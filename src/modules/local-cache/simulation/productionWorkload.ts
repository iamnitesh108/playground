// A simulated service in front of a cache, one tick per second, for the hit-rate dashboard. Two eviction strategies
// (LRU, and LRU behind a TinyLFU admission filter) and workload events that real dashboards show: a batch scan,
// a shift in what is popular, a deploy that empties the cache, and a slow database. Pure TypeScript: no React.

/** Seeded Zipf trace, the same generator as the recorded TypeScript app (tools/local-cache-capture/runtime-ts/out.ts). */
export function zipfTrace(length: number, keys: number, s: number, seed: number): Int32Array {
  const cdf = new Float64Array(keys)
  let sum = 0
  for (let k = 0; k < keys; k++) cdf[k] = sum += 1 / Math.pow(k + 1, s)
  let x = seed >>> 0
  const rnd = () => ((x = (Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0) / 2 ** 32)
  const out = new Int32Array(length)
  for (let i = 0; i < length; i++) {
    const r = rnd() * sum
    let lo = 0, hi = keys - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (cdf[mid] < r) lo = mid + 1
      else hi = mid
    }
    out[i] = lo
  }
  return out
}

/** What every eviction strategy offers the simulated cache. */
export interface EvictionPolicy {
  /** Looks the key up; a hit also counts as a use. */
  get(key: number): boolean
  /** Adds a freshly loaded key; returns how many entries were evicted (a rejected newcomer counts as one). */
  add(key: number): number
  clear(): void
  readonly size: number
}

/** Least recently used: a Map keeps insertion order, so re-inserting on use makes the first key the oldest. */
export class LruPolicy implements EvictionPolicy {
  private readonly entries = new Map<number, true>()
  private readonly capacity: number
  constructor(capacity: number) {
    this.capacity = capacity
  }
  get(key: number) {
    if (!this.entries.delete(key)) return false
    this.entries.set(key, true)
    return true
  }
  add(key: number) {
    this.entries.set(key, true)
    if (this.entries.size <= this.capacity) return 0
    this.entries.delete(this.entries.keys().next().value!)
    return 1
  }
  clear() {
    this.entries.clear()
  }
  get size() {
    return this.entries.size
  }
  /** The least recently used key (the next victim). */
  oldest(): number | undefined {
    return this.entries.keys().next().value
  }
  remove(key: number) {
    this.entries.delete(key)
  }
}

/** A small count-min sketch: 4 rows of 4-bit-like counters, halved every 10 × capacity increments (ageing). */
export class FrequencySketch {
  private readonly rows: Uint8Array[]
  private readonly mask: number
  private additions = 0
  private readonly capacity: number
  constructor(capacity: number) {
    this.capacity = capacity
    let width = 16
    while (width < capacity * 4) width *= 2
    this.mask = width - 1
    this.rows = Array.from({ length: 4 }, () => new Uint8Array(width))
  }
  private index(key: number, row: number) {
    let h = Math.imul(key + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca6b)
    h ^= h >>> 15
    h = Math.imul(h, 0xc2b2ae35)
    return (h ^ (h >>> 13)) & this.mask
  }
  increment(key: number) {
    for (let r = 0; r < 4; r++) {
      const i = this.index(key, r)
      if (this.rows[r][i] < 15) this.rows[r][i]++
    }
    if (++this.additions >= this.capacity * 10) {
      for (const row of this.rows) for (let i = 0; i < row.length; i++) row[i] >>= 1
      this.additions = 0
    }
  }
  frequency(key: number) {
    let min = 15
    for (let r = 0; r < 4; r++) min = Math.min(min, this.rows[r][this.index(key, r)])
    return min
  }
}

/** LRU behind a TinyLFU admission filter: a newcomer gets in only if it is used more often than the LRU victim. */
export class TinyLfuPolicy implements EvictionPolicy {
  private readonly lru: LruPolicy
  private sketch: FrequencySketch
  private readonly capacity: number
  constructor(capacity: number) {
    this.capacity = capacity
    this.lru = new LruPolicy(capacity)
    this.sketch = new FrequencySketch(capacity)
  }
  get(key: number) {
    this.sketch.increment(key)
    return this.lru.get(key)
  }
  add(key: number) {
    if (this.lru.size < this.capacity) return this.lru.add(key)
    const victim = this.lru.oldest()!
    if (this.sketch.frequency(key) <= this.sketch.frequency(victim)) return 1   // newcomer rejected
    this.lru.remove(victim)
    this.lru.add(key)
    return 1
  }
  clear() {
    this.lru.clear()
    this.sketch = new FrequencySketch(this.capacity)
  }
  get size() {
    return this.lru.size
  }
}

export type PolicyName = 'lru' | 'tinylfu'
export const POLICIES: Record<PolicyName, { label: string; make: (capacity: number) => EvictionPolicy }> = {
  lru: { label: 'LRU (like lru-cache)', make: (c) => new LruPolicy(c) },
  tinylfu: { label: 'TinyLFU admission (like moka; Caffeine adds a window)', make: (c) => new TinyLfuPolicy(c) },
}

export type WorkloadEvent = 'scan' | 'shift' | 'deploy' | 'slow'
export const EVENTS: Record<WorkloadEvent, { label: string; from: number; to: number; describe: string }> = {
  scan: { label: 'batch scan', from: 15, to: 22, describe: 'a report job reads every product once: half the requests are cold keys never seen again' },
  shift: { label: 'new favourites', from: 30, to: 31, describe: 'a sale starts: the popular products change all at once' },
  slow: { label: 'slow database', from: 38, to: 44, describe: 'the database answers five times slower' },
  deploy: { label: 'deploy', from: 48, to: 49, describe: 'a new version starts with an empty cache' },
}

export interface WorkloadInput {
  policy: PolicyName
  capacity: number
  keys: number
  skew: number
  requestsPerSecond: number
  loadMs: number
  seconds: number
  events: readonly WorkloadEvent[]
}

export interface Tick {
  second: number
  requests: number
  hits: number
  misses: number
  evictions: number
  loadMs: number
  size: number
  hitRate: number
}

export interface WorkloadResult {
  ticks: Tick[]
  /** Totals named as Caffeine's CacheStats names them. */
  totals: { hitCount: number; missCount: number; hitRate: number; loadSuccessCount: number; evictionCount: number; averageLoadPenaltyMs: number; estimatedSize: number }
}

export function runWorkload(input: WorkloadInput): WorkloadResult {
  const cache = POLICIES[input.policy].make(input.capacity)
  const on = (e: WorkloadEvent, t: number) => input.events.includes(e) && t >= EVENTS[e].from && t < EVENTS[e].to
  const trace = zipfTrace(input.requestsPerSecond * input.seconds, input.keys, input.skew, 17)
  let scanNext = input.keys * 10            // scanned keys are outside the normal key space: cold, never repeated
  let shift = 0
  const ticks: Tick[] = []
  for (let t = 0; t < input.seconds; t++) {
    if (input.events.includes('shift') && t === EVENTS.shift.from) shift = Math.floor(input.keys / 2)
    if (on('deploy', t)) cache.clear()
    const penalty = input.loadMs * (on('slow', t) ? 5 : 1)
    let hits = 0, misses = 0, evictions = 0
    for (let i = 0; i < input.requestsPerSecond; i++) {
      const scanning = on('scan', t) && i % 2 === 1
      const key = scanning ? scanNext++ : (trace[t * input.requestsPerSecond + i] + shift) % input.keys
      if (cache.get(key)) hits++
      else {
        misses++
        evictions += cache.add(key)
      }
    }
    ticks.push({ second: t, requests: hits + misses, hits, misses, evictions, loadMs: penalty, size: cache.size, hitRate: hits / (hits + misses) })
  }
  const hitCount = ticks.reduce((n, k) => n + k.hits, 0)
  const missCount = ticks.reduce((n, k) => n + k.misses, 0)
  return {
    ticks,
    totals: {
      hitCount,
      missCount,
      hitRate: hitCount / (hitCount + missCount),
      loadSuccessCount: missCount,
      evictionCount: ticks.reduce((n, k) => n + k.evictions, 0),
      averageLoadPenaltyMs: ticks.reduce((n, k) => n + k.misses * k.loadMs, 0) / Math.max(1, missCount),
      estimatedSize: cache.size,
    },
  }
}

/** Replays a fixed trace through a policy and returns the hit ratio (used to check the model against a recording). */
export function replay(trace: Int32Array, policy: EvictionPolicy): number {
  let hits = 0
  for (const key of trace) {
    if (policy.get(key)) hits++
    else policy.add(key)
  }
  return hits / trace.length
}
