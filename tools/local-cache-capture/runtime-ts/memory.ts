import { LRUCache } from 'lru-cache'
import { emit } from './out.ts'

const N = 1_000_000
/** Heap in use plus typed-array memory (lru-cache keeps its linked list in typed arrays), after full GCs. */
function heapAfterGc(): number {
  const gc = (globalThis as { gc?: () => void }).gc
  if (!gc) throw new Error('run with node --expose-gc')
  for (let i = 0; i < 4; i++) gc()
  const m = process.memoryUsage()
  return m.heapUsed + m.arrayBuffers
}

/** Bytes per object for N objects made by `make`, kept alive in an array (array slot excluded). */
function perObject(make: (i: number) => unknown): number {
  const keep: unknown[] = new Array(N).fill(null)
  const before = heapAfterGc()
  for (let i = 0; i < N; i++) keep[i] = make(i)
  const per = (heapAfterGc() - before) / N
  if (keep[N - 1] == null) throw new Error()
  return per
}

export function footprint() {
  emit({
    exp: 'objects', lib: 'node', n: N,
    stringKey: perObject((i) => `product:${100_000 + i}`),
    productValue: perObject((i) => ({ id: i, name: `Product ${100_000 + i}`, priceCents: 1999 })),
  })
  // keys are small integers (no allocation of their own) and every value is the same object,
  // so the growth is what the structure adds per entry
  const value = { shared: true }
  const structures: [string, () => (k: number) => void][] = [
    ['Map', () => { const m = new Map<number, object>(); return (k) => void m.set(k, value) }],
    ['lru-cache, max', () => { const c = new LRUCache<number, object>({ max: N }); return (k) => void c.set(k, value) }],
    ['lru-cache, max + ttl', () => { const c = new LRUCache<number, object>({ max: N, ttl: 600_000 }); return (k) => void c.set(k, value) }],
    ['lru-cache, maxSize + sizeCalculation', () => { const c = new LRUCache<number, object>({ maxSize: N * 10, sizeCalculation: () => 1 }); return (k) => void c.set(k, value) }],
  ]
  let put: ((k: number) => void) | null = null
  for (const [name, make] of structures) {
    put = null                                            // let the previous structure go before measuring
    const before = heapAfterGc()
    put = make()
    for (let k = 0; k < N; k++) put(k)
    const after = heapAfterGc()
    emit({ exp: 'footprint', lib: 'node', structure: name, n: N, bytesPerEntry: (after - before) / N, alive: typeof put })
  }
}

/** A cache bounded by bytes: maxSize + sizeCalculation, with dispose() telling us what left and why. */
export function weight() {
  // #region weight
  const evicted: string[] = []
  const cache = new LRUCache<string, Buffer>({
    maxSize: 1_000_000,                                   // 1 MB budget
    sizeCalculation: (value) => value.length,             // weigh each entry by its bytes
    dispose: (_value, key, reason) => evicted.push(`${key} (${reason})`),
  })
  // #endregion
  const steps: [string, string, number?][] = [
    ['put', 'a', 300_000], ['put', 'b', 300_000], ['get', 'a'], ['get', 'a'], ['put', 'c', 300_000],
    ['put', 'd', 200_000], ['put', 'd', 200_000], ['put', 'e', 400_000], ['put', 'e', 400_000],
    ['put', 'e', 400_000], ['put', 'huge', 2_000_000],
  ]
  for (const [op, key, bytes] of steps) {
    if (op === 'put') cache.set(key, Buffer.alloc(bytes!))
    else cache.get(key)
    emit({ exp: 'weight', lib: 'lru-cache', op, key, bytes: bytes ?? 0, present: [...cache.keys()].sort(), weightedSize: cache.calculatedSize, evicted: [...evicted] })
    evicted.length = 0
  }
}
