use moka::policy::EvictionPolicy;
use moka::sync::Cache;
use serde_json::json;
use std::path::Path;

/// Replays a trace file (one integer key per line) through moka at several max capacities, with its default
/// TinyLFU policy and with plain LRU. Each request is a read; a miss is followed by an insert.
pub fn run(args: &[String]) {
    let path = Path::new(&args[0]);
    let keys: Vec<u32> = std::fs::read_to_string(path)
        .expect("trace")
        .lines()
        .map(|l| l.parse().expect("key"))
        .collect();
    let trace = path.file_stem().unwrap().to_string_lossy().to_string();
    for size in args[1..].iter().map(|s| s.parse::<u64>().unwrap()) {
        for (name, policy) in [("moka", EvictionPolicy::tiny_lfu()), ("moka-lru", EvictionPolicy::lru())] {
            let cache: Cache<u32, u32> = Cache::builder()
                .max_capacity(size)
                .eviction_policy(policy)
                .build();
            let mut hits = 0u64;
            for &key in &keys {
                if cache.get(&key).is_some() {
                    hits += 1;
                } else {
                    cache.insert(key, key);
                }
            }
            println!("{}", json!({ "lib": name, "trace": trace, "size": size, "requests": keys.len(), "hits": hits }));
        }
    }
}
