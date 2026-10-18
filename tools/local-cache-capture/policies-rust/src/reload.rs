use moka::sync::Cache;
use serde_json::json;
use std::sync::atomic::{AtomicU32, Ordering};
use std::thread::sleep;
use std::time::{Duration, Instant};

/// One reader asks for the same key every 100 ms; loading takes 200 ms; entries live 1 s. moka has no
/// refresh-after-write, so after expiry the next get_with waits for the load.
pub fn run() {
    let start = Instant::now();
    let version = AtomicU32::new(0);
    let cache: Cache<String, u32> = Cache::builder().time_to_live(Duration::from_millis(1000)).build();
    for i in 0..=30u64 {
        sleep(Duration::from_millis(i * 100).saturating_sub(start.elapsed()));
        let at = Instant::now();
        let value = cache.get_with("price:7".to_string(), || {
            let from = start.elapsed().as_millis();
            sleep(Duration::from_millis(200)); // the database query
            let v = version.fetch_add(1, Ordering::SeqCst) + 1;
            println!("{}", json!({ "mode": "time_to_live", "event": "load", "from": from, "to": start.elapsed().as_millis(), "version": v }));
            v
        });
        println!("{}", json!({ "mode": "time_to_live", "event": "read", "at": start.elapsed().as_millis(),
            "ms": at.elapsed().as_secs_f64() * 1000.0, "version": value }));
    }
}
