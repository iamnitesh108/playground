//! One thread, the same workload as the Java and TypeScript apps: 65,536 integer keys with Zipf popularity.
//! get = reads that hit; put = writes into a cache half that size, so it evicts as it goes.
use crate::out::*;
use moka::sync::Cache;
use std::time::Instant;

const KEYS: usize = 1 << 16;
const TRACE: usize = 1 << 20;

fn report(op: &str, mut pass: impl FnMut() -> u64) {
    for _ in 0..5 { std::hint::black_box(pass()); }
    let mut rates: Vec<f64> = (0..7)
        .map(|_| {
            let t0 = Instant::now();
            std::hint::black_box(pass());
            TRACE as f64 / t0.elapsed().as_secs_f64()
        })
        .collect();
    emit(vec![("exp", s("bench")), ("lib", s("moka")), ("op", s(op)), ("opsPerSec", n(median(&mut rates).round())), ("passes", n(7))]);
}

pub fn run() {
    let trace = zipf_trace(TRACE, KEYS, 0.99, 7);
    let full: Cache<u32, u64> = Cache::new(2 * KEYS as u64);
    for k in 0..KEYS as u32 { full.insert(k, k as u64); }
    full.run_pending_tasks();
    let half: Cache<u32, u64> = Cache::new(KEYS as u64 / 2);
    report("get", || trace.iter().map(|k| full.get(k).unwrap_or(0)).sum());
    report("put", || {
        for (i, k) in trace.iter().enumerate() { half.insert(*k, i as u64); }
        half.entry_count()
    });
}
