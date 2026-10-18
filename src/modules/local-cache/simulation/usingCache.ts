/*
 * A small bounded cache with a size limit, a time to live and a fake clock: the model behind the operation
 * playground of "Using it day to day". Eviction is plain LRU (the least recently used entry goes first), which
 * is what lru-cache does; Caffeine and moka may pick another victim (see the eviction lesson).
 * Pure TypeScript, no React; no parameter properties so Node can run it directly.
 */

export type RemovalCause = 'SIZE' | 'EXPIRED' | 'EXPLICIT' | 'REPLACED'

export interface Removal {
  key: string
  value: string
  cause: RemovalCause
  at: number
}

export interface Entry {
  key: string
  value: string
  /** Fake-clock time at which the entry expires. */
  expiresAt: number
}

export interface CacheStats {
  hits: number
  misses: number
  loads: number
  evictions: number
}

export type RemovalListener = (removal: Removal) => void

export interface BoundedCacheOptions {
  maximumSize: number
  ttl: number
}

/** A bounded LRU cache with expire-after-write and removal listeners (observers). */
export class BoundedCache {
  readonly maximumSize: number
  readonly ttl: number
  /** Map iteration order is insertion order: the first key is the least recently used. */
  private readonly entries = new Map<string, Entry>()
  private readonly listeners: RemovalListener[] = []
  private clock = 0
  private counters: CacheStats = { hits: 0, misses: 0, loads: 0, evictions: 0 }

  constructor(options: BoundedCacheOptions) {
    this.maximumSize = options.maximumSize
    this.ttl = options.ttl
  }

  onRemoval(listener: RemovalListener): () => void {
    this.listeners.push(listener)
    return () => this.listeners.splice(this.listeners.indexOf(listener), 1)
  }

  get now(): number {
    return this.clock
  }

  get size(): number {
    return this.entries.size
  }

  /** Entries from most to least recently used. */
  snapshot(): Entry[] {
    return [...this.entries.values()].reverse()
  }

  stats(): CacheStats {
    return { ...this.counters }
  }

  /** getIfPresent / get: a hit moves the entry to the most recently used end; an expired entry is removed. */
  get(key: string): string | undefined {
    const entry = this.live(key)
    if (!entry) {
      this.counters.misses++
      return undefined
    }
    this.counters.hits++
    this.touch(entry)
    return entry.value
  }

  /** put / set / insert: a new value for an existing key replaces the old one. */
  put(key: string, value: string): void {
    const old = this.live(key)
    if (old) {
      this.entries.delete(key)
      this.notify(old, 'REPLACED')
    }
    this.entries.set(key, { key, value, expiresAt: this.clock + this.ttl })
    this.evictIfNeeded()
  }

  /** get(key, loader) / get_with: a miss runs the loader once and stores its result. */
  getWithLoader(key: string, loader: (key: string) => string): string {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    this.counters.loads++
    const value = loader(key)
    this.put(key, value)
    return value
  }

  invalidate(key: string): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    this.entries.delete(key)
    this.notify(entry, 'EXPLICIT')
    return true
  }

  invalidateAll(): void {
    for (const entry of [...this.entries.values()]) this.invalidate(entry.key)
  }

  /** Moves the fake clock; expired entries are removed by the next access or cleanUp(). */
  advance(ms: number): void {
    this.clock += ms
  }

  /** cleanUp / purgeStale / run_pending_tasks: removes every expired entry now. */
  cleanUp(): void {
    for (const entry of [...this.entries.values()]) this.live(entry.key)
  }

  /** The entry if present and not expired; an expired one is removed on the way. */
  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt <= this.clock) {
      this.entries.delete(key)
      this.notify(entry, 'EXPIRED')
      return undefined
    }
    return entry
  }

  private touch(entry: Entry): void {
    this.entries.delete(entry.key)
    this.entries.set(entry.key, entry)
  }

  private evictIfNeeded(): void {
    while (this.entries.size > this.maximumSize) {
      const eldest = this.entries.values().next().value as Entry
      this.entries.delete(eldest.key)
      this.counters.evictions++
      this.notify(eldest, 'SIZE')
    }
  }

  private notify(entry: Entry, cause: RemovalCause): void {
    const removal: Removal = { key: entry.key, value: entry.value, cause, at: this.clock }
    for (const listener of this.listeners) listener(removal)
  }
}

/** One step of a scripted session, shared by the playground and the check against lru-cache. */
export type Op =
  | { op: 'get'; key: string }
  | { op: 'put'; key: string; value: string }
  | { op: 'load'; key: string }
  | { op: 'invalidate'; key: string }
  | { op: 'invalidateAll' }
  | { op: 'advance'; ms: number }
  | { op: 'cleanUp' }

/** Applies one op; returns a short description of what happened. */
export function apply(cache: BoundedCache, step: Op, loader: (key: string) => string = (k) => `loaded ${k}`): string {
  switch (step.op) {
    case 'get': {
      const v = cache.get(step.key)
      return v === undefined ? `get ${step.key}: miss` : `get ${step.key}: hit (${v})`
    }
    case 'put':
      cache.put(step.key, step.value)
      return `put ${step.key}=${step.value}`
    case 'load': {
      const before = cache.stats().loads
      const v = cache.getWithLoader(step.key, loader)
      return cache.stats().loads > before ? `get-with-loader ${step.key}: miss, loaded (${v})` : `get-with-loader ${step.key}: hit (${v})`
    }
    case 'invalidate':
      return cache.invalidate(step.key) ? `invalidate ${step.key}` : `invalidate ${step.key}: not present`
    case 'invalidateAll':
      cache.invalidateAll()
      return 'invalidateAll'
    case 'advance':
      cache.advance(step.ms)
      return `clock +${step.ms / 1000} s`
    case 'cleanUp':
      cache.cleanUp()
      return 'cleanUp'
  }
}

/** The scripted session the capture runs against both lru-cache and this model. */
export const CHECK_SCRIPT: readonly Op[] = [
  { op: 'put', key: 'a', value: '1' },
  { op: 'put', key: 'b', value: '1' },
  { op: 'put', key: 'c', value: '1' },
  { op: 'get', key: 'a' },
  { op: 'put', key: 'd', value: '1' },
  { op: 'put', key: 'c', value: '2' },
  { op: 'load', key: 'e' },
  { op: 'get', key: 'b' },
  { op: 'advance', ms: 30_000 },
  { op: 'put', key: 'f', value: '1' },
  { op: 'invalidate', key: 'c' },
  { op: 'advance', ms: 40_000 },
  { op: 'get', key: 'e' },
  { op: 'get', key: 'f' },
  { op: 'load', key: 'g' },
  { op: 'cleanUp' },
]
