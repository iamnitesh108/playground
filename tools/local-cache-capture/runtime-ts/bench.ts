import { LRUCache } from 'lru-cache'
import { emit, median, zipfTrace } from './out.ts'

/**
 * One thread (Node has one for your JavaScript), the same workload as the Java and Rust apps:
 * 65,536 integer keys with Zipf popularity. get = reads that hit; put = writes into a cache half that size.
 */
const KEYS = 1 << 16
const TRACE = 1 << 20

function report(lib: string, op: string, pass: () => number) {
  for (let i = 0; i < 5; i++) pass()
  const rates: number[] = []
  for (let r = 0; r < 7; r++) {
    const t0 = performance.now()
    pass()
    rates.push(TRACE / ((performance.now() - t0) / 1000))
  }
  emit({ exp: 'bench', lib, op, opsPerSec: Math.round(median(rates)), passes: rates.length })
}

export function run() {
  const trace = zipfTrace(TRACE, KEYS, 0.99, 7)
  const full = new LRUCache<number, number>({ max: KEYS * 2 })
  const map = new Map<number, number>()
  for (let k = 0; k < KEYS; k++) {
    full.set(k, k)
    map.set(k, k)
  }
  const half = new LRUCache<number, number>({ max: KEYS / 2 })
  report('lru-cache', 'get', () => { let s = 0; for (let i = 0; i < TRACE; i++) s += full.get(trace[i])!; return s })
  report('lru-cache', 'put', () => { for (let i = 0; i < TRACE; i++) half.set(trace[i], i); return half.size })
  report('Map (no bound, no policy)', 'get', () => { let s = 0; for (let i = 0; i < TRACE; i++) s += map.get(trace[i])!; return s })
}
