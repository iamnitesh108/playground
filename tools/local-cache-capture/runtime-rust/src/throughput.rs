//! Reads per second from 1, 2, 4 and 8 threads: moka against an LRU behind one Mutex.
use crate::out::*;
use moka::sync::Cache;
use std::collections::HashMap;
use std::num::NonZeroUsize;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Barrier, Mutex, RwLock};
use std::thread;
use std::time::{Duration, Instant};

const KEYS: usize = 1 << 16;
const TRACE: usize = 1 << 20;

/// Every thread reads keys from its own place in the Zipf trace until the time is up; returns reads/s.
fn measure(get: Arc<dyn Fn(u32) -> u64 + Send + Sync>, trace: Arc<Vec<u32>>, threads: usize, millis: u64) -> f64 {
    let stop = Arc::new(AtomicBool::new(false));
    let total = Arc::new(AtomicU64::new(0));
    let barrier = Arc::new(Barrier::new(threads + 1));
    let handles: Vec<_> = (0..threads)
        .map(|t| {
            let (get, trace, stop, total, barrier) = (get.clone(), trace.clone(), stop.clone(), total.clone(), barrier.clone());
            thread::spawn(move || {
                barrier.wait();
                let (mut i, mut count, mut sink) = (t * (TRACE / 8), 0u64, 0u64);
                while !stop.load(Ordering::Relaxed) {
                    for _ in 0..1024 {
                        sink = sink.wrapping_add(get(trace[i]));
                        i = (i + 1) & (TRACE - 1);
                    }
                    count += 1024;
                }
                total.fetch_add(count + (sink == 42) as u64, Ordering::Relaxed);
            })
        })
        .collect();
    barrier.wait();
    let t0 = Instant::now();
    thread::sleep(Duration::from_millis(millis));
    stop.store(true, Ordering::Relaxed);
    for h in handles { h.join().unwrap(); }
    total.load(Ordering::Relaxed) as f64 / t0.elapsed().as_secs_f64()
}

pub fn run() {
    let trace = Arc::new(zipf_trace(TRACE, KEYS, 0.99, 7));
    let moka: Cache<u32, u64> = Cache::new(2 * KEYS as u64);
    let lru = Arc::new(Mutex::new(lru::LruCache::<u32, u64>::new(NonZeroUsize::new(2 * KEYS).unwrap())));
    let map = Arc::new(RwLock::new(HashMap::<u32, u64>::new()));
    for k in 0..KEYS as u32 {
        moka.insert(k, k as u64);
        lru.lock().unwrap().put(k, k as u64);
        map.write().unwrap().insert(k, k as u64);
    }
    moka.run_pending_tasks();
    let caches: Vec<(&str, Arc<dyn Fn(u32) -> u64 + Send + Sync>)> = vec![
        ("moka", Arc::new(move |k| moka.get(&k).unwrap_or(0))),
        ("Mutex<lru::LruCache>", { let l = lru.clone(); Arc::new(move |k| *l.lock().unwrap().get(&k).unwrap_or(&0)) }),
        ("RwLock<HashMap> (no bound, no policy)", { let m = map.clone(); Arc::new(move |k| *m.read().unwrap().get(&k).unwrap_or(&0)) }),
    ];
    let cores = thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
    for (name, get) in caches {
        for threads in [1usize, 2, 4, 8] {
            measure(get.clone(), trace.clone(), threads, 300); // warm-up
            let mut runs: Vec<f64> = (0..5).map(|_| measure(get.clone(), trace.clone(), threads, 200)).collect();
            emit(vec![("exp", s("throughput")), ("lib", s(name)), ("threads", n(threads as u32)), ("readsPerSec", n(median(&mut runs).round())),
                ("runs", n(5)), ("cores", n(cores as u32))]);
        }
    }
}
