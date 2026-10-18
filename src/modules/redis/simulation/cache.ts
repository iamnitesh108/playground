import { seeded } from './random'

/*
 * A hot key cached with a TTL, read many times a second, rebuilt from a slow
 * database. When it expires, every request that misses goes to the database at
 * once (a stampede) unless something coordinates them.
 */

export type Strategy = 'none' | 'lock' | 'early-refresh' | 'stale-while-revalidate'

export interface CacheInput {
  strategy: Strategy
  requestsPerSecond: number
  ttlSeconds: number
  /** Time to rebuild the value from the database. */
  rebuildMs: number
  durationSeconds: number
  /** XFetch beta (early refresh): higher refreshes earlier. */
  beta: number
}

export interface CacheResult {
  /** Database queries started, per 100 ms bucket. */
  dbPerBucket: number[]
  dbQueries: number
  /** Requests that had to wait for the database. */
  waited: number
  /** Requests answered with a value older than the TTL. */
  servedStale: number
  requests: number
}

export function simulateCache(i: CacheInput): CacheResult {
  const random = seeded(5)
  const step = 1000 / i.requestsPerSecond
  const total = Math.floor(i.durationSeconds * i.requestsPerSecond)
  const buckets = Array.from({ length: Math.ceil((i.durationSeconds * 1000) / 100) }, () => 0)
  // the cache entry: valid until `expires`; a rebuild in flight finishes at `rebuildDone`
  let expires = i.ttlSeconds * 1000
  let rebuildDone: number | null = null
  let dbQueries = 0, waited = 0, servedStale = 0
  const query = (at: number) => {
    dbQueries++
    buckets[Math.min(buckets.length - 1, Math.floor(at / 100))]++
  }
  for (let n = 0; n < total; n++) {
    const now = n * step
    if (rebuildDone !== null && now >= rebuildDone) {
      expires = rebuildDone + i.ttlSeconds * 1000
      rebuildDone = null
    }
    const fresh = now < expires
    switch (i.strategy) {
      case 'none':
        if (!fresh) {
          // every miss queries the database until one of them refills the key
          query(now)
          waited++
          if (rebuildDone === null) rebuildDone = now + i.rebuildMs
        }
        break
      case 'lock':
        if (!fresh) {
          waited++
          if (rebuildDone === null) { query(now); rebuildDone = now + i.rebuildMs }
        }
        break
      case 'early-refresh': {
        // XFetch: refresh before expiry with a probability that rises as expiry nears
        const early = now - i.rebuildMs * i.beta * Math.log(Math.max(random(), 1e-9)) >= expires
        if (!fresh) { waited++; if (rebuildDone === null) { query(now); rebuildDone = now + i.rebuildMs } }
        else if (early && rebuildDone === null) { query(now); rebuildDone = now + i.rebuildMs }
        break
      }
      case 'stale-while-revalidate':
        if (!fresh) {
          servedStale++
          if (rebuildDone === null) { query(now); rebuildDone = now + i.rebuildMs }
        }
        break
    }
  }
  return { dbPerBucket: buckets, dbQueries, waited, servedStale, requests: total }
}
