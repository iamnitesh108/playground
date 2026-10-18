/*
 * Average read time of a cache in front of a slower source, for a given hit ratio.
 * A hit costs one cache lookup; a miss costs the lookup, the load from the source and the put.
 */

export interface LatencyInput {
  /** Fraction of reads answered by the cache, 0…1. */
  hitRatio: number
  /** One cache lookup, ns. */
  cacheNs: number
  /** One load from the source behind the cache, ns. */
  missNs: number
}

export interface LatencyResult {
  averageNs: number
  /** How much faster than always going to the source. */
  speedup: number
  /** Share of the total read time spent on misses, 0…1. */
  missShare: number
}

export function averageRead({ hitRatio, cacheNs, missNs }: LatencyInput): LatencyResult {
  const h = Math.min(1, Math.max(0, hitRatio))
  const hitPart = h * cacheNs
  const missPart = (1 - h) * (cacheNs + missNs + cacheNs) // look, load, put
  const averageNs = hitPart + missPart
  return { averageNs, speedup: missNs / averageNs, missShare: averageNs ? missPart / averageNs : 0 }
}

/** Formats nanoseconds as ns, µs or ms. */
export function formatNs(ns: number): string {
  if (ns < 1000) return `${ns < 10 ? ns.toFixed(1) : Math.round(ns)} ns`
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(ns < 10_000 ? 2 : 1)} µs`
  return `${(ns / 1_000_000).toFixed(2)} ms`
}
