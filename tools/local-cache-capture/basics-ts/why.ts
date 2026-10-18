// Why a cache and not a Map: heap growth of an unbounded Map vs a bounded LRUCache, and what one read costs
// (a cache hit, a Map lookup, a Redis GET on localhost, recomputing the value). Prints JSON lines.
// Run with: node --expose-gc why.ts   (REDIS_PORT selects the Redis server)
import { LRUCache } from 'lru-cache'
import { Redis } from 'ioredis'

const emit = (record: object) => console.log(JSON.stringify(record))
const gc = (globalThis as { gc?: () => void }).gc
if (!gc) throw new Error('run with --expose-gc')

const TOTAL = 1_000_000
const STEP = 100_000
const valueFor = (i: number) => `{"id":${i},"name":"user ${i}","email":"user${i}@example.com","plan":"basic"}`

function heapMb(): number {
  gc!()
  gc!()
  return process.memoryUsage().heapUsed / 2 ** 20
}

// #region heap
function growth(kind: string, store: { set(k: string, v: string): unknown; readonly size: number }) {
  const base = heapMb()
  for (let i = 1; i <= TOTAL; i++) {
    store.set(`user:${i}`, valueFor(i)) // every key is new: nothing is ever read twice
    if (i % STEP === 0) emit({ t: 'heap', kind, inserted: i, size: store.size, mb: +(heapMb() - base).toFixed(1) })
  }
}
growth('map', new Map<string, string>()) // grows forever
growth('cache', new LRUCache<string, string>({ max: 10_000 })) // stays at 10,000
// #endregion

// ---- latency: medians of several batches, after a warm-up ----
const KEYS = 10_000
const keys = Array.from({ length: KEYS }, (_, i) => `user:${i}`)
const cache = new LRUCache<string, string>({ max: KEYS })
const map = new Map<string, string>()
for (let i = 0; i < KEYS; i++) {
  cache.set(keys[i], valueFor(i))
  map.set(keys[i], valueFor(i))
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

/** ns per call: runs `fn` over the keys in batches and returns the median batch. */
function perCall(fn: (i: number) => unknown, batch = 1_000_000, rounds = 15): number {
  let sink = 0
  for (let i = 0; i < batch; i++) sink += fn(i % KEYS) ? 1 : 0 // warm-up
  const samples: number[] = []
  for (let r = 0; r < rounds; r++) {
    const t0 = process.hrtime.bigint()
    for (let i = 0; i < batch; i++) sink += fn(i % KEYS) ? 1 : 0
    samples.push(Number(process.hrtime.bigint() - t0) / batch)
  }
  if (sink < 0) console.log(sink)
  return median(samples)
}

emit({ t: 'latency', op: 'cache-get', ns: perCall((i) => cache.get(keys[i])) })
emit({ t: 'latency', op: 'map-get', ns: perCall((i) => map.get(keys[i])) })
emit({ t: 'latency', op: 'compute', ns: perCall((i) => valueFor(i), 200_000) }) // build the value again

const redis = new Redis({ port: Number(process.env.REDIS_PORT ?? 6379) })
for (let i = 0; i < KEYS; i++) await redis.set(keys[i], valueFor(i))
for (let i = 0; i < 5_000; i++) await redis.get(keys[i % KEYS]) // warm-up
const samples: number[] = []
for (let i = 0; i < 20_000; i++) {
  const t0 = process.hrtime.bigint()
  await redis.get(keys[i % KEYS]) // one round trip, awaited
  samples.push(Number(process.hrtime.bigint() - t0))
}
samples.sort((a, b) => a - b)
emit({ t: 'latency', op: 'redis-get', ns: samples[samples.length >> 1], p99: samples[Math.floor(samples.length * 0.99)] })
redis.disconnect()
