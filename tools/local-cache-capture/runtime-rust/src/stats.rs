//! moka keeps entry_count() and weighted_size(), but no hit/miss counters: this wrapper adds them.
use crate::out::*;
use moka::sync::Cache;
use std::sync::atomic::{AtomicU64, Ordering::Relaxed};
use std::sync::Arc;
use std::time::Instant;

// #region stats
pub struct CountingCache<K, V> {
    cache: Cache<K, V>,
    hits: AtomicU64,
    misses: AtomicU64,
    load_nanos: AtomicU64,
    evictions: Arc<AtomicU64>,
}

impl<K: std::hash::Hash + Eq + Send + Sync + 'static, V: Clone + Send + Sync + 'static> CountingCache<K, V> {
    pub fn new(max: u64) -> Self {
        let evictions = Arc::new(AtomicU64::new(0));
        let counter = evictions.clone();
        let cache = Cache::builder()
            .max_capacity(max)
            .eviction_listener(move |_k, _v, cause| if cause.was_evicted() { counter.fetch_add(1, Relaxed); })
            .build();
        Self { cache, hits: AtomicU64::new(0), misses: AtomicU64::new(0), load_nanos: AtomicU64::new(0), evictions }
    }

    /// Like get_with, but counts: entry().or_insert_with() tells whether this call loaded the value.
    pub fn get_with(&self, key: K, load: impl FnOnce() -> V) -> V {
        let entry = self.cache.entry(key).or_insert_with(|| {
            let t0 = Instant::now();
            let v = load();
            self.load_nanos.fetch_add(t0.elapsed().as_nanos() as u64, Relaxed);
            v
        });
        if entry.is_fresh() { self.misses.fetch_add(1, Relaxed) } else { self.hits.fetch_add(1, Relaxed) };
        entry.into_value()
    }
}
// #endregion

pub fn run() {
    let products = CountingCache::<u32, String>::new(1_000);
    for id in zipf_trace(20_000, 10_000, 0.99, 5) {
        products.get_with(id, || format!("product {id}"));
    }
    products.cache.run_pending_tasks();
    let (h, m) = (products.hits.load(Relaxed), products.misses.load(Relaxed));
    emit(vec![("exp", s("stats")), ("lib", s("moka")), ("requests", n(20_000)), ("keys", n(10_000)), ("maximumSize", n(1_000)),
        ("stats", J::O(vec![("requests", n((h + m) as f64)), ("hits", n(h as f64)), ("misses", n(m as f64)), ("hitRate", n(h as f64 / (h + m) as f64)),
            ("averageLoadMs", n(products.load_nanos.load(Relaxed) as f64 / m.max(1) as f64 / 1e6)), ("evictions", n(products.evictions.load(Relaxed) as f64)),
            ("entryCount", n(products.cache.entry_count() as f64)), ("weightedSize", n(products.cache.weighted_size() as f64))]))]);
}
