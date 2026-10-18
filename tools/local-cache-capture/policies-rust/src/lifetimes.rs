use moka::sync::Cache;
use moka::Expiry;
use serde_json::{json, Value};
use std::sync::Arc;
use std::thread::sleep;
use std::time::{Duration, Instant};

fn ms(start: Instant) -> u128 {
    start.elapsed().as_millis()
}

/// time_to_live without calling run_pending_tasks: an expired entry is invisible at once but removed later.
pub fn lazy() {
    let start = Instant::now();
    let cache: Cache<String, String> = Cache::builder()
        .max_capacity(100)
        .time_to_live(Duration::from_millis(200))
        .eviction_listener(move |key, _value, cause| {
            println!("{}", json!({ "t": ms(start), "event": "listener", "key": *key, "cause": format!("{cause:?}") }));
        })
        .build();
    let step = |op: &str, result: Value| println!("{}", json!({ "t": ms(start), "event": "op", "op": op, "result": result }));
    cache.insert("a".into(), "1".into());
    cache.insert("b".into(), "2".into());
    step("insert a and b", json!(cache.entry_count()));
    sleep(Duration::from_millis(100));
    step("get(a)", json!(cache.get("a")));
    sleep(Duration::from_millis(200)); // both are now past their 200 ms
    step("entry_count()", json!(cache.entry_count()));
    step("get(a)", json!(cache.get("a")));
    step("entry_count()", json!(cache.entry_count()));
    cache.run_pending_tasks();
    step("run_pending_tasks()", Value::Null);
    step("entry_count()", json!(cache.entry_count()));
}

/// An idle cache: nothing removes the expired entry until some later call runs the housekeeping.
pub fn idle() {
    let start = Instant::now();
    let cache: Cache<String, String> = Cache::builder()
        .max_capacity(100)
        .time_to_live(Duration::from_millis(200))
        .eviction_listener(move |key, _value, cause| {
            println!("{}", json!({ "event": "listener", "key": *key, "cause": format!("{cause:?}"), "afterMs": ms(start) }));
        })
        .build();
    cache.insert("k".into(), "v".into());
    sleep(Duration::from_millis(1000));
    println!("{}", json!({ "event": "op", "op": "idle for 1 s, then get(other)", "afterMs": ms(start) }));
    cache.get("other");
}

/// One entry read every 200 ms for a while, then left alone: time to live vs time to idle.
pub fn ttl_vs_tti() {
    let ttl: Cache<String, String> = Cache::builder().time_to_live(Duration::from_millis(500)).build();
    let tti: Cache<String, String> = Cache::builder().time_to_idle(Duration::from_millis(500)).build();
    ttl.insert("k".into(), "v".into());
    tti.insert("k".into(), "v".into());
    let start = Instant::now();
    for t in [200u64, 400, 600, 800, 1000, 1600] {
        sleep(Duration::from_millis(t).saturating_sub(start.elapsed()));
        println!("{}", json!({ "t": t, "timeToLive": ttl.get("k").is_some(), "timeToIdle": tti.get("k").is_some() }));
    }
}

/// A different lifetime per entry, chosen by an Expiry from the key.
struct ByKind;

impl Expiry<String, String> for ByKind {
    fn expire_after_create(&self, key: &String, _value: &String, _created_at: Instant) -> Option<Duration> {
        Some(lifetime(key))
    }
}

fn lifetime(key: &str) -> Duration {
    match key.split(':').next() {
        Some("price") => Duration::from_millis(300),
        Some("token") => Duration::from_millis(1500),
        _ => Duration::from_millis(3000),
    }
}

/// Real time: when is each entry removed if housekeeping runs every 50 ms?
pub fn per_entry() {
    let start = Instant::now();
    let cache: Cache<String, String> = Cache::builder()
        .expire_after(ByKind)
        .eviction_listener(move |key: Arc<String>, _value, cause| {
            println!("{}", json!({ "event": "removed", "key": *key, "afterMs": ms(start), "cause": format!("{cause:?}") }));
        })
        .build();
    for key in ["price:7", "token:42", "session:9"] {
        cache.insert(key.to_string(), "v".into());
        println!("{}", json!({ "event": "insert", "key": key, "ttlMs": lifetime(key).as_millis() }));
    }
    let mut visible = vec!["price:7", "token:42", "session:9"];
    while start.elapsed() < Duration::from_millis(4500) {
        sleep(Duration::from_millis(50));
        visible.retain(|key| {
            let still = cache.contains_key(*key);
            if !still {
                println!("{}", json!({ "event": "invisible", "key": key, "afterMs": ms(start) }));
            }
            still
        });
        cache.run_pending_tasks();
    }
}
