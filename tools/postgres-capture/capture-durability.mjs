// Records the durability lessons (WAL, replication, partitioning) on real PostgreSQL 18 containers
// and writes src/modules/postgres/data/durability.ts.
//
//   node capture-durability.mjs wal|repl|part   # record one section into durability-app/out/<section>.json
//   node capture-durability.mjs gen             # write the data file from the recorded sections
//
// Every container is named pg-dur-*, lives on the podman network pg-dur-net and is removed at the end.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertClean, background, exec, logs, podman, psqlRaw, rows, session, sleep, startServer, val, waitReady } from './durability-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'durability-app', 'out')
const APP = join(HERE, 'durability-app')
const DATA = join(HERE, '..', '..', 'src', 'modules', 'postgres', 'data', 'durability.ts')
mkdirSync(OUT, { recursive: true })

const save = (name, data) => writeFileSync(join(OUT, `${name}.json`), JSON.stringify(data, null, 1))
const load = (name) => JSON.parse(readFileSync(join(OUT, `${name}.json`), 'utf8'))
const lsn = (c) => val(c, 'SELECT pg_current_wal_insert_lsn()')
const diff = (c, a, b) => Number(val(c, `SELECT pg_wal_lsn_diff('${b}', '${a}')`))

/** Runs a TypeScript program from durability-app with node's type stripping. */
function app(file, args = []) {
  const r = spawnSync('node', [join(APP, file), ...args], { cwd: APP, encoding: 'utf8' })
  return (r.stdout + r.stderr).trimEnd()
}

/* ------------------------------------------------------------------ WAL */
async function wal() {
  const c = 'pg-dur-wal'
  await startServer(c, { port: 55515 })
  const out = { version: val(c, 'SHOW server_version') }
  psqlRaw(c, `CREATE EXTENSION pg_walinspect;
CREATE TABLE orders (id bigint PRIMARY KEY, customer_id int NOT NULL, amount numeric(10,2) NOT NULL, status text NOT NULL DEFAULT 'new') WITH (fillfactor = 90);
INSERT INTO orders (id, customer_id, amount) SELECT g, g % 5000, (g % 1000) + 0.99 FROM generate_series(1, 100000) g;
VACUUM ANALYZE orders;`)
  out.table = rows(c, `SELECT pg_relation_size('orders') / 8192 AS pages, pg_size_pretty(pg_relation_size('orders')) AS size`)[0]

  // 1. The record stream of one transaction, right after a checkpoint and once more without one
  const TX = (n, del) => [
    'BEGIN;',
    `INSERT INTO orders (id, customer_id, amount) VALUES (${n}, 7, 25.00);`,
    `UPDATE orders SET status = 'paid' WHERE id = ${n};`,
    `DELETE FROM orders WHERE id = ${del};`,
    'COMMIT;',
  ]
  const recordsBetween = (a, b) =>
    rows(c, `SELECT start_lsn::text, end_lsn::text, prev_lsn::text, xid::text, resource_manager, record_type, record_length, main_data_length, fpi_length, description
             FROM pg_get_wal_records_info('${a}', '${b}') ORDER BY start_lsn`)
  psqlRaw(c, 'CHECKPOINT;')
  const s0 = lsn(c)
  out.txSql = TX(100001, 42)
  out.txShown = session(c, out.txSql)
  const s1 = lsn(c)
  session(c, TX(100002, 43))
  const s2 = lsn(c)
  out.afterCheckpoint = { start: s0, end: s1, bytes: diff(c, s0, s1), records: recordsBetween(s0, s1) }
  out.again = { start: s1, end: s2, bytes: diff(c, s1, s2), records: recordsBetween(s1, s2) }
  out.inspectShown = session(c, [
    `SELECT start_lsn, xid, resource_manager AS rmgr, record_type, record_length AS len, fpi_length AS fpi
FROM pg_get_wal_records_info('${s1}', '${s2}');`,
  ])
  out.walFile = rows(c, `SELECT '${s1}'::text AS lsn, file_name, file_offset, pg_size_pretty(setting::bigint) AS seg FROM pg_walfile_name_offset('${s1}'), pg_settings WHERE name = 'wal_segment_size'`)[0]
  out.walFile.segBytes = Number(val(c, `SELECT setting FROM pg_settings WHERE name = 'wal_segment_size'`))
  out.walFileShown = session(c, [`SELECT pg_current_wal_lsn(), pg_walfile_name(pg_current_wal_lsn());`])
  out.lsShown = '$ ls $PGDATA/pg_wal\n' + exec(c, 'ls $PGDATA/pg_wal').trim()

  // 2. Full-page writes: touch one row on every 100th id (~ every page), twice in a row after a checkpoint
  const fpw = []
  for (const [label, settings] of [
    ['full_page_writes = on', { full_page_writes: 'on', wal_compression: 'off' }],
    ['on + wal_compression = lz4', { full_page_writes: 'on', wal_compression: 'lz4' }],
    ['full_page_writes = off', { full_page_writes: 'off', wal_compression: 'off' }],
  ]) {
    psqlRaw(c, Object.entries(settings).map(([k, v]) => `ALTER SYSTEM SET ${k} = '${v}';`).join('\n') + '\nSELECT pg_reload_conf();')
    await sleep(500)
    psqlRaw(c, 'CHECKPOINT;')
    const a = lsn(c)
    psqlRaw(c, 'UPDATE orders SET amount = amount + 1 WHERE id % 100 = 0;')
    const b = lsn(c)
    psqlRaw(c, 'UPDATE orders SET amount = amount + 1 WHERE id % 100 = 0;')
    const d = lsn(c)
    const stats = (x, y) => ({
      ...rows(c, `SELECT sum(count)::int AS records, sum(record_size)::bigint AS record_bytes, sum(fpi_size)::bigint AS fpi_bytes FROM pg_get_wal_stats('${x}', '${y}')`)[0],
      fpi: Number(val(c, `SELECT count(*) FROM pg_get_wal_block_info('${x}', '${y}', false) WHERE block_fpi_length > 0`)),
    })
    fpw.push({ label, first: { bytes: diff(c, a, b), ...stats(a, b) }, second: { bytes: diff(c, b, d), ...stats(b, d) } })
  }
  psqlRaw(c, 'ALTER SYSTEM RESET full_page_writes; ALTER SYSTEM RESET wal_compression; SELECT pg_reload_conf();')
  out.fpw = fpw
  out.fpwRows = Number(val(c, 'SELECT count(*) FROM orders WHERE id % 100 = 0'))

  // 3. synchronous_commit and group commit, measured with pgbench (one INSERT per transaction)
  psqlRaw(c, 'CREATE TABLE payments (id bigserial PRIMARY KEY, amount int NOT NULL);')
  exec(c, `printf 'INSERT INTO payments (amount) VALUES (1);\\n' > /tmp/pay.sql`)
  const bench = (clients, level, secs = 5) => {
    const t = exec(c, `PGOPTIONS='-c synchronous_commit=${level}' pgbench -n -U postgres -c ${clients} -j ${Math.min(clients, 4)} -T ${secs} -f /tmp/pay.sql lab`)
    return { tps: Math.round(Number(t.match(/tps = ([\d.]+)/)[1])), latencyMs: Number(t.match(/latency average = ([\d.]+) ms/)[1]), text: t.trim() }
  }
  const walIo = () => rows(c, `SELECT (SELECT sum(fsyncs) FROM pg_stat_io WHERE object = 'wal')::bigint AS fsyncs, (SELECT sum(writes) FROM pg_stat_io WHERE object = 'wal')::bigint AS writes, (SELECT xact_commit FROM pg_stat_database WHERE datname = 'lab')::bigint AS commits`)[0]
  // three interleaved 5-second runs per level, the median kept: fsync latency on a shared disk is noisy
  const runs = { off: [], on: [] }
  for (let i = 0; i < 3; i++) for (const level of ['off', 'on']) runs[level].push(bench(1, level))
  const median = (xs) => [...xs].sort((a, b) => a.tps - b.tps)[1]
  out.syncLevels = ['off', 'on'].map((level) => ({ level, ...median(runs[level]), runs: runs[level].map((r) => r.tps) }))
  out.group = []
  for (const clients of [1, 4, 16, 64]) {
    const a = walIo()
    const r = bench(clients, 'on', 10)
    await sleep(1500)
    const b = walIo()
    out.group.push({ clients, text: r.text, tps: r.tps, latencyMs: r.latencyMs, commits: b.commits - a.commits, fsyncs: b.fsyncs - a.fsyncs, writes: b.writes - a.writes })
  }
  out.pgbenchShown = `$ PGOPTIONS='-c synchronous_commit=on' pgbench -n -U postgres -c 16 -j 4 -T 10 -f /tmp/pay.sql lab\n` + out.group.find((g) => g.clients === 16).text

  // 4. What synchronous_commit = off can lose: kill the server while a program inserts
  psqlRaw(c, 'CREATE TABLE ledger (id bigint PRIMARY KEY);')
  out.loss = []
  for (const level of ['off', 'on']) {
    psqlRaw(c, 'TRUNCATE ledger; CHECKPOINT;')
    const run = spawnSync('sh', ['-c', `node ${join(APP, 'commitLoss.ts')} ${level} & sleep 3; podman kill -s KILL ${c} >/dev/null; wait`], { cwd: APP, encoding: 'utf8' })
    const printed = (run.stdout + run.stderr).trim()
    podman(['start', c])
    await waitReady(c)
    const present = rows(c, 'SELECT count(*)::int AS n, coalesce(max(id), 0)::int AS max FROM ledger')[0]
    out.loss.push({ level, printed, acked: Number(printed.match(/last acknowledged id: (\d+)/)?.[1] ?? 0), present: present.n, max: present.max })
  }
  out.recoveryLog = logs(c).split('\n').filter((l) => /database system was interrupted|redo starts|redo done|database system is ready|checkpoint starting: end-of-recovery|automatic recovery/.test(l)).slice(-6).join('\n')

  // 5. Checkpoint spacing: checkpoint_timeout = 30s and a small max_wal_size, light then heavy writes
  psqlRaw(c, `ALTER SYSTEM SET checkpoint_timeout = '30s'; ALTER SYSTEM SET max_wal_size = '64MB'; ALTER SYSTEM SET min_wal_size = '32MB'; SELECT pg_reload_conf();
CREATE TABLE events (id bigserial, payload text);
SELECT pg_stat_reset_shared('checkpointer');`)
  psqlRaw(c, 'CHECKPOINT;')
  const t0 = Date.now()
  const since = new Date(t0).toISOString()
  const phase = []
  const until = async (sec, fn) => { while (Date.now() - t0 < sec * 1000) await fn() }
  phase.push({ label: 'light writes', from: 0 })
  await until(75, async () => { psqlRaw(c, `INSERT INTO events (payload) SELECT repeat('x', 100) FROM generate_series(1, 200);`); await sleep(2000) })
  phase.push({ label: 'heavy writes', from: (Date.now() - t0) / 1000 })
  await until(115, async () => { psqlRaw(c, `INSERT INTO events (payload) SELECT repeat('x', 200) FROM generate_series(1, 20000);`); await sleep(1000) })
  phase.push({ label: 'light writes', from: (Date.now() - t0) / 1000 })
  await until(160, async () => { psqlRaw(c, `INSERT INTO events (payload) SELECT repeat('x', 100) FROM generate_series(1, 200);`); await sleep(2000) })
  phase.push({ label: 'end', from: (Date.now() - t0) / 1000 })
  const log = logs(c, since)
  const at = (line) => (Date.parse(line.slice(0, 23).replace(' ', 'T') + 'Z') - t0) / 1000
  out.checkpoints = { phases: phase, lines: log.split('\n').filter((l) => /checkpoint (starting|complete)|checkpoints are occurring/.test(l)).map((l) => ({ t: Math.round(at(l) * 10) / 10, text: l.replace(/^\S+ \S+ \S+ \[\d+\] /, '') })) }
  out.checkpointer = session(c, ['SELECT num_timed, num_requested, num_done, buffers_written FROM pg_stat_checkpointer;'])
  out.checkpointLogSample = log.split('\n').filter((l) => /checkpoint/.test(l)).slice(0, 6).map((l) => l.replace(/\[\d+\] /, '')).join('\n')
  podman(['rm', '-f', c])
  save('wal', out)
}

/* ------------------------------------------------------------------ replication */
const hide = (s) => s.replace(/password=\S+/g, 'password=********').replace(/password '[^']*'/g, "password '********'")
const conninfoLines = (s) => s.split('\n').filter((l) => l.trim()).join('\n')

async function repl() {
  const P = 'pg-dur-primary', S = 'pg-dur-standby', L = 'pg-dur-sub'
  const out = {}
  // the primary also serves logical replication later, so it starts with wal_level = logical
  await startServer(P, { port: 55516, alias: 'primary', args: ['wal_level=logical', 'max_wal_size=128MB', 'min_wal_size=32MB'] })
  out.primarySetup = session(P, [
    `CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'repl-secret';`,
    `CREATE TABLE orders (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, customer_id int NOT NULL, amount numeric(10,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
    `INSERT INTO orders (customer_id, amount) SELECT g % 5000, (g % 1000) + 0.99 FROM generate_series(1, 100000) g;`,
  ])
  exec(P, `echo 'host replication replicator all scram-sha-256' >> $PGDATA/pg_hba.conf`)
  psqlRaw(P, 'SELECT pg_reload_conf();')
  out.hbaLine = exec(P, 'tail -n 2 $PGDATA/pg_hba.conf').trim()

  // 1. The standby: a base backup of the primary, written with -R so it starts as a standby
  podman(['rm', '-f', S], { allowFail: true })
  const BB = 'pg_basebackup -h primary -U replicator -D /var/lib/postgresql/18/docker -R -X stream -C -S standby1 -c fast -P -v -d "application_name=standby1"'
  podman(['run', '-d', '--name', S, '--network', 'pg-dur-net', '--network-alias', 'standby', '-p', '55517:5432', '--user', 'postgres', '-e', 'PGPASSWORD=repl-secret',
    '--entrypoint', 'bash', 'docker.io/library/postgres:18', '-c', `${BB} > /tmp/basebackup.log 2>&1; exec postgres -D /var/lib/postgresql/18/docker -c max_standby_streaming_delay=5s`])
  await waitReady(S)
  out.basebackup = `$ ${BB.replace('/var/lib/postgresql/18/docker', '$PGDATA')}\n` + exec(S, 'cat /tmp/basebackup.log').replace(/\r/g, '\n').split('\n').filter((l) => l.trim()).filter((l, i, a) => !/^\d+\/\d+ kB/.test(l) || i === a.findLastIndex((x) => /^\d+\/\d+ kB/.test(x))).join('\n')
  out.standbyFiles = '$ ls $PGDATA | grep -E "signal|auto"\n' + exec(S, 'ls /var/lib/postgresql/18/docker | grep -E "signal|auto"').trim()
  out.autoConf = '$ cat $PGDATA/postgresql.auto.conf\n' + hide(conninfoLines(exec(S, 'cat /var/lib/postgresql/18/docker/postgresql.auto.conf')))
  await sleep(1500)
  out.statReplication = session(P, ['\\x on', `SELECT pid, application_name, client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
       write_lag, flush_lag, replay_lag, sync_state
FROM pg_stat_replication;`]).replace(/\d+\.\d+\.\d+\.\d+/g, (ip) => ip)
  out.walReceiver = session(S, ['\\x on', 'SELECT status, written_lsn, flushed_lsn, sender_host, slot_name FROM pg_stat_wal_receiver;', 'SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();'])

  // 2. Lag under load, sampled every 250 ms; replay is paused on the standby for a few seconds
  const pg = (await import('./durability-app/node_modules/pg/lib/index.js')).default
  const sampler = new pg.Client({ host: '127.0.0.1', port: 55516, user: 'postgres', password: 'lab', database: 'lab' })
  await sampler.connect()
  const base = (await sampler.query('SELECT pg_current_wal_lsn() AS l')).rows[0].l
  const samples = []
  const t0 = Date.now()
  const load = background(P, [`DO $$ BEGIN FOR i IN 1..60 LOOP INSERT INTO orders (customer_id, amount) SELECT g % 5000, 9.99 FROM generate_series(1, 20000) g; COMMIT; PERFORM pg_sleep(0.2); END LOOP; END $$;`])
  const marks = []
  while (Date.now() - t0 < 16000) {
    const t = (Date.now() - t0) / 1000
    if (t > 4 && !marks.some((m) => m.label === 'pause')) { psqlRaw(S, 'SELECT pg_wal_replay_pause();'); marks.push({ t, label: 'pause' }) }
    if (t > 9 && !marks.some((m) => m.label === 'resume')) { psqlRaw(S, 'SELECT pg_wal_replay_resume();'); marks.push({ t, label: 'resume' }) }
    const r = (await sampler.query(`SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), $1)::bigint AS cur, pg_wal_lsn_diff(sent_lsn, $1)::bigint AS sent, pg_wal_lsn_diff(write_lsn, $1)::bigint AS write,
      pg_wal_lsn_diff(flush_lsn, $1)::bigint AS flush, pg_wal_lsn_diff(replay_lsn, $1)::bigint AS replay,
      extract(epoch FROM replay_lag) * 1000 AS replay_lag_ms, extract(epoch FROM flush_lag) * 1000 AS flush_lag_ms FROM pg_stat_replication`, [base])).rows[0]
    samples.push({ t: Math.round(t * 100) / 100, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v === null ? null : Math.round(Number(v) * 10) / 10])) })
    await sleep(250)
  }
  await load.done
  out.lag = { samples, marks }
  out.pausedView = session(S, ['SELECT pg_wal_replay_pause();', 'SELECT pg_get_wal_replay_pause_state();', 'SELECT pg_wal_replay_resume();'])

  // 3. Synchronous replication: commit latency per synchronous_commit level, then a commit that waits
  out.syncSetup = session(P, [`ALTER SYSTEM SET synchronous_standby_names = 'standby1';`, 'SELECT pg_reload_conf();'])
  await sleep(1000)
  out.syncState = session(P, ['SELECT application_name, state, sync_state FROM pg_stat_replication;'])
  exec(P, `printf 'INSERT INTO orders (customer_id, amount) VALUES (7, 1.00);\\n' > /tmp/one.sql`)
  const bench = (level) => {
    const t = exec(P, `PGOPTIONS='-c synchronous_commit=${level}' pgbench -n -U postgres -c 1 -T 4 -f /tmp/one.sql lab`)
    return { tps: Math.round(Number(t.match(/tps = ([\d.]+)/)[1])), latencyMs: Number(t.match(/latency average = ([\d.]+) ms/)[1]) }
  }
  const levels = ['off', 'local', 'remote_write', 'on', 'remote_apply']
  const runs = Object.fromEntries(levels.map((l) => [l, []]))
  for (let i = 0; i < 5; i++) for (const l of levels) runs[l].push(bench(l))
  // fsync time on a shared lab disk is noisy: keep the median of five interleaved runs
  out.syncLevels = levels.map((level) => ({ level, ...[...runs[level]].sort((a, b) => a.latencyMs - b.latencyMs)[2], runs: runs[level].map((r) => r.latencyMs) }))

  // the standby goes away: a commit on the primary waits
  podman(['stop', '-t', '5', S])
  const waiting = background(P, [`INSERT INTO orders (customer_id, amount) VALUES (7, 42.00);`])
  await sleep(3000)
  out.syncWaitActivity = session(P, [`SELECT pid, state, wait_event_type, wait_event, now() - query_start AS waiting_for, query
FROM pg_stat_activity WHERE wait_event = 'SyncRep';`])
  psqlRaw(P, `SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE wait_event = 'SyncRep';`)
  out.syncWaitCancelled = await waiting.done
  out.syncWaitAfter = session(P, [`SELECT count(*) FROM orders WHERE amount = 42.00;`])
  podman(['start', S])
  await waitReady(S)
  out.syncReset = session(P, [`ALTER SYSTEM RESET synchronous_standby_names;`, 'SELECT pg_reload_conf();'])
  await sleep(1000)

  // 4. Read-your-writes from the standby, as an application does it
  out.ryw = { naive: app('readYourWrites.ts', ['naive']), waitLsn: app('readYourWrites.ts', ['wait-lsn']) }

  // 5. Hot standby: reads work, writes do not; a long query conflicts with VACUUM on the primary
  out.hotRead = session(S, ['SELECT count(*) FROM orders;', 'INSERT INTO orders (customer_id, amount) VALUES (1, 1.00);'])
  const conflict = async (feedback) => {
    session(S, [`ALTER SYSTEM SET hot_standby_feedback = ${feedback};`, 'SELECT pg_reload_conf();'])
    await sleep(1500)
    psqlRaw(P, `INSERT INTO orders (customer_id, amount) SELECT 99, 5.00 FROM generate_series(1, 5000); VACUUM orders;`)
    const reader = background(S, ['BEGIN ISOLATION LEVEL REPEATABLE READ;', 'SELECT count(*) FROM orders WHERE customer_id = 99;', 'SELECT pg_sleep(12);', 'SELECT count(*) FROM orders WHERE customer_id = 99;', 'COMMIT;'], { prompt: 'standby=# ' })
    await sleep(1500)
    const primary = session(P, ['DELETE FROM orders WHERE customer_id = 99;', 'VACUUM (VERBOSE) orders;'], { prompt: 'primary=# ' })
    const standby = await reader.done
    return { feedback, standby, primary: primary.split('\n').filter((l) => /=#|DELETE \d|tuples:|removable cutoff|INFO:  finished|VACUUM$/.test(l)).join('\n') }
  }
  out.conflicts = [await conflict('off'), await conflict('on')]
  session(S, ['ALTER SYSTEM RESET hot_standby_feedback;', 'SELECT pg_reload_conf();'])
  out.conflictStats = session(S, [`SELECT datname, confl_snapshot, confl_lock FROM pg_stat_database_conflicts WHERE datname = 'lab';`])

  // 6. Replication slots: a slot whose standby is gone keeps WAL until the disk fills
  const walDir = () => rows(P, `SELECT count(*)::int AS files, sum(size)::bigint AS bytes FROM pg_ls_waldir() WHERE name ~ '^[0-9A-F]{24}$'`)[0]
  out.slotCreate = session(P, [`SELECT pg_create_physical_replication_slot('gone_standby', true);`])
  const growth = [{ step: 0, ...walDir() }]
  for (let i = 1; i <= 6; i++) {
    psqlRaw(P, `INSERT INTO orders (customer_id, amount) SELECT g % 5000, 1.00 FROM generate_series(1, 400000) g; CHECKPOINT;`)
    growth.push({ step: i, wal: Number(val(P, `SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) FROM pg_replication_slots WHERE slot_name = 'gone_standby'`)), ...walDir() })
  }
  out.slotGrowth = growth
  out.slotStatus = session(P, [`SELECT slot_name, active, restart_lsn, wal_status, pg_size_pretty(safe_wal_size) AS safe_wal_size,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained
FROM pg_replication_slots;`])
  out.slotLimit = session(P, [`ALTER SYSTEM SET max_slot_wal_keep_size = '256MB';`, 'SELECT pg_reload_conf();', 'CHECKPOINT;', `SELECT slot_name, active, wal_status, invalidation_reason FROM pg_replication_slots;`])
  psqlRaw(P, `SELECT pg_switch_wal(); INSERT INTO orders (customer_id, amount) SELECT g % 5000, 1.00 FROM generate_series(1, 100000) g; CHECKPOINT;`)
  out.slotLost = session(P, ['CHECKPOINT;', `SELECT slot_name, active, wal_status, invalidation_reason FROM pg_replication_slots;`])
  growth.push({ step: 7, wal: 0, ...walDir() })
  out.slotDrop = session(P, [`SELECT pg_drop_replication_slot('gone_standby');`, 'CHECKPOINT;', `SELECT count(*) AS wal_files, pg_size_pretty(sum(size)) AS pg_wal FROM pg_ls_waldir();`])
  psqlRaw(P, 'ALTER SYSTEM RESET max_slot_wal_keep_size; SELECT pg_reload_conf();')
  out.slotLog = logs(P).split('\n').filter((l) => /invalidating|gone_standby|max_slot_wal_keep_size/.test(l)).map((l) => l.replace(/^\S+ \S+ \S+ \[\d+\] /, '')).slice(0, 4).join('\n')

  // 7. Logical replication: a publication on the primary, a subscription on a third server
  await startServer(L, { port: 55518, alias: 'subscriber' })
  psqlRaw(P, 'DELETE FROM orders WHERE id > 1000; VACUUM orders;')
  out.publication = session(P, ['CREATE PUBLICATION orders_pub FOR TABLE orders;'], { prompt: 'primary=# ' })
  out.subscription = session(L, [
    `CREATE TABLE orders (id bigint PRIMARY KEY, customer_id int NOT NULL, amount numeric(10,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());`,
    `CREATE SUBSCRIPTION orders_sub CONNECTION 'host=primary dbname=lab user=postgres password=lab' PUBLICATION orders_pub;`,
  ], { prompt: 'subscriber=# ' }).replace(/password=lab/, 'password=********')
  await sleep(3000)
  out.subscriptionCopy = session(L, ['SELECT count(*) FROM orders;'], { prompt: 'subscriber=# ' })
  out.logicalChange = session(P, [`UPDATE orders SET amount = 120.00 WHERE id = 1;`, `DELETE FROM orders WHERE id = 2;`], { prompt: 'primary=# ' })
  await sleep(1500)
  out.logicalSeen = session(L, ['SELECT id, amount FROM orders WHERE id IN (1, 2) ORDER BY id;', `SELECT subname, received_lsn, latest_end_lsn FROM pg_stat_subscription;`], { prompt: 'subscriber=# ' })
  out.logicalSlots = session(P, [`SELECT slot_name, plugin, slot_type, active, confirmed_flush_lsn FROM pg_replication_slots;`], { prompt: 'primary=# ' })
  // what logical decoding produces, with the test_decoding plugin
  out.decoding = session(P, [
    `SELECT pg_create_logical_replication_slot('peek', 'test_decoding');`,
    `UPDATE orders SET amount = 130.00 WHERE id = 1;`,
    `INSERT INTO orders (customer_id, amount) VALUES (8, 15.50);`,
    `SELECT lsn, xid, data FROM pg_logical_slot_get_changes('peek', NULL, NULL);`,
    `SELECT pg_drop_replication_slot('peek');`,
  ], { prompt: 'primary=# ' })
  // DDL is not replicated
  const sinceDdl = new Date().toISOString()
  out.ddl = session(P, ['ALTER TABLE orders ADD COLUMN note text;', `INSERT INTO orders (customer_id, amount, note) VALUES (9, 10.00, 'gift');`], { prompt: 'primary=# ' })
  await sleep(4000)
  out.ddlError = logs(L, sinceDdl).split('\n').filter((l) => /ERROR|missing replicated column|worker/.test(l)).map((l) => l.replace(/^\S+ \S+ \S+ \[\d+\] /, '')).slice(0, 3).join('\n')
  out.ddlFix = session(L, ['ALTER TABLE orders ADD COLUMN note text;'], { prompt: 'subscriber=# ' })
  await sleep(6000)
  out.ddlFixed = session(L, [`SELECT id, note FROM orders WHERE note IS NOT NULL;`], { prompt: 'subscriber=# ' })
  podman(['rm', '-f', L])
  psqlRaw(P, `DROP PUBLICATION orders_pub; SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_type = 'logical';`)

  // 8. Promotion: the standby becomes a primary on a new timeline
  const sincePromote = new Date().toISOString()
  out.beforePromote = session(S, ['SELECT pg_is_in_recovery(), timeline_id FROM pg_control_checkpoint();'], { prompt: 'standby=# ' })
  out.promote = session(S, ['SELECT pg_promote();', 'SELECT pg_is_in_recovery();', `INSERT INTO orders (customer_id, amount) VALUES (11, 1.00) RETURNING id;`], { prompt: 'standby=# ' })
  psqlRaw(S, 'CHECKPOINT;')
  out.afterPromote = session(S, ['SELECT timeline_id FROM pg_control_checkpoint();'], { prompt: 'standby=# ' })
  out.promoteLog = logs(S, sincePromote).split('\n').filter((l) => /promote|timeline|archive recovery|ready to accept|redo done/.test(l)).map((l) => l.replace(/^\S+ \S+ \S+ \[\d+\] /, '')).join('\n')
  out.oldPrimary = session(P, ['SELECT count(*) AS standbys FROM pg_stat_replication;', `INSERT INTO orders (customer_id, amount) VALUES (12, 1.00) RETURNING id;`], { prompt: 'primary=# ' })
  out.historyFile = '$ cat $PGDATA/pg_wal/00000002.history\n' + exec(S, 'cat /var/lib/postgresql/18/docker/pg_wal/00000002.history').trim()

  await sampler.end()
  podman(['rm', '-f', S, P])
  save('repl', out)
}

/* ------------------------------------------------------------------ partitioning */
async function part() {
  const c = 'pg-dur-part'
  await startServer(c, { port: 55519 })
  const out = {}
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const mm = (m) => String(m).padStart(2, '0')
  const bound = (m) => (m === 13 ? '2027-01-01' : `2026-${mm(m)}-01`)
  // 1. Range partitions by month, 200,000 rows each
  out.createRange = [
    `CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY,
  user_id    int NOT NULL,
  kind       text NOT NULL,
  created_at timestamptz NOT NULL,
  payload    text
) PARTITION BY RANGE (created_at);`,
    `CREATE TABLE events_2026_01 PARTITION OF events FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');`,
    `CREATE TABLE events_2026_02 PARTITION OF events FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');`,
  ]
  out.createRangeShown = session(c, out.createRange)
  psqlRaw(c, months.slice(2).map((m) => `CREATE TABLE events_2026_${mm(m)} PARTITION OF events FOR VALUES FROM ('${bound(m)}') TO ('${bound(m + 1)}');`).join('\n'))
  psqlRaw(c, months.map((m) => `INSERT INTO events (user_id, kind, created_at, payload)
  SELECT (g * 7919) % 50000, (ARRAY['view','click','order','payment'])[1 + g % 4], timestamptz '${bound(m)}' + (g % (28 * 24 * 60)) * interval '1 minute', repeat('x', 60)
  FROM generate_series(1, 200000) g;`).join('\n') + '\nVACUUM ANALYZE events;')
  out.tree = session(c, [`SELECT relid, parentrelid, isleaf, level FROM pg_partition_tree('events') LIMIT 5;`])
  out.sizes = rows(c, `SELECT c.relname AS name, c.reltuples::bigint AS rows, pg_relation_size(c.oid) AS bytes FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid WHERE i.inhparent = 'events'::regclass ORDER BY 1`)
  out.describe = session(c, ['\\d events'])

  // 2. A primary key must contain the partition key
  out.pk = session(c, ['ALTER TABLE events ADD PRIMARY KEY (id);', 'ALTER TABLE events ADD PRIMARY KEY (id, created_at);'])

  // 3. Indexes on a partitioned table
  out.index = session(c, [
    'CREATE INDEX events_user_idx ON events (user_id);',
    `SELECT count(*) FILTER (WHERE c.relkind = 'I') AS partitioned_index, count(*) FILTER (WHERE c.relkind = 'i') AS index_per_partition
FROM pg_class c WHERE c.relname LIKE 'events%user_id%' OR c.relname = 'events_user_idx';`,
    'CREATE INDEX CONCURRENTLY events_kind_idx ON events (kind);',
  ])
  out.indexOnly = session(c, [
    'CREATE INDEX events_kind_idx ON ONLY events (kind);',
    'CREATE INDEX CONCURRENTLY events_2026_01_kind_idx ON events_2026_01 (kind);',
    'ALTER INDEX events_kind_idx ATTACH PARTITION events_2026_01_kind_idx;',
    `SELECT indisvalid FROM pg_index WHERE indexrelid = 'events_kind_idx'::regclass;`,
  ])
  psqlRaw(c, months.slice(1).map((m) => `CREATE INDEX events_2026_${mm(m)}_kind_idx ON events_2026_${mm(m)} (kind); ALTER INDEX events_kind_idx ATTACH PARTITION events_2026_${mm(m)}_kind_idx;`).join('\n'))
  out.indexOnlyValid = session(c, [`SELECT indisvalid FROM pg_index WHERE indexrelid = 'events_kind_idx'::regclass;`])

  // 4. Partition pruning in EXPLAIN
  const explain = (sql, opts = 'COSTS OFF') => session(c, [`EXPLAIN (${opts}) ${sql}`])
  out.prune = {
    month: explain(`SELECT count(*) FROM events WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';`),
    noKey: explain(`SELECT count(*) FROM events WHERE user_id = 42;`),
    monthAnalyze: explain(`SELECT count(*) FROM events WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';`, 'ANALYZE, COSTS OFF, BUFFERS'),
    yearAnalyze: explain(`SELECT count(*) FROM events WHERE kind = 'order' AND created_at >= '2026-01-01';`, 'ANALYZE, COSTS OFF, BUFFERS'),
    expr: explain(`SELECT count(*) FROM events WHERE date_trunc('month', created_at) = '2026-03-01';`),
    stable: explain(`SELECT count(*) FROM events WHERE created_at >= timestamptz '2026-12-31' - interval '3 days';`),
    runtime: session(c, [
      `PREPARE by_day(timestamptz) AS SELECT count(*) FROM events WHERE created_at >= $1 AND created_at < $1 + interval '1 day';`,
      'SET plan_cache_mode = force_generic_plan;',
      `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF, SUMMARY OFF) EXECUTE by_day('2026-05-10');`,
    ]),
    off: session(c, ['SET enable_partition_pruning = off;', `EXPLAIN (COSTS OFF) SELECT count(*) FROM events WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';`]),
  }

  // 5. Dropping old data: DELETE a month vs DETACH + DROP a month (same row count)
  const timed = (statements) => {
    psqlRaw(c, 'CHECKPOINT;')
    const a = lsn(c)
    const shown = session(c, ['\\timing on', ...statements])
    const b = lsn(c)
    return { shown: shown.replace(/^lab=# \\timing on\nTiming is on\.\n/, ''), wal: diff(c, a, b), ms: [...shown.matchAll(/Time: ([\d.]+) ms/g)].map((m) => Number(m[1])) }
  }
  const before = rows(c, `SELECT pg_relation_size('events_2026_01') AS jan, pg_relation_size('events_2026_02') AS feb`)[0]
  out.dropVsDelete = {
    before,
    delete: timed([`DELETE FROM events WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01';`]),
    afterDelete: session(c, [`SELECT count(*), pg_size_pretty(pg_relation_size('events_2026_01')) AS size FROM events_2026_01;`]),
    drop: timed(['ALTER TABLE events DETACH PARTITION events_2026_02;', 'DROP TABLE events_2026_02;']),
    concurrently: session(c, ['ALTER TABLE events DETACH PARTITION events_2026_03 CONCURRENTLY;', 'DROP TABLE events_2026_03;']),
  }

  // 6. Default partitions
  out.noPartition = session(c, [`INSERT INTO events (user_id, kind, created_at) VALUES (1, 'view', '2027-01-15');`])
  out.withDefault = session(c, [
    'CREATE TABLE events_default PARTITION OF events DEFAULT;',
    `INSERT INTO events (user_id, kind, created_at) VALUES (1, 'view', '2027-01-15') RETURNING tableoid::regclass, id;`,
    `CREATE TABLE events_2027_01 PARTITION OF events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');`,
  ])

  // 7. List and hash partitioning
  out.list = session(c, [
    `CREATE TABLE customers (id bigint NOT NULL, region text NOT NULL, name text) PARTITION BY LIST (region);`,
    `CREATE TABLE customers_eu PARTITION OF customers FOR VALUES IN ('de', 'fr', 'nl');`,
    `CREATE TABLE customers_us PARTITION OF customers FOR VALUES IN ('us', 'ca');`,
    `CREATE TABLE customers_other PARTITION OF customers DEFAULT;`,
    `INSERT INTO customers SELECT g, (ARRAY['de','fr','nl','us','ca','br','jp'])[1 + g % 7], 'customer ' || g FROM generate_series(1, 70000) g;`,
    `SELECT tableoid::regclass AS partition, count(*) FROM customers GROUP BY 1 ORDER BY 1;`,
    `EXPLAIN (COSTS OFF) SELECT * FROM customers WHERE region = 'fr';`,
  ])
  out.hash = session(c, [
    `CREATE TABLE carts (user_id bigint NOT NULL, items int NOT NULL) PARTITION BY HASH (user_id);`,
    `CREATE TABLE carts_0 PARTITION OF carts FOR VALUES WITH (MODULUS 4, REMAINDER 0);`,
    `CREATE TABLE carts_1 PARTITION OF carts FOR VALUES WITH (MODULUS 4, REMAINDER 1);`,
    `CREATE TABLE carts_2 PARTITION OF carts FOR VALUES WITH (MODULUS 4, REMAINDER 2);`,
    `CREATE TABLE carts_3 PARTITION OF carts FOR VALUES WITH (MODULUS 4, REMAINDER 3);`,
    `INSERT INTO carts SELECT g, g % 9 FROM generate_series(1, 100000) g;`,
    `SELECT tableoid::regclass AS partition, count(*) FROM carts GROUP BY 1 ORDER BY 1;`,
    `EXPLAIN (COSTS OFF) SELECT * FROM carts WHERE user_id = 42;`,
    `EXPLAIN (COSTS OFF) SELECT * FROM carts WHERE user_id < 100;`,
  ])
  out.hashCounts = rows(c, `SELECT tableoid::regclass::text AS name, count(*)::int AS rows FROM carts GROUP BY 1 ORDER BY 1`)
  out.hashOf = rows(c, `SELECT user_id::int AS user_id, tableoid::regclass::text AS name FROM carts WHERE user_id <= 12 ORDER BY 1`)
  out.listCounts = rows(c, `SELECT tableoid::regclass::text AS name, count(*)::int AS rows FROM customers GROUP BY 1 ORDER BY 1`)

  // 8. When it does not help: a lookup by id over 365 daily partitions vs one table
  psqlRaw(c, `CREATE TABLE visits (id bigint NOT NULL, user_id int NOT NULL, created_at timestamptz NOT NULL) PARTITION BY RANGE (created_at);
DO $$ BEGIN FOR d IN 0..364 LOOP
  EXECUTE format('CREATE TABLE visits_%s PARTITION OF visits FOR VALUES FROM (%L) TO (%L)', d, timestamptz '2026-01-01' + d * interval '1 day', timestamptz '2026-01-01' + (d + 1) * interval '1 day');
END LOOP; END $$;
INSERT INTO visits SELECT g, g % 50000, timestamptz '2026-01-01' + (g % 365) * interval '1 day' + (g % 1440) * interval '1 minute' FROM generate_series(1, 1460000) g;
CREATE INDEX ON visits (id);
CREATE TABLE visits_flat AS SELECT * FROM visits;
CREATE INDEX ON visits_flat (id);
CREATE INDEX ON visits_flat (created_at);
VACUUM ANALYZE visits; VACUUM ANALYZE visits_flat;`)
  const timing = (sql) => {
    // warm up once, then keep the median of five runs
    psqlRaw(c, `EXPLAIN ANALYZE ${sql}`)
    const runs = Array.from({ length: 5 }, () => {
      const t = psqlRaw(c, `EXPLAIN (ANALYZE, COSTS OFF) ${sql}`)
      return { plan: Number(t.match(/Planning Time: ([\d.]+)/)[1]), exec: Number(t.match(/Execution Time: ([\d.]+)/)[1]) }
    }).sort((a, b) => a.plan + a.exec - (b.plan + b.exec))
    return runs[2]
  }
  out.notHelp = {
    byIdPart: timing('SELECT * FROM visits WHERE id = 123456;'),
    byIdFlat: timing('SELECT * FROM visits_flat WHERE id = 123456;'),
    byDayPart: timing(`SELECT count(*) FROM visits WHERE created_at >= '2026-06-01' AND created_at < '2026-06-02';`),
    byDayFlat: timing(`SELECT count(*) FROM visits_flat WHERE created_at >= '2026-06-01' AND created_at < '2026-06-02';`),
    plan: (() => {
      const l = session(c, ['EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF) SELECT * FROM visits WHERE id = 123456;']).split('\n')
      return [...l.slice(0, 9), `   … ${l.length - 14} more lines: the same index scan on every other partition …`, ...l.slice(-5)].join('\n')
    })(),
    partitions: 365,
    rows: 1460000,
  }
  podman(['rm', '-f', c])
  save('part', out)
}

/* ------------------------------------------------------------------ main */
const sections = { wal, repl, part }
const which = process.argv[2]
if (which === 'gen') gen()
else if (sections[which]) await sections[which]()
else console.error('usage: node capture-durability.mjs wal|repl|part|gen')

function gen() {
  const data = Object.fromEntries(['wal', 'repl', 'part'].filter((s) => existsSync(join(OUT, `${s}.json`))).map((s) => [s, load(s)]))
  const text = JSON.stringify(data)
  assertClean(text)
  writeFileSync(DATA, `// Recorded on PostgreSQL ${data.wal?.version ?? '18'} (official postgres:18 image, podman). Generated by\n// tools/postgres-capture/capture-durability.mjs — do not edit by hand.\n\nexport const DURABILITY = ${JSON.stringify(data, null, 1)} as const\n`)
}
