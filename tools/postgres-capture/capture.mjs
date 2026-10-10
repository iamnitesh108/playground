// Single-session captures: page header, WAL records, B-tree internals, plans, constraint errors.
import pg from 'pg'
import { writeFileSync } from 'node:fs'

const c = new pg.Client({ host: '127.0.0.1', port: 55432, user: 'postgres', password: 'lab', database: 'lab' })
await c.connect()
const q = async (sql) => (await c.query(sql)).rows
const err = async (sql) => {
  try {
    await c.query(sql)
    return { ok: true }
  } catch (e) {
    return { code: e.code, message: e.message, detail: e.detail ?? null, constraint: e.constraint ?? null }
  }
}
const out = {}

// Page header of a fresh two-row page
await c.query('DROP TABLE IF EXISTS accounts')
await c.query('CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL) WITH (autovacuum_enabled = false)')
await c.query('INSERT INTO accounts VALUES (1, 100), (2, 100)')
out.pageHeader = (await q(`SELECT lower, upper, special, pagesize FROM page_header(get_raw_page('accounts', 0))`))[0]
out.blockSize = (await q('SHOW block_size'))[0].block_size

// WAL records for: insert + commit, HOT update + commit, non-HOT update (changes indexed column) + commit
const walFor = async (label, sql) => {
  const start = (await q('SELECT pg_current_wal_insert_lsn()::text AS l'))[0].l
  await c.query(sql)
  const end = (await q('SELECT pg_current_wal_insert_lsn()::text AS l'))[0].l
  const recs = await q(`SELECT start_lsn::text, resource_manager, record_type, record_length, xid::text, description
                         FROM pg_get_wal_records_info('${start}', '${end}') ORDER BY start_lsn`)
  out.wal ??= []
  out.wal.push({ label, sql, start, end, records: recs })
}
await walFor('insert', 'INSERT INTO accounts VALUES (3, 300)')
await walFor('hot-update', 'UPDATE accounts SET balance = 350 WHERE id = 3')
await walFor('update-key', 'UPDATE accounts SET id = 4 WHERE id = 3')
await walFor('checkpoint', 'CHECKPOINT')

// B-tree on 100,000 rows, and plans
await c.query('DROP TABLE IF EXISTS orders')
await c.query(`CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL, status text NOT NULL, amount numeric(12,2) NOT NULL, created_at timestamptz NOT NULL)`)
await c.query(`INSERT INTO orders
  SELECT g, (g * 7919) % 5000, (ARRAY['NEW','PAID','SHIPPED','DELIVERED'])[1 + g % 4], (g % 1000) + 0.99, timestamptz '2026-01-01' + g * interval '1 minute'
  FROM generate_series(1, 100000) g`)
await c.query('ANALYZE orders')
out.tableSize = (await q(`SELECT pg_size_pretty(pg_relation_size('orders')) AS heap, pg_relation_size('orders') / 8192 AS pages, pg_size_pretty(pg_relation_size('orders_pkey')) AS pkey`))[0]
out.btreeMeta = (await q(`SELECT level, root FROM bt_metap('orders_pkey')`))[0]
out.btreeRoot = await q(`SELECT itemoffset, data FROM bt_page_items('orders_pkey', (SELECT root FROM bt_metap('orders_pkey'))) ORDER BY itemoffset LIMIT 6`)
out.btreeRootStats = (await q(`SELECT live_items, type FROM bt_page_stats('orders_pkey', (SELECT root FROM bt_metap('orders_pkey')))`))[0]
out.btreeLeafStats = (await q(`SELECT live_items, type, avg_item_size FROM bt_page_stats('orders_pkey', 1)`))[0]

const plan = async (label, sql) => {
  const rows = await q(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) ${sql}`)
  out.plans ??= []
  out.plans.push({ label, sql, plan: rows.map((r) => r['QUERY PLAN']) })
}
await plan('seq scan', `SELECT * FROM orders WHERE customer_id = 42`)
await c.query('CREATE INDEX orders_customer_idx ON orders (customer_id)')
await c.query('ANALYZE orders')
await plan('index on customer_id', `SELECT * FROM orders WHERE customer_id = 42`)
await plan('primary key lookup', `SELECT * FROM orders WHERE id = 31337`)
await plan('range on primary key', `SELECT * FROM orders WHERE id BETWEEN 1000 AND 1100`)
await plan('low selectivity', `SELECT * FROM orders WHERE status = 'PAID'`)
await c.query('VACUUM orders')
await plan('index-only', `SELECT customer_id FROM orders WHERE customer_id BETWEEN 100 AND 110`)
await c.query('CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at)')
await c.query('ANALYZE orders')
await plan('composite: leading column', `SELECT id FROM orders WHERE customer_id = 42 AND created_at >= '2026-02-01'`)
await plan('composite: second column only', `SELECT id FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-03-02'`)
await plan('function on column', `SELECT * FROM orders WHERE customer_id + 0 = 42`)

// Constraint errors
await c.query('DROP TABLE IF EXISTS payments')
await c.query('DROP TABLE IF EXISTS customers')
await c.query('CREATE TABLE customers (id int PRIMARY KEY, email text NOT NULL UNIQUE)')
await c.query(`CREATE TABLE payments (
  id bigserial PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customers (id),
  idempotency_key text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0))`)
await c.query(`INSERT INTO customers VALUES (1, 'ann@example.com')`)
await c.query(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00)`)
out.errors = {
  unique: await err(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00)`),
  foreignKey: await err(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (99, 'req-2', 10.00)`),
  check: await err(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-3', -5)`),
  notNull: await err(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, NULL, 5)`),
  fkDelete: await err(`DELETE FROM customers WHERE id = 1`),
}
const tag = async (sql) => {
  const r = await c.query(sql)
  return { command: r.command, rowCount: r.rowCount, rows: r.rows }
}
out.onConflict = {
  doNothing: await tag(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`),
  doNothingNew: await tag(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-4', 40.00) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`),
  doUpdate: await tag(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 30.00) ON CONFLICT (idempotency_key) DO UPDATE SET amount = EXCLUDED.amount RETURNING id, amount`),
}
// An error aborts the whole transaction
await c.query('BEGIN')
await err(`INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00)`)
out.abortedTx = await err(`SELECT 1`)
await c.query('ROLLBACK')

await c.end()
writeFileSync(new URL('./capture.json', import.meta.url), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1).slice(0, 200))
