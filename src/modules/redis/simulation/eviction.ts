import { seeded } from './random'
import { LFU_INIT_VAL, lfuIncrement } from './lfu'

/*
 * maxmemory eviction, reduced to keys of equal size in a cache that holds
 * `capacity` keys. Redis does not keep an exact LRU list: it samples a few keys
 * and evicts the best candidate (approximated LRU / LFU). The workload mirrors
 * the recorded experiment: a set of hot keys read constantly while many cold
 * keys are written once.
 */

export type Policy = 'allkeys-random' | 'allkeys-lru' | 'allkeys-lfu' | 'exact-lru'

export interface EvictionOptions {
  policy: Policy
  capacity: number
  hotKeys: number
  coldWrites: number
  /** Hot reads between two batches of cold writes, per 1000 cold writes. */
  hotReadsPer1000: number
  samples: number
  /** Operations per second: the LRU clock only has 1-second resolution, so keys touched in the same second look equally old. */
  opsPerSecond: number
  seed?: number
}

export interface EvictionResult {
  hotSurvived: number
  coldSurvived: number
  evicted: number
  hitRate: number
}

interface Entry {
  lastAccess: number
  counter: number
}

export function runEviction(o: EvictionOptions): EvictionResult {
  const random = seeded(o.seed ?? 11)
  const keys = new Map<string, Entry>()
  const list: string[] = []
  // position of each key in `list`, so removing a random key is O(1)
  const pos = new Map<string, number>()
  let clock = 0
  // Redis keeps a 24-bit LRU clock in seconds per key (LRU_CLOCK_RESOLUTION = 1000 ms)
  const lruNow = () => Math.floor(clock / o.opsPerSecond)
  let evicted = 0
  let hits = 0
  let reads = 0

  // exact LRU (for comparison only): a Map keeps keys in recency order, oldest first
  const recency = new Map<string, true>()
  const touch = (k: string) => { if (o.policy === 'exact-lru') { recency.delete(k); recency.set(k, true) } }

  const evictOne = () => {
    let victim: string
    if (o.policy === 'exact-lru') {
      victim = recency.keys().next().value!
      recency.delete(victim)
    } else if (o.policy === 'allkeys-random') {
      victim = list[Math.floor(random() * list.length)]
    } else {
      victim = list[Math.floor(random() * list.length)]
      for (let i = 1; i < o.samples; i++) {
        const k = list[Math.floor(random() * list.length)]
        const a = keys.get(k)!, b = keys.get(victim)!
        const worse = o.policy === 'allkeys-lru' ? a.lastAccess < b.lastAccess : a.counter < b.counter || (a.counter === b.counter && a.lastAccess < b.lastAccess)
        if (worse) victim = k
      }
    }
    keys.delete(victim)
    const at = pos.get(victim)!
    const moved = list[list.length - 1]
    list[at] = moved
    pos.set(moved, at)
    list.pop()
    pos.delete(victim)
    evicted++
  }

  const write = (k: string) => {
    clock++
    if (!keys.has(k)) {
      if (list.length >= o.capacity) evictOne()
      pos.set(k, list.length)
      list.push(k)
    }
    keys.set(k, { lastAccess: lruNow(), counter: LFU_INIT_VAL })
    touch(k)
  }
  const read = (k: string) => {
    clock++
    reads++
    const e = keys.get(k)
    if (!e) return
    hits++
    e.lastAccess = lruNow()
    touch(k)
    e.counter = lfuIncrement(e.counter, 10, random)
  }

  for (let i = 0; i < o.hotKeys; i++) write(`hot:${i}`)
  let hotCursor = 0
  for (let i = 0; i < o.coldWrites; i++) {
    write(`cold:${i}`)
    if ((i + 1) % 1000 === 0) for (let j = 0; j < o.hotReadsPer1000; j++) read(`hot:${hotCursor++ % o.hotKeys}`)
  }
  let hot = 0
  for (let i = 0; i < o.hotKeys; i++) if (keys.has(`hot:${i}`)) hot++
  return { hotSurvived: hot, coldSurvived: keys.size - hot, evicted, hitRate: reads ? hits / reads : 0 }
}
