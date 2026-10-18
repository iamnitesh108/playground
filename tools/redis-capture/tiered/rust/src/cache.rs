use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures::StreamExt;
use moka::future::Cache;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use tokio_postgres::Client;

pub const CHANNEL: &str = "cache:invalidate";

const PAGE: &str = "
    SELECT p.id, p.name, p.price_cents, p.version,
           coalesce(avg(r.stars), 0)::float8 AS rating, count(r.product_id) AS reviews
    FROM products p LEFT JOIN reviews r ON r.product_id = p.id
    WHERE p.id = $1
    GROUP BY p.id";

/// One product page: the row plus its review summary (an aggregate query in Postgres).
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Product {
    pub id: i32,
    pub name: String,
    pub price_cents: i32,
    pub version: i32,
    pub rating: f64,
    pub reviews: i64,
}

/// Which level answered a read.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug)]
pub enum Level { L1, L2, PG }

/// Product pages through three levels: moka in this process (L1), Redis shared by every
/// instance (L2), Postgres
/// (the source of truth). Reads fall through and fill the levels on the way back; writes go to
/// Postgres, delete the
/// Redis copy and tell every instance, over Pub/Sub, to drop its L1 copy.
pub struct TieredProductCache {
    l1: Cache<i32, Product>,
    redis: redis::aio::MultiplexedConnection,
    db: Arc<Client>,
    l2_ttl_seconds: u64,
    pub queries: AtomicU64,
}

impl TieredProductCache {
    pub fn new(db: Arc<Client>, redis: redis::aio::MultiplexedConnection, l1_ttl: Duration) -> Self {
        TieredProductCache { l1: Self::new_l1(l1_ttl), redis, db, l2_ttl_seconds: 300, queries: AtomicU64::new(0) }
    }

    fn new_l1(ttl: Duration) -> Cache<i32, Product> {
        // a short TTL is the safety net if an invalidation message is ever missed
        Cache::builder().max_capacity(1000).time_to_live(ttl).build()
    }

    /// Drops L1 copies whenever any instance publishes an invalidation; calls `on_evict` for
    /// each.
    pub async fn listen(
        self: &Arc<Self>,
        client: &redis::Client,
        on_evict: impl Fn(&str) + Send + 'static,
    ) -> redis::RedisResult<()> {
        let mut pubsub = client.get_async_pubsub().await?;
        pubsub.subscribe(CHANNEL).await?;
        let me = Arc::clone(self);
        tokio::spawn(async move {
            let mut messages = pubsub.on_message();
            while let Some(message) = messages.next().await {
                let key: String = message.get_payload().unwrap_or_default();
                if let Ok(id) = key.trim_start_matches("product:").parse::<i32>() {
                    me.l1.invalidate(&id).await;
                }
                on_evict(&key);
            }
        });
        Ok(())
    }

    /// L1 → L2 → Postgres. moka's get_with runs the loader once per key even when many tasks
    /// ask at the same
    /// moment (the others wait for it): a stampede on one instance becomes a single
    /// Redis/Postgres read.
    pub async fn get(&self, id: i32) -> (Product, Level) {
        let mut level = Level::L1;
        let product = self.l1.get_with(id, async {
            let (p, l) = self.load_below_l1(id).await;
            level = l;
            p
        }).await;
        (product, level)
    }

    /// The same read without single-flight: every caller that misses loads on its own.
    pub async fn get_uncoalesced(&self, id: i32) -> (Product, Level) {
        if let Some(p) = self.l1.get(&id).await {
            return (p, Level::L1);
        }
        let (p, l) = self.load_below_l1(id).await;
        self.l1.insert(id, p.clone()).await;
        (p, l)
    }

    /// Redis only: the classic single-level cache-aside, for comparison.
    pub async fn get_redis_only(&self, id: i32) -> (Product, Level) {
        self.load_below_l1(id).await
    }

    /// No cache at all: every read is a Postgres query, for comparison.
    pub async fn get_from_database(&self, id: i32) -> (Product, Level) {
        (self.load(id).await, Level::PG)
    }

    async fn load_below_l1(&self, id: i32) -> (Product, Level) {
        let key = format!("product:{id}");
        let mut redis = self.redis.clone();
        if let Ok(Some(hit)) = redis.get::<_, Option<String>>(&key).await {
            return (serde_json::from_str(&hit).expect("cached product"), Level::L2);
        }
        let product = self.load(id).await;
        let value = serde_json::to_string(&product).unwrap();
        let _: () = redis.set_ex(&key, value, self.l2_ttl_seconds).await.expect("redis set");
        (product, Level::PG)
    }

    async fn load(&self, id: i32) -> Product {
        self.queries.fetch_add(1, Ordering::Relaxed);
        let r = self.db.query_one(PAGE, &[&id]).await.expect("product page");
        Product { id: r.get(0), name: r.get(1), price_cents: r.get(2), version: r.get(3), rating: r.get(4), reviews: r.get(5) }
    }

    /// The write path: Postgres first, then delete (not update) the Redis copy, then tell every
    /// instance to drop
    /// its L1 copy. With publish = false the last step is skipped, to show what an instance
    /// without it serves.
    pub async fn update_price(&self, id: i32, price_cents: i32, publish: bool) -> i32 {
        let row = self.db
            .query_one(
                "UPDATE products SET price_cents = $1, version = version + 1 WHERE id = $2 RETURNING version",
                &[&price_cents, &id],
            )
            .await
            .expect("update");
        let key = format!("product:{id}");
        let mut redis = self.redis.clone();
        let _: () = redis.del(&key).await.expect("redis del");
        if publish {
            let _: () = redis.publish(CHANNEL, &key).await.expect("redis publish");
        }
        row.get(0)
    }

    /// Makes a product cold in both caches of this instance.
    pub async fn forget(&self, id: i32) {
        self.l1.invalidate(&id).await;
        let mut redis = self.redis.clone();
        let _: () = redis.del(format!("product:{id}")).await.expect("redis del");
    }

    pub fn clear_l1(&self) {
        self.l1.invalidate_all();
    }
}
