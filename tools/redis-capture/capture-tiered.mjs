// Records the "Multi-level caching" lesson: the same three-level cache (in-process L1 → Redis L2 → Postgres) written
// with Micronaut + Caffeine, TypeScript + lru-cache and Rust + moka, each run as two instances against one Redis and
// one Postgres: a read trace with invalidation, a stale read, a stampede, and a benchmark of three strategies.
//   (cd tiered/micronaut && gradle installDist); (cd tiered/ts && npm install); (cd tiered/rust && cargo build --release)
//   node capture-tiered.mjs ../../src/modules/redis/data/tiered.ts
// Redis on port 17400, Postgres on 17401.
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { ROOT, Server, sleep, version } from './lib/server.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-tiered.mjs <out.ts>')
const HERE = join(dirname(fileURLToPath(import.meta.url)), 'tiered')
const REDIS_PORT = 17400
const PG_PORT = 17401
const L1_TTL_MS = 3000

/** How each app is started; all three speak the same stdin/JSON protocol. */
const APPS = {
  micronaut: {
    cmd: join(HERE, 'micronaut/build/install/tiered-cache/bin/tiered-cache'), args: [],
    env: { REDIS_URI: `redis://localhost:${REDIS_PORT}?timeout=2s`, PG_URL: `jdbc:postgresql://localhost:${PG_PORT}/shop`, L1_TTL: `${L1_TTL_MS}ms` },
  },
  ts: {
    cmd: 'node', args: [join(HERE, 'ts/main.ts')],
    env: { REDIS_URL: `redis://localhost:${REDIS_PORT}`, PG_URL: `postgres://shop@localhost:${PG_PORT}/shop`, L1_TTL_MS: String(L1_TTL_MS) },
  },
  rust: {
    cmd: join(HERE, 'rust/target/release/tiered-cache'), args: [],
    env: { REDIS_URL: `redis://localhost:${REDIS_PORT}`, PG_URL: `host=localhost port=${PG_PORT} user=shop dbname=shop`, L1_TTL_MS: String(L1_TTL_MS) },
  },
}
for (const [name, app] of Object.entries(APPS)) if (app.cmd !== 'node' && !existsSync(app.cmd)) throw new Error(`build the ${name} app first`)

// ---------- Postgres: a throwaway cluster with products and their reviews ----------
const PGDATA = join(ROOT, 'pg')
const psql = (sql, db = 'shop') => execFileSync('psql', ['-X', '-q', '-A', '-t', '-h', 'localhost', '-p', String(PG_PORT), '-U', 'shop', '-d', db, '-c', sql]).toString().trim()
function startPostgres() {
  mkdirSync(PGDATA, { recursive: true })
  execFileSync('initdb', ['-U', 'shop', '--auth=trust', '-D', PGDATA], { stdio: 'ignore' })
  execFileSync('pg_ctl', ['-D', PGDATA, '-l', join(ROOT, 'pg.log'), '-o', `-p ${PG_PORT} -k ${ROOT} -c listen_addresses=localhost`, '-w', 'start'], { stdio: 'ignore' })
  psql('CREATE DATABASE shop', 'postgres')
  psql(`
    CREATE TABLE products (id int PRIMARY KEY, name text NOT NULL, price_cents int NOT NULL, version int NOT NULL DEFAULT 1);
    CREATE TABLE reviews (product_id int NOT NULL REFERENCES products, stars int NOT NULL);
    INSERT INTO products SELECT g, 'Product ' || g, 500 + (g * 37 % 9500), 1 FROM generate_series(1, 10000) g;
    UPDATE products SET name = 'Headphones', price_cents = 7999 WHERE id = 7;
    UPDATE products SET name = 'Desk lamp', price_cents = 1999 WHERE id = 42;
    INSERT INTO reviews SELECT 1 + (g::bigint * 7919 % 10000), 1 + (g * 31 % 5) FROM generate_series(1, 500000) g;
    CREATE INDEX reviews_product_id ON reviews (product_id);
    ANALYZE;`)
}
const stopPostgres = () => { try { execFileSync('pg_ctl', ['-D', PGDATA, '-m', 'fast', 'stop'], { stdio: 'ignore' }) } catch { /* not running */ } }

// ---------- one running app instance ----------
class Instance {
  constructor(app, name, env = {}) {
    this.name = name
    this.events = []
    this.proc = spawn(app.cmd, app.args, { env: { ...process.env, ...app.env, INSTANCE: name, ...env }, stdio: ['pipe', 'pipe', 'pipe'] })
    this.stderr = []
    this.proc.stderr.on('data', (d) => this.stderr.push(d.toString()))
    createInterface({ input: this.proc.stdout }).on('line', (line) => {
      if (line.startsWith('{')) this.events.push({ at: Date.now(), ...JSON.parse(line) })
    })
  }
  async waitFor(pred, from = 0, timeoutMs = 60_000) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const hit = this.events.slice(from).find(pred)
      if (hit) return hit
      await sleep(5)
    }
    throw new Error(`${this.name}: timed out; stderr:\n${this.stderr.join('').slice(-2000)}`)
  }
  /** Sends one command and waits for the event it produces. */
  async run(cmd, ev) {
    const from = this.events.length
    this.proc.stdin.write(cmd + '\n')
    return this.waitFor((e) => e.ev === ev, from)
  }
  stop() {
    this.proc.stdin.write('quit\n')
    return new Promise((r) => { this.proc.on('exit', r); setTimeout(() => { this.proc.kill('SIGKILL'); r() }, 5000) })
  }
}

// ---------- the scenario, the same for every language ----------
async function scenario(app, redis) {
  await redis.call('FLUSHALL')
  psql('UPDATE products SET price_cents = 1999, version = 1 WHERE id = 42')
  const a = new Instance(app, 'A')
  const b = new Instance(app, 'B')
  await a.waitFor((e) => e.ev === 'ready')
  await b.waitFor((e) => e.ev === 'ready')
  const t0 = Date.now()
  const steps = []
  const step = async (inst, cmd, ev, note) => {
    const e = await inst.run(cmd, ev)
    steps.push({ at: e.at - t0, cmd: `${inst.name}> ${cmd}`, event: strip(e), note })
    return e
  }
  // warm-up so that JIT and connection set-up do not show up as cache latency
  for (const inst of [a, b]) { await inst.run('get 1', 'get'); await inst.run('clear-l1', 'clear-l1') }
  await redis.call('FLUSHALL')

  await step(a, 'get 42', 'get', 'cold: missed L1 and Redis, read Postgres, filled both')
  await step(a, 'get 42', 'get', 'now in A’s own memory')
  await step(b, 'get 42', 'get', 'B has never seen it, but Redis has: A’s load helps B')
  await step(b, 'get 42', 'get', 'and now B has it in memory too')
  const evictsBefore = { A: a.events.length, B: b.events.length }
  await step(a, 'update 42 2499', 'update', 'Postgres updated, Redis copy deleted, invalidation published')
  for (const inst of [a, b]) {
    const e = await inst.waitFor((x) => x.ev === 'evict', evictsBefore[inst.name], 3000)
    steps.push({ at: e.at - t0, cmd: null, event: strip(e), note: `${inst.name} heard the invalidation and dropped its copy` })
  }
  await step(b, 'get 42', 'get', 'new price, loaded fresh from Postgres')
  await step(a, 'get 42', 'get', 'A finds the fresh copy B just put in Redis')
  await step(a, 'update-silent 42 2999', 'update', 'a write that forgets to publish the invalidation')
  await step(b, 'get 42', 'get', 'B still serves the old price from its own memory')
  await sleep(L1_TTL_MS + 300)
  await step(b, 'get 42', 'get', `after the ${L1_TTL_MS / 1000} s L1 TTL: the stale copy expired`)

  const stampedeOff = strip(await a.run('stampede 100 off', 'stampede'))
  const stampedeOn = strip(await a.run('stampede 100 on', 'stampede'))
  await a.stop()
  await b.stop()

  // the benchmark: one instance, a 10 s L1 TTL, 20,000 Zipf reads per strategy, caches emptied before each
  const bench = new Instance(app, 'A', { L1_TTL: '10s', L1_TTL_MS: '10000' })
  await bench.waitFor((e) => e.ev === 'ready')
  await bench.run('bench pg 2000', 'bench') // warm-up
  const results = []
  for (const mode of ['pg', 'redis', 'tiered']) {
    await redis.call('FLUSHALL')
    results.push(strip(await bench.run(`bench ${mode} 20000`, 'bench')))
  }
  await bench.stop()
  return { steps, stampede: [stampedeOff, stampedeOn], bench: results }
}
const strip = ({ at: _at, ...rest }) => rest

// ---------- run ----------
const out = { redisVersion: version(), postgresVersion: execFileSync('postgres', ['--version']).toString().trim().split(' ').pop(), l1TtlMs: L1_TTL_MS }
const redisServer = new Server('tiered', REDIS_PORT)
try {
  startPostgres()
  await redisServer.start()
  const redis = await redisServer.client()

  // what one product page costs at each level, measured outside the apps
  out.explain = psql(`EXPLAIN (ANALYZE, COSTS OFF, TIMING ON) SELECT p.id, p.name, p.price_cents, p.version, coalesce(avg(r.stars), 0)::float8 AS rating, count(r.product_id) AS reviews FROM products p LEFT JOIN reviews r ON r.product_id = p.id WHERE p.id = 42 GROUP BY p.id`)
  out.rows = { products: Number(psql('SELECT count(*) FROM products')), reviews: Number(psql('SELECT count(*) FROM reviews')) }

  out.apps = {}
  for (const [name, app] of Object.entries(APPS)) {
    console.error(`recording ${name}…`)
    out.apps[name] = await scenario(app, redis)
  }
  await redis.call('SET', 'product:42', JSON.stringify({ id: 42, name: 'Desk lamp', priceCents: 2999, version: 3, rating: 3.02, reviews: 50 }))
  out.valueBytes = JSON.stringify({ id: 42, name: 'Desk lamp', priceCents: 2999, version: 3, rating: 3.02, reviews: 50 }).length
  out.memoryUsage = await redis.call('MEMORY', 'USAGE', 'product:42')
  redis.close()
} finally {
  await redisServer.stop()
  stopPostgres()
}

let text = JSON.stringify(out, null, 1).replaceAll(String(REDIS_PORT), '6379').replaceAll(String(PG_PORT), '5432')
for (const secret of [userInfo().username, homedir()]) if (text.includes(secret)) throw new Error(`recording contains "${secret}"`)
writeFileSync(outFile, `// Recorded by tools/redis-capture/capture-tiered.mjs (Redis ${out.redisVersion}, PostgreSQL ${out.postgresVersion}) — do not edit by hand.\n\nexport const TIERED = ${text} as const\n`)
console.error('wrote', outFile)
