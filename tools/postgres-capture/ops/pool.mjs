import pg from 'pg' // run from tools/postgres-capture: node ops/pool.mjs
import { writeFileSync } from 'node:fs'
const base = { host: '127.0.0.1', port: 56432, user: 'app_rw', password: 'app-secret' }
const client = async (database) => { const c = new pg.Client({ ...base, database }); await c.connect(); return c }
const admin = async () => { const c = new pg.Client({ host: '127.0.0.1', port: 56432, user: 'pooladmin', password: 'admin-secret', database: 'pgbouncer' }); await c.connect(); return c }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pools = async (a, db) => {
  const r = await a.query({ text: 'SHOW POOLS', rowMode: 'array' })
  const cols = r.fields.map((f) => f.name)
  const pick = ['database', 'cl_active', 'cl_waiting', 'sv_active', 'sv_idle', 'pool_mode']
  return r.rows.filter((x) => x[0] === db).map((x) => Object.fromEntries(pick.map((p) => [p, x[cols.indexOf(p)]])))[0]
}
const out = {}
const a = await admin()

// 1. Five clients, two server connections, transaction mode
{
  const cs = await Promise.all([1, 2, 3, 4, 5].map(() => client('shop')))
  const t0 = Date.now()
  const runs = cs.map((c, i) => c.query('SELECT pg_backend_pid() AS pid, pg_sleep(1)').then((r) => ({ client: i + 1, backend: r.rows[0].pid, doneAfterMs: Date.now() - t0 })))
  await sleep(300)
  const during = await pools(a, 'shop')
  const results = await Promise.all(runs)
  out.queue = { during, results: results.map((r) => ({ ...r, doneAfterS: Math.round(r.doneAfterMs / 1000) })), after: await pools(a, 'shop') }
  await Promise.all(cs.map((c) => c.end()))
}

// 2. Session state leaks between clients in transaction mode (pool of one)
{
  const A = await client('shop_single'), B = await client('shop_single')
  const q = async (c, sql) => { let r = await c.query({ text: sql, rowMode: 'array' }); if (Array.isArray(r)) r = r[r.length - 1]; return r.rows?.length ? r.rows.map((x) => x.join(' | ')).join('\n') : r.command }
  const steps = []
  const run = async (who, c, sql) => steps.push({ who, sql, result: await q(c, sql) })
  await run('A', A, 'SHOW statement_timeout')
  await run('A', A, "SET statement_timeout = '5s'")
  await run('B', B, 'SHOW statement_timeout')
  await run('B', B, 'RESET statement_timeout')
  await run('A', A, "BEGIN; SET LOCAL statement_timeout = '5s'; COMMIT")
  await run('B', B, 'SHOW statement_timeout')
  await run('A', A, 'SELECT pg_backend_pid()')
  await run('B', B, 'SELECT pg_backend_pid()')
  out.leak = steps
  await A.end(); await B.end()
}

// 3. Session mode: idle clients keep their server connection
{
  const c1 = await client('shop_session'), c2 = await client('shop_session')
  await c1.query('SELECT 1'); await c2.query('SELECT 1')
  const c3 = await client('shop_session')
  const t0 = Date.now()
  const p = c3.query('SELECT 1 AS answer').then(() => Date.now() - t0)
  await sleep(500)
  const during = await pools(a, 'shop_session')
  await sleep(1500)
  await c1.end()
  const waitedMs = await p
  out.session = { during, waitedS: Math.round(waitedMs / 100) / 10, after: await pools(a, 'shop_session') }
  await c2.end(); await c3.end()
}

// 4. Named prepared statements through transaction pooling
{
  const cs = await Promise.all([1, 2, 3].map(() => client('shop')))
  const res = []
  for (let round = 0; round < 2; round++)
    for (const [i, c] of cs.entries()) {
      const r = await c.query({ name: 'order_count', text: 'SELECT count(*)::int AS n, pg_backend_pid() AS pid FROM app.orders WHERE amount > $1', values: [0] })
      res.push({ client: i + 1, round: round + 1, ...r.rows[0] })
    }
  out.prepared = res
  await Promise.all(cs.map((c) => c.end()))
}
await a.end()
writeFileSync(new URL('./pool.json', import.meta.url), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
