//! Bytes per entry (counted by the allocator) and a cache bounded by weight.
use crate::alloc::live;
use crate::out::*;
use moka::notification::RemovalCause;
use moka::sync::Cache;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const N: u64 = 1_000_000;

fn measure(name: &str, fill: impl FnOnce() -> Box<dyn std::any::Any>) {
    let before = live();
    let kept = fill();
    let after = live();
    emit(vec![("exp", s("footprint")), ("lib", s("rust")), ("structure", s(name)), ("n", n(N as f64)), ("bytesPerEntry", n((after - before) as f64 / N as f64))]);
    drop(kept);
}

pub fn footprint() {
    // keys and values are u64: stored inline, no allocation of their own
    measure("HashMap", || {
        let mut m = HashMap::new();
        for k in 0..N { m.insert(k, k); }
        Box::new(m)
    });
    measure("moka, max_capacity", || {
        let c: Cache<u64, u64> = Cache::new(N);
        for k in 0..N { c.insert(k, k); }
        c.run_pending_tasks();
        Box::new(c)
    });
    measure("moka, max_capacity + time_to_live", || {
        let c: Cache<u64, u64> = Cache::builder().max_capacity(N).time_to_live(Duration::from_secs(600)).build();
        for k in 0..N { c.insert(k, k); }
        c.run_pending_tasks();
        Box::new(c)
    });
    // a typical key and value: what they cost on their own
    let before = live();
    let keys: Vec<String> = (0..N).map(|i| format!("product:{}", 100_000 + i)).collect();
    let key_bytes = (live() - before) as f64 / N as f64;
    emit(vec![("exp", s("objects")), ("lib", s("rust")), ("n", n(N as f64)), ("stringKeyHeap", n(key_bytes)),
        ("stringStruct", n(std::mem::size_of::<String>() as f64))]);
    drop(keys);
}

/// A cache bounded by bytes: a weigher plus max_capacity, with an eviction listener.
pub fn weight() {
    // #region weight
    let evicted = Arc::new(Mutex::new(Vec::<String>::new()));
    let log = evicted.clone();
    let cache: Cache<String, Arc<Vec<u8>>> = Cache::builder()
        .max_capacity(1_000_000)                                       // 1 MB budget
        .weigher(|_key: &String, value: &Arc<Vec<u8>>| value.len() as u32) // weigh each entry by its bytes
        .eviction_listener(move |key, _value, cause: RemovalCause| log.lock().unwrap().push(format!("{key} ({cause:?})")))
        .build();
    // #endregion
    let steps: [(&str, &str, usize); 11] = [
        ("put", "a", 300_000), ("put", "b", 300_000), ("get", "a", 0), ("get", "a", 0), ("put", "c", 300_000),
        ("put", "d", 200_000), ("put", "d", 200_000), ("put", "e", 400_000), ("put", "e", 400_000),
        ("put", "e", 400_000), ("put", "huge", 2_000_000),
    ];
    for (op, key, bytes) in steps {
        if op == "put" { cache.insert(key.to_string(), Arc::new(vec![0u8; bytes])); } else { cache.get(key); }
        cache.run_pending_tasks();
        let mut present: Vec<String> = cache.iter().map(|(k, _)| k.to_string()).collect();
        present.sort();
        let ev: Vec<String> = evicted.lock().unwrap().drain(..).collect();
        emit(vec![("exp", s("weight")), ("lib", s("moka")), ("op", s(op)), ("key", s(key)), ("bytes", n(bytes as f64)),
            ("present", strs(present)), ("weightedSize", n(cache.weighted_size() as f64)), ("evicted", strs(ev))]);
    }
}
