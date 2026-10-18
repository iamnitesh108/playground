import { seeded } from './random'

/*
 * Several app instances read product pages through up to three levels: their own in-process cache (L1), Redis
 * shared by all of them (L2), and Postgres. Reads pick products with Zipf popularity; writes change a product in
 * Postgres and delete its Redis copy, and (with invalidation on) tell every instance to drop its L1 copy.
 * The model counts where each read was served, how many reached the database, how long they took and how many
 * returned an older version than the database had.
 */

export type Strategy = 'none' | 'redis' | 'tiered'
export type Level = 'L1' | 'L2' | 'PG'

export interface TieredInput {
  strategy: Strategy
  instances: number
  /** Reads per second, per instance. */
  readsPerSecond: number
  /** Writes per second, across the whole system. */
  writesPerSecond: number
  products: number
  /** Zipf exponent: 0 = every product equally popular, higher = a few products get most reads. */
  skew: number
  l1Size: number
  l1TtlSeconds: number
  l2TtlSeconds: number
  /** Publish an invalidation on every write, so each instance drops its L1 copy. */
  invalidation: boolean
  /** Network round trip from an app to Redis or Postgres. */
  rttMs: number
  /** Time Postgres spends running the product-page query. */
  queryMs: number
  /** Time an in-process cache lookup takes. */
  l1Us: number
}

export interface TieredResult {
  reads: number
  served: Record<Level, number>
  staleReads: number
  dbQueriesPerSecond: number
  avgMs: number
  p50Ms: number
  p99Ms: number
  seconds: number
}

/** How long a read served by each level takes, from the round trips it makes. */
export function levelLatencyMs(i: TieredInput): Record<Level, number> {
  const redisCall = i.rttMs + 0.02
  const database = i.rttMs + i.queryMs
  return {
    L1: i.l1Us / 1000,
    L2: (i.strategy === 'tiered' ? i.l1Us / 1000 : 0) + redisCall,
    // with a cache, a database read is a Redis miss, the query, and a SET to fill Redis
    PG: i.strategy === 'none' ? database : (i.strategy === 'tiered' ? i.l1Us / 1000 : 0) + redisCall + database + redisCall,
  }
}

function zipf(products: number, skew: number, random: () => number): () => number {
  const cdf = new Float64Array(products)
  let sum = 0
  for (let k = 0; k < products; k++) cdf[k] = sum += 1 / Math.pow(k + 1, skew)
  return () => {
    const u = random() * sum
    let lo = 0
    let hi = products - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (cdf[mid] < u) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

interface Entry {
  version: number
  expires: number
}

/** At most this many reads are simulated; the duration shrinks for high traffic. */
const MAX_READS = 150_000

export function simulateTiered(i: TieredInput): TieredResult {
  const random = seeded(11)
  const pick = zipf(i.products, i.skew, random)
  const totalRate = i.instances * i.readsPerSecond
  const seconds = Math.min(60, MAX_READS / totalRate)
  const reads = Math.floor(seconds * totalRate)
  const versions = new Int32Array(i.products)
  const l2 = new Map<number, Entry>()
  // a Map keeps insertion order: re-inserting on a hit makes the first key the least recently used
  const l1 = Array.from({ length: i.instances }, () => new Map<number, Entry>())
  const served: Record<Level, number> = { L1: 0, L2: 0, PG: 0 }
  let stale = 0
  let queries = 0
  const readGap = 1000 / totalRate
  const writeGap = i.writesPerSecond > 0 ? 1000 / i.writesPerSecond : Infinity
  let nextWrite = writeGap

  const putL1 = (cache: Map<number, Entry>, key: number, version: number, now: number) => {
    cache.delete(key)
    cache.set(key, { version, expires: now + i.l1TtlSeconds * 1000 })
    if (cache.size > i.l1Size) cache.delete(cache.keys().next().value as number)
  }

  for (let r = 0; r < reads; r++) {
    const now = r * readGap
    while (nextWrite <= now) {
      const key = pick()
      versions[key]++
      if (i.strategy !== 'none') l2.delete(key)
      if (i.strategy === 'tiered' && i.invalidation) for (const cache of l1) cache.delete(key)
      nextWrite += writeGap
    }
    const key = pick()
    const own = l1[r % i.instances]
    if (i.strategy === 'tiered') {
      const hit = own.get(key)
      if (hit && hit.expires > now) {
        served.L1++
        if (hit.version < versions[key]) stale++
        own.delete(key)
        own.set(key, hit)
        continue
      }
    }
    if (i.strategy !== 'none') {
      const hit = l2.get(key)
      if (hit && hit.expires > now) {
        served.L2++
        if (hit.version < versions[key]) stale++
        if (i.strategy === 'tiered') putL1(own, key, hit.version, now)
        continue
      }
    }
    served.PG++
    queries++
    if (i.strategy !== 'none') l2.set(key, { version: versions[key], expires: now + i.l2TtlSeconds * 1000 })
    if (i.strategy === 'tiered') putL1(own, key, versions[key], now)
  }

  const latency = levelLatencyMs(i)
  const levels = (['L1', 'L2', 'PG'] as const).filter((l) => served[l] > 0).sort((a, b) => latency[a] - latency[b])
  const percentile = (p: number) => {
    let seen = 0
    for (const l of levels) {
      seen += served[l]
      if (seen >= p * reads) return latency[l]
    }
    return 0
  }
  return {
    reads,
    served,
    staleReads: stale,
    dbQueriesPerSecond: queries / seconds,
    avgMs: levels.reduce((sum, l) => sum + served[l] * latency[l], 0) / reads,
    p50Ms: percentile(0.5),
    p99Ms: percentile(0.99),
    seconds,
  }
}
