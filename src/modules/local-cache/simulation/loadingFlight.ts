// A model of N callers asking for the same missing key, under three loading strategies.
// Pure TypeScript: no React. Times are in milliseconds from the first caller's arrival.

export interface FlightInput {
  callers: number
  /** Callers arrive evenly spread over this window. */
  arrivalSpreadMs: number
  loaderMs: number
  /** The loader fails (throws / rejects) instead of returning a value. */
  fails: boolean
}

export type CallerRole = 'loaded' | 'waited' | 'hit'
export interface CallerOutcome {
  id: number
  arriveMs: number
  /** When this caller's own loader call started (if it ran one). */
  loadStartMs?: number
  doneMs: number
  role: CallerRole
  ok: boolean
}

export interface FlightResult {
  callers: CallerOutcome[]
  loaderCalls: number
  /** Time the source of truth spent answering loader calls. */
  sourceBusyMs: number
  maxWaitMs: number
  medianWaitMs: number
  errors: number
}

/** One way of handling a miss. Each strategy decides who loads and when each caller is answered. */
export interface FlightStrategy {
  id: string
  label: string
  run(arrivals: number[], input: FlightInput): CallerOutcome[]
}

/** Check, load, put: every caller that misses runs its own load. */
const naive: FlightStrategy = {
  id: 'naive',
  label: 'naive',
  run(arrivals, { loaderMs, fails }) {
    let cachedAt = Infinity
    return arrivals.map((at, id) => {
      if (at >= cachedAt) return { id, arriveMs: at, doneMs: at, role: 'hit', ok: true }
      const done = at + loaderMs
      if (!fails) cachedAt = Math.min(cachedAt, done)
      return { id, arriveMs: at, loadStartMs: at, doneMs: done, role: 'loaded', ok: !fails }
    })
  },
}

/**
 * Shared in-flight load (lru-cache fetch(), moka get_with / try_get_with, Caffeine AsyncCache): callers that miss
 * while a load is running wait for that load and get its result — value or error. After a failure the next caller
 * starts a new load.
 */
const shared: FlightStrategy = {
  id: 'shared',
  label: 'shared result',
  run(arrivals, { loaderMs, fails }) {
    let flight: { start: number; end: number } | null = null
    let cachedAt = Infinity
    return arrivals.map((at, id) => {
      if (at >= cachedAt) return { id, arriveMs: at, doneMs: at, role: 'hit', ok: true }
      if (flight && at < flight.end) return { id, arriveMs: at, doneMs: flight.end, role: 'waited', ok: !fails }
      flight = { start: at, end: at + loaderMs }
      if (!fails) cachedAt = flight.end
      return { id, arriveMs: at, loadStartMs: at, doneMs: flight.end, role: 'loaded', ok: !fails }
    })
  },
}

/**
 * Blocking compute (Caffeine Cache.get(key, loader), ConcurrentHashMap.computeIfAbsent): waiters block on the key.
 * On success they all get the value; on failure the next waiter in line runs the loader itself — one after another.
 */
const blocking: FlightStrategy = {
  id: 'blocking',
  label: 'blocking compute',
  run(arrivals, { loaderMs, fails }) {
    let lockFreeAt = 0
    let cachedAt = Infinity
    return arrivals.map((at, id) => {
      if (at >= cachedAt) return { id, arriveMs: at, doneMs: at, role: 'hit', ok: true }
      if (!fails && at < lockFreeAt) return { id, arriveMs: at, doneMs: lockFreeAt, role: 'waited', ok: true }
      const start = Math.max(at, lockFreeAt)
      lockFreeAt = start + loaderMs
      if (!fails) cachedAt = lockFreeAt
      return { id, arriveMs: at, loadStartMs: start, doneMs: lockFreeAt, role: 'loaded', ok: !fails }
    })
  },
}

export const STRATEGIES: readonly FlightStrategy[] = [naive, shared, blocking]

export function simulateFlight(strategy: FlightStrategy, input: FlightInput): FlightResult {
  const n = Math.max(1, input.callers)
  const arrivals = Array.from({ length: n }, (_, i) => (n === 1 ? 0 : (input.arrivalSpreadMs * i) / (n - 1)))
  const callers = strategy.run(arrivals, input)
  const waits = callers.map((c) => c.doneMs - c.arriveMs).sort((a, b) => a - b)
  const loaders = callers.filter((c) => c.role === 'loaded')
  return {
    callers,
    loaderCalls: loaders.length,
    sourceBusyMs: loaders.length * input.loaderMs,
    maxWaitMs: waits[waits.length - 1],
    medianWaitMs: waits[Math.floor((waits.length - 1) / 2)],
    errors: callers.filter((c) => !c.ok).length,
  }
}
