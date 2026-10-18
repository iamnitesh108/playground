// A node-postgres pool under a burst of requests. Connection details come from the
// standard PG* environment variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
import pg from 'pg'

const pool = new pg.Pool({
  max: 5, // at most 5 connections to PostgreSQL
  idleTimeoutMillis: 10_000, // close a connection that sat unused for 10 s
  connectionTimeoutMillis: 2_000, // give up waiting for a free connection after 2 s
  maxLifetimeSeconds: 1_800, // replace every connection after 30 minutes
  application_name: 'orders-api', // shown in pg_stat_activity
})

// An idle connection can die (server restart, network); without a listener the process crashes.
pool.on('error', (err) => console.error('idle client error', err.message))

const stats = () => ({ total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount })

// 1. Twenty requests arrive at once; each runs a 200 ms query.
const start = performance.now()
const samples: { ms: number; total: number; idle: number; waiting: number }[] = []
const sampler = setInterval(() => samples.push({ ms: Math.round(performance.now() - start), ...stats() }), 50)
const results = await Promise.all(
  Array.from({ length: 20 }, async (_, i) => {
    const { rows } = await pool.query('SELECT pg_backend_pid() AS pid, pg_sleep(0.2)')
    return { request: i + 1, pid: rows[0].pid as number, doneMs: Math.round(performance.now() - start) }
  }),
)
clearInterval(sampler)

// 2. A transaction needs one client for all its statements: check out, use, always release.
async function placeOrder(userId: number, amount: number): Promise<number> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('INSERT INTO orders (user_id, amount) VALUES ($1, $2) RETURNING id', [userId, amount])
    await client.query('UPDATE users SET order_count = order_count + 1 WHERE id = $1', [userId])
    await client.query('COMMIT')
    return rows[0].id
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release() // forgetting this leaks the connection: the pool slowly runs dry
  }
}
const orderId = await placeOrder(1, 4200)

// 3. All five connections checked out and never released: the sixth caller times out.
const held = await Promise.all(Array.from({ length: 5 }, () => pool.connect()))
const waitStart = performance.now()
const timeout = await pool.connect().then(
  () => 'got a connection',
  (err: Error) => err.message,
)
const waitedMs = Math.round(performance.now() - waitStart)
held.forEach((c) => c.release())

console.log(JSON.stringify({ results, samples, orderId, timeout: { message: timeout, waitedMs, stats: stats() } }))
await pool.end()
