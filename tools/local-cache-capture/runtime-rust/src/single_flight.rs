//! Many callers, one missing key: who calls the loader, how long everyone waits, and what failures do.
use crate::out::*;
use moka::sync::Cache;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier};
use std::thread;
use std::time::{Duration, Instant};

const CALLERS: usize = 50;
const LOADER_MS: u64 = 200;

/// The slow source of truth: 200 ms per call.
fn load(calls: &AtomicUsize, key: &str) -> String {
    calls.fetch_add(1, Ordering::SeqCst);
    thread::sleep(Duration::from_millis(LOADER_MS));
    format!("price of {key}")
}

// #region naive
// --- naive: check, load, insert ---
fn naive_get(cache: &Cache<String, String>, calls: &AtomicUsize, key: &str) -> String {
    if let Some(v) = cache.get(key) {
        return v;
    }
    let v = load(calls, key); // every caller that missed runs this
    cache.insert(key.to_string(), v.clone());
    v
}
// #endregion

// #region singleflight
// --- single-flight: get_with runs one init per key; the other callers wait for it ---
fn single_flight_get(cache: &Cache<String, String>, calls: &AtomicUsize, key: &str) -> String {
    cache.get_with(key.to_string(), || load(calls, key))
}
// #endregion

/// Starts every caller at the same moment (a barrier) and returns what each one waited, in ms.
fn together<F: Fn() + Send + Sync + 'static>(callers: usize, call: F) -> Vec<f64> {
    let call = Arc::new(call);
    let barrier = Arc::new(Barrier::new(callers));
    let handles: Vec<_> = (0..callers)
        .map(|_| {
            let (call, barrier) = (call.clone(), barrier.clone());
            thread::spawn(move || {
                barrier.wait();
                let t0 = Instant::now();
                call();
                t0.elapsed().as_secs_f64() * 1000.0
            })
        })
        .collect();
    handles.into_iter().map(|h| h.join().unwrap()).collect()
}

fn stampede(mode: &str, single_flight: bool) {
    let cache: Cache<String, String> = Cache::new(1_000);
    let calls = Arc::new(AtomicUsize::new(0));
    let (c, k) = (cache.clone(), calls.clone());
    let waits = together(CALLERS, move || {
        if single_flight { single_flight_get(&c, &k, "product:42") } else { naive_get(&c, &k, "product:42") };
    });
    emit(vec![("exp", s("stampede")), ("lib", s("moka")), ("mode", s(mode)), ("callers", n(CALLERS as u32)), ("loaderMs", n(LOADER_MS as u32)),
        ("loaderCalls", n(calls.load(Ordering::SeqCst) as u32)), ("waits", nums(waits)), ("errors", n(0))]);
}

/// moka::future: the same with async tasks on tokio instead of threads.
fn future_stampede() {
    let rt = tokio::runtime::Builder::new_multi_thread().enable_all().build().unwrap();
    rt.block_on(async {
        // #region future
        let cache: moka::future::Cache<String, String> = moka::future::Cache::new(1_000);
        let calls = Arc::new(AtomicUsize::new(0));
        let tasks: Vec<_> = (0..CALLERS)
            .map(|_| {
                let (cache, calls) = (cache.clone(), calls.clone());
                tokio::spawn(async move {
                    let t0 = Instant::now();
                    cache
                        .get_with("product:42".to_string(), async {
                            calls.fetch_add(1, Ordering::SeqCst);
                            tokio::time::sleep(Duration::from_millis(LOADER_MS)).await;
                            "price of product:42".to_string()
                        })
                        .await;
                    t0.elapsed().as_secs_f64() * 1000.0
                })
            })
            .collect();
        // #endregion
        let mut waits = vec![];
        for t in tasks {
            waits.push(t.await.unwrap());
        }
        emit(vec![("exp", s("stampede")), ("lib", s("moka")), ("mode", s("future::Cache get_with")), ("callers", n(CALLERS as u32)),
            ("loaderMs", n(LOADER_MS as u32)), ("loaderCalls", n(calls.load(Ordering::SeqCst) as u32)), ("waits", nums(waits)), ("errors", n(0))]);
    });
}

/// The loader fails after 100 ms: try_get_with hands every waiter the same Arc'd error.
fn failure() {
    let cache: Cache<String, String> = Cache::new(1_000);
    let calls = Arc::new(AtomicUsize::new(0));
    let errors = Arc::new(std::sync::Mutex::new(Vec::<Arc<String>>::new()));
    let (c, k, e) = (cache.clone(), calls.clone(), errors.clone());
    let t0 = Instant::now();
    let waits = together(10, move || {
        // #region failing
        let r = c.try_get_with("product:42".to_string(), || -> Result<String, String> {
            k.fetch_add(1, Ordering::SeqCst);
            thread::sleep(Duration::from_millis(100));
            Err("database timeout".to_string())
        });
        // #endregion
        if let Err(err) = r {
            e.lock().unwrap().push(err);
        }
    });
    let errs = errors.lock().unwrap();
    let shared = errs.iter().filter(|x| Arc::ptr_eq(x, &errs[0])).count();
    emit(vec![("exp", s("failure")), ("lib", s("moka")), ("mode", s("try_get_with")), ("callers", n(10)), ("loaderCalls", n(calls.load(Ordering::SeqCst) as u32)),
        ("errors", n(errs.len() as u32)), ("error", s(format!("Arc<String>: {}", errs[0]))), ("sameErrorArc", n(shared as u32)),
        ("cachedAfter", J::B(cache.contains_key("product:42"))), ("waits", nums(waits)), ("totalMs", n(t0.elapsed().as_secs_f64() * 1000.0))]);
}

/// A product that does not exist, read three times: None is not stored; Option<V> as the value is.
fn absent() {
    // #region absent
    let calls = AtomicUsize::new(0);
    let plain: Cache<String, String> = Cache::new(1_000);
    for _ in 0..3 {
        plain.optionally_get_with("product:999".to_string(), || { calls.fetch_add(1, Ordering::SeqCst); None });
    }
    let neg_calls = AtomicUsize::new(0);
    let negative: Cache<String, Option<String>> = Cache::builder().max_capacity(1_000).time_to_live(Duration::from_secs(30)).build();
    for _ in 0..3 {
        negative.get_with("product:999".to_string(), || { neg_calls.fetch_add(1, Ordering::SeqCst); None });
    }
    // #endregion
    plain.run_pending_tasks();
    negative.run_pending_tasks();
    emit(vec![("exp", s("absent")), ("lib", s("moka")), ("reads", n(3)), ("nullLoaderCalls", n(calls.load(Ordering::SeqCst) as u32)),
        ("nullSize", n(plain.entry_count() as f64)), ("optionalLoaderCalls", n(neg_calls.load(Ordering::SeqCst) as u32)), ("optionalSize", n(negative.entry_count() as f64))]);
}

/// get_with for a key, whose init calls get_with for the same key.
fn recursive() {
    let cache: Cache<String, String> = Cache::new(1_000);
    let (tx, rx) = std::sync::mpsc::channel();
    thread::spawn(move || {
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            // #region recursive
            cache.get_with("product:42".to_string(), || cache.get_with("product:42".to_string(), || "inner".to_string()))
            // #endregion
        }));
        let _ = tx.send(match r {
            Ok(v) => format!("returned {v}"),
            Err(p) => format!("panicked: {}", p.downcast_ref::<String>().cloned().or(p.downcast_ref::<&str>().map(|s| s.to_string())).unwrap_or_default()),
        });
    });
    let result = rx.recv_timeout(Duration::from_secs(3)).unwrap_or_else(|_| "no answer after 3 s (thread stuck)".to_string());
    emit(vec![("exp", s("recursive")), ("lib", s("moka")), ("result", s(result))]);
}

pub fn run() {
    stampede("naive", false);
    stampede("get_with", true);
    future_stampede();
    failure();
    absent();
    recursive();
}
