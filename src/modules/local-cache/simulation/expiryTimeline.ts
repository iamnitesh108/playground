/*
 * One key, one cache, many reads over a few seconds: what each read gets under expire-after-write, expire-after-
 * access (idle) or refresh-after-write — whether it waited for a load, and how out of date its value was.
 *
 * The model follows the libraries' read paths:
 *  - a read of a missing or expired entry loads it and waits; reads arriving during that load wait for the same
 *    load (single-flight, like Caffeine's LoadingCache.get, moka's get_with and lru-cache's fetch);
 *  - expire-after-access restarts the clock on every read; expire-after-write does not;
 *  - refresh-after-write serves the current value and, once it is older than the refresh time, starts one
 *    background reload; the entry still expires at the hard TTL if nobody reads it.
 * Jitter, when set, shortens or lengthens each loaded entry's lifetime by up to ±jitter % (deterministic).
 */

export type ExpiryMode = 'write' | 'access' | 'refresh'
export type ReadPattern = 'steady' | 'sparse' | 'pause'

export interface ExpiryInput {
  mode: ExpiryMode
  /** Lifetime: time to live (write), time to idle (access), or the hard expiry under refresh. */
  ttlMs: number
  /** refresh mode: how old a value may get before a read triggers a background reload. */
  refreshMs: number
  loadMs: number
  /** The source of truth changes this often. */
  sourceChangeMs: number
  pattern: ReadPattern
  jitterPercent: number
  durationMs: number
}

export type ReadOutcome = 'hit' | 'waited' | 'refresh-trigger'

export interface ReadResult {
  at: number
  outcome: ReadOutcome
  waitMs: number
  version: number
  /** How long the source had already held a newer value than the one returned. */
  staleMs: number
}

export interface LoadSpan {
  from: number
  to: number
  version: number
  background: boolean
}

export interface EntrySpan {
  from: number
  to: number
  version: number
}

export interface ExpiryResult {
  reads: ReadResult[]
  loads: LoadSpan[]
  /** When an entry existed and was valid (fresh or not yet expired). */
  entries: EntrySpan[]
  /** When an entry expired (became invisible). */
  expirations: number[]
  sourceChanges: number[]
  stats: { reads: number; waited: number; totalWaitMs: number; maxWaitMs: number; loads: number; maxStaleMs: number; avgStaleMs: number }
}

/** Times at which the single reader asks for the key. */
export function readTimes(pattern: ReadPattern, durationMs: number): number[] {
  const out: number[] = []
  const every = pattern === 'sparse' ? 1500 : 250
  for (let t = 0; t <= durationMs; t += every) {
    if (pattern === 'pause' && t > durationMs * 0.3 && t < durationMs * 0.7) continue
    out.push(t)
  }
  return out
}

/** A repeatable pseudo-random factor in [-1, 1] per load, so the same settings always draw the same picture. */
const wobble = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

export function simulateExpiry(input: ExpiryInput): ExpiryResult {
  const { mode, ttlMs, refreshMs, loadMs, sourceChangeMs, pattern, jitterPercent, durationMs } = input
  const sourceVersion = (t: number) => Math.floor(t / sourceChangeMs) + 1
  const sourceChanges: number[] = []
  for (let t = sourceChangeMs; t <= durationMs; t += sourceChangeMs) sourceChanges.push(t)

  const reads: ReadResult[] = []
  const loads: LoadSpan[] = []
  const entries: EntrySpan[] = []
  const expirations: number[] = []

  interface Entry { version: number; writtenAt: number; lastAccess: number; lifetime: number; spanIndex: number }
  let entry: Entry | null = null
  let inflight: LoadSpan | null = null

  const lifetimeOf = () => ttlMs * (1 + (jitterPercent / 100) * wobble(loads.length))
  const expiresAt = (e: Entry) => (mode === 'access' ? e.lastAccess : e.writtenAt) + e.lifetime

  /** A finished load replaces the entry. */
  const complete = (load: LoadSpan) => {
    if (entry) entries[entry.spanIndex].to = Math.min(entries[entry.spanIndex].to, load.to)
    entries.push({ from: load.to, to: durationMs, version: load.version })
    entry = { version: load.version, writtenAt: load.to, lastAccess: load.to, lifetime: lifetimeOf(), spanIndex: entries.length - 1 }
    inflight = null
  }
  const startLoad = (at: number, background: boolean) => {
    const load: LoadSpan = { from: at, to: at + loadMs, version: sourceVersion(at), background }
    loads.push(load)
    inflight = load
    return load
  }
  const staleness = (version: number, at: number) => {
    // the source moved past `version` at version × sourceChangeMs
    const changedAt = version * sourceChangeMs
    return sourceVersion(at) > version ? at - changedAt : 0
  }

  for (const at of readTimes(pattern, durationMs)) {
    const pending = inflight as LoadSpan | null
    if (pending && pending.to <= at) complete(pending)
    const current = entry as Entry | null
    if (current && at >= expiresAt(current)) {
      const end = expiresAt(current)
      expirations.push(end)
      entries[current.spanIndex].to = end
      entry = null
    }
    const live = entry as Entry | null
    if (live) {
      live.lastAccess = at
      let outcome: ReadOutcome = 'hit'
      if (mode === 'refresh' && at - live.writtenAt >= refreshMs && !inflight) {
        startLoad(at, true)
        outcome = 'refresh-trigger'
      }
      reads.push({ at, outcome, waitMs: 0, version: live.version, staleMs: staleness(live.version, at) })
      continue
    }
    // missing or expired: wait for the load already in flight, or start one (single-flight)
    const load = (inflight as LoadSpan | null) ?? startLoad(at, false)
    reads.push({ at, outcome: 'waited', waitMs: load.to - at, version: load.version, staleMs: staleness(load.version, load.to) })
  }
  // an entry nobody read again still expires
  const last = entry as Entry | null
  if (last && expiresAt(last) < durationMs) {
    expirations.push(expiresAt(last))
    entries[last.spanIndex].to = expiresAt(last)
  }
  const pendingAtEnd = inflight as LoadSpan | null
  if (pendingAtEnd && pendingAtEnd.to <= durationMs) complete(pendingAtEnd)

  const waited = reads.filter((r) => r.outcome === 'waited')
  return {
    reads,
    loads,
    entries: entries.filter((e) => e.to > e.from),
    expirations,
    sourceChanges,
    stats: {
      reads: reads.length,
      waited: waited.length,
      totalWaitMs: waited.reduce((n, r) => n + r.waitMs, 0),
      maxWaitMs: Math.max(0, ...waited.map((r) => r.waitMs)),
      loads: loads.length,
      maxStaleMs: Math.max(0, ...reads.map((r) => r.staleMs)),
      avgStaleMs: reads.reduce((n, r) => n + r.staleMs, 0) / Math.max(1, reads.length),
    },
  }
}
