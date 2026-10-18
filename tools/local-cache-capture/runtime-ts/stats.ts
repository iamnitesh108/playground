import { LRUCache } from 'lru-cache'
import { emit, zipfTrace } from './out.ts'

// #region stats
/** lru-cache keeps no counters; this wrapper adds them, using the per-call `status` object fetch() fills in. */
export class CountingCache<K extends {}, V extends {}> {
  hits = 0
  misses = 0
  loads = 0
  loadFailures = 0
  loadMs = 0
  evictions = 0
  readonly cache: LRUCache<K, V>

  constructor(options: { max: number; load: (key: K) => Promise<V> }) {
    this.cache = new LRUCache<K, V>({
      max: options.max,
      dispose: (_v, _k, reason) => { if (reason === 'evict') this.evictions++ },
      fetchMethod: async (key) => {
        const t0 = performance.now()
        try {
          return await options.load(key)
        } catch (e) {
          this.loadFailures++
          throw e
        } finally {
          this.loads++
          this.loadMs += performance.now() - t0
        }
      },
    })
  }

  async get(key: K): Promise<V | undefined> {
    const status: LRUCache.Status<V> = {}
    const value = await this.cache.fetch(key, { status })
    if (status.fetch === 'hit') this.hits++
    else this.misses++
    return value
  }

  stats() {
    const requests = this.hits + this.misses
    return { requests, hits: this.hits, misses: this.misses, hitRate: this.hits / requests, loads: this.loads, loadFailures: this.loadFailures,
      averageLoadMs: this.loadMs / Math.max(1, this.loads), evictions: this.evictions, size: this.cache.size }
  }
}
// #endregion

export async function run() {
  const products = new CountingCache<number, string>({
    max: 1_000,
    load: async (id) => `product ${id}`,
  })
  for (const id of zipfTrace(20_000, 10_000, 0.99, 5)) await products.get(id)
  emit({ exp: 'stats', lib: 'lru-cache', requests: 20_000, keys: 10_000, maximumSize: 1_000, stats: products.stats() })

  // #region memo
  // memo(): lru-cache's own memoisation of a synchronous function
  let computed = 0
  const priceWithTax = new LRUCache<number, number>({ max: 100, memoMethod: (cents) => { computed++; return Math.round(cents * 1.2) } })
  const results = [1999, 1999, 500, 1999].map((c) => priceWithTax.memo(c))
  // #endregion
  emit({ exp: 'memo', lib: 'lru-cache', calls: 4, computed, results })
}
