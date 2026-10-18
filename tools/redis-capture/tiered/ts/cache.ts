import { Redis } from 'ioredis'
import { LRUCache } from 'lru-cache'
import pg from 'pg'

export interface Product {
  id: number
  name: string
  priceCents: number
  version: number
  rating: number
  reviews: number
}

export type Level = 'L1' | 'L2' | 'PG'
export interface Read {
  product: Product
  level: Level
}

export const CHANNEL = 'cache:invalidate'

const PAGE = `
  SELECT p.id, p.name, p.price_cents, p.version,
         coalesce(avg(r.stars), 0)::float8 AS rating, count(r.product_id)::int AS reviews
  FROM products p LEFT JOIN reviews r ON r.product_id = p.id
  WHERE p.id = $1
  GROUP BY p.id`

/**
 * Product pages through three levels: an LRU in this process (L1), Redis shared by every
 * instance (L2), Postgres
 * (the source of truth). Reads fall through and fill the levels on the way back; writes go to
 * Postgres, delete the
 * Redis copy and tell every instance, over Pub/Sub, to drop its L1 copy.
 */
export class TieredProductCache {
  private l1: LRUCache<number, Product>
  /** Loads in progress, per product: concurrent misses on one instance share one load
   * (single-flight). */
  private readonly inflight = new Map<number, Promise<Read>>()
  queries = 0
  onEvict: (key: string) => void = () => {}

  private readonly db: pg.Pool
  private readonly redis: Redis
  private readonly subscriber: Redis
  private readonly l1TtlMs: number
  private readonly l2TtlSeconds: number

  constructor(db: pg.Pool, redis: Redis, subscriber: Redis, l1TtlMs: number, l2TtlSeconds = 300) {
    this.db = db
    this.redis = redis
    this.subscriber = subscriber
    this.l1TtlMs = l1TtlMs
    this.l2TtlSeconds = l2TtlSeconds
    this.l1 = this.newL1()
  }

  private newL1() {
    // a short TTL is the safety net if an invalidation message is ever missed
    return new LRUCache<number, Product>({ max: 1000, ttl: this.l1TtlMs })
  }

  async listen(): Promise<void> {
    this.subscriber.on('message', (_channel: string, key: string) => {
      this.l1.delete(Number(key.slice('product:'.length)))
      this.onEvict(key)
    })
    await this.subscriber.subscribe(CHANNEL)
  }

  /** L1 → L2 → Postgres, with concurrent misses for the same product sharing one load. */
  async get(id: number): Promise<Read> {
    const hit = this.l1.get(id)
    if (hit) return { product: hit, level: 'L1' }
    const running = this.inflight.get(id)
    if (running) return { product: (await running).product, level: 'L1' }
    const load = this.loadBelowL1(id).then((r) => {
      this.l1.set(id, r.product)
      return r
    })
    this.inflight.set(id, load)
    try {
      return await load
    } finally {
      this.inflight.delete(id)
    }
  }

  /** The same read without single-flight: every caller that misses loads on its own. */
  async getUncoalesced(id: number): Promise<Read> {
    const hit = this.l1.get(id)
    if (hit) return { product: hit, level: 'L1' }
    const r = await this.loadBelowL1(id)
    this.l1.set(id, r.product)
    return r
  }

  /** Redis only: the classic single-level cache-aside, for comparison. */
  getRedisOnly(id: number): Promise<Read> {
    return this.loadBelowL1(id)
  }

  /** No cache at all: every read is a Postgres query, for comparison. */
  async getFromDatabase(id: number): Promise<Read> {
    return { product: await this.load(id), level: 'PG' }
  }

  private async loadBelowL1(id: number): Promise<Read> {
    const key = `product:${id}`
    const hit = await this.redis.get(key)
    if (hit) return { product: JSON.parse(hit) as Product, level: 'L2' }
    const product = await this.load(id)
    await this.redis.set(key, JSON.stringify(product), 'EX', this.l2TtlSeconds)
    return { product, level: 'PG' }
  }

  private async load(id: number): Promise<Product> {
    this.queries++
    const { rows } = await this.db.query(PAGE, [id])
    const r = rows[0]
    return { id: r.id, name: r.name, priceCents: r.price_cents, version: r.version, rating: r.rating, reviews: r.reviews }
  }

  /**
   * The write path: Postgres first, then delete (not update) the Redis copy, then tell every
   * instance to drop its
   * L1 copy. With publish = false the last step is skipped, to show what an instance without it
   * serves.
   */
  async updatePrice(id: number, priceCents: number, publish: boolean): Promise<number> {
    const { rows } = await this.db.query(
      'UPDATE products SET price_cents = $1, version = version + 1 WHERE id = $2 RETURNING version',
      [priceCents, id],
    )
    const key = `product:${id}`
    await this.redis.del(key)
    if (publish) await this.redis.publish(CHANNEL, key)
    return rows[0].version
  }

  /** Makes a product cold in both caches of this instance. */
  async forget(id: number): Promise<void> {
    this.l1.delete(id)
    await this.redis.del(`product:${id}`)
  }

  clearL1(): void {
    this.l1 = this.newL1()
  }
}
