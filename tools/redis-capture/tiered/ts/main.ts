import { createInterface } from 'node:readline'
import { Redis } from 'ioredis'
import pg from 'pg'
import { TieredProductCache, type Level, type Read } from './cache.ts'
import { zipf } from './zipf.ts'

/**
 * Reads commands from stdin and prints one JSON line per event, so a script can drive two
 * instances side by side:
 *   get ID · update ID PRICE · update-silent ID PRICE · clear-l1 · bench pg|redis|tiered N ·
 * stampede N on|off · quit
 */
const instance = process.env.INSTANCE ?? 'A'
const print = (event: Record<string, unknown>) => console.log(JSON.stringify({ inst: instance, ...event }))
const ms = (since: bigint) => Number(process.hrtime.bigint() - since) / 1e6
const round = (n: number, digits: number) => Number(n.toFixed(digits))

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'
const cache = new TieredProductCache(
  new pg.Pool({ connectionString: process.env.PG_URL ?? 'postgres://shop@localhost:5432/shop', max: 20 }),
  new Redis(redisUrl),
  new Redis(redisUrl),
  Number(process.env.L1_TTL_MS ?? 10_000),
)
cache.onEvict = (key) => print({ ev: 'evict', key, reason: 'pubsub' })
await cache.listen()

async function bench(mode: string, n: number) {
  const read: (id: number) => Promise<Read> =
    mode === 'pg' ? (id) => cache.getFromDatabase(id) : mode === 'redis' ? (id) => cache.getRedisOnly(id) : (id) => cache.get(id)
  cache.clearL1()
  const next = zipf(10_000, 1.1, 42)
  const served: Record<Level, number> = { L1: 0, L2: 0, PG: 0 }
  const micros = new Float64Array(n)
  const queriesBefore = cache.queries
  const start = process.hrtime.bigint()
  for (let i = 0; i < n; i++) {
    const id = next()
    const t = process.hrtime.bigint()
    const r = await read(id)
    micros[i] = Number(process.hrtime.bigint() - t) / 1e3
    served[r.level]++
  }
  const seconds = ms(start) / 1e3
  micros.sort()
  print({
    ev: 'bench', mode, n, l1: served.L1, l2: served.L2, pg: served.PG, pgQueries: cache.queries - queriesBefore,
    p50us: round(micros[n >> 1], 1), p95us: round(micros[Math.floor(n * 0.95)], 1), p99us: round(micros[Math.floor(n * 0.99)], 1),
    avgUs: round(micros.reduce((a, b) => a + b, 0) / n, 1), readsPerSec: Math.round(n / seconds),
  })
}

/** N concurrent requests for the same cold product; how many of them reached Postgres. */
async function stampede(n: number, coalesce: boolean) {
  await cache.forget(7)
  const before = cache.queries
  const t = process.hrtime.bigint()
  await Promise.all(Array.from({ length: n }, () => (coalesce ? cache.get(7) : cache.getUncoalesced(7))))
  print({ ev: 'stampede', n, coalesce, pgQueries: cache.queries - before, ms: round(ms(t), 3) })
}

print({ ev: 'ready' })
for await (const line of createInterface({ input: process.stdin })) {
  const [cmd, a, b] = line.trim().split(/\s+/)
  if (cmd === 'get') {
    const t = process.hrtime.bigint()
    const r = await cache.get(Number(a))
    print({ ev: 'get', key: `product:${a}`, served: r.level, ms: round(ms(t), 3), version: r.product.version, price: r.product.priceCents })
  } else if (cmd === 'update' || cmd === 'update-silent') {
    const t = process.hrtime.bigint()
    const version = await cache.updatePrice(Number(a), Number(b), cmd === 'update')
    print({ ev: 'update', key: `product:${a}`, price: Number(b), version, publish: cmd === 'update', ms: round(ms(t), 3) })
  } else if (cmd === 'clear-l1') {
    cache.clearL1()
    print({ ev: 'clear-l1' })
  } else if (cmd === 'bench') await bench(a, Number(b))
  else if (cmd === 'stampede') await stampede(Number(a), b === 'on')
  else if (cmd === 'quit') break
  else print({ ev: 'error', message: `unknown command ${cmd}` })
}
process.exit(0)
