/*
 * Small, readable models of the eviction policies the lesson compares. Each one only answers "was this request a
 * hit?" and keeps the cache within `capacity` entries; values and concurrency are left out on purpose.
 *
 *  - FIFO      evicts the oldest insertion.
 *  - LRU       evicts the least recently used entry (what lru-cache does).
 *  - LFU       evicts the entry with the fewest hits while cached (ties: least recent).
 *  - TinyLFU   an LRU whose door is guarded by a frequency sketch: a new key only gets in if it was requested more
 *              often than the entry it would evict (moka's default policy: no window, LRU main).
 *  - W-TinyLFU Caffeine's policy: a small LRU admission window, then TinyLFU admission into a segmented LRU main
 *              (probation 20 %, protected 80 %), with the window resized by hill climbing.
 *
 * Simplifications against the libraries are listed in the lesson ("How close are the models?") and at each class.
 * Imports end in .ts so Node can run this file directly when the capture script records the models' hit ratios.
 */
import { Deque, type DequeNode } from './evictionDeque.ts'
import { FrequencySketch } from './evictionSketch.ts'

export type PolicyId = 'fifo' | 'lru' | 'lfu' | 'tinylfu' | 'wtinylfu'
export type Region = 'window' | 'probation' | 'protected' | 'main'

/** What a policy did with one request, for step-through views (observer). */
export type PolicyEvent =
  | { type: 'hit'; key: number; region: Region }
  | { type: 'miss'; key: number }
  | { type: 'insert'; key: number; region: Region }
  | { type: 'evict'; key: number; region: Region; why: string }
  | { type: 'admit'; candidate: number; victim: number; candidateFreq: number; victimFreq: number }
  | { type: 'reject'; candidate: number; victim: number; candidateFreq: number; victimFreq: number }
  | { type: 'promote'; key: number }
  | { type: 'demote'; key: number }
  | { type: 'resize'; windowMax: number; protectedMax: number }

export type Listener = (event: PolicyEvent) => void

export interface Policy {
  readonly id: PolicyId
  readonly capacity: number
  /** Records one request; true when it was a hit. A miss also loads the key (it may be rejected at once). */
  access(key: number): boolean
  size(): number
}

class Fifo implements Policy {
  readonly id = 'fifo'
  readonly capacity: number
  private readonly queue = new Deque<Region>()
  private readonly map = new Map<number, DequeNode<Region>>()
  private readonly emit: Listener

  constructor(capacity: number, listener: Listener = () => {}) {
    this.capacity = capacity
    this.emit = listener
  }

  access(key: number): boolean {
    if (this.map.has(key)) {
      this.emit({ type: 'hit', key, region: 'main' })
      return true
    }
    this.emit({ type: 'miss', key })
    if (this.queue.size >= this.capacity) {
      const old = this.queue.popFront()!
      this.map.delete(old.key)
      this.emit({ type: 'evict', key: old.key, region: 'main', why: 'oldest insertion' })
    }
    const node: DequeNode<Region> = { key, region: 'main', prev: null, next: null }
    this.queue.pushBack(node)
    this.map.set(key, node)
    this.emit({ type: 'insert', key, region: 'main' })
    return false
  }

  size(): number {
    return this.queue.size
  }

  keys(): number[] {
    return this.queue.keys()
  }
}

/** Exact LRU: a map for lookup plus a doubly linked list in recency order. */
export class Lru implements Policy {
  readonly id = 'lru'
  readonly capacity: number
  private readonly list = new Deque<Region>()
  private readonly map = new Map<number, DequeNode<Region>>()
  private readonly emit: Listener

  constructor(capacity: number, listener: Listener = () => {}) {
    this.capacity = capacity
    this.emit = listener
  }

  access(key: number): boolean {
    const node = this.map.get(key)
    if (node) {
      this.list.moveToBack(node)
      this.emit({ type: 'hit', key, region: 'main' })
      return true
    }
    this.emit({ type: 'miss', key })
    if (this.list.size >= this.capacity) {
      const old = this.list.popFront()!
      this.map.delete(old.key)
      this.emit({ type: 'evict', key: old.key, region: 'main', why: 'least recently used' })
    }
    const fresh: DequeNode<Region> = { key, region: 'main', prev: null, next: null }
    this.list.pushBack(fresh)
    this.map.set(key, fresh)
    this.emit({ type: 'insert', key, region: 'main' })
    return false
  }

  size(): number {
    return this.list.size
  }

  /** Least recently used first. */
  keys(): number[] {
    return this.list.keys()
  }
}

/**
 * In-cache LFU in O(1): one LRU list per hit count. Counts are kept only while a key is cached (a "perfect" LFU
 * that remembers every key ever seen needs memory for all of them).
 */
class Lfu implements Policy {
  readonly id = 'lfu'
  readonly capacity: number
  private readonly counts = new Map<number, number>()
  private readonly nodes = new Map<number, DequeNode<Region>>()
  private readonly buckets = new Map<number, Deque<Region>>()
  private minCount = 0
  private readonly emit: Listener

  constructor(capacity: number, listener: Listener = () => {}) {
    this.capacity = capacity
    this.emit = listener
  }

  private bucket(count: number): Deque<Region> {
    let b = this.buckets.get(count)
    if (!b) this.buckets.set(count, (b = new Deque<Region>()))
    return b
  }

  access(key: number): boolean {
    const node = this.nodes.get(key)
    if (node) {
      const count = this.counts.get(key)!
      const from = this.bucket(count)
      from.remove(node)
      if (from.size === 0 && this.minCount === count) this.minCount = count + 1
      this.bucket(count + 1).pushBack(node)
      this.counts.set(key, count + 1)
      this.emit({ type: 'hit', key, region: 'main' })
      return true
    }
    this.emit({ type: 'miss', key })
    if (this.nodes.size >= this.capacity) {
      const victim = this.bucket(this.minCount).popFront()!
      this.nodes.delete(victim.key)
      this.counts.delete(victim.key)
      this.emit({ type: 'evict', key: victim.key, region: 'main', why: `fewest hits (${this.minCount})` })
    }
    const fresh: DequeNode<Region> = { key, region: 'main', prev: null, next: null }
    this.bucket(1).pushBack(fresh)
    this.nodes.set(key, fresh)
    this.counts.set(key, 1)
    this.minCount = 1
    this.emit({ type: 'insert', key, region: 'main' })
    return false
  }

  size(): number {
    return this.nodes.size
  }

  count(key: number): number {
    return this.counts.get(key) ?? 0
  }
}

/**
 * TinyLFU admission in front of one LRU (moka 0.12's default). Every request bumps the sketch; when the cache is
 * full, a missed key is admitted only if its estimated frequency beats the LRU victim's.
 * Simplified: moka batches reads and writes and applies them in its housekeeping, and compares the candidate with
 * as many victims as its weight needs (here every entry weighs 1, so one victim).
 */
class TinyLfu implements Policy {
  readonly id = 'tinylfu'
  readonly capacity: number
  readonly sketch: FrequencySketch
  private readonly list = new Deque<Region>()
  private readonly map = new Map<number, DequeNode<Region>>()
  private readonly emit: Listener

  constructor(capacity: number, listener: Listener = () => {}) {
    this.capacity = capacity
    this.sketch = new FrequencySketch(capacity)
    this.emit = listener
  }

  access(key: number): boolean {
    this.sketch.increment(key)
    const node = this.map.get(key)
    if (node) {
      this.list.moveToBack(node)
      this.emit({ type: 'hit', key, region: 'main' })
      return true
    }
    this.emit({ type: 'miss', key })
    if (this.list.size >= this.capacity) {
      const victim = this.list.head!
      const candidateFreq = this.sketch.frequency(key)
      const victimFreq = this.sketch.frequency(victim.key)
      const verdict = { candidate: key, victim: victim.key, candidateFreq, victimFreq }
      if (candidateFreq <= victimFreq) {
        this.emit({ type: 'reject', ...verdict })
        return false
      }
      this.emit({ type: 'admit', ...verdict })
      this.list.remove(victim)
      this.map.delete(victim.key)
      this.emit({ type: 'evict', key: victim.key, region: 'main', why: 'lost to a more frequent key' })
    }
    const fresh: DequeNode<Region> = { key, region: 'main', prev: null, next: null }
    this.list.pushBack(fresh)
    this.map.set(key, fresh)
    this.emit({ type: 'insert', key, region: 'main' })
    return false
  }

  size(): number {
    return this.list.size
  }
}

export interface WTinyLfuOptions {
  /** Resize the window by hill climbing, as Caffeine does (default true). */
  adaptive?: boolean
}

/** Caffeine's constants (BoundedLocalCache, 3.1.8). */
const PERCENT_MAIN = 0.99
const PERCENT_MAIN_PROTECTED = 0.8
const HILL_CLIMBER_RESTART_THRESHOLD = 0.05
const HILL_CLIMBER_STEP_PERCENT = 0.0625
const HILL_CLIMBER_STEP_DECAY_RATE = 0.98

/**
 * W-TinyLFU as in Caffeine: new keys enter a small LRU window; whatever falls out of the window competes, by
 * sketch frequency, with the LRU victim of the probation segment; a hit in probation promotes to protected.
 * The hill climber samples the hit rate every 10 × capacity requests and grows or shrinks the window.
 * Simplified: no read/write buffers, one request at a time, no random admission of warm candidates (Caffeine
 * admits a candidate with frequency ≥ 6 with probability 1/128 against hash-flooding), and protected overflow is
 * demoted immediately instead of in the next maintenance cycle.
 */
export class WTinyLfu implements Policy {
  readonly id = 'wtinylfu'
  readonly capacity: number
  readonly sketch: FrequencySketch
  readonly window = new Deque<Region>()
  readonly probation = new Deque<Region>()
  readonly protectedList = new Deque<Region>()
  windowMax: number
  protectedMax: number
  private readonly map = new Map<number, DequeNode<Region>>()
  private readonly emit: Listener
  private readonly adaptive: boolean
  private hitsInSample = 0
  private missesInSample = 0
  private previousHitRate = 0
  private stepSize: number
  private climbing = false

  constructor(capacity: number, listener: Listener = () => {}, options: WTinyLfuOptions = {}) {
    this.capacity = capacity
    this.sketch = new FrequencySketch(capacity)
    this.emit = listener
    this.adaptive = options.adaptive ?? true
    this.windowMax = capacity - Math.floor(PERCENT_MAIN * capacity)
    this.protectedMax = Math.floor(PERCENT_MAIN_PROTECTED * (capacity - this.windowMax))
    this.stepSize = -HILL_CLIMBER_STEP_PERCENT * capacity
  }

  size(): number {
    return this.map.size
  }

  access(key: number): boolean {
    this.sketch.increment(key)
    const node = this.map.get(key)
    if (node) {
      this.hitsInSample++
      this.emit({ type: 'hit', key, region: node.region })
      if (node.region === 'window') this.window.moveToBack(node)
      else if (node.region === 'protected') this.protectedList.moveToBack(node)
      else this.promote(node)
      this.climb()
      return true
    }
    this.missesInSample++
    this.emit({ type: 'miss', key })
    const fresh: DequeNode<Region> = { key, region: 'window', prev: null, next: null }
    this.window.pushBack(fresh)
    this.map.set(key, fresh)
    this.emit({ type: 'insert', key, region: 'window' })
    this.evict()
    this.climb()
    return false
  }

  /** A second hit while on probation earns a place in the protected segment. */
  private promote(node: DequeNode<Region>): void {
    this.probation.remove(node)
    node.region = 'protected'
    this.protectedList.pushBack(node)
    this.emit({ type: 'promote', key: node.key })
    this.demoteFromProtected()
  }

  private demoteFromProtected(): void {
    while (this.protectedList.size > this.protectedMax) {
      const old = this.protectedList.popFront()!
      old.region = 'probation'
      this.probation.pushBack(old)
      this.emit({ type: 'demote', key: old.key })
    }
  }

  private dropNode(node: DequeNode<Region>, why: string): void {
    const from = node.region === 'window' ? this.window : node.region === 'protected' ? this.protectedList : this.probation
    from.remove(node)
    this.map.delete(node.key)
    this.emit({ type: 'evict', key: node.key, region: node.region, why })
  }

  private evict(): void {
    // the window overflows into probation: those entries become candidates for the main space
    let candidate: DequeNode<Region> | null = null
    while (this.window.size > this.windowMax) {
      const moved = this.window.popFront()!
      moved.region = 'probation'
      this.probation.pushBack(moved)
      candidate ??= moved
    }
    while (this.map.size > this.capacity) {
      if (!this.climbing && this.adaptive) this.climbing = true
      candidate ??= this.window.head
      const victim = this.probation.head ?? this.protectedList.head ?? this.window.head
      if (!candidate || !victim || candidate === victim) {
        this.dropNode((candidate ?? victim)!, 'only entry to evict')
        candidate = null
        continue
      }
      const candidateFreq = this.sketch.frequency(candidate.key)
      const victimFreq = this.sketch.frequency(victim.key)
      const verdict = { candidate: candidate.key, victim: victim.key, candidateFreq, victimFreq }
      if (candidateFreq > victimFreq) {
        this.emit({ type: 'admit', ...verdict })
        this.dropNode(victim, 'lost to a more frequent candidate')
      } else {
        this.emit({ type: 'reject', ...verdict })
        const next = candidate.next
        this.dropNode(candidate, 'not more frequent than the victim')
        candidate = next
      }
    }
  }

  /** Caffeine's hill climber: keep moving the window size in the direction that raised the hit rate. */
  private climb(): void {
    if (!this.adaptive || !this.climbing) return
    const requests = this.hitsInSample + this.missesInSample
    if (requests < this.sketch.sampleSize) return
    const hitRate = this.hitsInSample / requests
    const change = hitRate - this.previousHitRate
    const amount = change >= 0 ? this.stepSize : -this.stepSize
    this.stepSize =
      Math.abs(change) >= HILL_CLIMBER_RESTART_THRESHOLD
        ? HILL_CLIMBER_STEP_PERCENT * this.capacity * (amount >= 0 ? 1 : -1)
        : HILL_CLIMBER_STEP_DECAY_RATE * amount
    this.previousHitRate = hitRate
    this.hitsInSample = this.missesInSample = 0
    const adjustment = Math.trunc(amount)
    if (adjustment > 0) this.increaseWindow(adjustment)
    else if (adjustment < 0) this.decreaseWindow(-adjustment)
  }

  private increaseWindow(adjustment: number): void {
    const quota = Math.min(adjustment, this.protectedMax)
    if (quota <= 0) return
    this.protectedMax -= quota
    this.windowMax += quota
    this.demoteFromProtected()
    // entries move from the main space into the window until it holds its new share
    for (let left = quota; left > 0; left--) {
      const moved = this.probation.popFront() ?? this.protectedList.popFront()
      if (!moved) break
      moved.region = 'window'
      this.window.pushBack(moved)
    }
    this.emit({ type: 'resize', windowMax: this.windowMax, protectedMax: this.protectedMax })
  }

  private decreaseWindow(adjustment: number): void {
    const quota = Math.min(adjustment, Math.max(0, this.windowMax - 1))
    if (quota <= 0) return
    this.protectedMax += quota
    this.windowMax -= quota
    for (let left = quota; left > 0 && this.window.size > this.windowMax; left--) {
      const moved = this.window.popFront()!
      moved.region = 'probation'
      this.probation.pushBack(moved)
    }
    this.emit({ type: 'resize', windowMax: this.windowMax, protectedMax: this.protectedMax })
  }
}

export interface PolicyInfo {
  id: PolicyId
  label: string
  /** Which recorded library behaves like this model. */
  library?: string
}

export const POLICIES: readonly PolicyInfo[] = [
  { id: 'fifo', label: 'FIFO' },
  { id: 'lru', label: 'LRU', library: 'lru-cache' },
  { id: 'lfu', label: 'LFU' },
  { id: 'tinylfu', label: 'TinyLFU', library: 'moka' },
  { id: 'wtinylfu', label: 'W-TinyLFU', library: 'Caffeine' },
]

/** Strategy factory: one place that maps an id to its policy. */
export function createPolicy(id: PolicyId, capacity: number, listener?: Listener): Policy {
  const factories: Record<PolicyId, () => Policy> = {
    fifo: () => new Fifo(capacity, listener),
    lru: () => new Lru(capacity, listener),
    lfu: () => new Lfu(capacity, listener),
    tinylfu: () => new TinyLfu(capacity, listener),
    wtinylfu: () => new WTinyLfu(capacity, listener),
  }
  return factories[id]()
}

export interface ReplayResult {
  hits: number
  requests: number
  hitRatio: number
}

/** Runs a whole trace through a policy. */
export function replay(policy: Policy, trace: ArrayLike<number>): ReplayResult {
  let hits = 0
  for (let i = 0; i < trace.length; i++) if (policy.access(trace[i])) hits++
  return { hits, requests: trace.length, hitRatio: hits / Math.max(1, trace.length) }
}

/**
 * The best any policy could do (Belady's OPT: evict the key whose next request is furthest away). Needs the
 * future, so no real cache can run it; it is the ceiling the others are measured against.
 */
export function optimalHitRatio(trace: ArrayLike<number>, capacity: number): number {
  const n = trace.length
  const nextUse = new Int32Array(n)
  const seen = new Map<number, number>()
  for (let i = n - 1; i >= 0; i--) {
    nextUse[i] = seen.get(trace[i]) ?? n + i
    seen.set(trace[i], i)
  }
  // a max-heap of (next use, key) for cached keys; stale heap items are skipped lazily
  const heapNext: number[] = []
  const heapKey: number[] = []
  const cachedNext = new Map<number, number>()
  const push = (next: number, key: number) => {
    let i = heapNext.length
    heapNext.push(next)
    heapKey.push(key)
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heapNext[p] >= heapNext[i]) break
      ;[heapNext[p], heapNext[i]] = [heapNext[i], heapNext[p]]
      ;[heapKey[p], heapKey[i]] = [heapKey[i], heapKey[p]]
      i = p
    }
  }
  const pop = () => {
    const top = { next: heapNext[0], key: heapKey[0] }
    const lastN = heapNext.pop()!
    const lastK = heapKey.pop()!
    if (heapNext.length) {
      heapNext[0] = lastN
      heapKey[0] = lastK
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < heapNext.length && heapNext[l] > heapNext[m]) m = l
        if (r < heapNext.length && heapNext[r] > heapNext[m]) m = r
        if (m === i) break
        ;[heapNext[m], heapNext[i]] = [heapNext[i], heapNext[m]]
        ;[heapKey[m], heapKey[i]] = [heapKey[i], heapKey[m]]
        i = m
      }
    }
    return top
  }
  let hits = 0
  for (let i = 0; i < n; i++) {
    const key = trace[i]
    if (cachedNext.has(key)) hits++
    else if (cachedNext.size >= capacity) {
      // drop heap items of keys whose next use has moved on
      while (cachedNext.get(heapKey[0]) !== heapNext[0]) pop()
      // a key needed later than everything cached is better not stored at all
      if (heapNext[0] <= nextUse[i]) continue
      cachedNext.delete(pop().key)
    }
    cachedNext.set(key, nextUse[i])
    push(nextUse[i], key)
  }
  return hits / Math.max(1, n)
}
