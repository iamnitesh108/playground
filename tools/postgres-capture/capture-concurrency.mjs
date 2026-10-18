import { homedir, userInfo } from 'node:os'
// Records the isolation, locking and constraint lessons on a real PostgreSQL 18:
// multi-session replays (2–4 sessions, with pg_locks / pgrowlocks after every step),
// lock conflict matrices, timeouts, a deadlock with its server log, and the
// output of the small TypeScript programs in concurrency-app/.
//
//   node capture-concurrency.mjs <port> <container> ../../src/modules/postgres/data/concurrency.ts
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(new URL('./concurrency-app/package.json', import.meta.url))
const pg = require('pg')

const [, , portArg, container, outFile] = process.argv
if (!portArg || !container || !outFile) {
  console.error('usage: node capture-concurrency.mjs <port> <container> <out.ts>')
  process.exit(1)
}
const conn = { host: '127.0.0.1', port: Number(portArg), user: 'postgres', password: 'lab', database: 'lab' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const client = async () => {
  const c = new pg.Client(conn)
  c.on('error', () => {}) // a server-side termination is recorded from the query instead
  await c.connect()
  return c
}

function describe(res) {
  if (Array.isArray(res)) res = res[res.length - 1]
  if (res.command === 'SELECT' && res.fields?.length) return { kind: 'rows', columns: res.fields.map((f) => f.name), rows: res.rows.map((r) => res.fields.map((f) => r[f.name])) }
  const tag =
    res.command === 'INSERT'
      ? `INSERT 0 ${res.rowCount}`
      : res.rowCount !== null && res.rowCount !== undefined && ['UPDATE', 'DELETE', 'SELECT', 'MERGE'].includes(res.command)
        ? `${res.command} ${res.rowCount}`
        : res.command
  return { kind: 'tag', tag }
}
const errorOf = (e) => ({ kind: 'error', code: e.code ?? 'XX000', message: e.message, detail: e.detail ?? null, ...(e.hint ? { hint: e.hint } : {}) })

/** One statement on one connection, recorded as rows, a command tag or an error. */
const q = (c, sql, params) => c.query(sql, params).then(describe, errorOf)

// ---------------------------------------------------------------------------
// Multi-session runner
// ---------------------------------------------------------------------------

/** pg_locks for the sessions, with pids replaced by session names. */
const lockRows = (relations, { own = false } = {}) => async (admin, names) => {
  const pids = Object.keys(names).map(Number)
  const { rows } = await admin.query(
    `SELECT l.pid, l.locktype, l.mode, l.granted,
            coalesce(l.relation::regclass::text, '') AS rel, l.page, l.tuple,
            l.transactionid::text AS txid, l.objid::text AS objid,
            pg_blocking_pids(l.pid) AS blocked_by
       FROM pg_locks l
      WHERE l.pid = ANY($1) AND l.locktype <> 'virtualxid'
      ORDER BY l.pid, l.granted DESC, l.locktype, l.mode`,
    [pids],
  )
  const ownXid = new Map()
  for (const r of rows) if (r.locktype === 'transactionid' && r.mode === 'ExclusiveLock') ownXid.set(r.txid, names[r.pid])
  return rows
    .filter((r) => (r.locktype === 'relation' ? relations.includes(r.rel) : r.locktype !== 'transactionid' || own || !r.granted))
    .map((r) => ({
      session: names[r.pid],
      lock: r.locktype,
      target:
        r.locktype === 'relation' ? r.rel
        : r.locktype === 'transactionid' ? `xid ${r.txid}${ownXid.has(r.txid) ? ` (${ownXid.get(r.txid)})` : ''}`
        : r.locktype === 'tuple' ? `${r.rel} (${r.page},${r.tuple})`
        : r.locktype === 'advisory' ? `key ${r.objid}`
        : r.rel,
      mode: r.mode,
      granted: r.granted,
      blockedBy: r.blocked_by.map((p) => names[p] ?? 'other'),
    }))
}

/** Row locks as pgrowlocks reads them from the tuples themselves. */
const rowLocks = (table) => async (admin, names) => {
  const { rows } = await admin.query(`SELECT locked_row::text AS row, multi, modes::text[] AS modes, pids FROM pgrowlocks('${table}') ORDER BY locked_row`)
  return rows.map((r) => ({ row: r.row, multi: r.multi, modes: r.modes, sessions: r.pids.map((p) => names[p] ?? 'other') }))
}

/** Predicate (SIRead) locks of serializable transactions. */
const siReadLocks = async (admin, names) => {
  const { rows } = await admin.query(
    `SELECT pid, locktype, coalesce(relation::regclass::text, '') AS rel, page, tuple
       FROM pg_locks WHERE mode = 'SIReadLock' ORDER BY pid, locktype, page, tuple`,
  )
  return rows.map((r) => ({
    session: names[r.pid] ?? '(committed)',
    lock: r.locktype,
    target: r.locktype === 'relation' ? r.rel : r.locktype === 'page' ? `${r.rel} page ${r.page}` : `${r.rel} (${r.page},${r.tuple})`,
    mode: 'SIReadLock',
    granted: true,
    blockedBy: [],
  }))
}

async function runScenario({ name, setup = [], steps, sessions = ['A', 'B'], observe, settleMs = 250 }) {
  const admin = await client()
  for (const sql of setup) await admin.query(sql)
  const conns = {}
  const names = {}
  for (const s of sessions) {
    conns[s] = await client()
    names[(await conns[s].query('SELECT pg_backend_pid() AS p')).rows[0].p] = s
  }
  const pidOf = Object.fromEntries(Object.entries(names).map(([p, s]) => [s, Number(p)]))
  const pending = {}
  const frames = []
  const t0 = Date.now()

  const inspect = async (step, results) => {
    const act = await admin.query(`SELECT pid, backend_xid::text AS xid, state, wait_event_type FROM pg_stat_activity WHERE pid = ANY($1)`, [Object.values(pidOf)])
    const state = {}
    for (const s of sessions) {
      const row = act.rows.find((r) => r.pid === pidOf[s])
      state[s] = { xid: row?.xid ?? null, state: row?.state ?? 'closed', waiting: row?.wait_event_type === 'Lock' }
    }
    const frame = { step, results, sessions: state, t: Date.now() - t0 }
    if (observe) frame.obs = await observe(admin, names)
    frames.push(frame)
  }

  await inspect(null, {})
  for (const step of steps) {
    const results = {}
    if (step.sql) {
      const p = conns[step.s].query(step.sql).then(describe, errorOf)
      const settled = await Promise.race([p.then((r) => ({ r })), sleep(step.wait ?? settleMs).then(() => null)])
      if (settled) results[step.s] = settled.r
      else {
        results[step.s] = { kind: 'blocked' }
        pending[step.s] = p
      }
    }
    if (step.sleep) await sleep(step.sleep)
    await sleep(120)
    for (const s of Object.keys(pending)) {
      if (s === step.s && results[s]?.kind === 'blocked') continue
      const done = await Promise.race([pending[s].then((r) => ({ r })), sleep(40).then(() => null)])
      if (done) {
        results[s] = { ...done.r, unblocked: true }
        delete pending[s]
      }
    }
    await inspect(step.sql ? { s: step.s, sql: step.sql } : { s: '*', sql: step.label }, results)
  }
  for (const s of Object.keys(pending)) await pending[s].catch(() => {})
  for (const s of sessions) await conns[s].end().catch(() => {})
  await admin.end()
  console.log(`  ${name}: ${frames.length - 1} steps`)
  return frames
}

// ---------------------------------------------------------------------------
// Isolation: six anomalies × four levels
// ---------------------------------------------------------------------------

const LEVELS = ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']
const accounts = [
  'DROP TABLE IF EXISTS accounts CASCADE',
  'CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL)',
  'INSERT INTO accounts VALUES (1, 100), (2, 100)',
]
const read = 'SELECT balance FROM accounts WHERE id = 1'

const ANOMALIES = {
  'dirty-read': {
    setup: accounts,
    steps: (lvl) => [
      { s: 'B', sql: 'BEGIN' },
      { s: 'B', sql: 'UPDATE accounts SET balance = 999 WHERE id = 1' },
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: read },
      { s: 'B', sql: 'ROLLBACK' },
      { s: 'A', sql: 'COMMIT' },
    ],
    judge: (f) => {
      const v = valueOf(f, 4, 'A')
      return { happened: Number(v) === 999, evidence: `A read ${v} while B’s uncommitted value was 999` }
    },
  },
  'non-repeatable-read': {
    setup: accounts,
    steps: (lvl) => [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: read },
      { s: 'B', sql: 'UPDATE accounts SET balance = 200 WHERE id = 1' },
      { s: 'A', sql: read },
      { s: 'A', sql: 'COMMIT' },
    ],
    judge: (f) => {
      const a = valueOf(f, 2, 'A'), b = valueOf(f, 4, 'A')
      return { happened: a !== b, evidence: `A read ${a}, then ${b}` }
    },
  },
  phantom: {
    setup: [
      'DROP TABLE IF EXISTS orders CASCADE',
      'CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL, amount int NOT NULL)',
      'INSERT INTO orders VALUES (1, 1, 20), (2, 1, 30), (3, 2, 50)',
    ],
    steps: (lvl) => [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: 'SELECT count(*) AS orders, sum(amount) AS total FROM orders WHERE customer_id = 1' },
      { s: 'B', sql: 'INSERT INTO orders VALUES (4, 1, 45)' },
      { s: 'A', sql: 'SELECT count(*) AS orders, sum(amount) AS total FROM orders WHERE customer_id = 1' },
      { s: 'A', sql: 'COMMIT' },
    ],
    judge: (f) => {
      const a = valueOf(f, 2, 'A'), b = valueOf(f, 4, 'A')
      return { happened: a !== b, evidence: `A counted ${a} orders, then ${b}` }
    },
  },
  'lost-update': {
    setup: accounts,
    steps: (lvl) => [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: read },
      { s: 'B', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'B', sql: read },
      { s: 'A', sql: 'UPDATE accounts SET balance = 150 WHERE id = 1' },
      { s: 'B', sql: 'UPDATE accounts SET balance = 70 WHERE id = 1' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: read },
    ],
    judge: (f) => {
      const end = valueOf(f, 9, 'A')
      return { happened: Number(end) === 70, evidence: `final balance ${end} (A wanted +50, B −30)` }
    },
  },
  'write-skew': {
    setup: [
      'DROP TABLE IF EXISTS doctors CASCADE',
      'CREATE TABLE doctors (id int PRIMARY KEY, name text NOT NULL, on_call bool NOT NULL)',
      `INSERT INTO doctors VALUES (1, 'Ana', true), (2, 'Ben', true)`,
    ],
    steps: (lvl) => [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'B', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: 'SELECT count(*) AS on_call FROM doctors WHERE on_call' },
      { s: 'B', sql: 'SELECT count(*) AS on_call FROM doctors WHERE on_call' },
      { s: 'A', sql: 'UPDATE doctors SET on_call = false WHERE id = 1' },
      { s: 'B', sql: 'UPDATE doctors SET on_call = false WHERE id = 2' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: 'SELECT count(*) AS on_call FROM doctors WHERE on_call' },
    ],
    observe: siReadLocks,
    judge: (f) => {
      const end = valueOf(f, 9, 'A')
      return { happened: Number(end) === 0, evidence: `${end} doctors on call at the end` }
    },
  },
  'read-only-anomaly': {
    sessions: ['A', 'B', 'C'],
    setup: [
      'DROP TABLE IF EXISTS batch_ctl, receipts CASCADE',
      'CREATE TABLE batch_ctl (open_batch int NOT NULL)',
      'INSERT INTO batch_ctl VALUES (1)',
      'CREATE TABLE receipts (id serial PRIMARY KEY, batch int NOT NULL, payer text NOT NULL, amount int NOT NULL)',
      `INSERT INTO receipts (batch, payer, amount) VALUES (1, 'ann', 100), (1, 'bob', 200), (1, 'cy', 300)`,
    ],
    steps: (lvl) => [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'A', sql: `INSERT INTO receipts (batch, payer, amount) SELECT open_batch, 'dan', 40 FROM batch_ctl` },
      { s: 'B', sql: `BEGIN ISOLATION LEVEL ${lvl}` },
      { s: 'B', sql: 'UPDATE batch_ctl SET open_batch = open_batch + 1' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'C', sql: `BEGIN ISOLATION LEVEL ${lvl} READ ONLY` },
      { s: 'C', sql: 'SELECT open_batch FROM batch_ctl' },
      { s: 'C', sql: 'SELECT count(*) AS receipts, sum(amount) AS total FROM receipts WHERE batch = 1' },
      { s: 'C', sql: 'COMMIT' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'C', sql: 'SELECT count(*) AS receipts, sum(amount) AS total FROM receipts WHERE batch = 1' },
    ],
    judge: (f) => {
      const reported = valueOf(f, 8, 'C'), final = valueOf(f, 11, 'C')
      return { happened: reported !== null && reported !== final, evidence: `report said batch 1 has ${reported ?? 'no answer'} receipts; it ends with ${final}` }
    },
  },
}

/** First value of the rows a session got at a step (also when it arrived later, unblocked). */
function valueOf(frames, step, s) {
  const r = frames[step]?.results[s]
  if (r?.kind === 'rows') return r.rows[0]?.[0] ?? null
  // the result may have arrived on a later step (the statement was waiting)
  for (let i = step + 1; i < frames.length; i++) {
    const later = frames[i].results[s]
    if (later?.unblocked) return later.kind === 'rows' ? (later.rows[0]?.[0] ?? null) : null
  }
  return null
}

/** The first error any session got, if any. */
function firstError(frames) {
  for (let i = 1; i < frames.length; i++)
    for (const [s, r] of Object.entries(frames[i].results)) if (r.kind === 'error') return { step: i, session: s, code: r.code, message: r.message, detail: r.detail }
  return null
}

async function isolation() {
  const out = {}
  for (const [anomaly, def] of Object.entries(ANOMALIES)) {
    for (const lvl of LEVELS) {
      const frames = await runScenario({ name: `${anomaly} @ ${lvl}`, setup: def.setup, steps: def.steps(lvl), sessions: def.sessions, observe: def.observe })
      out[`${anomaly}|${lvl}`] = { frames, ...def.judge(frames), error: firstError(frames) }
    }
  }
  return out
}

/** SSI granularity: two serializable transactions touching different rows, via an index scan and via a sequential scan. */
async function ssiGranularity() {
  const setup = [
    'DROP TABLE IF EXISTS accounts CASCADE',
    'CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL)',
    'INSERT INTO accounts SELECT g, 100 FROM generate_series(1, 10000) g',
    'ANALYZE accounts',
  ]
  const steps = (seq) => [
    { s: 'A', sql: 'BEGIN ISOLATION LEVEL SERIALIZABLE' },
    ...(seq ? [{ s: 'A', sql: 'SET LOCAL enable_indexscan = off; SET LOCAL enable_bitmapscan = off' }] : []),
    { s: 'B', sql: 'BEGIN ISOLATION LEVEL SERIALIZABLE' },
    ...(seq ? [{ s: 'B', sql: 'SET LOCAL enable_indexscan = off; SET LOCAL enable_bitmapscan = off' }] : []),
    { s: 'A', sql: 'SELECT balance FROM accounts WHERE id = 1' },
    { s: 'B', sql: 'SELECT balance FROM accounts WHERE id = 9000' },
    { s: 'A', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 9000' },
    { s: 'B', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 1' },
    { s: 'A', sql: 'COMMIT' },
    { s: 'B', sql: 'COMMIT' },
  ]
  const disjoint = (seq) => [
    { s: 'A', sql: 'BEGIN ISOLATION LEVEL SERIALIZABLE' },
    ...(seq ? [{ s: 'A', sql: 'SET LOCAL enable_indexscan = off; SET LOCAL enable_bitmapscan = off' }] : []),
    { s: 'B', sql: 'BEGIN ISOLATION LEVEL SERIALIZABLE' },
    ...(seq ? [{ s: 'B', sql: 'SET LOCAL enable_indexscan = off; SET LOCAL enable_bitmapscan = off' }] : []),
    { s: 'A', sql: 'SELECT balance FROM accounts WHERE id = 1' },
    { s: 'B', sql: 'SELECT balance FROM accounts WHERE id = 9000' },
    { s: 'A', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 1' },
    { s: 'B', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 9000' },
    { s: 'A', sql: 'COMMIT' },
    { s: 'B', sql: 'COMMIT' },
  ]
  return {
    crossIndex: await runScenario({ name: 'ssi cross, index', setup, steps: steps(false), observe: siReadLocks }),
    disjointIndex: await runScenario({ name: 'ssi disjoint, index', setup, steps: disjoint(false), observe: siReadLocks }),
    disjointSeq: await runScenario({ name: 'ssi disjoint, seq scan', setup, steps: disjoint(true), observe: siReadLocks }),
  }
}

// ---------------------------------------------------------------------------
// Locks
// ---------------------------------------------------------------------------

const ROW_MODES = ['FOR KEY SHARE', 'FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE']
const TABLE_MODES = ['ACCESS SHARE', 'ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']

async function rowMatrix() {
  const admin = await client()
  await admin.query('DROP TABLE IF EXISTS items CASCADE')
  await admin.query('CREATE TABLE items (id int PRIMARY KEY, qty int NOT NULL)')
  await admin.query('INSERT INTO items VALUES (1, 5)')
  const a = await client(), b = await client()
  const cells = []
  for (const held of ROW_MODES) {
    for (const asked of ROW_MODES) {
      await a.query('BEGIN')
      await a.query(`SELECT * FROM items WHERE id = 1 ${held}`)
      await b.query('BEGIN')
      const r = await q(b, `SELECT * FROM items WHERE id = 1 ${asked} NOWAIT`)
      await b.query('ROLLBACK')
      await a.query('ROLLBACK')
      cells.push({ held, asked, ok: r.kind !== 'error', error: r.kind === 'error' ? r.message : null })
    }
  }
  // which row lock each statement takes, as pgrowlocks reads it from the tuple
  await admin.query('CREATE EXTENSION IF NOT EXISTS pgrowlocks')
  await admin.query('DROP TABLE IF EXISTS order_items')
  await admin.query('CREATE TABLE order_items (id int PRIMARY KEY, item_id int NOT NULL REFERENCES items)')
  const statements = [
    ...ROW_MODES.map((m) => `SELECT * FROM items WHERE id = 1 ${m}`),
    'UPDATE items SET qty = qty - 1 WHERE id = 1',
    'UPDATE items SET id = 2 WHERE id = 1',
    'DELETE FROM items WHERE id = 1',
    'INSERT INTO order_items VALUES (1, 1)',
  ]
  const takes = []
  for (const sql of statements) {
    await a.query('BEGIN')
    await a.query(sql)
    const { rows } = await admin.query(`SELECT modes::text[] AS modes FROM pgrowlocks('items')`)
    await a.query('ROLLBACK')
    takes.push({ sql, modes: rows[0]?.modes ?? [] })
  }
  const nowaitError = (await (async () => {
    await a.query('BEGIN')
    await a.query('SELECT * FROM items WHERE id = 1 FOR UPDATE')
    const r = await q(b, 'SELECT * FROM items WHERE id = 1 FOR UPDATE NOWAIT')
    await a.query('ROLLBACK')
    return r
  })())
  await a.end(); await b.end(); await admin.end()
  return { cells, takes, nowaitError }
}

async function tableMatrix() {
  const admin = await client()
  await admin.query('DROP TABLE IF EXISTS t CASCADE')
  await admin.query('CREATE TABLE t (id int PRIMARY KEY)')
  const a = await client(), b = await client()
  const cells = []
  for (const held of TABLE_MODES) {
    for (const asked of TABLE_MODES) {
      await a.query('BEGIN')
      await a.query(`LOCK TABLE t IN ${held} MODE`)
      await b.query('BEGIN')
      const r = await q(b, `LOCK TABLE t IN ${asked} MODE NOWAIT`)
      await b.query('ROLLBACK')
      await a.query('ROLLBACK')
      cells.push({ held, asked, ok: r.kind !== 'error' })
    }
  }
  await a.end(); await b.end(); await admin.end()
  return cells
}

/**
 * Which table lock a statement asks for: another session holds EXCLUSIVE (it conflicts with every
 * mode but ACCESS SHARE), so the statement either finishes (it needed only ACCESS SHARE) or waits —
 * and pg_locks shows the mode it waits for.
 */
async function statementLocks() {
  const admin = await client()
  await admin.query('DROP TABLE IF EXISTS orders, customers CASCADE')
  await admin.query('CREATE TABLE customers (id int PRIMARY KEY)')
  await admin.query(`CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL, status text NOT NULL DEFAULT 'new', amount int NOT NULL DEFAULT 0)`)
  await admin.query('INSERT INTO customers VALUES (1)')
  await admin.query('INSERT INTO orders (id, customer_id) VALUES (1, 1)')
  const list = [
    'SELECT * FROM orders',
    'SELECT * FROM orders FOR UPDATE',
    `INSERT INTO orders (id, customer_id) VALUES (2, 1)`,
    `UPDATE orders SET status = 'paid' WHERE id = 1`,
    'DELETE FROM orders WHERE id = 1',
    'VACUUM orders',
    'ANALYZE orders',
    'CREATE INDEX CONCURRENTLY ON orders (status)',
    'CREATE INDEX ON orders (status)',
    'ALTER TABLE orders VALIDATE CONSTRAINT orders_amount_check',
    'ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers',
    'CREATE TRIGGER noop BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger()',
    'ALTER TABLE orders ADD COLUMN note text',
    `ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'open'`,
    'ALTER TABLE orders ALTER COLUMN amount TYPE bigint',
    'TRUNCATE orders',
    'VACUUM FULL orders',
    'DROP TABLE orders',
  ]
  await admin.query('ALTER TABLE orders ADD CONSTRAINT orders_amount_check CHECK (amount >= 0) NOT VALID')
  const out = []
  for (const sql of list) {
    const target = 'orders'
    const h = await client(), s = await client()
    const sp = (await s.query('SELECT pg_backend_pid() AS p')).rows[0].p
    await h.query('BEGIN')
    await h.query(`LOCK TABLE ${target} IN EXCLUSIVE MODE`)
    let finished = false
    const p = s.query(sql).then(() => { finished = true }, () => {})
    await sleep(250)
    const { rows } = await admin.query(`SELECT mode FROM pg_locks WHERE pid = $1 AND relation = $2::regclass AND NOT granted`, [sp, target])
    await admin.query('SELECT pg_cancel_backend($1)', [sp])
    await p
    await h.query('ROLLBACK')
    await h.end(); await s.end()
    out.push({ sql, mode: finished ? 'AccessShareLock' : (rows[0]?.mode ?? null) })
  }
  // LOCK TABLE does not work on a materialized view: run the refresh in a transaction and read the lock it holds
  await admin.query('CREATE MATERIALIZED VIEW IF NOT EXISTS order_totals AS SELECT 1 AS customer_id, 0 AS total')
  await admin.query('CREATE UNIQUE INDEX IF NOT EXISTS order_totals_customer ON order_totals (customer_id)')
  const s = await client()
  const sp = (await s.query('SELECT pg_backend_pid() AS p')).rows[0].p
  await s.query('BEGIN')
  await s.query('REFRESH MATERIALIZED VIEW CONCURRENTLY order_totals')
  const held = await admin.query(`SELECT mode FROM pg_locks WHERE pid = $1 AND relation = 'order_totals'::regclass AND granted`, [sp])
  await s.query('ROLLBACK')
  await s.end()
  const order = ['AccessShareLock', 'RowShareLock', 'RowExclusiveLock', 'ShareUpdateExclusiveLock', 'ShareLock', 'ShareRowExclusiveLock', 'ExclusiveLock', 'AccessExclusiveLock']
  const strongest = held.rows.map((r) => r.mode).sort((a, b) => order.indexOf(b) - order.indexOf(a))[0] ?? null
  out.push({ sql: 'REFRESH MATERIALIZED VIEW CONCURRENTLY order_totals', mode: strongest })
  await admin.end()
  return out
}

const pileupSetup = [
  'DROP TABLE IF EXISTS orders CASCADE',
  `CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL, status text NOT NULL DEFAULT 'new')`,
  'INSERT INTO orders SELECT g, g % 100, \'new\' FROM generate_series(1, 1000) g',
]

/** Runs `work` with log_lock_waits on and returns its result plus the server log lines it caused. */
async function withLockLog(work) {
  const admin = await client()
  await admin.query('ALTER SYSTEM SET log_lock_waits = on')
  await admin.query('SELECT pg_reload_conf()')
  await sleep(300)
  const since = new Date(Date.now() - 100).toISOString()
  const result = await work()
  await sleep(300)
  await admin.query('ALTER SYSTEM RESET log_lock_waits')
  await admin.query('SELECT pg_reload_conf()')
  await admin.end()
  const logs = spawnSync('podman', ['logs', '--since', since, container], { encoding: 'utf8' })
  const log = `${logs.stdout}\n${logs.stderr}`
    .split('\n')
    .filter((l) => /^\d{4}-\d\d-\d\d /.test(l) || /^\t/.test(l))
    .filter((l) => !/parameter "log_lock_waits"|received SIGHUP|checkpoint/.test(l))
    .map((l) => l.replace(/^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\.\d+ UTC/, '$1 UTC'))
  return { frames: result, log: [...new Set(log)] }
}

const lockScenarios = async () => ({
  pileup: await withLockLog(() => runScenario({
    name: 'ddl pile-up',
    sessions: ['A', 'B', 'C', 'D'],
    setup: pileupSetup,
    observe: lockRows(['orders']),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: 'SELECT count(*) FROM orders' },
      { s: 'B', sql: 'ALTER TABLE orders ADD COLUMN note text' },
      { s: 'C', sql: 'SELECT status FROM orders WHERE id = 1' },
      { s: 'D', sql: `UPDATE orders SET status = 'paid' WHERE id = 2` },
      { label: '… 1 second later', sleep: 1000 },
      { s: 'A', sql: 'COMMIT' },
    ],
  })),
  pileupTimeout: await runScenario({
    name: 'ddl with lock_timeout',
    sessions: ['A', 'B', 'C'],
    setup: pileupSetup,
    observe: lockRows(['orders']),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: 'SELECT count(*) FROM orders' },
      { s: 'B', sql: `SET lock_timeout = '2s'` },
      { s: 'B', sql: 'ALTER TABLE orders ADD COLUMN note text' },
      { s: 'C', sql: 'SELECT status FROM orders WHERE id = 1' },
      { label: '… 2 seconds later', sleep: 2000 },
      { s: 'A', sql: 'COMMIT' },
    ],
  }),
  skipLocked: await runScenario({
    name: 'skip locked',
    sessions: ['A', 'B', 'C'],
    setup: [
      'DROP TABLE IF EXISTS jobs CASCADE',
      `CREATE TABLE jobs (id int PRIMARY KEY, status text NOT NULL DEFAULT 'queued')`,
      'INSERT INTO jobs (id) SELECT generate_series(1, 5)',
    ],
    observe: rowLocks('jobs'),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED` },
      { s: 'B', sql: 'BEGIN' },
      { s: 'B', sql: `SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED` },
      { s: 'C', sql: `SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE NOWAIT` },
      { s: 'C', sql: `SELECT id FROM jobs WHERE status = 'queued' ORDER BY id LIMIT 1 FOR UPDATE` },
      { s: 'A', sql: `UPDATE jobs SET status = 'done' WHERE id = 1` },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: `UPDATE jobs SET status = 'done' WHERE id = 2` },
      { s: 'B', sql: 'COMMIT' },
    ],
  }),
  advisory: await runScenario({
    name: 'advisory',
    observe: lockRows([]),
    steps: [
      { s: 'A', sql: 'SELECT pg_try_advisory_lock(42) AS got_it' },
      { s: 'B', sql: 'SELECT pg_try_advisory_lock(42) AS got_it' },
      { s: 'B', sql: 'SELECT pg_advisory_lock(42)' },
      { s: 'A', sql: 'SELECT pg_advisory_unlock(42) AS released' },
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `SELECT pg_advisory_xact_lock(hashtext('nightly-report'))` },
      { s: 'B', sql: `SELECT pg_try_advisory_xact_lock(hashtext('nightly-report')) AS got_it` },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: `SELECT pg_try_advisory_xact_lock(hashtext('nightly-report')) AS got_it` },
    ],
  }),
})

const deadlock = () =>
  withLockLog(() =>
    runScenario({
      name: 'deadlock',
      setup: accounts,
      observe: lockRows(['accounts']),
      steps: [
        { s: 'A', sql: 'BEGIN' },
        { s: 'B', sql: 'BEGIN' },
        { s: 'A', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 1' },
        { s: 'B', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 2' },
        { s: 'A', sql: 'UPDATE accounts SET balance = balance + 10 WHERE id = 2' },
        { s: 'B', sql: 'UPDATE accounts SET balance = balance + 10 WHERE id = 1', wait: 1600 },
        { s: 'A', sql: 'ROLLBACK' },
        { s: 'B', sql: 'COMMIT' },
      ],
    }),
  )

async function timeouts() {
  const out = {}
  let c = await client()
  await c.query('SET lock_timeout = 0')
  await c.query(`SET statement_timeout = '500ms'`)
  out.statement = { sql: `SET statement_timeout = '500ms';\nSELECT pg_sleep(2);`, result: await q(c, 'SELECT pg_sleep(2)') }
  await c.end()

  c = new pg.Client(conn)
  let terminated = null
  c.on('error', (e) => { terminated ??= errorOf(e) }) // the server's FATAL arrives first
  await c.connect()
  await c.query(`SET idle_in_transaction_session_timeout = '500ms'`)
  await c.query('BEGIN')
  await c.query('SELECT 1')
  await sleep(900)
  out.idle = { sql: `SET idle_in_transaction_session_timeout = '500ms';\nBEGIN;\nSELECT 1;\n-- the application does nothing for 0.9 s\nSELECT 1;`, result: await q(c, 'SELECT 1'), server: terminated }
  await c.end().catch(() => {})

  c = await client()
  await c.query(`SET transaction_timeout = '1s'`)
  await c.query('BEGIN')
  await c.query('SELECT pg_sleep(0.6)')
  out.transaction = { sql: `SET transaction_timeout = '1s';\nBEGIN;\nSELECT pg_sleep(0.6);  -- fine\nSELECT pg_sleep(0.6);  -- the transaction passes 1 s`, result: await q(c, 'SELECT pg_sleep(0.6)') }
  await c.end().catch(() => {})

  c = await client()
  const show = await c.query(`SELECT name, setting, unit FROM pg_settings WHERE name IN ('lock_timeout', 'statement_timeout', 'idle_in_transaction_session_timeout', 'transaction_timeout', 'deadlock_timeout', 'log_lock_waits', 'max_locks_per_transaction', 'max_pred_locks_per_transaction') ORDER BY name`)
  out.defaults = show.rows
  await c.end()
  return out
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

const paymentsSetup = [
  'DROP TABLE IF EXISTS payments, customers CASCADE',
  'CREATE TABLE customers (id int PRIMARY KEY, email text NOT NULL UNIQUE, name text)',
  `CREATE TABLE payments (
     id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
     customer_id int NOT NULL REFERENCES customers (id),
     idempotency_key text NOT NULL UNIQUE,
     amount numeric(12,2) NOT NULL CHECK (amount > 0))`,
  `INSERT INTO customers VALUES (1, 'ann@example.com', 'Ann')`,
]

const constraintScenarios = async () => ({
  uniqueRaceCommit: await runScenario({
    name: 'unique race, commit',
    setup: paymentsSetup,
    observe: lockRows([]),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10)` },
      { s: 'B', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10)` },
      { s: 'A', sql: 'COMMIT' },
    ],
  }),
  uniqueRaceRollback: await runScenario({
    name: 'unique race, rollback',
    setup: paymentsSetup,
    observe: lockRows([]),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10)` },
      { s: 'B', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10)` },
      { s: 'A', sql: 'ROLLBACK' },
    ],
  }),
  onConflictRace: await runScenario({
    name: 'on conflict race',
    setup: paymentsSetup,
    observe: lockRows([]),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` },
      { s: 'B', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-9', 10) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: `SELECT id, amount FROM payments WHERE idempotency_key = 'req-9'` },
    ],
  }),
  fkKeyShare: await runScenario({
    name: 'fk key share',
    setup: ['CREATE EXTENSION IF NOT EXISTS pgrowlocks', ...paymentsSetup],
    observe: rowLocks('customers'),
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25)` },
      { s: 'B', sql: `UPDATE customers SET name = 'Ann Lee' WHERE id = 1` },
      { s: 'B', sql: `UPDATE customers SET email = 'ann@new.example' WHERE id = 1` },
      { s: 'A', sql: 'COMMIT' },
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-2', 10)` },
      { s: 'B', sql: 'DELETE FROM customers WHERE id = 1' },
      { s: 'A', sql: 'COMMIT' },
    ],
  }),
})

async function constraintCaptures() {
  const c = await client()
  const out = {}
  for (const sql of paymentsSetup) await c.query(sql)

  out.uniqueIndex = (await c.query(`
    SELECT con.conname AS constraint_name, con.contype AS type, con.conindid::regclass::text AS backing_index,
           am.amname AS method, i.indisunique AS is_unique
      FROM pg_constraint con
      JOIN pg_index i ON i.indexrelid = con.conindid
      JOIN pg_class ic ON ic.oid = i.indexrelid
      JOIN pg_am am ON am.oid = ic.relam
     WHERE con.conrelid = 'payments'::regclass
     ORDER BY con.conname`)).rows

  // NULLs in a unique column
  await c.query('DROP TABLE IF EXISTS coupons')
  await c.query('CREATE TABLE coupons (code text UNIQUE)')
  out.nullsDistinct = [await q(c, 'INSERT INTO coupons VALUES (NULL)'), await q(c, 'INSERT INTO coupons VALUES (NULL)')]
  await c.query('DROP TABLE coupons')
  await c.query('CREATE TABLE coupons (code text UNIQUE NULLS NOT DISTINCT)')
  out.nullsNotDistinct = [await q(c, 'INSERT INTO coupons VALUES (NULL)'), await q(c, 'INSERT INTO coupons VALUES (NULL)')]

  // checked per row, at the end of the statement, or at commit
  await c.query('DROP TABLE IF EXISTS playlist')
  await c.query('CREATE TABLE playlist (song text PRIMARY KEY, pos int NOT NULL UNIQUE)')
  await c.query(`INSERT INTO playlist VALUES ('a', 1), ('b', 2), ('c', 3)`)
  out.shiftImmediate = await q(c, 'UPDATE playlist SET pos = pos + 1')
  await c.query('ALTER TABLE playlist DROP CONSTRAINT playlist_pos_key')
  await c.query('ALTER TABLE playlist ADD CONSTRAINT playlist_pos_key UNIQUE (pos) DEFERRABLE')
  out.shiftDeferrable = await q(c, 'UPDATE playlist SET pos = pos + 1')
  await c.query('BEGIN')
  await c.query('SET CONSTRAINTS playlist_pos_key DEFERRED')
  out.swap = [
    await q(c, `UPDATE playlist SET pos = 4 WHERE song = 'a'`),
    await q(c, `UPDATE playlist SET pos = 2 WHERE song = 'c'`),
    await q(c, 'COMMIT'),
  ]
  await c.query('BEGIN')
  await c.query('SET CONSTRAINTS playlist_pos_key DEFERRED')
  out.swapBroken = [await q(c, `UPDATE playlist SET pos = 3 WHERE song = 'a'`), await q(c, 'COMMIT')]

  // deferred foreign key: parent inserted after the child, within one transaction
  await c.query('DROP TABLE IF EXISTS order_lines, orders CASCADE')
  await c.query('CREATE TABLE orders (id int PRIMARY KEY)')
  await c.query('CREATE TABLE order_lines (order_id int REFERENCES orders DEFERRABLE INITIALLY DEFERRED, line int, PRIMARY KEY (order_id, line))')
  await c.query('BEGIN')
  out.deferredFk = [await q(c, 'INSERT INTO order_lines VALUES (7, 1)'), await q(c, 'INSERT INTO orders VALUES (7)'), await q(c, 'COMMIT')]
  await c.query('BEGIN')
  out.deferredFkFail = [await q(c, 'INSERT INTO order_lines VALUES (8, 1)'), await q(c, 'COMMIT')]

  // exclusion constraint and WITHOUT OVERLAPS
  await c.query('CREATE EXTENSION IF NOT EXISTS btree_gist')
  await c.query('DROP TABLE IF EXISTS bookings, room_bookings')
  await c.query(`CREATE TABLE bookings (
    id     int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room   int NOT NULL,
    during tstzrange NOT NULL,
    EXCLUDE USING gist (room WITH =, during WITH &&))`)
  const book = (room, from, to) => q(c, `INSERT INTO bookings (room, during) VALUES (${room}, '[2026-11-02 ${from}, 2026-11-02 ${to})')`)
  out.bookings = [
    { room: 101, from: '09:00', to: '10:00', result: await book(101, '09:00', '10:00') },
    { room: 101, from: '10:00', to: '11:30', result: await book(101, '10:00', '11:30') },
    { room: 102, from: '09:30', to: '11:00', result: await book(102, '09:30', '11:00') },
    { room: 101, from: '11:00', to: '12:00', result: await book(101, '11:00', '12:00') },
    { room: 102, from: '11:00', to: '12:30', result: await book(102, '11:00', '12:30') },
  ]
  await c.query(`CREATE TABLE room_bookings (
    room   int,
    during tstzrange,
    PRIMARY KEY (room, during WITHOUT OVERLAPS))`)
  out.withoutOverlaps = [
    await q(c, `INSERT INTO room_bookings VALUES (101, '[2026-11-02 09:00, 2026-11-02 10:00)')`),
    await q(c, `INSERT INTO room_bookings VALUES (101, '[2026-11-02 09:30, 2026-11-02 10:30)')`),
  ]
  out.withoutOverlapsIndex = (await c.query(`SELECT indexrelid::regclass::text AS index, am.amname AS method FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid JOIN pg_am am ON am.oid = ic.relam WHERE indrelid = 'room_bookings'::regclass`)).rows

  // ON DELETE actions
  const actions = {}
  for (const action of ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL']) {
    await c.query('DROP TABLE IF EXISTS order_lines, orders CASCADE')
    await c.query('CREATE TABLE orders (id int PRIMARY KEY)')
    await c.query(`CREATE TABLE order_lines (id int PRIMARY KEY, order_id int REFERENCES orders ON DELETE ${action})`)
    await c.query('INSERT INTO orders VALUES (1), (2)')
    await c.query('INSERT INTO order_lines VALUES (1, 1), (2, 1), (3, 1), (4, 2)')
    const del = await q(c, 'DELETE FROM orders WHERE id = 1')
    const left = (await c.query('SELECT id, order_id FROM order_lines ORDER BY id')).rows
    actions[action] = { del, left }
  }
  out.onDelete = actions

  // the cost of an unindexed foreign key on DELETE of the parent
  await c.query('DROP TABLE IF EXISTS order_lines, orders CASCADE')
  await c.query('CREATE TABLE orders (id int PRIMARY KEY)')
  await c.query('CREATE TABLE order_lines (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, order_id int NOT NULL REFERENCES orders, qty int NOT NULL)')
  await c.query('INSERT INTO orders SELECT generate_series(1, 20000)')
  await c.query('INSERT INTO order_lines (order_id, qty) SELECT 1 + (g % 19000), 1 FROM generate_series(1, 400000) g')
  await c.query('ANALYZE orders, order_lines')
  const explainDelete = async () => {
    await c.query('BEGIN')
    const { rows } = await c.query('EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY ON) DELETE FROM orders WHERE id BETWEEN 19001 AND 19100')
    await c.query('ROLLBACK')
    return rows.map((r) => r['QUERY PLAN'])
  }
  await explainDelete() // warm the cache
  const fkNoIndex = await explainDelete()
  await c.query('CREATE INDEX order_lines_order_id_idx ON order_lines (order_id)')
  await explainDelete()
  const fkIndex = await explainDelete()
  out.fkIndex = { sql: 'DELETE FROM orders WHERE id BETWEEN 19001 AND 19100  -- 100 orders that have no lines', without: fkNoIndex, with: fkIndex }
  await c.end()
  return out
}

// ---------------------------------------------------------------------------
// The TypeScript programs
// ---------------------------------------------------------------------------

function runApp(file) {
  const out = execFileSync('node', [`src/${file}`], {
    cwd: new URL('./concurrency-app/', import.meta.url),
    env: { ...process.env, PGPORT: String(conn.port) },
    encoding: 'utf8',
  })
  console.log(`  app ${file}`)
  return out.trimEnd()
}

// ---------------------------------------------------------------------------

const main = async () => {
  console.log('isolation'); const iso = await isolation(); const ssi = await ssiGranularity()
  console.log('locks'); const rows = await rowMatrix(); const table = await tableMatrix(); const statements = await statementLocks()
  const scenarios = await lockScenarios(); const dl = await deadlock(); const to = await timeouts()
  console.log('constraints'); const cons = await constraintScenarios(); const caps = await constraintCaptures()
  console.log('apps')
  const retryOut = runApp('retry.ts')
  const idemOut = runApp('idempotent.ts')
  const queueOut = runApp('queue.ts').split('\n')
  const queue = JSON.parse(queueOut.pop())

  const version = await (async () => { const c = await client(); const v = (await c.query('SHOW server_version')).rows[0].server_version; await c.end(); return v })()
  const data = {
    version,
    isolation: iso,
    ssi,
    locks: { rowMatrix: rows, tableMatrix: table, statements, ...scenarios, deadlock: dl, timeouts: to },
    constraints: { ...cons, ...caps },
    apps: { retry: retryOut, idempotent: idemOut, queue: { log: queueOut.join('\n'), runs: queue } },
  }
  let json = JSON.stringify(data)
  json = json.replaceAll(`:${conn.port}`, ':5432')
  if ([homedir(), userInfo().username, '/home/', '/Users/'].some((bad) => json.includes(bad))) throw new Error('refusing to write: output contains a user name or home directory')
  const header = `// Recorded from PostgreSQL ${version} by tools/postgres-capture/capture-concurrency.mjs — do not edit by hand.\n\n`
  writeFileSync(outFile, `${header}export const CONCURRENCY = ${json} as const\n`)
  console.log(`wrote ${outFile} (${(json.length / 1024).toFixed(0)} kB)`)
}

await main()
