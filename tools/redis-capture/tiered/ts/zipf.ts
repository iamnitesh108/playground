/**
 * Product ids with a Zipf (power-law) popularity, the shape of real traffic: a few products get
 * most reads.
 * Deterministic (xorshift32 with a fixed seed), so every language's benchmark reads the same
 * sequence.
 */
export function zipf(products: number, skew: number, seed: number): () => number {
  const cdf = new Float64Array(products)
  let sum = 0
  for (let i = 0; i < products; i++) cdf[i] = sum += 1 / Math.pow(i + 1, skew)
  for (let i = 0; i < products; i++) cdf[i] /= sum
  let state = seed | 0
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    const u = (state >>> 1) / 2147483647
    let lo = 0
    let hi = products - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (cdf[mid] < u) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }
}
