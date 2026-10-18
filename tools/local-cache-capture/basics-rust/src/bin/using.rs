//! The everyday moka API, one section per task. Each section prints "## <name>" and then what happened.
use moka::notification::RemovalCause;
use moka::sync::Cache;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug)]
struct Product {
    name: String,
    price_cents: u32,
}

static LOADS: AtomicUsize = AtomicUsize::new(0);

fn load_product(id: &str) -> Product {
    LOADS.fetch_add(1, Ordering::SeqCst);
    Product { name: format!("Product {id}"), price_cents: 1000 + id[1..].parse::<u32>().unwrap() }
}

fn section(name: &str) {
    println!("## {name}");
}

fn show(p: &Option<Product>) -> String {
    p.as_ref().map_or("None".into(), |p| format!("{} ({})", p.name, p.price_cents))
}

#[tokio::main]
async fn main() {
    section("build");
    // #region build
    let cache: Cache<String, Product> = Cache::builder()
        .max_capacity(100) // at most 100 entries
        .time_to_live(Duration::from_secs(10 * 60)) // each entry lives 10 minutes
        .build();
    // #endregion
    println!("entry_count() = {}", cache.entry_count());

    section("get-put");
    // #region get-put
    println!("get(\"p1\") = {}", show(&cache.get("p1"))); // a miss: None
    cache.insert("p1".to_string(), load_product("p1"));
    println!("get(\"p1\") = {}", show(&cache.get("p1"))); // a hit (a clone of the value)
    println!("contains_key(\"p2\") = {}", cache.contains_key("p2"));
    // #endregion

    section("loader");
    // #region loader
    // get_with(key, init): returns the cached value, or runs init once (other callers for the key wait for it).
    LOADS.store(0, Ordering::SeqCst);
    cache.get_with("p7".to_string(), || load_product("p7"));
    cache.get_with("p7".to_string(), || load_product("p7"));
    println!("two calls for p7 → loader ran {} time(s)", LOADS.load(Ordering::SeqCst));
    // #endregion

    section("invalidate");
    // #region invalidate
    cache.insert("p2".to_string(), load_product("p2"));
    cache.invalidate("p2"); // one key
    cache.run_pending_tasks(); // counts are updated by maintenance
    println!("after invalidate(\"p2\"): entry_count() = {}", cache.entry_count());
    cache.invalidate_all(); // everything
    cache.run_pending_tasks();
    println!("after invalidate_all(): entry_count() = {}", cache.entry_count());
    // #endregion

    section("bulk");
    // #region bulk
    for id in ["p1", "p2", "p3"] {
        cache.insert(id.to_string(), load_product(id));
    }
    // No get_all: ask key by key, loading the misses.
    LOADS.store(0, Ordering::SeqCst);
    let wanted = ["p1", "p3", "p9"];
    let all: Vec<Product> = wanted.iter().map(|id| cache.get_with(id.to_string(), || load_product(id))).collect();
    println!("got {} products, loader ran {} time(s)", all.len(), LOADS.load(Ordering::SeqCst));
    // #endregion

    section("iterate");
    // #region iterate
    println!("entry_count() before maintenance = {}", cache.entry_count());
    cache.run_pending_tasks();
    println!("entry_count() after run_pending_tasks() = {}", cache.entry_count());
    let mut ids: Vec<String> = cache.iter().map(|(id, product)| format!("{id} → {}", product.name)).collect();
    ids.sort(); // iter() has no defined order
    for line in ids {
        println!("{line}");
    }
    // #endregion

    section("loading");
    // #region loading
    // No loading-cache type: wrap the cache and its loader in your own function.
    fn product(cache: &Cache<String, Product>, id: &str) -> Product {
        cache.get_with(id.to_string(), || load_product(id))
    }
    LOADS.store(0, Ordering::SeqCst);
    product(&cache, "p4");
    product(&cache, "p4");
    println!("product(\"p4\") twice → loader ran {} time(s)", LOADS.load(Ordering::SeqCst));
    // #endregion

    section("async");
    // #region async
    // moka::future::Cache: the same API with async loaders; concurrent callers share one in-flight load.
    let remote: moka::future::Cache<String, Product> = moka::future::Cache::new(100);
    LOADS.store(0, Ordering::SeqCst);
    let load = || async {
        tokio::time::sleep(Duration::from_millis(20)).await; // a slow source
        load_product("p5")
    };
    let (a, b, c) = tokio::join!(
        remote.get_with("p5".to_string(), load()),
        remote.get_with("p5".to_string(), load()),
        remote.get_with("p5".to_string(), load()),
    );
    println!(
        "3 concurrent get_with(\"p5\") → {} | {} | {}; loader ran {} time(s)",
        show(&Some(a)), show(&Some(b)), show(&Some(c)), LOADS.load(Ordering::SeqCst)
    );
    // #endregion

    section("removal");
    // #region removal
    let small: Cache<&str, &str> = Cache::builder()
        .max_capacity(2)
        .time_to_live(Duration::from_millis(200)) // no fake clock in moka: a short real TTL
        .eviction_listener(|key: Arc<&str>, value: &str, cause: RemovalCause| {
            println!("removed {key}={value} ({cause:?})")
        })
        .build();
    small.insert("a", "v1");
    small.insert("a", "v2"); // replaces v1
    small.insert("b", "v1");
    small.invalidate("b");
    small.insert("c", "v1");
    small.insert("d", "v1"); // a third entry in a cache of 2
    small.run_pending_tasks(); // listeners run during maintenance
    std::thread::sleep(Duration::from_millis(300));
    small.run_pending_tasks();
    // #endregion

    section("stats");
    // #region stats
    // No statistics in moka 0.12: count hits and misses yourself.
    let (mut hits, mut misses) = (0, 0);
    for id in ["p1", "p1", "p2", "p3", "p404"] {
        match cache.get(id) {
            Some(_) => hits += 1,
            None => misses += 1,
        }
    }
    println!("hits = {hits}, misses = {misses}, hit ratio = {:.2}", hits as f64 / (hits + misses) as f64);
    // #endregion
}
