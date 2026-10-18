/** Prints one JSON object per line: what the capture script records. */
export function emit(event: Record<string, unknown>): void {
  console.log(JSON.stringify(event, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1000) / 1000 : v)))
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** Keys with Zipf popularity: key 0 is the most popular, then 1, … (seeded, so every run is the same). */
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
