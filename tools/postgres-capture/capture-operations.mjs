import { homedir, userInfo } from 'node:os'
// Records the pooling and monitoring lessons on a real PostgreSQL 18 (container pg-ops) and a
// real PgBouncer (container pg-ops-bouncer), and writes src/modules/postgres/data/operations.ts.
// Usage (see README.md): node capture-operations.mjs [port] [bouncer port]
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'

const require = createRequire(new URL('./operations-app/package.json', import.meta.url))
const pg = require('pg')

const PORT = Number(process.argv[2] ?? 55520)
const BOUNCER_PORT = Number(process.argv[3] ?? 55521)
const SERVER = 'pg-ops'
const BOUNCER = 'pg-ops-bouncer'
const APP = new URL('./operations-app/', import.meta.url).pathname
const OUT = new URL('../../src/modules/postgres/data/operations.ts', import.meta.url).pathname

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (...a) => console.error('·', ...a)
const exec = (container, cmd, env = {}) =>
  execFileSync('podman', ['exec', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), container, 'bash', '-c', cmd], { encoding: 'utf8', maxBuffer: 1 << 26 })
const onServer = (cmd) => exec(SERVER, cmd)
/** Runs each statement with psql in the server container (separate -c flags: ALTER SYSTEM refuses to run inside a transaction). */
const psql = (...sql) => onServer(`psql -U postgres -d lab -v ON_ERROR_STOP=1 -X -q -At ${sql.map((q) => `-c ${JSON.stringify(q).replace(/\$/g, '\\$')}`).join(' ')}`)

/** Runs a command in a container in the background; resolves with its output. */
function spawnIn(container, cmd, env = {}) {
  const p = spawn('podman', ['exec', ...Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`]), container, 'bash', '-c', cmd])
  let out = ''
  p.stdout.on('data', (d) => (out += d))
  p.stderr.on('data', (d) => (out += d))
  return new Promise((resolve, reject) => p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd}\n${out}`)))))
}

const conn = (over = {}) => ({ host: '127.0.0.1', port: PORT, user: 'postgres', password: 'lab', database: 'lab', ...over })
async function client(over = {}) {
  const c = new pg.Client(conn(over))
  c.on('error', () => {}) // errors are read where they matter
  await c.connect()
  return c
}
const rows = async (c, sql, values) => (await c.query(sql, values)).rows

/** Parses pgbench's summary (and -P progress lines). */
function parseBench(text) {
  const num = (re) => {
    const m = text.match(re)
    return m ? Number(m[1]) : null
  }
  const progress = [...text.matchAll(/progress: ([\d.]+) s, ([\d.]+) tps, lat ([\d.]+) ms stddev ([\d.]+|NaN), (\d+) failed/g)].map((m) => ({
    s: Number(m[1]),
    tps: Math.round(Number(m[2])),
    latMs: Number(m[3]),
  }))
  return {
    clients: num(/number of clients: (\d+)/),
    tps: Math.round(num(/tps = ([\d.]+)/) ?? 0),
    latencyMs: num(/latency average = ([\d.]+) ms/),
    connectMs: num(/average connection time = ([\d.]+) ms/),
    transactions: num(/number of transactions actually processed: (\d+)/),
    failed: num(/number of failed transactions: (\d+)/),
    progress,
  }
}
const bench = (args, container = SERVER, env = {}) => spawnIn(container, `pgbench ${args} 2>&1`, env).then(parseBench)

// ---------------------------------------------------------------- setup
async function setup() {
  log('setup')
  psql(`DROP DATABASE IF EXISTS shop WITH (FORCE)`)
  psql(`DROP ROLE IF EXISTS app_rw`)
  psql(`CREATE ROLE app_rw LOGIN PASSWORD 'app-secret'`)
  psql(`CREATE DATABASE shop OWNER app_rw`)
  onServer(`PGPASSWORD=app-secret psql -h 127.0.0.1 -U app_rw -d shop -v ON_ERROR_STOP=1 -X -q <<'SQL'
CREATE TABLE users (id bigint PRIMARY KEY, name text NOT NULL, order_count int NOT NULL DEFAULT 0);
CREATE TABLE orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id bigint NOT NULL REFERENCES users, amount int NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
INSERT INTO users SELECT g, 'user ' || g FROM generate_series(1, 1000) g;
INSERT INTO orders (user_id, amount) SELECT 1 + g % 1000, 100 + g % 9000 FROM generate_series(1, 20000) g;
SQL`)
  onServer(`PGPASSWORD=app-secret pgbench -h 127.0.0.1 -U app_rw -i -s 5 -q shop 2>&1`)
  psql(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`, `CREATE EXTENSION IF NOT EXISTS pg_buffercache`)
  // 200 small tables, so a backend's catalog caches can grow the way they do in a real application
  psql(`DO $$ BEGIN FOR i IN 1..200 LOOP EXECUTE format('DROP TABLE IF EXISTS app_table_%s; CREATE TABLE app_table_%s (id bigint PRIMARY KEY, a int, b text, c timestamptz, d numeric, e jsonb)', i, i); END LOOP; END $$`)
  log('pgbench -i -s 20 lab')
  onServer(`pgbench -U postgres -i -s 20 -q lab 2>&1`)
  psql(`ALTER SYSTEM SET track_io_timing = on`)
  psql(`ALTER SYSTEM SET pg_stat_statements.track = 'top'`)
  psql(`SELECT pg_reload_conf()`)
}

// ---------------------------------------------------------------- pooling: what a connection costs
async function backendMemory() {
  log('backend memory')
  const N = 50
  const cs = await Promise.all(Array.from({ length: N }, () => client({ application_name: 'idle-probe' })))
  await Promise.all(cs.map((c) => c.query('SELECT 1')))
  const contexts = async (c) => {
    const [t] = await rows(c, `SELECT sum(total_bytes)::bigint AS total, sum(used_bytes)::bigint AS used, count(*)::int AS n FROM pg_backend_memory_contexts`)
    const top = await rows(c, `SELECT name, sum(total_bytes)::bigint AS bytes FROM pg_backend_memory_contexts GROUP BY name ORDER BY 2 DESC LIMIT 6`)
    return { totalBytes: Number(t.total), usedBytes: Number(t.used), contexts: t.n, top: top.map((r) => ({ name: r.name, bytes: Number(r.bytes) })) }
  }
  const procMem = () => {
    const pids = psql(`COPY (SELECT pid FROM pg_stat_activity WHERE application_name = 'idle-probe') TO STDOUT`).trim().split('\n')
    // as the postgres user: a rootless container's root may not read another user's /proc/<pid>/smaps_rollup
    const out = execFileSync('podman', ['exec', '-u', 'postgres', SERVER, 'bash', '-c', `for p in ${pids.join(' ')}; do grep -E '^(Rss|Pss|Private_Clean|Private_Dirty):' /proc/$p/smaps_rollup | tr -s ' ' | tr '\\n' ' '; echo; done`], { encoding: 'utf8' })
    const per = out.trim().split('\n').map((line) => {
      const kb = (k) => Number(line.match(new RegExp(`${k}: (\\d+) kB`))[1])
      return { rss: kb('Rss'), pss: kb('Pss'), priv: kb('Private_Clean') + kb('Private_Dirty') }
    })
    const avg = (k) => Math.round(per.reduce((s, x) => s + x[k], 0) / per.length)
    return { backends: per.length, rssKb: avg('rss'), pssKb: avg('pss'), privateKb: avg('priv') }
  }
  const fresh = { proc: procMem(), ctx: await contexts(cs[0]) }
  // each backend touches the 200 tables once, as an application with many tables eventually does
  await Promise.all(cs.map((c) => c.query(`DO $$ BEGIN FOR i IN 1..200 LOOP EXECUTE format('SELECT * FROM app_table_%s WHERE id = 1', i); END LOOP; END $$`)))
  const warm = { proc: procMem(), ctx: await contexts(cs[0]) }
  await Promise.all(cs.map((c) => c.end()))
  const sharedBuffers = psql(`COPY (SELECT current_setting('shared_buffers')) TO STDOUT`).trim()
  return { connections: N, fresh, warm, sharedBuffers }
}

async function connectCost() {
  log('connect cost')
  const env = { PGPASSWORD: 'lab' }
  const persistent = await bench('-h 127.0.0.1 -U postgres -n -S -c 8 -j 4 -T 8 lab', SERVER, env)
  const reconnect = await bench('-h 127.0.0.1 -U postgres -n -S -C -c 8 -j 4 -T 8 lab', SERVER, env)
  return { persistent, reconnect }
}

async function tooMany() {
  log('too many clients')
  const [s] = await (async () => {
    const c = await client()
    const r = await rows(c, `SELECT current_setting('max_connections') AS max, current_setting('superuser_reserved_connections') AS su, current_setting('reserved_connections') AS reserved`)
    await c.end()
    return r
  })()
  const open = []
  let error = null
  for (let i = 0; i < 200 && !error; i++) {
    try {
      open.push(await client({ user: 'app_rw', password: 'app-secret', database: 'shop' }))
    } catch (e) {
      error = { code: e.code, message: e.message }
    }
  }
  const opened = open.length
  // a superuser still gets in on the reserved slots
  let superuser = null
  try {
    const c = await client()
    superuser = (await rows(c, `SELECT count(*)::int AS n FROM pg_stat_activity WHERE backend_type = 'client backend'`))[0].n
    await c.end()
  } catch (e) {
    superuser = e.message
  }
  await Promise.all(open.map((c) => c.end()))
  return { maxConnections: Number(s.max), superuserReserved: Number(s.su), reserved: Number(s.reserved), opened, error, superuserConnectedWith: superuser }
}

async function scaling() {
  log('scaling')
  const out = { tpcb: [], select: [] }
  for (const c of [1, 2, 4, 8, 16, 32, 64]) {
    const j = Math.min(c, 8)
    // a shared machine is noisy (writes wait on fsync): best of three runs each
    const runs = []
    for (let k = 0; k < 3; k++) {
      psql('CHECKPOINT')
      runs.push(await bench(`-U postgres -c ${c} -j ${j} -T 6 lab`))
    }
    out.tpcb.push(runs.reduce((a, b) => (b.tps > a.tps ? b : a)))
    const reads = []
    for (let k = 0; k < 3; k++) reads.push(await bench(`-U postgres -n -S -c ${c} -j ${j} -T 5 lab`))
    out.select.push(reads.reduce((a, b) => (b.tps > a.tps ? b : a)))
    log('  clients', c, out.tpcb.at(-1).tps, out.select.at(-1).tps)
  }
  const strip = (r) => ({ clients: r.clients, tps: r.tps, latencyMs: r.latencyMs })
  return { tpcb: out.tpcb.map(strip), select: out.select.map(strip), cpus: Number(onServer('nproc').trim()) }
}

// ---------------------------------------------------------------- pooling: PgBouncer
const onBouncer = (cmd, env) => exec(BOUNCER, cmd, env)

async function startBouncer() {
  log('pgbouncer')
  const secret = psql(`COPY (SELECT rolpassword FROM pg_authid WHERE rolname = 'app_rw') TO STDOUT`).trim()
  execFileSync('podman', ['cp', `${APP}pgbouncer.ini`, `${BOUNCER}:/etc/pgbouncer/pgbouncer.ini`])
  onBouncer(`pkill pgbouncer || true; sleep 0.5; mkdir -p /var/run/postgresql /var/log/postgresql; chown postgres /var/run/postgresql /var/log/postgresql
printf '"app_rw" "%s"\\n"pooladmin" "admin-secret"\\n' '${secret}' > /etc/pgbouncer/userlist.txt
chown postgres /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini
su postgres -c "pgbouncer -d /etc/pgbouncer/pgbouncer.ini"`)
  await sleep(800)
}

const viaBouncer = (database) => client({ port: BOUNCER_PORT, user: 'app_rw', password: 'app-secret', database })
const bouncerAdmin = () => client({ port: BOUNCER_PORT, user: 'pooladmin', password: 'admin-secret', database: 'pgbouncer' })
const one = async (c, sql) => {
  try {
    let r = await c.query({ text: sql, rowMode: 'array' })
    if (Array.isArray(r)) r = r[r.length - 1]
    return r.rows?.length ? r.rows.map((x) => x.join(' | ')).join('\n') : r.command
  } catch (e) {
    return `ERROR: ${e.message}`
  }
}

async function bouncerConfig() {
  const a = await bouncerAdmin()
  const r = await a.query({ text: 'SHOW CONFIG', rowMode: 'array' })
  const names = ['pool_mode', 'default_pool_size', 'max_client_conn', 'max_prepared_statements', 'server_reset_query', 'server_idle_timeout', 'query_wait_timeout', 'reserve_pool_size']
  const cfg = Object.fromEntries(r.rows.filter((x) => names.includes(x[0])).map((x) => [x[0], x[1]]))
  const version = (await a.query({ text: 'SHOW VERSION', rowMode: 'array' })).rows[0][0]
  await a.end()
  return { version, defaults: cfg }
}

async function advisory() {
  log('advisory locks through the pooler')
  const A = await viaBouncer('shop_single'), B = await viaBouncer('shop_single')
  const steps = []
  const run = async (who, c, sql) => steps.push({ who, sql, result: await one(c, sql) })
  await run('A', A, 'SELECT pg_advisory_lock(42)')
  await run('B', B, 'SELECT pg_try_advisory_lock(42)')
  const direct = await client({ user: 'app_rw', password: 'app-secret', database: 'shop' })
  const directTry = await one(direct, 'SELECT pg_try_advisory_lock(42)')
  await run('A', A, 'SELECT pg_advisory_unlock_all()')
  await run('A', A, 'BEGIN; SELECT pg_advisory_xact_lock(42); COMMIT')
  await run('B', B, "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory'")
  await Promise.all([A.end(), B.end(), direct.end()])
  return { steps, directTry }
}

async function listen() {
  log('LISTEN through the pooler')
  const count = async (listenerOpts, notifierOpts) => {
    const L = await listenerOpts(), N = await notifierOpts()
    const got = []
    L.on('notification', (m) => got.push(m.payload))
    await L.query('LISTEN order_created')
    await sleep(200)
    await N.query(`NOTIFY order_created, 'order 20001'`)
    await sleep(1000)
    await L.query('SELECT 1') // give a pending notification a chance to arrive
    await sleep(300)
    await Promise.all([L.end(), N.end()])
    return got.length
  }
  const direct = () => client({ user: 'app_rw', password: 'app-secret', database: 'shop' })
  return { direct: await count(direct, direct), transactionMode: await count(() => viaBouncer('shop'), () => viaBouncer('shop')) }
}

async function sqlPrepare() {
  log('SQL PREPARE through the pooler')
  const A = await viaBouncer('shop_single'), B = await viaBouncer('shop_single')
  const steps = []
  const run = async (who, c, sql) => steps.push({ who, sql, result: await one(c, sql) })
  await run('A', A, 'PREPARE big_orders AS SELECT count(*) FROM orders WHERE amount > $1')
  await run('B', B, 'EXECUTE big_orders(5000)')
  await run('B', B, 'PREPARE big_orders AS SELECT 1')
  await one(A, 'DEALLOCATE ALL')
  await Promise.all([A.end(), B.end()])
  return steps
}

async function protocolPrepared(max) {
  const a = await bouncerAdmin()
  await a.query(`SET max_prepared_statements = ${max}`)
  await a.end()
  await sleep(300)
  const cs = await Promise.all([1, 2, 3].map(() => viaBouncer('shop')))
  const res = []
  for (let round = 1; round <= 2; round++)
    for (const [i, c] of cs.entries()) {
      try {
        const r = await c.query({ name: 'order_count', text: 'SELECT count(*)::int AS n, pg_backend_pid() AS pid FROM orders WHERE amount > $1', values: [5000] })
        res.push({ client: i + 1, round, ok: true, pid: r.rows[0].pid, error: null })
      } catch (e) {
        res.push({ client: i + 1, round, ok: false, pid: null, error: e.message })
      }
    }
  await Promise.all(cs.map((c) => c.end().catch(() => {})))
  return { max, results: res }
}

async function statementMode() {
  log('statement mode')
  const c = await viaBouncer('shop_statement')
  const steps = []
  for (const sql of ['SELECT count(*) FROM orders', 'BEGIN']) steps.push({ sql, result: await one(c, sql) })
  await c.end().catch(() => {})
  return steps
}

async function bouncerBench() {
  log('pgbench through the pooler')
  const env = { PGPASSWORD: 'app-secret' }
  // both runs leave the server container through the host, so the network path is the same
  const persistent = await bench(`-h host.containers.internal -p ${PORT} -U app_rw -n -S -c 8 -j 4 -T 8 shop`, SERVER, env)
  const direct = await bench(`-h host.containers.internal -p ${PORT} -U app_rw -n -S -C -c 8 -j 4 -T 8 shop`, SERVER, env)
  const pooled = await bench(`-h host.containers.internal -p ${BOUNCER_PORT} -U app_rw -n -S -C -c 8 -j 4 -T 8 shop_bench`, SERVER, env)
  const a = await bouncerAdmin()
  const r = await a.query({ text: 'SHOW POOLS', rowMode: 'array' })
  const cols = r.fields.map((f) => f.name)
  const row = r.rows.find((x) => x[0] === 'shop_bench')
  const pools = Object.fromEntries(['cl_active', 'cl_waiting', 'sv_active', 'sv_idle', 'pool_mode'].map((k) => [k, row[cols.indexOf(k)]]))
  await a.end()
  const strip = (x) => ({ tps: x.tps, latencyMs: x.latencyMs, connectMs: x.connectMs })
  return { persistent: strip(persistent), direct: strip(direct), pooled: strip(pooled), poolsAfter: pools }
}

// ---------------------------------------------------------------- client-side pools
function clientPools() {
  log('node-postgres and HikariCP')
  const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: String(PORT), PGUSER: 'app_rw', PGPASSWORD: 'app-secret', PGDATABASE: 'shop' }
  const node = JSON.parse(execFileSync('node', ['pool.ts'], { cwd: APP, env, encoding: 'utf8' }))
  const java = JSON.parse(
    execFileSync('java', ['-cp', 'build/install/operations-app/lib/*', 'demo.pool.OrdersPool'], {
      cwd: APP,
      env: { ...process.env, JDBC_URL: `jdbc:postgresql://127.0.0.1:${PORT}/shop`, DB_USER: 'app_rw', DB_PASSWORD: 'app-secret' },
      encoding: 'utf8',
    }),
  )
  return {
    node: {
      lastDoneMs: Math.max(...node.results.map((r) => r.doneMs)),
      pids: new Set(node.results.map((r) => r.pid)).size,
      samples: node.samples,
      timeout: node.timeout,
    },
    java,
  }
}

// ---------------------------------------------------------------- monitoring
const ACTIVITY = `
SELECT CASE
         WHEN state = 'active' AND wait_event_type IS NULL THEN 'running'
         WHEN state = 'active' THEN wait_event_type
         ELSE state END AS what,
       coalesce(wait_event_type || ':' || wait_event, '') AS wait
FROM pg_stat_activity
WHERE backend_type = 'client backend' AND pid <> pg_backend_pid() AND datname = 'lab'`

async function activity() {
  log('pg_stat_activity under load')
  const admin = await client({ application_name: 'monitor' })
  const samples = []
  const waits = {}
  let stop = false
  const t0 = Date.now()
  const sampler = (async () => {
    while (!stop) {
      const r = await rows(admin, ACTIVITY)
      const counts = {}
      for (const x of r) {
        counts[x.what] = (counts[x.what] ?? 0) + 1
        if (x.wait && x.what !== 'idle') waits[x.wait] = (waits[x.wait] ?? 0) + 1
      }
      samples.push({ ms: Date.now() - t0, ...counts })
      await sleep(250)
    }
  })()
  const phases = []
  for (const c of [4, 16, 48]) {
    const from = Date.now() - t0
    const r = await bench(`-U postgres -n -c ${c} -j ${Math.min(c, 8)} -T 6 -P 1 lab`)
    phases.push({ clients: c, fromMs: from, toMs: Date.now() - t0, tps: r.tps, latencyMs: r.latencyMs, progress: r.progress })
  }
  // a snapshot in the middle of the busiest phase, as you would query it by hand
  stop = true
  await sampler
  const snapshotDuring = (async () => {
    await sleep(2500)
    return rows(
      admin,
      `SELECT pid, state, wait_event_type, wait_event, round(extract(epoch FROM now() - xact_start) * 1000)::int AS xact_ms, left(query, 48) AS query
       FROM pg_stat_activity WHERE backend_type = 'client backend' AND datname = 'lab' AND pid <> pg_backend_pid()
       ORDER BY wait_event_type NULLS FIRST, pid LIMIT 8`,
    )
  })()
  const [, snapshot] = await Promise.all([bench(`-U postgres -n -c 48 -j 8 -T 5 lab`), snapshotDuring])
  await admin.end()
  const topWaits = Object.entries(waits)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([wait, n]) => ({ wait, samples: n }))
  return { samples, phases, topWaits, snapshot }
}

async function statements() {
  log('pg_stat_statements')
  psql(`SELECT pg_stat_statements_reset()`)
  psql(`SELECT pg_stat_reset()`)
  psql(`SELECT pg_stat_reset_shared('io')`)
  onServer(`cat > /tmp/report.sql <<'SQL'
SELECT bid, count(*), sum(abalance) FROM pgbench_accounts GROUP BY bid;
SQL
cat > /tmp/lookup.sql <<'SQL'
\\set aid random(1, 2000000)
SELECT * FROM pgbench_accounts WHERE abalance = :aid;
SQL`)
  await Promise.all([
    bench(`-U postgres -n -c 8 -j 4 -T 12 lab`),
    bench(`-U postgres -n -c 1 -T 12 -f /tmp/report.sql lab`),
    bench(`-U postgres -n -c 1 -T 12 -f /tmp/lookup.sql lab`),
  ])
  psql('ANALYZE')
  const c = await client()
  const top = await rows(
    c,
    `SELECT regexp_replace(query, '\\s+', ' ', 'g') AS query, calls::int, round(total_exec_time)::int AS total_ms,
            round(mean_exec_time::numeric, 2)::float AS mean_ms, rows::bigint AS rows,
            round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 1)::float AS hit_pct
     FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'lab')
     ORDER BY total_exec_time DESC LIMIT 8`,
  )
  const [all] = await rows(c, `SELECT round(sum(total_exec_time))::int AS ms, sum(calls)::int AS calls FROM pg_stat_statements WHERE dbid = (SELECT oid FROM pg_database WHERE datname = 'lab')`)
  const tables = await rows(
    c,
    `SELECT relname, seq_scan::int, coalesce(idx_scan, 0)::int AS idx_scan, n_live_tup::int, n_dead_tup::int, n_tup_upd::int, n_tup_hot_upd::int,
            CASE WHEN last_autovacuum IS NULL THEN NULL ELSE round(extract(epoch FROM now() - last_autovacuum))::int END AS autovacuum_s_ago,
            autovacuum_count::int
     FROM pg_stat_user_tables WHERE relname LIKE 'pgbench%' ORDER BY relname`,
  )
  const [db] = await rows(
    c,
    `SELECT blks_hit::bigint AS hit, blks_read::bigint AS read, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2)::float AS ratio,
            xact_commit::int, xact_rollback::int, temp_files::int, temp_bytes::bigint, deadlocks::int
     FROM pg_stat_database WHERE datname = 'lab'`,
  )
  const statio = await rows(
    c,
    `SELECT relname, heap_blks_hit::bigint AS heap_hit, heap_blks_read::bigint AS heap_read, idx_blks_hit::bigint AS idx_hit, idx_blks_read::bigint AS idx_read
     FROM pg_statio_user_tables WHERE relname LIKE 'pgbench%' ORDER BY heap_blks_hit + heap_blks_read DESC`,
  )
  const io = await rows(
    c,
    `SELECT backend_type, object, context, reads::bigint, read_bytes::bigint, writes::bigint, write_bytes::bigint, extends::bigint, hits::bigint, evictions::bigint, fsyncs::bigint
     FROM pg_stat_io WHERE coalesce(reads, 0) + coalesce(writes, 0) + coalesce(extends, 0) + coalesce(hits, 0) + coalesce(fsyncs, 0) > 0
     ORDER BY coalesce(reads, 0) + coalesce(writes, 0) + coalesce(hits, 0) DESC LIMIT 10`,
  )
  const buffers = await rows(
    c,
    `SELECT coalesce(c.relname, '(free or other databases)') AS rel, count(*)::int AS buffers
     FROM pg_buffercache b LEFT JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid) AND b.reldatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
     GROUP BY 1 ORDER BY 2 DESC LIMIT 7`,
  )
  const [totalBuffers] = await rows(c, `SELECT count(*)::int AS n FROM pg_buffercache`)
  const sizes = await rows(c, `SELECT relname, pg_relation_size(oid)::bigint AS bytes FROM pg_class WHERE relname IN ('pgbench_accounts', 'pgbench_accounts_pkey') ORDER BY 1`)
  const [ckpt] = await rows(c, `SELECT num_timed::int, num_requested::int, buffers_written::int FROM pg_stat_checkpointer`)
  await c.end()
  const shorten = (q) => (q.length > 90 ? `${q.slice(0, 87)}…` : q)
  return { top: top.map((r) => ({ ...r, query: shorten(r.query), rows: Number(r.rows) })), all, tables, db: { ...db, hit: Number(db.hit), read: Number(db.read), temp_bytes: Number(db.temp_bytes) }, statio: statio.map(numify), io: io.map(numify), buffers: { top: buffers, total: totalBuffers.n }, sizes: sizes.map(numify), checkpointer: ckpt }
}
const numify = (r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v]))

async function blocking() {
  log('blocking')
  const A = await client({ application_name: 'checkout' }), B = await client({ application_name: 'refund' }), M = await client({ application_name: 'monitor' })
  await A.query('BEGIN')
  await A.query('UPDATE pgbench_accounts SET abalance = abalance - 100 WHERE aid = 1')
  const bDone = B.query('UPDATE pgbench_accounts SET abalance = abalance + 100 WHERE aid = 1').then(
    () => 'UPDATE 1',
    (e) => `ERROR: ${e.message}`,
  )
  await sleep(1500) // past deadlock_timeout, so log_lock_waits writes its line
  const tree = await rows(
    M,
    `SELECT pid, application_name AS app, state, wait_event_type AS wait_type, wait_event, pg_blocking_pids(pid) AS blocked_by,
            round(extract(epoch FROM now() - xact_start))::int AS xact_s, left(query, 60) AS query
     FROM pg_stat_activity WHERE application_name IN ('checkout', 'refund') ORDER BY pid`,
  )
  const locks = await rows(
    M,
    `SELECT l.pid, a.application_name AS app, l.locktype, l.mode, l.granted, coalesce(l.relation::regclass::text, l.transactionid::text, '') AS target
     FROM pg_locks l JOIN pg_stat_activity a USING (pid)
     WHERE a.application_name IN ('checkout', 'refund') AND l.locktype IN ('relation', 'transactionid', 'tuple') AND (l.relation IS NULL OR l.relation = 'pgbench_accounts'::regclass)
     ORDER BY l.pid, l.locktype`,
  )
  const holder = tree.find((r) => r.app === 'checkout').pid
  const cancel = (await rows(M, `SELECT pg_terminate_backend($1) AS terminated`, [holder]))[0].terminated
  const bResult = await bDone
  await Promise.all([B.end(), M.end(), A.end().catch(() => {})])
  return { tree: tree.map((r) => ({ ...r, blocked_by: `{${r.blocked_by.join(',')}}` })), locks, terminated: cancel, waiterResult: bResult }
}

async function idleInTransaction() {
  log('idle in transaction timeout')
  const c = await client({ application_name: 'forgetful' })
  let fatal = null
  c.on('error', (e) => (fatal = { code: e.code ?? null, message: e.message }))
  await c.query(`SET idle_in_transaction_session_timeout = '2s'`)
  await c.query('BEGIN')
  await c.query('SELECT count(*) FROM pgbench_branches')
  const M = await client({ application_name: 'monitor' })
  await sleep(1000)
  const [seen] = await rows(M, `SELECT state, round(extract(epoch FROM now() - state_change))::int AS idle_s FROM pg_stat_activity WHERE application_name = 'forgetful'`)
  await sleep(2000)
  let next = null
  try {
    await c.query('SELECT 1')
    next = 'ok'
  } catch (e) {
    next = e.message
  }
  await M.end()
  return { seen, fatal, nextQuery: next }
}

async function workMem() {
  log('work_mem')
  const c = await client()
  const plan = async (mem) => {
    await c.query(`SET work_mem = '${mem}'`)
    const r = await c.query(`EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY ON) SELECT * FROM pgbench_accounts WHERE aid <= 500000 ORDER BY filler DESC, abalance`)
    const lines = r.rows.map((x) => x['QUERY PLAN'])
    const exec = lines.find((l) => l.includes('Execution Time'))
    return { workMem: mem, method: lines.find((l) => l.includes('Sort Method')).trim(), executionMs: Number(exec.match(/([\d.]+) ms/)[1]), plan: lines.join('\n') }
  }
  const small = await plan('4MB')
  const big = await plan('256MB')
  await c.end()
  return [small, big]
}

async function settings() {
  const c = await client()
  const names = [
    'shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem', 'autovacuum_work_mem', 'max_connections', 'hash_mem_multiplier',
    'random_page_cost', 'max_wal_size', 'autovacuum_naptime', 'autovacuum_vacuum_scale_factor', 'autovacuum_vacuum_threshold', 'autovacuum_vacuum_insert_scale_factor',
    'autovacuum_vacuum_cost_limit', 'autovacuum_vacuum_cost_delay', 'autovacuum_max_workers', 'autovacuum_worker_slots', 'autovacuum_vacuum_max_threshold',
    'log_min_duration_statement', 'log_lock_waits', 'log_temp_files', 'log_autovacuum_min_duration', 'log_checkpoints', 'deadlock_timeout', 'track_io_timing',
    'idle_in_transaction_session_timeout', 'statement_timeout', 'io_method',
  ]
  const r = await rows(c, `SELECT name, setting, unit, context, boot_val, reset_val FROM pg_settings WHERE name = ANY($1) ORDER BY name`, [names])
  const shown = {}
  for (const n of names) shown[n] = (await rows(c, `SELECT current_setting($1) AS v`, [n]))[0]?.v
  await c.end()
  return r.map((x) => ({ name: x.name, value: shown[x.name], default: x.boot_val, unit: x.unit, context: x.context }))
}

async function autovacuum() {
  log('autovacuum over time')
  const runOnce = async (label, prepare) => {
    psql(...prepare)
    psql(`VACUUM (ANALYZE) pgbench_accounts`)
    await sleep(500)
    const c = await client()
    await c.query(`SELECT pg_stat_reset_single_table_counters('pgbench_accounts'::regclass)`)
    const samples = []
    let stop = false
    const t0 = Date.now()
    const sampler = (async () => {
      while (!stop) {
        await c.query('SELECT pg_stat_clear_snapshot()')
        const [r] = await rows(c, `SELECT n_dead_tup::int AS dead, n_live_tup::int AS live, autovacuum_count::int AS av FROM pg_stat_user_tables WHERE relname = 'pgbench_accounts'`)
        const [v] = await rows(c, `SELECT count(*)::int AS running FROM pg_stat_progress_vacuum WHERE relid = 'pgbench_accounts'::regclass`)
        samples.push({ s: Math.round((Date.now() - t0) / 100) / 10, dead: r.dead, vacuums: r.av, running: v.running })
        await sleep(1000)
      }
    })()
    const b = await bench(`-U postgres -n -c 8 -j 4 -T 60 lab`)
    stop = true
    await sampler
    const [size] = await rows(c, `SELECT pg_relation_size('pgbench_accounts')::bigint AS bytes`)
    await c.end()
    return { label, tps: b.tps, samples, sizeBytes: Number(size.bytes) }
  }
  const sizeBefore = Number(psql(`COPY (SELECT pg_relation_size('pgbench_accounts')) TO STDOUT`).trim())
  const off = await runOnce('autovacuum off for the table', [`ALTER TABLE pgbench_accounts SET (autovacuum_enabled = off)`])
  const def = await runOnce(
    'defaults (scale factor 0.2, naptime 1 min)',
    [`ALTER TABLE pgbench_accounts RESET (autovacuum_enabled)`, `ALTER SYSTEM RESET autovacuum_naptime`, `SELECT pg_reload_conf()`],
  )
  const tuned = await runOnce(
    'tuned (scale factor 0.01, naptime 10 s)',
    [`ALTER TABLE pgbench_accounts SET (autovacuum_vacuum_scale_factor = 0.01, autovacuum_vacuum_threshold = 1000)`, `ALTER SYSTEM SET autovacuum_naptime = '10s'`, `SELECT pg_reload_conf()`],
  )
  psql(`ALTER TABLE pgbench_accounts RESET (autovacuum_vacuum_scale_factor, autovacuum_vacuum_threshold)`, `ALTER SYSTEM RESET autovacuum_naptime`, `SELECT pg_reload_conf()`)
  return { sizeBefore, runs: [off, def, tuned] }
}

async function xidAge() {
  const c = await client()
  const r = await rows(c, `SELECT datname, age(datfrozenxid)::int AS xid_age, current_setting('autovacuum_freeze_max_age')::int AS freeze_max_age FROM pg_database ORDER BY 2 DESC LIMIT 3`)
  await c.end()
  return r
}

/** Log lines written while the workloads ran, one example of each kind. */
function logLines(since) {
  const all = execFileSync('bash', ['-c', `podman logs --since ${since} ${SERVER} 2>&1`], { encoding: 'utf8', maxBuffer: 1 << 28 })
  // group continuation lines (a tab or spaces) with the line they belong to
  const entries = []
  for (const line of all.split('\n')) {
    if (/^\d{4}-\d\d-\d\d /.test(line)) entries.push(line)
    else if (entries.length && line.trim()) entries[entries.length - 1] += `\n${line}`
  }
  const first = (re, extra) => {
    const i = entries.findIndex((e) => re.test(e))
    if (i < 0) return null
    return extra ? entries.slice(i, i + 1 + extra).join('\n') : entries[i]
  }
  const trimPlan = (e) => (e ? e.split('\n').slice(0, 14).join('\n') : e)
  return {
    slow: first(/duration: [\d.]+ ms {2}statement: SELECT bid/),
    autoExplain: trimPlan(first(/duration: [\d.]+ ms {2}plan:/)),
    lockWait: first(/still waiting for ShareLock/, 2),
    tempFile: first(/temporary file:/, 1),
    autovacuum: first(/automatic vacuum of table "lab\.public\.pgbench_accounts"/),
    checkpoint: first(/checkpoint complete:/),
    idleTimeout: first(/idle-in-transaction timeout/),
  }
}

// ---------------------------------------------------------------- cheat sheet (glossary lesson)
function cheatSheet() {
  log('cheat sheet')
  const run = (db, cmd) => ({ cmd, out: onServer(`psql -U postgres -d ${db} -X -P pager=off -c ${JSON.stringify(cmd).replace(/\$/g, '\\$')} 2>&1`).replace(/\s+$/, '') })
  return [
    run('shop', '\\conninfo'),
    run('shop', '\\dt+'),
    run('shop', '\\d orders'),
    run('shop', '\\du'),
    run('shop', `SELECT relname AS table, pg_size_pretty(pg_total_relation_size(oid)) AS total, pg_size_pretty(pg_relation_size(oid)) AS heap, pg_size_pretty(pg_indexes_size(oid)) AS indexes FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace ORDER BY pg_total_relation_size(oid) DESC LIMIT 5`),
    run('shop', `SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database ORDER BY pg_database_size(datname) DESC`),
  ]
}

// ---------------------------------------------------------------- main
function sanitise(json) {
  if ([homedir(), userInfo().username, '/home/'].some((bad) => json.includes(bad))) throw new Error('refusing to write: output contains a user name or home directory')
  return json
    .replaceAll(`port=${PORT}`, 'port=5432')
    .replaceAll(`:${PORT}`, ':5432')
    .replaceAll(`port ${PORT}`, 'port 5432')
    .replaceAll('host.containers.internal', 'db')
}

const ONLY = process.env.ONLY?.split(',')
if (ONLY) {
  // re-record some sections into the existing data file (setup and containers already in place)
  const text = (await import('node:fs')).readFileSync(OUT, 'utf8')
  const data = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  const sections = {
    scaling: async () => (data.pool.scaling = await scaling()),
    advisory: async () => (data.pool.advisory = await advisory()),
    bouncerBench: async () => (data.pool.bouncerBench = await bouncerBench()),
    statements: async () => (data.mon.statements = await statements()),
    cheatSheet: async () => (data.cheatSheet = cheatSheet()),
  }
  if (ONLY.some((k) => k === 'advisory' || k === 'bouncerBench')) await startBouncer()
  for (const k of ONLY) await sections[k]()
  writeFileSync(OUT, text.slice(0, text.indexOf('{')) + sanitise(JSON.stringify(data, null, 1)) + '\n')
  log('updated', ONLY.join(', '))
  process.exit(0)
}

await setup()
const out = { recordedWith: psql('SHOW server_version').trim() }
out.pool = {}
out.pool.memory = await backendMemory()
out.pool.connectCost = await connectCost()
out.pool.tooMany = await tooMany()
out.pool.scaling = await scaling()
await startBouncer()
out.pool.bouncer = await bouncerConfig()
out.pool.advisory = await advisory()
out.pool.listen = await listen()
out.pool.sqlPrepare = await sqlPrepare()
log('protocol prepared statements')
out.pool.prepared = [await protocolPrepared(0), await protocolPrepared(200)]
out.pool.statementMode = await statementMode()
out.pool.bouncerBench = await bouncerBench()
out.pool.clients = clientPools()

const since = new Date().toISOString()
psql(`ALTER SYSTEM SET log_min_duration_statement = '250ms'`)
psql(`ALTER SYSTEM SET auto_explain.log_min_duration = '200ms'`)
psql(`ALTER SYSTEM SET log_lock_waits = on`)
psql(`ALTER SYSTEM SET log_temp_files = 0`)
psql(`ALTER SYSTEM SET log_autovacuum_min_duration = 0`)
psql(`SELECT pg_reload_conf()`)
await sleep(500)
out.mon = {}
out.mon.settings = await settings()
out.mon.activity = await activity()
out.mon.statements = await statements()
out.mon.blocking = await blocking()
out.mon.idle = await idleInTransaction()
out.mon.workMem = await workMem()
psql(`CHECKPOINT`)
out.mon.autovacuum = await autovacuum()
out.mon.xidAge = await xidAge()
await sleep(1000)
out.mon.logs = logLines(since)
out.cheatSheet = cheatSheet()

const json = sanitise(JSON.stringify(out, null, 1))
writeFileSync(
  OUT,
  `// Generated by tools/postgres-capture/capture-operations.mjs — recorded on PostgreSQL ${out.recordedWith} and PgBouncer. Do not edit.\n\nexport const OPERATIONS = ${json}\n`,
)
