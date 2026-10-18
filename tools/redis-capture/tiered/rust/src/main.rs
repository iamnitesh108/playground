//! Reads commands from stdin and prints one JSON line per event, so a script can drive two
//! instances side by side:
//!   get ID · update ID PRICE · update-silent ID PRICE · clear-l1 · bench pg|redis|tiered N ·
//! stampede N on|off · quit
mod cache;
mod zipf;

use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};

use cache::{Level, TieredProductCache};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};
use zipf::Zipf;

fn print(instance: &str, mut event: Value) {
    event.as_object_mut().unwrap().insert("inst".into(), json!(instance));
    println!("{event}");
}

fn ms(since: Instant) -> f64 {
    (since.elapsed().as_secs_f64() * 1e6).round() / 1e3
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let instance: Arc<str> = std::env::var("INSTANCE").unwrap_or_else(|_| "A".into()).into();
    let redis_url = std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
    let pg_url = std::env::var("PG_URL").unwrap_or_else(|_| "host=localhost user=shop dbname=shop".into());
    let l1_ttl = Duration::from_millis(std::env::var("L1_TTL_MS").ok().and_then(|v| v.parse().ok()).unwrap_or(10_000));

    let (db, connection) = tokio_postgres::connect(&pg_url, tokio_postgres::NoTls).await?;
    tokio::spawn(connection);
    let client = redis::Client::open(redis_url)?;
    let cache = Arc::new(TieredProductCache::new(Arc::new(db), client.get_multiplexed_async_connection().await?, l1_ttl));
    let evict_instance = Arc::clone(&instance);
    cache.listen(&client, move |key| print(&evict_instance, json!({ "ev": "evict", "key": key, "reason": "pubsub" }))).await?;

    print(&instance, json!({ "ev": "ready" }));
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    while let Some(line) = lines.next_line().await? {
        let a: Vec<&str> = line.split_whitespace().collect();
        match a.first().copied() {
            Some("get") => {
                let t = Instant::now();
                let (p, level) = cache.get(a[1].parse()?).await;
                print(&instance, json!({ "ev": "get", "key": format!("product:{}", a[1]), "served": format!("{level:?}"), "ms": ms(t), "version": p.version, "price": p.price_cents }));
            }
            Some(cmd @ ("update" | "update-silent")) => {
                let t = Instant::now();
                let version = cache.update_price(a[1].parse()?, a[2].parse()?, cmd == "update").await;
                print(&instance, json!({ "ev": "update", "key": format!("product:{}", a[1]), "price": a[2].parse::<i32>()?, "version": version, "publish": cmd == "update", "ms": ms(t) }));
            }
            Some("clear-l1") => {
                cache.clear_l1();
                print(&instance, json!({ "ev": "clear-l1" }));
            }
            Some("bench") => bench(&cache, &instance, a[1], a[2].parse()?).await,
            Some("stampede") => stampede(&cache, &instance, a[1].parse()?, a[2] == "on").await,
            Some("quit") => break,
            _ => print(&instance, json!({ "ev": "error", "message": format!("unknown command {line}") })),
        }
    }
    std::process::exit(0)
}

/// N reads of Zipf-distributed products through one strategy; where each was served and how
/// long it took.
async fn bench(cache: &Arc<TieredProductCache>, instance: &str, mode: &str, n: usize) {
    cache.clear_l1();
    let mut zipf = Zipf::new(10_000, 1.1, 42);
    let mut served: HashMap<Level, usize> = HashMap::new();
    let mut micros = Vec::with_capacity(n);
    let before = cache.queries.load(Ordering::Relaxed);
    let start = Instant::now();
    for _ in 0..n {
        let id = zipf.next();
        let t = Instant::now();
        let (_, level) = match mode {
            "pg" => cache.get_from_database(id).await,
            "redis" => cache.get_redis_only(id).await,
            _ => cache.get(id).await,
        };
        micros.push(t.elapsed().as_secs_f64() * 1e6);
        *served.entry(level).or_default() += 1;
    }
    let seconds = start.elapsed().as_secs_f64();
    micros.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let round = |v: f64| (v * 10.0).round() / 10.0;
    print(instance, json!({
        "ev": "bench", "mode": mode, "n": n,
        "l1": served.get(&Level::L1).copied().unwrap_or(0), "l2": served.get(&Level::L2).copied().unwrap_or(0), "pg": served.get(&Level::PG).copied().unwrap_or(0),
        "pgQueries": cache.queries.load(Ordering::Relaxed) - before,
        "p50us": round(micros[n / 2]), "p95us": round(micros[n * 95 / 100]), "p99us": round(micros[n * 99 / 100]),
        "avgUs": round(micros.iter().sum::<f64>() / n as f64), "readsPerSec": (n as f64 / seconds).round(),
    }));
}

/// N concurrent requests for the same cold product; how many of them reached Postgres.
async fn stampede(cache: &Arc<TieredProductCache>, instance: &str, n: usize, coalesce: bool) {
    cache.forget(7).await;
    let before = cache.queries.load(Ordering::Relaxed);
    let t = Instant::now();
    let tasks: Vec<_> = (0..n).map(|_| {
        let cache = Arc::clone(cache);
        tokio::spawn(async move { if coalesce { cache.get(7).await } else { cache.get_uncoalesced(7).await } })
    }).collect();
    for task in tasks { task.await.unwrap(); }
    print(instance, json!({ "ev": "stampede", "n": n, "coalesce": coalesce, "pgQueries": cache.queries.load(Ordering::Relaxed) - before, "ms": ms(t) }));
}
