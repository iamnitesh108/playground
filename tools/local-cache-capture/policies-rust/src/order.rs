use moka::notification::RemovalCause;
use moka::sync::Cache;
use serde_json::json;
use std::sync::{Arc, Mutex};

/// A few requests against a tiny cache: after each one, what was evicted and what is left.
pub fn run(args: &[String]) {
    let max: u64 = args[0].parse().unwrap();
    let evicted = Arc::new(Mutex::new(Vec::<String>::new()));
    let sink = Arc::clone(&evicted);
    let cache: Cache<String, String> = Cache::builder()
        .max_capacity(max)
        .eviction_listener(move |key: Arc<String>, _value, cause| {
            if cause == RemovalCause::Size {
                sink.lock().unwrap().push((*key).clone());
            }
        })
        .build();
    for (i, key) in args[1..].iter().enumerate() {
        let hit = cache.get(key).is_some();
        if !hit {
            cache.insert(key.clone(), key.clone());
        }
        cache.run_pending_tasks(); // apply the batched reads and writes now, so the listener has fired
        let mut contents: Vec<String> = cache.iter().map(|(k, _)| (*k).clone()).collect();
        contents.sort();
        let gone: Vec<String> = evicted.lock().unwrap().drain(..).collect();
        println!("{}", json!({ "lib": "moka", "step": i + 1, "key": key, "hit": hit, "evicted": gone, "contents": contents }));
    }
}
