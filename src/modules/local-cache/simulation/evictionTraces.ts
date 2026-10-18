/*
 * Deterministic access traces for the eviction lesson. The same generators produce the files the real libraries
 * (Caffeine, lru-cache, moka) replayed in tools/local-cache-capture/capture-policies.mjs and the shorter traces the
 * lesson's playground runs in the browser, so both see the same shapes of traffic.
 *
 * Plain TypeScript with no imports: Node runs this file directly (type stripping) when it writes the trace files.
 */

/** xorshift32: tiny, fast and deterministic, so every run and every language sees the same sequence. */
export function xorshift(seed: number): () => number {
  let state = seed | 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

/** Keys 0…n-1 drawn with Zipf popularity: key k is requested in proportion to 1 / (k+1)^skew. */
export function zipf(n: number, skew: number, random: () => number): () => number {
  const cdf = new Float64Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) cdf[i] = sum += 1 / Math.pow(i + 1, skew)
  for (let i = 0; i < n; i++) cdf[i] /= sum
  return () => {
    const u = random()
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (cdf[mid] < u) lo = mid + 1
      else hi = mid
    }
    return lo
  }
}

export type TraceId = 'zipf-0.6' | 'zipf-0.8' | 'zipf-1.0' | 'scan' | 'loop' | 'shift'

export interface TraceSpec {
  id: TraceId
  label: string
  /** One plain sentence: what the traffic looks like. */
  description: string
  /** Builds the trace; `scale` 1 is the recorded size (1,000,000 requests over 100,000 keys). */
  generate: (scale: number) => Int32Array
}

const LENGTH = 1_000_000
const UNIVERSE = 100_000
/** Keys of one-off scans start here, far away from the popular keys. */
const SCAN_BASE = 10_000_000

const zipfTrace = (skew: number, seed: number) => (scale: number) => {
  const length = Math.round(LENGTH * scale)
  const next = zipf(Math.round(UNIVERSE * scale), skew, xorshift(seed))
  const out = new Int32Array(length)
  for (let i = 0; i < length; i++) out[i] = next()
  return out
}

export const TRACES: readonly TraceSpec[] = [
  { id: 'zipf-0.6', label: 'Zipf 0.6', description: 'Mild popularity skew: a long tail of keys gets most requests.', generate: zipfTrace(0.6, 0x1234567) },
  { id: 'zipf-0.8', label: 'Zipf 0.8', description: 'Typical web traffic: some keys are clearly hot.', generate: zipfTrace(0.8, 0x2345678) },
  { id: 'zipf-1.0', label: 'Zipf 1.0', description: 'Strong skew: a small set of keys gets most requests.', generate: zipfTrace(1.0, 0x3456789) },
  {
    id: 'scan',
    label: 'Zipf + scans',
    description: 'Zipf 0.8 traffic, and every 100,000 requests a one-off scan of 20,000 keys that are never read again (a batch job, a crawler).',
    generate: (scale) => {
      const length = Math.round(LENGTH * scale)
      const period = Math.round(100_000 * scale)
      const scanLength = Math.round(20_000 * scale)
      const next = zipf(Math.round(UNIVERSE * scale), 0.8, xorshift(0x4567891))
      const out = new Int32Array(length)
      let scanKey = SCAN_BASE
      for (let i = 0; i < length; i++) out[i] = i % period >= period - scanLength ? scanKey++ : next()
      return out
    },
  },
  {
    id: 'loop',
    label: 'Loop',
    description: 'The same 6,000 keys read in a fixed order, over and over (a periodic job reading every row).',
    generate: (scale) => {
      const length = Math.round(LENGTH * scale)
      const loop = Math.round(6_000 * scale)
      const out = new Int32Array(length)
      for (let i = 0; i < length; i++) out[i] = i % loop
      return out
    },
  },
  {
    id: 'shift',
    label: 'Shifting hot set',
    description: 'Zipf 0.9 over 10,000 keys, and every 100,000 requests the popular keys move to a fresh set (yesterday’s news, today’s news).',
    generate: (scale) => {
      const length = Math.round(LENGTH * scale)
      const phase = Math.round(100_000 * scale)
      const hot = Math.round(10_000 * scale)
      const next = zipf(hot, 0.9, xorshift(0x5678912))
      const out = new Int32Array(length)
      for (let i = 0; i < length; i++) out[i] = Math.floor(i / phase) * hot + next()
      return out
    },
  },
]

/** Cache sizes (entries) the libraries were recorded at, for scale 1. */
export const RECORDED_SIZES = [500, 1_000, 2_500, 5_000] as const

export const traceById = (id: TraceId): TraceSpec => TRACES.find((t) => t.id === id)!
