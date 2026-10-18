/*
 * Three rate limiters, as pure functions over request times (ms). They match the
 * Lua scripts recorded in the locks experiment; check-simulator.mjs compares the
 * sliding log and the token bucket with the recorded decisions.
 */

export interface Decision {
  readonly at: number
  readonly allowed: boolean
  /** Count in the window (fixed, sliding) or tokens left (bucket) after the decision. */
  readonly level: number
}

/** INCR on a key per window, e.g. rate:user:7:<minute>. */
export function fixedWindow(times: readonly number[], windowMs: number, limit: number): Decision[] {
  const counts = new Map<number, number>()
  return times.map((at) => {
    const w = Math.floor(at / windowMs)
    const n = (counts.get(w) ?? 0) + 1
    counts.set(w, n)
    return { at, allowed: n <= limit, level: n }
  })
}

/** A sorted set of accepted request times; anything older than the window is removed first. */
export function slidingLog(times: readonly number[], windowMs: number, limit: number): Decision[] {
  let log: number[] = []
  return times.map((at) => {
    log = log.filter((t) => t > at - windowMs)
    if (log.length >= limit) return { at, allowed: false, level: log.length }
    log.push(at)
    return { at, allowed: true, level: log.length }
  })
}

/** Tokens refill continuously at `perSecond`, up to `capacity`; each request takes one. */
export function tokenBucket(times: readonly number[], capacity: number, perSecond: number): Decision[] {
  let tokens = capacity
  let last: number | null = null
  return times.map((at) => {
    if (last !== null) tokens = Math.min(capacity, tokens + ((at - last) * perSecond) / 1000)
    last = at
    const allowed = tokens >= 1
    if (allowed) tokens -= 1
    return { at, allowed, level: Math.round(tokens * 100) / 100 }
  })
}
