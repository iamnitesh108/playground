// Sizing an in-process cache: memory it takes (entries × bytes × instances) against a heap budget, and the hit ratio
// to expect when key popularity follows a Zipf law. Pure TypeScript: no React.

/** Sum of k^-s for k = 1..n: exact up to 100,000 terms, then the integral of the rest (midpoint rule). */
export function harmonic(n: number, s: number): number {
  const exact = Math.min(n, 100_000)
  let sum = 0
  for (let k = 1; k <= exact; k++) sum += Math.pow(k, -s)
  if (n > exact) {
    const a = exact + 0.5, b = n + 0.5
    sum += Math.abs(s - 1) < 1e-9 ? Math.log(b / a) : (Math.pow(b, 1 - s) - Math.pow(a, 1 - s)) / (1 - s)
  }
  return sum
}

/**
 * Best case: the cache holds exactly the `capacity` most popular keys (what a frequency-based policy such as
 * W-TinyLFU approaches on a steady workload). The hit ratio is their share of all requests.
 */
export function frequencyHitRatio(keyspace: number, skew: number, capacity: number): number {
  if (capacity >= keyspace) return 1
  return harmonic(capacity, skew) / harmonic(keyspace, skew)
}

/** Keys grouped so that big key spaces stay cheap: the first 2,000 one by one, then geometric buckets. */
function buckets(keyspace: number): { rank: number; count: number }[] {
  const out: { rank: number; count: number }[] = []
  let k = 1
  for (; k <= Math.min(keyspace, 2_000); k++) out.push({ rank: k, count: 1 })
  while (k <= keyspace) {
    const end = Math.min(keyspace, Math.floor(k * 1.01) + 1)
    out.push({ rank: Math.sqrt(k * end), count: end - k + 1 })
    k = end + 1
  }
  return out
}

/**
 * LRU on independent Zipf requests, by Che's approximation: an LRU of size C keeps a key if it was requested within
 * the last T requests, where T is such that the expected number of distinct keys in T requests equals C.
 */
export function lruHitRatio(keyspace: number, skew: number, capacity: number): number {
  if (capacity >= keyspace) return 1
  const h = harmonic(keyspace, skew)
  const groups = buckets(keyspace).map((b) => ({ p: Math.pow(b.rank, -skew) / h, count: b.count }))
  const occupied = (t: number) => groups.reduce((n, g) => n + g.count * (1 - Math.exp(-g.p * t)), 0)
  let lo = 0, hi = 1
  while (occupied(hi) < capacity) hi *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (occupied(mid) < capacity) lo = mid
    else hi = mid
  }
  return groups.reduce((n, g) => n + g.count * g.p * (1 - Math.exp(-g.p * hi)), 0)
}

export interface SizingInput {
  /** Distinct keys that can be requested. */
  keyspace: number
  /** Zipf exponent: 0 = all keys equally popular, about 1 = typical web traffic. */
  skew: number
  /** Maximum entries per instance. */
  entries: number
  keyBytes: number
  valueBytes: number
  /** What the cache itself adds per entry (measured per library). */
  overheadBytes: number
  instances: number
  /** Heap (or process memory) each instance has. */
  heapMb: number
  requestsPerSecond: number
}

export interface SizingResult {
  bytesPerEntry: number
  cacheMbPerInstance: number
  heapShare: number
  totalMb: number
  frequencyHit: number
  lruHit: number
  /** Loads per second per instance with the frequency-based estimate. */
  missesPerSecond: number
}

const MB = 1024 * 1024

export function sizeCache(input: SizingInput): SizingResult {
  const entries = Math.min(input.entries, input.keyspace)
  const bytesPerEntry = input.keyBytes + input.valueBytes + input.overheadBytes
  const cacheMb = (entries * bytesPerEntry) / MB
  const frequencyHit = frequencyHitRatio(input.keyspace, input.skew, entries)
  return {
    bytesPerEntry,
    cacheMbPerInstance: cacheMb,
    heapShare: cacheMb / input.heapMb,
    totalMb: cacheMb * input.instances,
    frequencyHit,
    lruHit: lruHitRatio(input.keyspace, input.skew, entries),
    missesPerSecond: input.requestsPerSecond * (1 - frequencyHit),
  }
}

/** Hit ratio against cache size, for a chart: sizes from 0.1 % of the key space up to all of it. */
export function hitCurve(keyspace: number, skew: number, points = 24): { entries: number; frequency: number; lru: number }[] {
  const out: { entries: number; frequency: number; lru: number }[] = []
  for (let i = 0; i <= points; i++) {
    const entries = Math.max(1, Math.round(keyspace * Math.pow(10, -3 + (3 * i) / points)))
    out.push({ entries, frequency: frequencyHitRatio(keyspace, skew, entries), lru: lruHitRatio(keyspace, skew, entries) })
  }
  return out
}
