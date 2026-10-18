import { homedir, userInfo } from 'node:os'
// Records the planner, B-tree and index-type lessons: statistics, estimates, costs, plans,
// join algorithms, sorts, write cost of indexes, bloat, and every index type with its size.
// Usage: node capture-queries.mjs ../../src/modules/postgres/data/queries.ts   (needs psql on PATH)
import { spawn, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const PORT = process.env.PG_QUERIES_PORT ?? '55514'
const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-queries.mjs <out.ts>')

const ARGS = ['-h', '127.0.0.1', '-p', PORT, '-U', 'postgres', '-d', 'lab', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
const ENV = { ...process.env, PGPASSWORD: 'lab', PAGER: '', PSQL_PAGER: '' }

/** Runs SQL through psql and returns what it printed (errors included). */
function psql(sql, extra = []) {
  const r = spawnSync('psql', [...ARGS, ...extra], { input: sql, encoding: 'utf8', env: ENV, maxBuffer: 64 << 20 })
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}\n--- for ---\n${sql}`)
  return (r.stdout + r.stderr).replace(/\s+$/, '')
}
/** As psql would show it to a person: aligned, with headers. */
const show = (sql, pre = '') => psql(`${pre}\n${sql}`)
/** Plain lines of output (tuples only, unaligned): EXPLAIN plans. */
const lines = (sql, pre = '') => psql(`${pre}\n${sql}`, ['-At']).split('\n')
/** One JSON value computed by the server. */
const json = (sql, pre = '') => JSON.parse(psql(`${pre}\nSELECT coalesce(json_agg(t), '[]') FROM (${sql}) t;`, ['-At']))
const one = (sql, pre = '') => json(sql, pre)[0]
const exec = (sql) => psql(sql)
/** psql output of a statement that is expected to fail. */
function failing(sql, pre = '') {
  const r = spawnSync('psql', [...ARGS.filter((a) => a !== 'ON_ERROR_STOP=1' && a !== '-v')], { input: `${pre}\n${sql}`, encoding: 'utf8', env: ENV })
  return (r.stdout + r.stderr).replace(/\s+$/, '')
}
const ms = () => Number(process.hrtime.bigint() / 1000n) / 1000

const NO_PARALLEL = 'SET max_parallel_workers_per_gather = 0;'
// a first lookup loads each index's metapage into the session's cache, so the recorded plan counts only the tree pages
const WARM = `DO $$ BEGIN PERFORM 1 FROM orders WHERE id = 1; PERFORM 1 FROM customers WHERE id = 1; PERFORM 1 FROM payments WHERE order_id = 1; END $$;`
const EXPLAIN = 'EXPLAIN (ANALYZE, BUFFERS)'
const EXPLAIN_SHORT = 'EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF)'
const plan = (sql, pre = `${NO_PARALLEL} ${WARM}`, how = EXPLAIN) => ({ sql, plan: lines(`${how} ${sql};`, pre) })
/** Total estimated cost and measured time of the top plan node. */
const priced = (sql, pre) => {
  const est = JSON.parse(psql(`${pre}\nEXPLAIN (FORMAT JSON) ${sql};`, ['-At']))[0].Plan
  const act = JSON.parse(psql(`${pre}\nEXPLAIN (ANALYZE, FORMAT JSON) ${sql};`, ['-At']))[0]
  return { node: est['Node Type'], cost: est['Total Cost'], ms: act['Execution Time'] }
}

const out = { version: one(`SELECT current_setting('server_version') AS v`).v }

// ---------------------------------------------------------------- data
exec(`
CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgstattuple; CREATE EXTENSION IF NOT EXISTS pg_visibility; CREATE EXTENSION IF NOT EXISTS pageinspect;
DROP TABLE IF EXISTS payments, orders, customers, deliveries, orders_w, products, bookings, stores, events, events_shuffled CASCADE;
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, email text NOT NULL, country text NOT NULL, city text NOT NULL, created_at timestamptz NOT NULL);
INSERT INTO customers SELECT g, 'customer ' || g, 'User' || g || '@Example.com',
  (ARRAY['DE','FR','US','JP','BR'])[1 + g % 5], (ARRAY['Berlin','Paris','New York','Tokyo','Sao Paulo'])[1 + g % 5],
  timestamptz '2025-01-01' + g * interval '30 minutes' FROM generate_series(1, 10000) g;
CREATE TABLE orders (id bigint PRIMARY KEY, customer_id int NOT NULL REFERENCES customers, status text NOT NULL,
  amount numeric(10,2) NOT NULL, created_at timestamptz NOT NULL, note text);
INSERT INTO orders SELECT g, 1 + (g::bigint * 7919) % 10000,
  CASE WHEN g % 100 < 70 THEN 'DELIVERED' WHEN g % 100 < 85 THEN 'SHIPPED' WHEN g % 100 < 97 THEN 'PAID' WHEN g % 100 < 99 THEN 'NEW' ELSE 'CANCELLED' END,
  ((g::bigint * 37) % 50000) / 100.0, timestamptz '2026-01-01' + g * interval '1 minute', 'gift wrap: ' || (g % 3 = 0)
  FROM generate_series(1, 500000) g;
CREATE TABLE payments (order_id bigint PRIMARY KEY REFERENCES orders, paid_at timestamptz NOT NULL, method text NOT NULL);
INSERT INTO payments SELECT id, created_at + interval '5 minutes', (ARRAY['card','bank','wallet'])[1 + id % 3]
  FROM orders WHERE status NOT IN ('NEW', 'CANCELLED');
VACUUM ANALYZE customers, orders, payments;
`)

// ---------------------------------------------------------------- planning: settings, sizes, statistics
out.settings = Object.fromEntries(
  json(`SELECT name, setting FROM pg_settings WHERE name IN ('seq_page_cost','random_page_cost','cpu_tuple_cost','cpu_index_tuple_cost',
        'cpu_operator_cost','parallel_tuple_cost','parallel_setup_cost','work_mem','effective_cache_size','default_statistics_target',
        'max_parallel_workers_per_gather','min_parallel_table_scan_size')`).map((r) => [r.name, r.setting]),
)
out.tables = json(`SELECT relname AS name, relpages AS pages, reltuples::bigint AS tuples, pg_relation_size(oid) AS bytes
                   FROM pg_class WHERE relname IN ('orders','customers','payments') ORDER BY relname`)
out.statsSql = `SELECT n_distinct, most_common_vals, most_common_freqs, correlation
FROM pg_stats WHERE tablename = 'orders' AND attname = 'status';`
out.statsShow = show(`\\x on\n${out.statsSql}`)
out.stats = json(`SELECT attname, n_distinct, null_frac, avg_width, correlation, most_common_vals::text AS mcv, most_common_freqs AS mcf,
                         histogram_bounds::text AS hist FROM pg_stats WHERE tablename = 'orders' ORDER BY attname`)
out.histSql = `SELECT histogram_bounds FROM pg_stats WHERE tablename = 'orders' AND attname = 'amount';`
out.counts = one(`SELECT count(*) FILTER (WHERE status = 'NEW') AS new, count(*) FILTER (WHERE customer_id = 42) AS c42,
                         count(*) FILTER (WHERE amount < 50) AS cheap FROM orders`)

// row estimates: most common value, 1/n_distinct, histogram
out.estimates = {
  mcv: plan(`SELECT * FROM orders WHERE status = 'NEW'`, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)'),
  distinct: plan(`SELECT * FROM orders WHERE customer_id = 42`, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)'),
  histogram: plan(`SELECT * FROM orders WHERE amount < 50`, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)'),
}

// a bad estimate from correlated columns, fixed with extended statistics
const correlated = `SELECT * FROM customers WHERE country = 'FR' AND city = 'Paris'`
out.correlated = { before: plan(correlated, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)') }
out.correlated.fix = `CREATE STATISTICS customers_country_city (dependencies) ON country, city FROM customers;\nANALYZE customers;`
exec(out.correlated.fix)
out.correlated.after = plan(correlated, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)')
out.correlated.dependencies = show(`SELECT statistics_name, dependencies FROM pg_stats_ext WHERE statistics_name = 'customers_country_city';`)

// a bad estimate from stale statistics, fixed with ANALYZE
exec(`CREATE TABLE deliveries (id bigint, order_id bigint, delivered_at timestamptz) WITH (autovacuum_enabled = false);
      INSERT INTO deliveries SELECT g, g, timestamptz '2026-01-01' + g * interval '20 seconds' FROM generate_series(1, 100000) g;
      ANALYZE deliveries;
      INSERT INTO deliveries SELECT g, g, timestamptz '2026-01-01' + g * interval '20 seconds' FROM generate_series(100001, 150000) g;`)
const stale = `SELECT * FROM deliveries WHERE delivered_at >= '2026-01-24'`
out.stale = { before: plan(stale, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)') }
exec('ANALYZE deliveries')
out.stale.after = plan(stale, undefined, 'EXPLAIN (ANALYZE, TIMING OFF, SUMMARY OFF)')

// the cost model by hand
out.cost = {
  all: lines(`EXPLAIN SELECT * FROM orders;`, NO_PARALLEL),
  filtered: lines(`EXPLAIN SELECT * FROM orders WHERE status = 'NEW';`, NO_PARALLEL),
  stats: show(`SELECT relpages, reltuples FROM pg_class WHERE relname = 'orders';`),
}

// scan types
exec('CREATE INDEX orders_customer_idx ON orders (customer_id); ANALYZE orders')
out.scans = {
  seq: plan(`SELECT * FROM orders WHERE status = 'DELIVERED'`),
  index: plan(`SELECT * FROM orders WHERE id = 31337`),
  indexOnly: plan(`SELECT id FROM orders WHERE id BETWEEN 1000 AND 1999`),
  bitmap: plan(`SELECT * FROM orders WHERE customer_id = 42`),
}

// joins
const nlSql = `SELECT o.id, c.name, o.amount FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id BETWEEN 1000 AND 1009`
const hashSql = `SELECT c.country, count(*), sum(o.amount) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.country`
const mergeSql = `SELECT o.id, p.method FROM orders o JOIN payments p ON p.order_id = o.id ORDER BY o.id LIMIT 1000`
out.joins = { nested: plan(nlSql), hash: plan(hashSql), merge: plan(mergeSql) }
// one query, all three algorithms priced and timed (the others switched off to force each)
const forcedSql = `SELECT o.id, p.method FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id <= 100000`
const OFF = (...algs) => NO_PARALLEL + algs.map((a) => `SET enable_${a} = off;`).join('')
out.forced = {
  sql: forcedSql,
  runs: [
    { algorithm: 'hash join', ...priced(forcedSql, OFF('mergejoin', 'nestloop')) },
    { algorithm: 'merge join', ...priced(forcedSql, OFF('hashjoin', 'nestloop')) },
    { algorithm: 'nested loop', ...priced(forcedSql, OFF('hashjoin', 'mergejoin')) },
  ],
  chosen: priced(forcedSql, NO_PARALLEL).node,
}
// a fuller plan for the tree explorer
out.report = plan(`SELECT c.id, c.name, sum(o.amount) AS spent
FROM customers c JOIN orders o ON o.customer_id = c.id
WHERE c.country = 'FR' AND o.created_at >= '2026-06-01' AND o.created_at < '2026-07-01'
GROUP BY c.id, c.name ORDER BY spent DESC LIMIT 5`)

// parallel query
const parSql = `SELECT status, count(*), avg(amount) FROM orders GROUP BY status`
out.parallel = {
  plan: plan(parSql, 'SET max_parallel_workers_per_gather = 2;'),
  timings: [0, 1, 2, 4].map((w) => {
    const pre = `SET max_parallel_workers_per_gather = ${w};`
    const times = [0, 1, 2].map(() => JSON.parse(psql(`${pre}\nEXPLAIN (ANALYZE, FORMAT JSON) ${parSql};`, ['-At']))[0]['Execution Time'])
    return { workers: w, ms: times.sort((a, b) => a - b)[1] }
  }),
  cpus: Number(spawnSync('nproc', { encoding: 'utf8' }).stdout.trim()),
}

// sorts and hashes spilling past work_mem
const sortSql = `SELECT id, amount FROM orders ORDER BY amount`
out.spill = {
  small: plan(sortSql, `${NO_PARALLEL} SET work_mem = '1MB';`),
  big: plan(sortSql, `${NO_PARALLEL} SET work_mem = '64MB';`),
  topN: plan(`${sortSql} LIMIT 10`, `${NO_PARALLEL} SET work_mem = '1MB';`),
  hashSmall: plan(forcedSql, `${NO_PARALLEL} SET work_mem = '256kB';`),
}

// ---------------------------------------------------------------- B-tree lesson
exec('DROP INDEX orders_customer_idx; CREATE INDEX orders_customer_created_idx ON orders (customer_id, created_at); ANALYZE orders')
out.multi = {
  both: plan(`SELECT id FROM orders WHERE customer_id = 42 AND created_at >= '2026-06-01'`, undefined, EXPLAIN_SHORT),
  leading: plan(`SELECT id FROM orders WHERE customer_id = 42`, undefined, EXPLAIN_SHORT),
  second: plan(`SELECT id FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-03-01 01:00'`, undefined, EXPLAIN_SHORT),
  sorted: plan(`SELECT id, created_at FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 5`, undefined, EXPLAIN_SHORT),
}
exec('CREATE INDEX orders_status_created_idx ON orders (status, created_at); ANALYZE orders')
out.multi.skip = plan(`SELECT id FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-03-01 01:00'`, undefined, EXPLAIN_SHORT)
exec('DROP INDEX orders_status_created_idx')

// covering index and the visibility map
const coverSql = `SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199`
out.covering = { plain: plan(coverSql, undefined, EXPLAIN_SHORT) }
exec('CREATE INDEX orders_customer_incl_idx ON orders (customer_id) INCLUDE (amount); VACUUM ANALYZE orders')
out.covering.ddl = 'CREATE INDEX orders_customer_incl_idx ON orders (customer_id) INCLUDE (amount);'
out.covering.vacuumed = plan(coverSql, undefined, EXPLAIN_SHORT)
out.covering.vmBefore = one(`SELECT all_visible FROM pg_visibility_map_summary('orders')`)
exec(`UPDATE orders SET note = note || '.' WHERE id % 10 = 0`)
out.covering.vmAfterUpdate = one(`SELECT all_visible FROM pg_visibility_map_summary('orders')`)
out.covering.afterUpdate = plan(coverSql, undefined, EXPLAIN_SHORT)
exec('VACUUM orders')
out.covering.vmAfterVacuum = one(`SELECT all_visible FROM pg_visibility_map_summary('orders')`)
out.covering.again = plan(coverSql, undefined, EXPLAIN_SHORT)
out.covering.vmShow = show(`SELECT all_visible, all_frozen FROM pg_visibility_map_summary('orders');`)

// sort avoidance
const latest = `SELECT * FROM orders ORDER BY created_at DESC LIMIT 10`
out.sortAvoid = { without: plan(latest, undefined, EXPLAIN_SHORT) }
exec('CREATE INDEX orders_created_idx ON orders (created_at)')
out.sortAvoid.with = plan(latest, undefined, EXPLAIN_SHORT)

// write amplification: the same 200,000-row insert with 0, 1, 3 and 6 indexes
const INDEXES = ['id', 'customer_id', 'created_at', 'status', 'amount', 'customer_id, created_at']
exec(`CREATE TABLE orders_w (LIKE orders) WITH (autovacuum_enabled = false)`)
out.writes = [0, 1, 3, 6].map((n) => {
  const runs = [0, 1, 2].map(() => {
    exec(`DROP TABLE orders_w; CREATE TABLE orders_w (LIKE orders) WITH (autovacuum_enabled = false);
          ${INDEXES.slice(0, n).map((c, i) => `CREATE INDEX orders_w_${i} ON orders_w (${c});`).join('\n')} CHECKPOINT;`)
    const lsn = one(`SELECT pg_current_wal_lsn()::text AS l`).l
    const t0 = ms()
    exec(`INSERT INTO orders_w SELECT * FROM orders WHERE id <= 200000`)
    const took = ms() - t0
    const after = one(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), '${lsn}')::bigint AS wal, pg_indexes_size('orders_w') AS idx, pg_relation_size('orders_w') AS heap`)
    return { ms: Math.round(took), ...after }
  })
  const mid = runs.sort((a, b) => a.ms - b.ms)[1]
  return { indexes: n, columns: INDEXES.slice(0, n), rowsPerSec: Math.round(200000 / (mid.ms / 1000)), ...mid }
})

// bloat: delete 3 of every 4 rows, vacuum, reindex
exec(`DROP TABLE orders_w; CREATE TABLE orders_w (LIKE orders) WITH (autovacuum_enabled = false);
      INSERT INTO orders_w SELECT * FROM orders; CREATE INDEX orders_w_customer_idx ON orders_w (customer_id);`)
const bloat = (stage) => ({ stage, ...one(`SELECT pg_relation_size('orders_w_customer_idx') AS bytes, avg_leaf_density AS density, leaf_pages
  FROM pgstatindex('orders_w_customer_idx')`) })
out.bloat = [bloat('fresh index')]
exec(`DELETE FROM orders_w WHERE id % 4 <> 0; VACUUM orders_w;`)
out.bloat.push(bloat('after deleting 75 % + VACUUM'))
exec(`REINDEX INDEX CONCURRENTLY orders_w_customer_idx`)
out.bloat.push(bloat('after REINDEX CONCURRENTLY'))
out.bloatShow = show(`SELECT pg_size_pretty(pg_relation_size(indexrelid)) AS size, avg_leaf_density, leaf_pages, deleted_pages
FROM pg_index, pgstatindex(indexrelid::regclass) WHERE indexrelid = 'orders_w_customer_idx'::regclass;`)

// CREATE INDEX blocks writes; CONCURRENTLY does not, and a failed one leaves an INVALID index
{
  const holder = spawn('psql', [...ARGS], { env: ENV })
  holder.stdin.write(`BEGIN; CREATE INDEX orders_w_amount_idx ON orders_w (amount); SELECT pg_sleep(3); ROLLBACK;\n`)
  holder.stdin.end()
  await new Promise((r) => setTimeout(r, 800))
  out.blocked = failing(`SET lock_timeout = '1s';\nINSERT INTO orders_w SELECT * FROM orders WHERE id = 1;`)
  out.blockedLocks = show(`SELECT l.mode, l.granted, left(a.query, 40) AS query FROM pg_locks l JOIN pg_stat_activity a USING (pid)
WHERE l.relation = 'orders_w'::regclass ORDER BY l.granted DESC;`)
  await new Promise((r) => holder.on('close', r))
}
{
  const t0 = ms()
  exec(`CREATE INDEX orders_w_amount_idx ON orders_w (amount)`)
  const plain = ms() - t0
  exec(`DROP INDEX orders_w_amount_idx`)
  const t1 = ms()
  exec(`CREATE INDEX CONCURRENTLY orders_w_amount_idx ON orders_w (amount)`)
  out.concurrently = { plainMs: Math.round(plain), concurrentMs: Math.round(ms() - t1) }
}
out.invalid = {
  error: failing(`CREATE UNIQUE INDEX CONCURRENTLY orders_w_customer_uq ON orders_w (customer_id);`),
  describe: show(`SELECT indexrelid::regclass AS index, indisvalid FROM pg_index WHERE indrelid = 'orders_w'::regclass ORDER BY 1;`),
}
exec('DROP INDEX orders_w_customer_uq')

// unused indexes
exec(`SELECT pg_stat_reset();`)
for (let i = 0; i < 20; i++) exec(`SELECT * FROM orders WHERE id = ${1000 + i}; SELECT * FROM orders WHERE customer_id = ${i + 1} ORDER BY created_at LIMIT 5;`)
exec(`SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;`)
await new Promise((r) => setTimeout(r, 1500))
out.unusedSql = `SELECT relname AS table, indexrelname AS index, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes WHERE relname = 'orders' ORDER BY idx_scan, pg_relation_size(indexrelid) DESC;`
out.unused = show(out.unusedSql)

// ---------------------------------------------------------------- Other index types
const size = (rel) => one(`SELECT pg_relation_size('${rel}') AS b`).b
// partial and expression
out.partial = { ddl: `CREATE INDEX orders_new_created_idx ON orders (created_at) WHERE status = 'NEW';` }
exec(out.partial.ddl + ' ANALYZE orders')
out.partial.plan = plan(`SELECT id, created_at FROM orders WHERE status = 'NEW' ORDER BY created_at LIMIT 20`, undefined, EXPLAIN_SHORT)
out.partial.other = plan(`SELECT id, created_at FROM orders WHERE status = 'PAID' ORDER BY created_at LIMIT 20`, undefined, EXPLAIN_SHORT)
out.partial.sizes = { partial: size('orders_new_created_idx'), full: size('orders_created_idx') }
const emailSql = `SELECT id FROM customers WHERE lower(email) = 'user42@example.com'`
out.expression = { before: plan(emailSql, undefined, EXPLAIN_SHORT), ddl: 'CREATE INDEX customers_email_lower_idx ON customers (lower(email));' }
exec(out.expression.ddl + ' ANALYZE customers')
out.expression.after = plan(emailSql, undefined, EXPLAIN_SHORT)

// products: JSONB, arrays, full-text, trigram
exec(`
CREATE TABLE products (id int PRIMARY KEY, sku text NOT NULL, name text NOT NULL, description text NOT NULL, attrs jsonb NOT NULL, tags text[] NOT NULL,
  search tsvector GENERATED ALWAYS AS (to_tsvector('english', name || ' ' || description)) STORED);
INSERT INTO products
SELECT g, 'SKU-' || lpad(to_hex((g::bigint * 2654435761) % 4294967296), 8, '0') || '-' || g,
  (ARRAY['Trail','City','Summit','Harbor','Desert','Alpine','Coastal','Urban'])[1 + g % 8] || ' ' ||
  (ARRAY['jacket','boot','backpack','tent','glove','shirt','hat','bottle','lamp','mug'])[1 + (g / 8) % 10],
  'A ' || (ARRAY['waterproof','lightweight','insulated','breathable','recycled','packable'])[1 + g % 6] || ' ' ||
  (ARRAY['nylon','wool','cotton','steel','leather','canvas','bamboo'])[1 + (g / 6) % 7] || ' design for ' ||
  (ARRAY['hiking','travel','camping','running','commuting','climbing','fishing','skiing','cycling'])[1 + (g / 42) % 9] || ', model ' || g,
  jsonb_build_object('color', (ARRAY['red','blue','green','black','white','grey'])[1 + g % 6], 'size', (ARRAY['S','M','L','XL'])[1 + (g / 6) % 4],
    'brand', 'brand' || (g % 50), 'weight_g', 100 + g % 900),
  CASE WHEN g % 20 = 0 THEN ARRAY['sale','new'] WHEN g % 7 = 0 THEN ARRAY['sale'] WHEN g % 11 = 0 THEN ARRAY['new'] ELSE ARRAY['regular'] END
FROM generate_series(1, 200000) g;
VACUUM ANALYZE products;`)
out.products = { rows: 200000, heap: size('products'), sample: show(`SELECT id, name, attrs, tags FROM products WHERE id = 42;`) }
const jsonSql = `SELECT id, name FROM products WHERE attrs @> '{"brand": "brand8", "color": "red", "size": "M"}'`
const jsonBroadSql = `SELECT id FROM products WHERE attrs @> '{"color": "red", "size": "M"}'`
const tagSql = `SELECT count(*) FROM products WHERE tags @> ARRAY['new', 'sale']`
const ftsSql = `SELECT id, name FROM products WHERE search @@ to_tsquery('english', 'waterproof & wool & skiing') LIMIT 5`
const trgmSql = `SELECT id, name FROM products WHERE description ILIKE '%model 4242%'`
out.gin = { before: { json: plan(jsonSql, undefined, EXPLAIN_SHORT), trgm: plan(trgmSql, undefined, EXPLAIN_SHORT) } }
const GIN_DDL = {
  json: 'CREATE INDEX products_attrs_idx ON products USING gin (attrs);',
  jsonPath: 'CREATE INDEX products_attrs_path_idx ON products USING gin (attrs jsonb_path_ops);',
  tags: 'CREATE INDEX products_tags_idx ON products USING gin (tags);',
  fts: 'CREATE INDEX products_search_idx ON products USING gin (search);',
  trgm: 'CREATE INDEX products_description_trgm_idx ON products USING gin (description gin_trgm_ops);',
}
const buildMs = {}
for (const [k, ddl] of Object.entries(GIN_DDL)) {
  const t0 = ms()
  exec(ddl)
  buildMs[k] = Math.round(ms() - t0)
}
exec('CREATE INDEX products_sku_btree_idx ON products (sku); CREATE INDEX products_sku_hash_idx ON products USING hash (sku); ANALYZE products')
exec('DROP INDEX products_attrs_path_idx')
out.gin.ddl = GIN_DDL
out.gin.buildMs = buildMs
out.gin.json = plan(jsonSql, undefined, EXPLAIN_SHORT)
out.gin.jsonBroad = plan(jsonBroadSql, undefined, EXPLAIN_SHORT)
out.gin.tags = plan(tagSql, undefined, EXPLAIN_SHORT)
out.gin.fts = plan(ftsSql, undefined, EXPLAIN_SHORT)
out.gin.trgm = plan(trgmSql, undefined, EXPLAIN_SHORT)
out.gin.tsvector = show(`SELECT name, search FROM products WHERE id = 42;`)
out.gin.trigrams = show(`SELECT show_trgm('wool');`)
exec(GIN_DDL.jsonPath)
out.gin.jsonPath = plan(jsonSql, undefined, EXPLAIN_SHORT)
out.sizes = {
  products: json(`SELECT c.relname AS name, am.amname AS method, pg_relation_size(c.oid) AS bytes FROM pg_class c JOIN pg_am am ON am.oid = c.relam
                  JOIN pg_index i ON i.indexrelid = c.oid WHERE i.indrelid = 'products'::regclass ORDER BY bytes DESC`),
}
exec('DROP INDEX products_sku_btree_idx')
const sku = one(`SELECT sku FROM products WHERE id = 4242`).sku
out.hash = { ddl: 'CREATE INDEX products_sku_hash_idx ON products USING hash (sku);', plan: plan(`SELECT id FROM products WHERE sku = '${sku}'`, `${NO_PARALLEL} DO $$ BEGIN PERFORM 1 FROM products WHERE sku = 'x'; END $$;`, EXPLAIN_SHORT) }

// GiST: ranges with an exclusion constraint, and nearest-neighbour search on points
out.gist = {
  ddl: `CREATE TABLE bookings (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_id int NOT NULL,
  during tstzrange NOT NULL,
  EXCLUDE USING gist (room_id WITH =, during WITH &&)
);`,
}
exec(out.gist.ddl)
exec(`INSERT INTO bookings (room_id, during)
      SELECT r, tstzrange(timestamptz '2026-01-01' + d * interval '1 day' + interval '14 hours', timestamptz '2026-01-01' + (d + 1) * interval '1 day' + interval '11 hours')
      FROM generate_series(1, 200) r, generate_series(0, 364, 3) d; ANALYZE bookings;`)
out.gist.rows = one(`SELECT count(*) AS n FROM bookings`).n
out.gist.ok = show(`INSERT INTO bookings (room_id, during) VALUES (7, '[2026-03-10 14:00, 2026-03-11 11:00)') RETURNING room_id, during;`)
out.gist.conflict = failing(`INSERT INTO bookings (room_id, during) VALUES (7, '[2026-03-10 18:00, 2026-03-12 11:00)');`)
out.gist.overlap = plan(`SELECT id, during FROM bookings WHERE room_id = 7 AND during && tstzrange('2026-03-10', '2026-03-12')`, undefined, EXPLAIN_SHORT)
exec(`CREATE TABLE stores (id int PRIMARY KEY, name text NOT NULL, location point NOT NULL);
      INSERT INTO stores SELECT g, 'store ' || g, point(((g::bigint * 7919) % 10007) / 100.0, ((g::bigint * 104729) % 10009) / 100.0) FROM generate_series(1, 100000) g;
      CREATE INDEX stores_location_idx ON stores USING gist (location); VACUUM ANALYZE stores;`)
out.gist.knn = plan(`SELECT id, location, location <-> point '(50, 50)' AS distance FROM stores ORDER BY location <-> point '(50, 50)' LIMIT 3`, undefined, EXPLAIN_SHORT)
out.gist.knnRows = show(`SELECT id, location, round((location <-> point '(50, 50)')::numeric, 3) AS distance FROM stores ORDER BY location <-> point '(50, 50)' LIMIT 3;`)
out.gist.sizes = json(`SELECT relname AS name, pg_relation_size(oid) AS bytes FROM pg_class WHERE relname IN ('bookings','bookings_room_id_during_excl','stores','stores_location_idx')`)

// BRIN on a time-ordered table, against a B-tree
exec(`CREATE TABLE events (id bigint, created_at timestamptz NOT NULL, kind text NOT NULL, payload text) WITH (autovacuum_enabled = false);
      INSERT INTO events SELECT g, timestamptz '2026-01-01' + g * interval '3 seconds', (ARRAY['click','view','buy'])[1 + g % 3], md5(g::text)
      FROM generate_series(1, 2000000) g; VACUUM ANALYZE events;`)
const rangeSql = `SELECT count(*) FROM events WHERE created_at >= '2026-02-01 10:00' AND created_at < '2026-02-01 11:00'`
out.brin = { rows: 2000000, seq: plan(rangeSql, undefined, EXPLAIN_SHORT) }
let t0 = ms()
exec('CREATE INDEX events_created_btree ON events (created_at)')
out.brin.btreeBuildMs = Math.round(ms() - t0)
out.brin.btree = plan(rangeSql, `${NO_PARALLEL} SET enable_indexonlyscan = off;`, EXPLAIN_SHORT)
exec('DROP INDEX events_created_btree')
out.brin.ddl = 'CREATE INDEX events_created_brin ON events USING brin (created_at);'
t0 = ms()
exec(out.brin.ddl)
out.brin.brinBuildMs = Math.round(ms() - t0)
out.brin.brin = plan(rangeSql, undefined, EXPLAIN_SHORT)
out.brin.sizes = { heap: size('events'), brin: size('events_created_brin') }
exec('CREATE INDEX events_created_btree ON events (created_at)')
out.brin.sizes.btree = size('events_created_btree')
out.brin.summary = show(`SELECT blknum, value FROM brin_page_items(get_raw_page('events_created_brin', 2), 'events_created_brin') ORDER BY blknum LIMIT 3;`)
out.brin.correlation = one(`SELECT correlation FROM pg_stats WHERE tablename = 'events' AND attname = 'created_at'`).correlation
// the same rows in random order: every range spans the whole period
exec(`CREATE TABLE events_shuffled AS SELECT * FROM events ORDER BY md5(id::text);
      CREATE INDEX events_shuffled_brin ON events_shuffled USING brin (created_at); VACUUM ANALYZE events_shuffled;`)
out.brin.shuffled = plan(rangeSql.replace('FROM events', 'FROM events_shuffled'), `${NO_PARALLEL} SET enable_seqscan = off;`, EXPLAIN_SHORT)
out.brin.shuffledCorrelation = one(`SELECT correlation FROM pg_stats WHERE tablename = 'events_shuffled' AND attname = 'created_at'`).correlation

// ---------------------------------------------------------------- write, refusing anything personal
const text = JSON.stringify(out, null, 1)
for (const bad of ['/home/', homedir(), userInfo().username]) {
  if (bad && text.toLowerCase().includes(bad.toLowerCase())) throw new Error(`refusing to write: output contains ${bad}`)
}
const header = `// Recorded from PostgreSQL ${out.version} by tools/postgres-capture/capture-queries.mjs — do not edit by hand.\n\n`
writeFileSync(outFile, `${header}export const QUERIES = ${text.replaceAll(`:${PORT}`, ':5432')} as const\n`)
console.log(`wrote ${outFile} (${(text.length / 1024).toFixed(0)} kB)`)
