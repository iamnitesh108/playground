//! Why a cache and not a map: memory growth of an unbounded HashMap vs a bounded moka cache, and what one read
//! costs (a cache hit, a map lookup, a Redis GET on localhost, recomputing the value). Prints JSON lines.
use moka::sync::Cache;
use std::alloc::{GlobalAlloc, Layout, System};
use std::collections::HashMap;
use std::hint::black_box;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;

/// Counts live heap bytes: Rust has no garbage collector, so this is exactly what is allocated right now.
struct Counting;
static LIVE: AtomicUsize = AtomicUsize::new(0);
unsafe impl GlobalAlloc for Counting {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        LIVE.fetch_add(layout.size(), Ordering::Relaxed);
        System.alloc(layout)
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        LIVE.fetch_sub(layout.size(), Ordering::Relaxed);
        System.dealloc(ptr, layout)
    }
}
#[global_allocator]
static GLOBAL: Counting = Counting;

const TOTAL: usize = 1_000_000;
const STEP: usize = 100_000;
const KEYS: usize = 10_000;

fn value_for(i: usize) -> String {
    format!("{{\"id\":{i},\"name\":\"user {i}\",\"email\":\"user{i}@example.com\",\"plan\":\"basic\"}}")
}

fn mb() -> f64 {
    LIVE.load(Ordering::Relaxed) as f64 / 1048576.0
}

fn report(kind: &str, inserted: usize, size: u64, mb: f64) {
    println!("{{\"t\":\"heap\",\"kind\":\"{kind}\",\"inserted\":{inserted},\"size\":{size},\"mb\":{mb:.1}}}");
}

// #region heap
fn growth(kind: &str, mut put: impl FnMut(String, Arc<String>), size: impl Fn() -> u64) {
    let base = mb();
    for i in 1..=TOTAL {
        put(format!("user:{i}"), Arc::new(value_for(i))); // every key is new: nothing is ever read twice
        if i % STEP == 0 {
            report(kind, i, size(), mb() - base);
        }
    }
}
// #endregion

fn median(mut xs: Vec<f64>) -> f64 {
    xs.sort_by(|a, b| a.partial_cmp(b).unwrap());
    xs[xs.len() / 2]
}

/// ns per call: runs f over the keys in batches and returns the median batch (after a warm-up).
fn per_call(mut f: impl FnMut(usize) -> bool, batch: usize, rounds: usize) -> f64 {
    let mut sink = 0usize;
    for i in 0..batch {
        sink += f(i % KEYS) as usize;
    }
    let mut samples = Vec::new();
    for _ in 0..rounds {
        let t0 = Instant::now();
        for i in 0..batch {
            sink += f(i % KEYS) as usize;
        }
        samples.push(t0.elapsed().as_nanos() as f64 / batch as f64);
    }
    black_box(sink);
    median(samples)
}

fn main() {
    {
        let map = std::cell::RefCell::new(HashMap::new()); // grows forever
        growth("map", |k, v| { map.borrow_mut().insert(k, v); }, || map.borrow().len() as u64);
    }
    {
        let cache: Cache<String, Arc<String>> = Cache::new(10_000); // stays at 10,000
        growth("cache", |k, v| cache.insert(k, v), || { cache.run_pending_tasks(); cache.entry_count() });
    }

    let keys: Vec<String> = (0..KEYS).map(|i| format!("user:{i}")).collect();
    let cache: Cache<String, Arc<String>> = Cache::new(KEYS as u64);
    let mut map = HashMap::new();
    for (i, k) in keys.iter().enumerate() {
        cache.insert(k.clone(), Arc::new(value_for(i)));
        map.insert(k.clone(), Arc::new(value_for(i)));
    }
    cache.run_pending_tasks();
    let cache_get = per_call(|i| cache.get(&keys[i]).is_some(), 1_000_000, 15);
    println!("{{\"t\":\"latency\",\"op\":\"cache-get\",\"ns\":{cache_get:.2}}}");
    let map_get = per_call(|i| black_box(map.get(&keys[i])).is_some(), 1_000_000, 15);
    println!("{{\"t\":\"latency\",\"op\":\"map-get\",\"ns\":{map_get:.2}}}");
    let compute = per_call(|i| !black_box(value_for(i)).is_empty(), 200_000, 15); // build the value again
    println!("{{\"t\":\"latency\",\"op\":\"compute\",\"ns\":{compute:.2}}}");

    let port = std::env::var("REDIS_PORT").unwrap_or_else(|_| "6379".into());
    let client = redis::Client::open(format!("redis://localhost:{port}")).unwrap();
    let mut conn = client.get_connection().unwrap();
    for (i, k) in keys.iter().enumerate() {
        redis::cmd("SET").arg(k).arg(value_for(i)).query::<()>(&mut conn).unwrap();
    }
    for i in 0..20_000 {
        let _: String = redis::cmd("GET").arg(&keys[i % KEYS]).query(&mut conn).unwrap(); // warm-up
    }
    let mut samples = Vec::with_capacity(20_000);
    for i in 0..20_000 {
        let t0 = Instant::now();
        let _: String = redis::cmd("GET").arg(&keys[i % KEYS]).query(&mut conn).unwrap(); // one round trip
        samples.push(t0.elapsed().as_nanos() as f64);
    }
    samples.sort_by(|a, b| a.partial_cmp(b).unwrap());
    println!("{{\"t\":\"latency\",\"op\":\"redis-get\",\"ns\":{:.0},\"p99\":{:.0}}}", samples[samples.len() / 2], samples[samples.len() * 99 / 100]);
}
