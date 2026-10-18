// Records how PostgreSQL works inside — processes, buffers, files, pages, tuples, TOAST, MVCC and VACUUM —
// for the "How it works" lessons. Talks to the server only through psql inside the container, so it needs
// no npm packages.
//
//   node capture-internals.mjs [container] [out file]
//   (defaults: pg-internals, ../../src/modules/postgres/data/internals.ts)
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CONTAINER = process.argv[2] ?? 'pg-internals'
const OUT = resolve(process.argv[3] ?? `${here}/../../src/modules/postgres/data/internals.ts`)
const PSQL = ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'lab', '-X', '-v', 'ON_ERROR_STOP=1']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const psql = (sql, flags = []) => execFileSync('podman', [...PSQL, ...flags], { input: sql, encoding: 'utf8' })
/** Rows of a query as JSON objects. */
const rows = (sql) => JSON.parse(psql(`SELECT coalesce(json_agg(_r), '[]') FROM (${sql}) _r`, ['-At']))
const one = (sql) => rows(sql)[0]
/** A statement and its output, the way psql prints them. */
const shown = (sql, flags = []) => `lab=# ${sql.trim()}\n${psql(sql, ['-q', ...flags]).replace(/\n+$/, '')}`
/** A statement's INFO/NOTICE output too (VACUUM VERBOSE reports on stderr). */
const verbose = (sql) =>
  execFileSync('podman', ['exec', '-i', CONTAINER, 'bash', '-c', 'psql -U postgres -d lab -X -q -v ON_ERROR_STOP=1 2>&1'], { input: sql, encoding: 'utf8' }).replace(/\n+$/, '')
const sh = (cmd) => execFileSync('podman', ['exec', CONTAINER, 'bash', '-c', cmd], { encoding: 'utf8' }).replace(/\n+$/, '')
/** A psql session running in the background (another client). */
const background = (sql) => {
  const p = spawn('podman', [...PSQL, '-q'], { stdio: ['pipe', 'ignore', 'ignore'] })
  p.stdin.end(sql)
  return new Promise((r) => p.on('exit', r))
}
const settle = () => psql('SELECT pg_stat_force_next_flush();', ['-q'])

const out = {}
const version = one(`SELECT current_setting('server_version') AS v`).v

// ---------------------------------------------------------------- setup
psql(`
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
CREATE EXTENSION pageinspect; CREATE EXTENSION pg_buffercache; CREATE EXTENSION pg_visibility;
CREATE EXTENSION pg_freespacemap; CREATE EXTENSION pgstattuple;
ALTER SYSTEM SET autovacuum_naptime = '1s';
ALTER SYSTEM SET log_autovacuum_min_duration = 0;
SELECT pg_reload_conf();
`)

// ================================================================= architecture
{
  const a = {}
  psql(`
CREATE TABLE orders (id int PRIMARY KEY, customer_id int NOT NULL, status text NOT NULL, total numeric(10,2), note text) WITH (autovacuum_enabled = off);
INSERT INTO orders SELECT g, g % 1000, CASE WHEN g % 10 = 0 THEN 'refunded' ELSE 'paid' END, (g % 500) * 1.25, NULL FROM generate_series(1, 100000) g;
CREATE INDEX ON orders (customer_id);
VACUUM ANALYZE orders;
CREATE VIEW paid_orders AS SELECT id, customer_id, total FROM orders WHERE status = 'paid';
-- a bloated table that autovacuum will work on slowly, so its worker shows up in ps
CREATE TABLE av_slow (id int, payload text) WITH (autovacuum_vacuum_cost_delay = 100, autovacuum_vacuum_cost_limit = 10);
INSERT INTO av_slow SELECT g, repeat('p', 100) FROM generate_series(1, 200000) g;
DELETE FROM av_slow WHERE id % 2 = 0;
`)
  sh('rm -rf /tmp/recv && mkdir /tmp/recv')
  const receiver = spawn('podman', ['exec', CONTAINER, 'pg_receivewal', '-U', 'postgres', '-D', '/tmp/recv'], { stdio: 'ignore' })
  const client = background(`SELECT count(*) FROM orders, pg_sleep(8);`)
  let ps = ''
  for (let i = 0; i < 100; i++) {
    await sleep(300)
    ps = sh('ps -eo pid,ppid,cmd | grep -v -e "ps -eo" -e "grep" -e "bash -c" -e pg_receivewal -e bin/psql')
    if (ps.includes('autovacuum worker') && ps.includes('walsender') && /lab \[local\] SELECT/.test(ps)) break
  }
  a.ps = ps
  a.activity = rows(`SELECT pid, backend_type, coalesce(usename, '') AS usename, coalesce(state, '') AS state, coalesce(wait_event_type || ':' || wait_event, '') AS wait FROM pg_stat_activity ORDER BY backend_type, pid`)
  a.activityText = shown(`SELECT pid, backend_type, state, wait_event FROM pg_stat_activity ORDER BY backend_type;`)
  sh('kill $(pidof pg_receivewal) || true')
  psql(`SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE backend_type = 'autovacuum worker';`)
  receiver.kill()
  await client
  psql(`DROP TABLE av_slow;`)

  a.settings = rows(`SELECT name, setting, unit, short_desc FROM pg_settings WHERE name IN ('shared_buffers','wal_buffers','work_mem','maintenance_work_mem','max_connections','effective_cache_size','io_method','io_workers','block_size','segment_size','wal_segment_size','data_checksums','synchronous_commit','wal_level') ORDER BY name`)

  // files on disk
  const db = one(`SELECT oid FROM pg_database WHERE datname = 'lab'`).oid
  psql(`CHECKPOINT;`)
  const path = one(`SELECT pg_relation_filepath('orders') AS p`).p
  a.files = {
    dbOid: db,
    path,
    relfilenode: one(`SELECT relfilenode FROM pg_class WHERE relname = 'orders'`).relfilenode,
    databases: shown(`SELECT oid, datname FROM pg_database ORDER BY oid;`),
    filepath: shown(`SELECT pg_relation_filepath('orders'), pg_relation_filepath('orders_pkey');`),
    pgdata: sh('cd "$PGDATA" && ls -p'),
    relFiles: sh(`cd "$PGDATA" && ls -l ${path}* $(dirname ${path})/$(psql -U postgres -d lab -Atc "SELECT relfilenode FROM pg_class WHERE relname='orders_pkey'") | awk '{print $5, $9}'`),
    walFiles: sh('cd "$PGDATA" && ls -l pg_wal | grep -v "^total" | awk \'{print $5, $9}\' | head -5'),
    xactFiles: sh('cd "$PGDATA" && ls -l pg_xact | grep -v "^total" | awk \'{print $5, $9}\''),
    sizes: one(`SELECT pg_relation_size('orders') AS main, pg_relation_size('orders', 'fsm') AS fsm, pg_relation_size('orders', 'vm') AS vm, pg_relation_size('orders_pkey') AS pkey`),
  }

  // the rewriter at work: a view is replaced by its definition before planning
  a.rewrite = shown(`EXPLAIN (COSTS OFF) SELECT * FROM paid_orders WHERE id = 42;`)

  // shared buffers: the same query cold and warm
  psql(`SELECT pg_buffercache_evict_relation('orders'); SELECT pg_buffercache_evict_relation('orders_pkey');`)
  const ex = (sql) => shown(`EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) ${sql}`)
  a.pointCold = ex(`SELECT * FROM orders WHERE id = 42;`)
  a.pointWarm = ex(`SELECT * FROM orders WHERE id = 42;`)
  a.scanCold = ex(`SELECT count(*) FROM orders;`)
  a.scanWarm = ex(`SELECT count(*) FROM orders;`)
  const usage = () => rows(`SELECT usagecount, count(*)::int AS buffers FROM pg_buffercache WHERE relfilenode = pg_relation_filenode('orders') AND reldatabase = (SELECT oid FROM pg_database WHERE datname = 'lab') GROUP BY 1 ORDER BY 1`)
  a.usageAfter2 = usage()
  for (let i = 0; i < 4; i++) psql(`SELECT count(*) FROM orders;`)
  a.usageAfter6 = usage()
  a.ordersPages = Number(one(`SELECT pg_relation_size('orders') / 8192 AS n`).n)
  a.summary = one(`SELECT * FROM pg_buffercache_summary()`)
  a.sharedBuffers = Number(one(`SELECT setting FROM pg_settings WHERE name = 'shared_buffers'`).setting)

  // commits: every COMMIT waits for a WAL flush
  psql(`
CREATE TABLE events (id bigint GENERATED ALWAYS AS IDENTITY, at timestamptz DEFAULT now()) WITH (autovacuum_enabled = off);
CREATE PROCEDURE insert_each_committed(n int) LANGUAGE plpgsql AS $$ BEGIN FOR i IN 1..n LOOP INSERT INTO events DEFAULT VALUES; COMMIT; END LOOP; END $$;
CREATE PROCEDURE insert_one_tx(n int) LANGUAGE plpgsql AS $$ BEGIN FOR i IN 1..n LOOP INSERT INTO events DEFAULT VALUES; END LOOP; END $$;
`)
  const fsyncs = () => Number(one(`SELECT sum(fsyncs)::int AS f FROM pg_stat_io WHERE object = 'wal' AND backend_type = 'client backend'`).f)
  const timed = (call, sync = 'on') => {
    const before = fsyncs()
    const r = psql(`SET synchronous_commit = ${sync};\n\\timing on\n${call}\n`, ['-q'])
    return { ms: Number(r.match(/Time: ([\d.]+) ms/)[1]), fsyncs: fsyncs() - before }
  }
  a.commits = {
    n: 1000,
    each: timed('CALL insert_each_committed(1000);'),
    eachAsync: timed('CALL insert_each_committed(1000);', 'off'),
    oneTx: timed('CALL insert_one_tx(1000);'),
  }
  out.architecture = a
}

// ================================================================= storage
{
  const s = {}
  psql(`
CREATE TABLE payments (id int PRIMARY KEY, order_id int NOT NULL, amount numeric(10,2) NOT NULL, status text NOT NULL, note text) WITH (autovacuum_enabled = off);
INSERT INTO payments VALUES (1, 101, 25.00, 'paid', NULL), (2, 102, 99.90, 'paid', 'gift wrap'), (3, 103, 5.00, 'refunded', NULL),
                            (4, 104, 140.00, 'paid', NULL), (5, 105, 12.50, 'pending', 'call back later, customer asked');
`)
  s.header = one(`SELECT lower, upper, special, pagesize, version, checksum FROM page_header(get_raw_page('payments', 0))`)
  s.headerText = shown(`SELECT lower, upper, special, pagesize FROM page_header(get_raw_page('payments', 0));`)
  s.items = rows(`SELECT lp, lp_off, lp_len, t_hoff, coalesce(t_bits, '') AS t_bits FROM heap_page_items(get_raw_page('payments', 0)) ORDER BY lp`)
  s.itemsText = shown(`SELECT lp, lp_off, lp_len, t_hoff, t_bits FROM heap_page_items(get_raw_page('payments', 0));`)
  psql(`CHECKPOINT;`)
  s.indexHeader = one(`SELECT lower, upper, special FROM page_header(get_raw_page('payments_pkey', 1))`)
  s.indexHeaderText = shown(`SELECT lower, upper, special FROM page_header(get_raw_page('payments_pkey', 1));`)
  // checksums are on by default since PostgreSQL 18; a page gets one when it is written out
  s.checksumInMemory = one(`SELECT checksum FROM page_header(get_raw_page('payments', 0))`).checksum
  psql(`SELECT pg_buffercache_evict_relation('payments');`)
  s.checksumText = shown(`SELECT checksum FROM page_header(get_raw_page('payments', 0));  -- after CHECKPOINT, read back from disk`)
  // tuple 1 (its note is NULL, so it carries a null bitmap) and its raw bytes
  s.tuple = one(`
SELECT lp, t_xmin::text AS xmin, t_xmax::text AS xmax, t_field3 AS cid, t_ctid::text AS ctid, t_infomask2, t_infomask, t_hoff, t_bits, lp_len,
       encode(substr(get_raw_page('payments', 0), lp_off + 1, lp_len), 'hex') AS hex
FROM heap_page_items(get_raw_page('payments', 0)) WHERE lp = 1`)

  // null bitmap: 8 vs 9 columns, with and without a NULL
  psql(`
CREATE TABLE cols8 (c1 int, c2 int, c3 int, c4 int, c5 int, c6 int, c7 int, c8 int);
CREATE TABLE cols9 (c1 int, c2 int, c3 int, c4 int, c5 int, c6 int, c7 int, c8 int, c9 int);
INSERT INTO cols8 VALUES (1,2,3,4,5,6,7,8), (1,2,3,4,5,6,7,NULL);
INSERT INTO cols9 VALUES (1,2,3,4,5,6,7,8,9), (1,2,3,4,5,6,7,8,NULL);
`)
  s.bitmap = rows(`
SELECT 'cols8' AS tbl, 8 AS columns, lp = 2 AS has_null, t_hoff, lp_len, coalesce(t_bits, '') AS t_bits FROM heap_page_items(get_raw_page('cols8', 0))
UNION ALL
SELECT 'cols9', 9, lp = 2, t_hoff, lp_len, coalesce(t_bits, '') FROM heap_page_items(get_raw_page('cols9', 0))`)

  // column order and alignment padding
  psql(`
CREATE TABLE orders_padded (is_paid boolean, id bigint, is_gift boolean, customer_id bigint, qty smallint, total_cents integer) WITH (autovacuum_enabled = off);
CREATE TABLE orders_packed (id bigint, customer_id bigint, total_cents integer, qty smallint, is_paid boolean, is_gift boolean) WITH (autovacuum_enabled = off);
INSERT INTO orders_padded SELECT true, g, false, g % 1000, 1, 1999 FROM generate_series(1, 100000) g;
INSERT INTO orders_packed SELECT g, g % 1000, 1999, 1, true, false FROM generate_series(1, 100000) g;
`)
  const order = (t) => one(`SELECT (SELECT lp_len FROM heap_page_items(get_raw_page('${t}', 0)) WHERE lp = 1) AS lp_len,
    (SELECT count(*) FROM heap_page_items(get_raw_page('${t}', 0)))::int AS per_page, pg_relation_size('${t}')::bigint AS bytes`)
  s.columnOrder = { padded: order('orders_padded'), packed: order('orders_packed') }
  s.columnOrderText = shown(`SELECT pg_column_size(ROW(true, 1::bigint, false, 1::bigint, 1::smallint, 1::int)) AS padded,
       pg_column_size(ROW(1::bigint, 1::bigint, 1::int, 1::smallint, true, false)) AS packed;`)

  // checks for the layout calculator: real lp_len of rows with mixed types
  const checks = [
    ['boolean', 'bigint'], ['bigint', 'boolean'], ['smallint', 'integer', 'boolean', 'bigint'], ['integer', 'text', 'bigint'],
    ['boolean', 'timestamptz', 'boolean', 'uuid'], ['text', 'integer', 'numeric', 'date'], ['uuid', 'integer', 'boolean', 'text', 'bigint', 'smallint'],
    ['double precision', 'boolean', 'smallint', 'integer', 'boolean'],
  ]
  const sample = { boolean: 'true', smallint: '7', integer: '42', bigint: '9000000000', text: `'paid'`, timestamptz: `'2026-01-01 10:00+00'`, uuid: `'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'`, numeric: '19.99', date: `'2026-01-01'`, 'double precision': '1.5' }
  s.layoutChecks = checks.map((types, i) => {
    const t = `chk${i}`
    psql(`CREATE TABLE ${t} (${types.map((ty, j) => `c${j} ${ty}`).join(', ')}); INSERT INTO ${t} VALUES (${types.map((ty) => sample[ty]).join(', ')});`)
    return { types, values: types.map((ty) => sample[ty]), lp_len: one(`SELECT lp_len FROM heap_page_items(get_raw_page('${t}', 0))`).lp_len }
  })

  // fillfactor
  psql(`
CREATE TABLE ff100 (LIKE orders_packed) WITH (fillfactor = 100, autovacuum_enabled = off);
CREATE TABLE ff70 (LIKE orders_packed) WITH (fillfactor = 70, autovacuum_enabled = off);
INSERT INTO ff100 SELECT * FROM orders_packed WHERE id <= 10000;
INSERT INTO ff70 SELECT * FROM orders_packed WHERE id <= 10000;
`)
  const ff = (t) => one(`SELECT (SELECT count(*) FROM heap_page_items(get_raw_page('${t}', 0)))::int AS per_page,
    (SELECT upper - lower FROM page_header(get_raw_page('${t}', 0))) AS free, (pg_relation_size('${t}') / 8192)::int AS pages`)
  s.fillfactor = { ff100: ff('ff100'), ff70: ff('ff70'), rows: 10000 }

  // TOAST
  psql(`
CREATE TABLE docs (id int PRIMARY KEY, kind text, body text) WITH (autovacuum_enabled = off);
INSERT INTO docs VALUES (1, 'repetitive', repeat('x', 1000)), (2, 'repetitive', repeat('x', 2100)), (3, 'repetitive', repeat('ab', 50000));
INSERT INTO docs SELECT 4, 'random', string_agg(md5(g::text), '') FROM generate_series(1, 40) g;
INSERT INTO docs SELECT 5, 'random', string_agg(md5(g::text), '') FROM generate_series(1, 70) g;
INSERT INTO docs SELECT 6, 'random', string_agg(md5(g::text), '') FROM generate_series(1, 400) g;
`)
  s.toast = rows(`SELECT d.id, d.kind, octet_length(body) AS length, pg_column_size(body) AS stored, coalesce(pg_column_compression(body), '') AS compression,
    pg_column_toast_chunk_id(body) IS NOT NULL AS external, h.lp_len AS row_bytes
    FROM docs d JOIN heap_page_items(get_raw_page('docs', 0)) h ON h.t_ctid = d.ctid ORDER BY id`)
  s.toastText = shown(`SELECT id, octet_length(body) AS length, pg_column_size(body) AS stored,
       pg_column_compression(body) AS compression, pg_column_toast_chunk_id(body) AS chunk_id
FROM docs ORDER BY id;`)
  const toastRel = one(`SELECT reltoastrelid::regclass::text AS t FROM pg_class WHERE relname = 'docs'`).t
  s.toastTable = toastRel
  s.toastChunksText = shown(`SELECT chunk_id, chunk_seq, length(chunk_data) FROM ${toastRel} ORDER BY 1, 2;`)
  // pglz vs lz4 on JSON-like text
  psql(`
CREATE TABLE doc_pglz (id int, body text COMPRESSION pglz) WITH (autovacuum_enabled = off);
CREATE TABLE doc_lz4 (id int, body text COMPRESSION lz4) WITH (autovacuum_enabled = off);
CREATE FUNCTION json_like(n int, seed int) RETURNS text LANGUAGE sql AS $$
  SELECT string_agg(format('{"order_id": %s, "status": "%s", "total": %s}', seed * 1000 + k, (ARRAY['paid','pending','refunded'])[1 + (seed + k) % 3], ((seed * 7 + k * 13) % 900) * 1.25), ',') FROM generate_series(1, n) k $$;
`)
  const load = (t) => Number(psql(`\\timing on\nINSERT INTO ${t} SELECT g, json_like(60, g) FROM generate_series(1, 5000) g;\n`, ['-q']).match(/Time: ([\d.]+) ms/)[1])
  const read = (t) => Number(psql(`\\timing on\nSELECT sum(length(body)) FROM ${t};\n`, ['-q']).match(/Time: ([\d.]+) ms/)[1])
  const comp = (t) => ({
    insertMs: load(t),
    ...one(`SELECT sum(octet_length(body))::bigint AS raw, sum(pg_column_size(body))::bigint AS stored, min(pg_column_compression(body)) AS method, pg_total_relation_size('${t}')::bigint AS total FROM ${t}`),
  })
  load('doc_pglz'); load('doc_lz4') // warm-up, then measure on empty tables
  psql(`TRUNCATE doc_pglz, doc_lz4;`)
  s.compression = { rows: 5000, pglz: comp('doc_pglz'), lz4: comp('doc_lz4') }
  s.compression.pglz.readMs = read('doc_pglz')
  s.compression.lz4.readMs = read('doc_lz4')
  s.compression.pglz.readMs = read('doc_pglz')
  s.compression.lz4.readMs = read('doc_lz4')
  // INSERT … SELECT copies an already compressed value as it is
  psql(`CREATE TABLE doc_copy (id int, body text COMPRESSION lz4); INSERT INTO doc_copy SELECT * FROM doc_pglz LIMIT 1;`)
  s.copyKeeps = shown(`SELECT pg_column_compression(body) FROM doc_copy;  -- column is lz4, value came from a pglz table`)

  // free space map and visibility map
  psql(`
CREATE TABLE fsm_demo (LIKE orders_packed) WITH (autovacuum_enabled = off);
INSERT INTO fsm_demo SELECT * FROM orders_packed WHERE id <= 1800;
DELETE FROM fsm_demo WHERE (ctid::text::point)[0] IN (2, 3);
DELETE FROM fsm_demo WHERE (ctid::text::point)[0] = 5 AND id % 2 = 0;
DELETE FROM fsm_demo WHERE (ctid::text::point)[0] = 8 AND id % 10 = 0;
`)
  const maps = () => rows(`SELECT f.blkno::int AS page, f.avail AS free, v.all_visible, v.all_frozen,
    (SELECT count(*) FROM fsm_demo WHERE (ctid::text::point)[0] = f.blkno)::int AS live
    FROM pg_freespace('fsm_demo') f JOIN pg_visibility_map('fsm_demo') v ON v.blkno = f.blkno ORDER BY 1`)
  s.mapsBefore = maps()
  s.vacuumMaps = verbose(`VACUUM (VERBOSE) fsm_demo;`).split('\n').filter((l) => /^(pages|tuples|visibility map):/.test(l)).join('\n')
  s.mapsAfter = maps()
  psql(`VACUUM (FREEZE) fsm_demo;`)
  s.mapsFrozen = maps()
  s.fsmText = shown(`SELECT * FROM pg_freespace('fsm_demo');`)
  s.vmText = shown(`SELECT * FROM pg_visibility_map('fsm_demo');`)
  out.storage = s
}

// ================================================================= mvcc
{
  const m = {}
  psql(`CREATE TABLE accounts (id int PRIMARY KEY, owner text, balance int) WITH (autovacuum_enabled = off);
INSERT INTO accounts VALUES (1, 'ann', 100);`)
  // three other sessions: A writes and stays open, B writes and commits, C writes and stays open
  const writers = (n) => Number(one(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE backend_xid IS NOT NULL AND state = 'active'`).n) >= n
  const until = async (pred) => { for (let i = 0; i < 60 && !pred(); i++) await sleep(250) }
  const a = background(`BEGIN; INSERT INTO accounts VALUES (2, 'ben', 200); SELECT pg_sleep(8); COMMIT;`)
  await until(() => writers(1))
  psql(`BEGIN; INSERT INTO accounts VALUES (3, 'cat', 300); COMMIT;`)
  const c = background(`BEGIN; INSERT INTO accounts VALUES (4, 'dan', 400); SELECT pg_sleep(6); COMMIT;`)
  await until(() => writers(2))
  m.snapshot = one(`SELECT pg_current_snapshot()::text AS snap, pg_snapshot_xmin(pg_current_snapshot())::text AS xmin,
    pg_snapshot_xmax(pg_current_snapshot())::text AS xmax, ARRAY(SELECT pg_snapshot_xip(pg_current_snapshot())::text) AS xip`)
  m.snapshotText = shown(`SELECT pg_current_snapshot();`)
  m.snapshotRows = shown(`SELECT xmin, xmax, * FROM accounts ORDER BY id;`)
  m.snapshotPage = rows(`SELECT lp, t_xmin::text AS xmin, t_xmax::text AS xmax, (SELECT pg_xact_status(t_xmin::text::xid8)) AS status FROM heap_page_items(get_raw_page('accounts', 0)) ORDER BY lp`)
  await a
  await c

  // hint bits: the first reader after a commit records the commit status on the tuple
  psql(`CREATE TABLE hints (id int, v int) WITH (autovacuum_enabled = off); INSERT INTO hints VALUES (1, 10);`)
  const mask = () => one(`SELECT t_xmin::text AS xmin, t_xmax::text AS xmax, t_infomask FROM heap_page_items(get_raw_page('hints', 0)) WHERE lp = 1`)
  m.hintBefore = mask()
  psql(`SELECT * FROM hints;`)
  m.hintAfter = mask()
  // a row lock is recorded in xmax too
  m.lock = JSON.parse(psql(`BEGIN; SELECT * FROM hints WHERE id = 1 FOR UPDATE \\g /dev/null
SELECT coalesce(json_agg(t), '[]') FROM (SELECT t_xmax::text AS xmax, t_infomask, pg_current_xact_id()::text AS me FROM heap_page_items(get_raw_page('hints', 0)) WHERE lp = 1) t;
ROLLBACK;`, ['-At']).split('\n').find((l) => l.startsWith('[')))[0]

  // an update chain over three transactions
  psql(`UPDATE accounts SET balance = 150 WHERE id = 1; UPDATE accounts SET balance = 175 WHERE id = 1; UPDATE accounts SET balance = 160 WHERE id = 1;`)
  m.chain = rows(`SELECT lp, t_xmin::text AS xmin, t_xmax::text AS xmax, t_ctid::text AS ctid, (t_infomask2 & 16384) <> 0 AS hot_updated, (t_infomask2 & 32768) <> 0 AS heap_only,
    (SELECT get_byte(b, 0) + get_byte(b, 1) * 256 FROM (SELECT (tuple_data_split('accounts'::regclass, t_data, t_infomask, t_infomask2, t_bits))[1] AS b) x) AS id,
    (SELECT get_byte(b, 0) + get_byte(b, 1) * 256 FROM (SELECT (tuple_data_split('accounts'::regclass, t_data, t_infomask, t_infomask2, t_bits))[3] AS b) x) AS balance
    FROM heap_page_items(get_raw_page('accounts', 0)) ORDER BY lp`)
  m.chainText = shown(`SELECT lp, t_xmin, t_xmax, t_ctid FROM heap_page_items(get_raw_page('accounts', 0));`)
  m.xid = one(`SELECT pg_current_xact_id()::text AS xid8, txid_current()::text AS txid`)
  out.mvcc = m
}

// ================================================================= vacuum
{
  const v = {}
  // HOT: the same updates with fillfactor 100 and 90
  const hot = (ff) => {
    const t = `hot_ff${ff}`
    psql(`CREATE TABLE ${t} (id int PRIMARY KEY, qty int, note text) WITH (fillfactor = ${ff}, autovacuum_enabled = off);
CREATE INDEX ON ${t} (note);
INSERT INTO ${t} SELECT g, 0, 'order ' || g || ' ' || repeat('n', 60) FROM generate_series(1, 20000) g;
VACUUM ANALYZE ${t};`)
    const before = one(`SELECT pg_relation_size('${t}')::bigint AS heap, pg_indexes_size('${t}')::bigint AS indexes`)
    for (let r = 0; r < 10; r++) psql(`UPDATE ${t} SET qty = qty + 1 WHERE id % 10 = ${r};`)
    settle()
    const st = one(`SELECT n_tup_upd::int AS upd, n_tup_hot_upd::int AS hot, n_tup_newpage_upd::int AS newpage FROM pg_stat_user_tables WHERE relname = '${t}'`)
    const after = one(`SELECT pg_relation_size('${t}')::bigint AS heap, pg_indexes_size('${t}')::bigint AS indexes`)
    return { fillfactor: ff, ...st, before, after }
  }
  v.hot = [hot(100), hot(90)]
  v.hotText = shown(`SELECT relname, n_tup_upd, n_tup_hot_upd, n_tup_newpage_upd FROM pg_stat_user_tables WHERE relname LIKE 'hot_ff%' ORDER BY relname;`)

  // page pruning: a HOT chain is cut short by a plain SELECT, no VACUUM needed
  psql(`CREATE TABLE prune (id int PRIMARY KEY, qty int, pad text) WITH (fillfactor = 100, autovacuum_enabled = off);
INSERT INTO prune SELECT g, 0, repeat('p', 400) FROM generate_series(1, 3) g;`)
  const page = () => rows(`SELECT lp, lp_flags, lp_off, lp_len, t_xmin::text AS xmin, t_xmax::text AS xmax, t_ctid::text AS ctid FROM heap_page_items(get_raw_page('prune', 0)) ORDER BY lp`)
  const free = () => one(`SELECT upper - lower AS free FROM page_header(get_raw_page('prune', 0))`).free
  // three HOT updates while the page is roomy (no pruning), then fill the page so the next read prunes it
  for (let i = 0; i < 3; i++) psql(`UPDATE prune SET qty = qty + 1 WHERE id = 1;`)
  psql(`INSERT INTO prune SELECT g, 0, repeat('p', 400) FROM generate_series(4, 14) g;`)
  v.pruneBefore = { items: page(), free: free() }
  psql(`SELECT * FROM prune WHERE id = 1;`)
  v.pruneAfter = { items: page(), free: free() }

  // bloat: every row updated once, then VACUUM, then VACUUM FULL
  psql(`CREATE TABLE items (id int PRIMARY KEY, qty int, note text) WITH (autovacuum_enabled = off);
INSERT INTO items SELECT g, 0, repeat('n', 80) FROM generate_series(1, 100000) g;
VACUUM ANALYZE items;`)
  const stat = (label) => ({
    label,
    ...one(`SELECT (pg_relation_size('items') / 8192)::int AS pages, pg_relation_size('items')::bigint AS bytes, pg_indexes_size('items')::bigint AS index_bytes,
      tuple_percent, dead_tuple_percent, free_percent, tuple_count::int, dead_tuple_count::int, (SELECT relfilenode FROM pg_class WHERE relname = 'items')::int AS relfilenode FROM pgstattuple('items')`),
  })
  v.bloat = [stat('fresh: 100,000 rows')]
  psql(`UPDATE items SET qty = 1;`)
  v.bloat.push(stat('after UPDATE of every row'))
  const vac = verbose(`VACUUM (VERBOSE) items;`)
  v.vacuumVerbose = vac.split('\n').slice(0, vac.split('\n').findIndex((l, i) => i > 0 && l.startsWith('INFO:  vacuuming'))).join('\n')
  v.bloat.push(stat('after VACUUM'))
  const vfull = Number(psql(`\\timing on\nVACUUM FULL items;\n`, ['-q']).match(/Time: ([\d.]+) ms/)[1])
  v.bloat.push(stat('after VACUUM FULL'))
  v.vacuumFullMs = vfull
  // the end of the table can be truncated by plain VACUUM
  psql(`DELETE FROM items WHERE id > 50000;`)
  const trunc = verbose(`VACUUM (VERBOSE) items;`)
  v.truncate = { line: trunc.split('\n').find((l) => l.startsWith('pages:')), after: stat('after DELETE of the second half + VACUUM') }

  // a long transaction holds cleanup back
  psql(`CREATE TABLE held (id int PRIMARY KEY, v int) WITH (autovacuum_enabled = off); INSERT INTO held SELECT g, 0 FROM generate_series(1, 10000) g;`)
  const holder = background(`BEGIN ISOLATION LEVEL REPEATABLE READ; SELECT count(*) FROM held; SELECT pg_sleep(6); COMMIT;`)
  await sleep(1000)
  psql(`DELETE FROM held WHERE id <= 5000;`)
  const heldVac = verbose(`VACUUM (VERBOSE) held;`).split('\n')
  v.held = {
    activity: shown(`SELECT pid, state, backend_xmin, now() - xact_start AS open_for FROM pg_stat_activity WHERE backend_xmin IS NOT NULL AND pid <> pg_backend_pid();`),
    blocked: heldVac.filter((l) => /^(tuples|removable cutoff):/.test(l)).join('\n'),
  }
  await holder
  v.held.released = verbose(`VACUUM (VERBOSE) held;`).split('\n').filter((l) => /^(tuples|removable cutoff):/.test(l)).join('\n')

  // freezing
  psql(`CREATE TABLE frz (id int, v int) WITH (autovacuum_enabled = off); INSERT INTO frz SELECT g, g FROM generate_series(1, 3) g;
CREATE PROCEDURE burn(n int) LANGUAGE plpgsql AS $$ BEGIN FOR i IN 1..n LOOP PERFORM pg_current_xact_id(); COMMIT; END LOOP; END $$;
CALL burn(10000);`)
  const frz = () => ({
    items: rows(`SELECT lp, t_xmin::text AS xmin, t_infomask, (t_infomask & 768) = 768 AS frozen FROM heap_page_items(get_raw_page('frz', 0)) ORDER BY lp`),
    ...one(`SELECT age(relfrozenxid)::int AS age, relfrozenxid::text AS relfrozenxid FROM pg_class WHERE relname = 'frz'`),
    vm: one(`SELECT all_visible, all_frozen FROM pg_visibility_map('frz', 0)`),
  })
  v.freezeBefore = frz()
  psql(`VACUUM (FREEZE) frz;`)
  v.freezeAfter = frz()
  v.datfrozen = rows(`SELECT datname, age(datfrozenxid)::int AS age FROM pg_database ORDER BY datname`)
  v.datfrozenText = shown(`SELECT datname, age(datfrozenxid), current_setting('autovacuum_freeze_max_age') AS freeze_max_age FROM pg_database;`)
  v.nextXid = one(`SELECT pg_current_xact_id()::text AS x`).x
  v.wraparoundCheck = shown(`SELECT c.oid::regclass AS table, age(c.relfrozenxid) AS xid_age,
       round(100.0 * age(c.relfrozenxid) / current_setting('autovacuum_freeze_max_age')::int, 4) AS pct_of_limit
FROM pg_class c WHERE c.relkind IN ('r', 'm', 't') ORDER BY age(c.relfrozenxid) DESC LIMIT 3;`)

  // autovacuum: a table crossing (and not crossing) its threshold
  v.settings = rows(`SELECT name, setting FROM pg_settings WHERE name IN ('autovacuum_vacuum_threshold','autovacuum_vacuum_scale_factor','autovacuum_vacuum_max_threshold','autovacuum_vacuum_insert_threshold','autovacuum_vacuum_insert_scale_factor','autovacuum_analyze_threshold','autovacuum_analyze_scale_factor','autovacuum_naptime','autovacuum_max_workers','autovacuum_freeze_max_age','vacuum_freeze_min_age','vacuum_freeze_table_age') ORDER BY name`)
  psql(`CREATE TABLE av_demo (id int PRIMARY KEY, v int); INSERT INTO av_demo SELECT g, 0 FROM generate_series(1, 1000) g;`)
  const avStats = () => {
    settle()
    return one(`SELECT n_live_tup::int AS live, n_dead_tup::int AS dead, autovacuum_count::int AS vacuums, autoanalyze_count::int AS analyzes, (SELECT reltuples::int FROM pg_class WHERE relname = 'av_demo') AS reltuples FROM pg_stat_user_tables WHERE relname = 'av_demo'`)
  }
  const waitFor = async (pred, ms) => {
    for (let t = 0; t < ms; t += 500) {
      const st = avStats()
      if (pred(st)) return st
      await sleep(500)
    }
    return avStats()
  }
  const first = await waitFor((st) => st.analyzes >= 1 && st.reltuples === 1000, 20000) // autoanalyze sets reltuples
  const since = new Date().toISOString()
  psql(`DELETE FROM av_demo WHERE id <= 300;`)
  const deleted = avStats()
  const vacuumed = await waitFor((st) => st.vacuums > first.vacuums, 30000)
  await sleep(1500)
  psql(`DELETE FROM av_demo WHERE id <= 450;`)
  const below = avStats()
  await sleep(6000)
  const stillBelow = avStats()
  v.autovacuum = { start: first, deleted, vacuumed, below, stillBelow }
  const logAll = execFileSync('bash', ['-c', `podman logs --since ${since} ${CONTAINER} 2>&1`], { encoding: 'utf8' })
  const lines = logAll.split('\n')
  const at = lines.findIndex((l) => l.includes('automatic vacuum of table "lab.public.av_demo"'))
  v.autovacuumLog = at < 0 ? '' : lines.slice(at, at + 12).filter((l, i) => i === 0 || /^\t/.test(l)).map((l) => l.replace(/^\S+ \S+ \S+ \[\d+\] /, '').replace(/^\t/, '  ')).join('\n')
  out.vacuum = v
}

// ---------------------------------------------------------------- write
psql(`ALTER SYSTEM RESET autovacuum_naptime; ALTER SYSTEM RESET log_autovacuum_min_duration; SELECT pg_reload_conf();`)
const json = JSON.stringify(out, null, 1)
// never publish who ran the capture or where
for (const bad of ['/home/', homedir(), userInfo().username]) if (json.includes(bad)) throw new Error(`refusing to write: output contains "${bad}"`)
writeFileSync(
  OUT,
  `// Recorded from ${version} by tools/postgres-capture/capture-internals.mjs — do not edit by hand.\n` +
    `// Transaction ids, LSNs, oids and timings differ on every run; the behaviour does not.\n\n` +
    `export const INTERNALS_VERSION = 'PostgreSQL ${version.split(' ')[0]}'\n\nexport const INTERNALS = ${json} as const\n`,
)
console.log(`wrote ${OUT}`)
