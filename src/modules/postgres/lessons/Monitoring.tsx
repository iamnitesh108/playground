import { BarChart, Flow, Proportion, StatTiles, type Hue } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { MonitoringLineChart } from '../components/MonitoringLineChart'
import { MonitoringMemory } from '../components/MonitoringMemory'
import { OPERATIONS } from '../data/operations'

const M = OPERATIONS.mon
const { activity, statements, blocking, idle, workMem, autovacuum, logs, settings, xidAge } = M
const version = OPERATIONS.recordedWith.split(' ')[0]

const fmt = (n: number) => n.toLocaleString('en')
const bytes = (b: number) => (b >= 1 << 30 ? `${(b / (1 << 30)).toFixed(1)} GB` : b >= 1 << 20 ? `${Math.round(b / (1 << 20))} MB` : `${Math.round(b / 1024)} kB`)
const setting = (name: string) => settings.find((s) => s.name === name)!

/** Sessions by what they were doing, sampled every 250 ms. */
const STATES: { key: string; label: string; hue: Hue }[] = [
  { key: 'running', label: 'active, running (no wait)', hue: 6 },
  { key: 'Lock', label: 'active, waiting: Lock (row/transaction lock)', hue: 8 },
  { key: 'LWLock', label: 'active, waiting: LWLock (e.g. WALWrite)', hue: 2 },
  { key: 'IO', label: 'active, waiting: IO (e.g. WalSync)', hue: 4 },
  { key: 'Client', label: 'active, waiting: Client', hue: 1 },
  { key: 'idle in transaction', label: 'idle in transaction', hue: 5 },
  { key: 'idle', label: 'idle', hue: 3 },
]
type Sample = (typeof activity.samples)[number] & Record<string, number | undefined>
const samples = activity.samples as Sample[]
const bands = activity.phases.map((p) => ({ from: p.fromMs / 1000, to: p.toMs / 1000, label: `${p.clients} clients` }))
const progress = activity.phases.flatMap((p) => p.progress.map((x) => ({ s: Math.round((p.fromMs / 1000 + x.s) * 10) / 10, tps: x.tps, lat: x.latMs })))
const busiest = activity.phases.at(-1)!
const slowest = progress.reduce((a, b) => (b.tps < a.tps ? b : a))

const top = statements.top
const totalMs = statements.all.ms
const short = (q: string) => (q.length > 46 ? `${q.slice(0, 44)}…` : q)

const avRuns = autovacuum.runs
const RUN_HUES: Hue[] = [8, 4, 6]
const tuned = avRuns[2]
const tunedVacuums = Math.max(...tuned.samples.map((s) => s.vacuums))
const maxDead = (i: number) => Math.max(...avRuns[i].samples.map((s) => s.dead))

const sb = statements.buffers
const accountsSize = statements.sizes.find((s) => s.relname === 'pgbench_accounts')!.bytes

export default function Monitoring() {
  return (
    <>
      <LessonGoals
        goals={[
          'find what every session is doing right now, and what it waits for (pg_stat_activity)',
          'find the queries that cost the most in total (pg_stat_statements)',
          'read table, cache and I/O statistics, and find who blocks whom',
          'turn on the log settings that explain slow queries, lock waits and autovacuum',
          'choose starting values for the memory settings and tune autovacuum',
          'set up the alerts worth having',
        ]}
        before={
          <>
            <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>, <a href="#/postgres/locks">Concurrent writes and locks</a>,{' '}
            <a href="#/postgres/query-planning">Query planning and EXPLAIN</a> and <a href="#/postgres/pooling">Connection pooling</a>
          </>
        }
      />
      <p>
        Everything on this page was recorded on PostgreSQL {version} under load from <code>pgbench</code>, the benchmark tool that ships with
        PostgreSQL: it creates four tables (accounts, branches, tellers, history) and runs a small bank transfer as fast as it can.
      </p>

      <h2>Where the numbers come from</h2>
      <p>PostgreSQL counts what it does in memory and shows the counts as ordinary views you query with SQL.</p>
      <Flow
        title="The statistics views and what each one answers"
        cols={4}
        rows={3}
        nodes={[
          { id: 'be', label: 'backends', sub: 'one per connection', col: 0, row: 0, rowSpan: 3, hue: 1, shape: 'queue' },
          { id: 'act', label: 'pg_stat_activity', sub: 'who does what, now', col: 1, row: 0, hue: 1 },
          { id: 'stm', label: 'pg_stat_statements', sub: 'cost per query shape', col: 1, row: 1, hue: 7 },
          { id: 'loc', label: 'pg_locks', sub: 'who waits for whom', col: 1, row: 2, hue: 8 },
          { id: 'tab', label: 'pg_stat_user_tables', sub: 'scans, dead tuples', col: 2, row: 0, hue: 3 },
          { id: 'db', label: 'pg_stat_database', sub: 'commits, cache hits', col: 2, row: 1, hue: 3 },
          { id: 'io', label: 'pg_stat_io', sub: 'reads, writes, fsyncs', col: 2, row: 2, hue: 4 },
          { id: 'log', label: 'server log', sub: 'slow queries, waits', col: 3, row: 0, hue: 4, shape: 'log' },
          { id: 'rep', label: 'pg_stat_replication', sub: 'replica lag', col: 3, row: 1, hue: 5 },
          { id: 'mon', label: 'your monitoring', sub: 'scrapes, graphs, alerts', col: 3, row: 2, hue: 6, shape: 'actor' },
        ]}
        edges={[
          { from: 'be', to: 'act', hue: 1, flow: true },
          { from: 'be', to: 'stm', hue: 7 },
          { from: 'be', to: 'loc', hue: 8 },
          { from: 'act', to: 'tab', hue: 3, dashed: true },
          { from: 'io', to: 'mon', hue: 6, flow: true },
          { from: 'rep', to: 'mon', hue: 6 },
        ]}
        caption="pg_stat_activity and pg_locks show this instant; the others are cumulative counters since the last reset — graph their change per minute, not their value."
      />
      <TermList
        items={[
          { term: 'cumulative statistics', definition: 'Counters that only grow (scans, rows, blocks) until reset; useful as differences over time.' },
          { term: 'wait event', definition: 'What an active session is waiting for right now: a lock, an internal lock (LWLock), I/O, the client…' },
          { term: 'query id', definition: 'A hash of a query’s shape with constants removed; pg_stat_statements adds up all calls with the same id.' },
          { term: 'cache hit ratio', definition: 'Share of page reads found in shared_buffers instead of asking the operating system.' },
          { term: 'bloat', definition: 'Space taken by dead tuples and empty pages that vacuum has not (yet) made reusable.' },
          { term: 'autovacuum', definition: 'Background workers that vacuum and analyse tables once enough rows changed.' },
        ]}
      />

      <h2>Right now: pg_stat_activity</h2>
      <p>
        <code>pg_stat_activity</code> has one row per server process: its state, what it waits for, and the query it runs. It is the first
        place to look when “the database is slow”.
      </p>
      <Table
        head={['state', 'meaning']}
        rows={[
          [<code key="s">active</code>, 'running a query — maybe waiting inside it (see wait_event_type)'],
          [<code key="s">idle</code>, 'connected, waiting for the client to send something'],
          [<code key="s">idle in transaction</code>, 'inside BEGIN … but doing nothing: holds locks and snapshots — the dangerous one'],
          [<code key="s">idle in transaction (aborted)</code>, 'a statement failed; waits for ROLLBACK'],
        ]}
      />
      <Predict
        question={<p>48 pgbench clients run bank transfers on a 12-thread machine. At a random instant, how many of the 48 sessions are running on a CPU?</p>}
        options={['About 48 — all of them', 'About 12 — one per CPU thread', 'Only a handful — most are waiting']}
        answer={2}
        explanation="Most sessions are waiting: for a row lock another transfer holds on the same branch (20 branches, 48 clients), or for the WAL flush at COMMIT. Recorded every 250 ms:"
      />
      <MonitoringLineChart
        title="Recorded: client sessions by state, sampled every 250 ms while pgbench ran with 4, 16 and 48 clients"
        series={STATES.filter((st) => samples.some((x) => x[st.key])).map((st) => ({ label: st.label, hue: st.hue, points: samples.map((x) => ({ x: x.ms / 1000, y: x[st.key] ?? 0 })) }))}
        stacked
        bands={bands}
        xUnit="s"
        yLabel="sessions"
        caption="Stacked: the height is the number of sessions. With 48 clients, at most a few are ever running; the rest wait for row locks (Lock: transactionid, tuple) or for the WAL to be flushed (LWLock: WALWrite)."
      />
      <BarChart
        title="Most frequent wait events in those samples (active sessions)"
        bars={activity.topWaits.slice(0, 6).map((w) => ({ label: w.wait, value: w.samples, hue: (w.wait.startsWith('Lock') ? 8 : w.wait.startsWith('LWLock') ? 2 : w.wait.startsWith('IO') ? 4 : 1) as Hue }))}
        unit=" samples"
      />
      <MonitoringLineChart
        title="Recorded at the same time by pgbench -P 1: throughput and latency per second"
        series={[{ label: 'transactions per second', hue: 6, points: progress.map((p) => ({ x: p.s, y: p.tps })) }]}
        bands={bands}
        xUnit="s"
        yLabel="tps"
        caption={`With 48 clients pgbench averaged ${fmt(busiest.tps)} tps at ${busiest.latencyMs} ms. The slump is real, not staged: during the 16-client phase the shared disk of this machine was slow to flush the WAL (down to ${fmt(slowest.tps)} tps at ${slowest.lat} ms per transaction). Every COMMIT waited for the flush (LWLock: WALWrite), and the transactions behind it waited for their row locks (Lock) — the same seconds in the chart above. Throughput alone says “slow”; the wait events say why.`}
      />
      <CodeBlock
        title="what is running, longest first"
        language="sql"
        code={`SELECT pid, usename, application_name, state,
       wait_event_type, wait_event,
       now() - xact_start  AS xact_age,
       now() - query_start AS query_age,
       left(query, 60)     AS query
FROM pg_stat_activity
WHERE backend_type = 'client backend' AND state <> 'idle'
ORDER BY xact_start NULLS LAST;`}
      />
      <Table
        head={['pid', 'state', 'wait_event_type', 'wait_event', 'in transaction', 'query']}
        rows={activity.snapshot.map((r) => [String(r.pid), r.state, r.wait_event_type ?? '', r.wait_event ?? '', `${Math.max(0, r.xact_ms)} ms`, <code key="q">{r.query}</code>])}
      />

      <h3>Who blocks whom</h3>
      <p>
        A session in <code>Lock</code> waits for another to commit. <code>pg_blocking_pids(pid)</code> names the sessions in its way. Recorded:
        session <em>checkout</em> updated row 1 and stayed in its transaction; <em>refund</em> tried to update the same row.
      </p>
      <Flow
        title="One open transaction, one waiter"
        cols={3}
        rows={1}
        nodes={[
          { id: 'co', label: 'checkout', sub: `pid ${blocking.tree[0].pid} · idle in tx`, col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'row', label: 'row aid = 1', sub: 'pgbench_accounts', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'rf', label: 'refund', sub: `pid ${blocking.tree[1].pid} · waits`, col: 2, row: 0, hue: 8, shape: 'actor' },
        ]}
        edges={[
          { from: 'co', to: 'row', label: 'holds', hue: 1 },
          { from: 'rf', to: 'row', label: 'waits', hue: 8, dashed: true },
        ]}
      />
      <CodeBlock
        title="blocked sessions and their blockers"
        language="sql"
        code={`SELECT pid, application_name AS app, state, wait_event_type, wait_event,
       pg_blocking_pids(pid) AS blocked_by,
       now() - xact_start AS xact_age, left(query, 60) AS query
FROM pg_stat_activity
WHERE cardinality(pg_blocking_pids(pid)) > 0
   OR pid IN (SELECT unnest(pg_blocking_pids(pid)) FROM pg_stat_activity);`}
      />
      <Table
        head={['pid', 'app', 'state', 'wait', 'blocked_by', 'xact age', 'query']}
        rows={blocking.tree.map((r) => [String(r.pid), r.app, r.state, `${r.wait_type}: ${r.wait_event}`, r.blocked_by, `${r.xact_s} s`, <code key="q">{r.query}</code>])}
      />
      <p>The same story in <code>pg_locks</code>: refund holds its own locks but has not been granted a share lock on checkout’s transaction id.</p>
      <Table
        head={['pid', 'app', 'locktype', 'mode', 'granted', 'on']}
        rows={blocking.locks.map((l) => [String(l.pid), l.app, l.locktype, l.mode, l.granted ? 'yes' : 'NO — waiting', l.target])}
      />
      <CodeBlock
        title={`recorded: ending the blocker (pg_terminate_backend returned ${blocking.terminated})`}
        language="sql"
        code={`SELECT pg_cancel_backend(${blocking.tree[0].pid});     -- cancels the running query (not enough: checkout is idle)
SELECT pg_terminate_backend(${blocking.tree[0].pid});  -- ends the session; its transaction rolls back
-- refund's UPDATE then finished: ${blocking.waiterResult}`}
      />
      <Callout tone="warn" title="Idle in transaction">
        <p>
          A forgotten open transaction holds its locks and keeps vacuum from removing any row version newer than its snapshot. Recorded: a session
          with <code>idle_in_transaction_session_timeout = '2s'</code> showed as <em>{idle.seen.state}</em>, and was then cut off — the server log
          says:
        </p>
        <CodeBlock language="text" code={logs.idleTimeout ?? ''} />
        <p>
          The client only saw “{idle.fatal?.message}”. Set this timeout (for example 1–10 minutes) for application roles:{' '}
          <code>ALTER ROLE app_rw SET idle_in_transaction_session_timeout = '5min'</code>.
        </p>
      </Callout>

      <h2>The expensive queries: pg_stat_statements</h2>
      <p>
        <code>pg_stat_statements</code> adds up the time, rows and buffers of every query shape. The slowest single query is often not the
        problem; the one that costs most <em>in total</em> is.
      </p>
      <CodeBlock
        title="enable it (restart needed once), then create the extension in the database"
        language="ini"
        code={`# postgresql.conf
shared_preload_libraries = 'pg_stat_statements'
compute_query_id = auto          # the default; pg_stat_statements turns it on
pg_stat_statements.track = top   # top-level statements (all = also inside functions)
track_io_timing = on             # time spent reading/writing blocks (cheap on modern Linux)`}
      />
      <CodeBlock
        title="top queries by total time"
        language="sql"
        code={`CREATE EXTENSION pg_stat_statements;

SELECT left(query, 60) AS query, calls,
       round(total_exec_time) AS total_ms,
       round(mean_exec_time::numeric, 2) AS mean_ms, rows,
       round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 1) AS hit_pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 8;

SELECT pg_stat_statements_reset();   -- start a fresh measurement`}
      />
      <p>Recorded after 12 seconds of pgbench (8 clients) plus two extra clients running a report and an unindexed lookup:</p>
      <Table
        head={['query', 'calls', 'total ms', 'mean ms', 'rows', 'cache hit %']}
        rows={top.map((r) => [<code key="q">{r.query}</code>, fmt(r.calls), fmt(r.total_ms), String(r.mean_ms), fmt(r.rows), r.hit_pct === null ? '—' : String(r.hit_pct)])}
      />
      <Proportion
        title={`Where ${fmt(totalMs)} ms of execution time went`}
        parts={[
          ...top.slice(0, 4).map((r, i) => ({ label: short(r.query), value: r.total_ms, hue: ([8, 2, 4, 7] as Hue[])[i], display: `${fmt(r.total_ms)} ms` })),
          { label: 'everything else', value: totalMs - top.slice(0, 4).reduce((n, r) => n + r.total_ms, 0), hue: 3, display: `${fmt(totalMs - top.slice(0, 4).reduce((n, r) => n + r.total_ms, 0))} ms` },
        ]}
      />
      <p>Reading it:</p>
      <ul>
        <li>
          The branch <code>UPDATE</code> is fast alone but runs {fmt(top[0].calls)} times and waits on row locks: most of its time is waiting.
          Fewer hot rows (or fewer concurrent writers to them) would help, not an index.
        </li>
        <li>
          The lookup by <code>abalance</code> averages {top.find((r) => r.query.includes('abalance = $1'))?.mean_ms} ms, returns no rows and
          reads half its blocks from outside shared buffers: a sequential scan of {bytes(accountsSize)}. An index fixes it (see{' '}
          <a href="#/postgres/indexes">B-tree indexes</a>).
        </li>
        <li>The report is honest work over every row; schedule it, or run it on a replica.</li>
      </ul>

      <h2>Tables: scans, dead tuples, vacuum</h2>
      <p>
        <code>pg_stat_user_tables</code> counts, per table, how it was read and changed. Many sequential scans on a big table point to a missing
        index; many dead tuples point to vacuum falling behind.
      </p>
      <Table
        head={['table', 'seq_scan', 'idx_scan', 'n_live_tup', 'n_dead_tup', 'HOT updates', 'last autovacuum']}
        rows={statements.tables.map((t) => [
          t.relname,
          fmt(t.seq_scan),
          fmt(t.idx_scan),
          fmt(t.n_live_tup),
          fmt(t.n_dead_tup),
          t.n_tup_upd ? `${Math.round((t.n_tup_hot_upd / t.n_tup_upd) * 100)} %` : '—',
          t.autovacuum_s_ago === null ? 'not yet' : `${t.autovacuum_s_ago} s ago`,
        ])}
      />
      <CodeBlock
        title="tables by dead tuples, with their last vacuum"
        language="sql"
        code={`SELECT relname, seq_scan, idx_scan, n_live_tup, n_dead_tup,
       round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
       last_autovacuum, last_autoanalyze, autovacuum_count
FROM pg_stat_user_tables
ORDER BY n_dead_tup DESC
LIMIT 10;`}
      />

      <h2>The cache: hit ratio and what is in it</h2>
      <p>
        Every page PostgreSQL reads is looked up in <code>shared_buffers</code> first. A “hit” costs nothing; a “read” goes to the operating
        system, which may still have it in its own page cache.
      </p>
      <StatTiles
        stats={[
          { label: 'cache hit ratio, database lab', value: `${statements.db.ratio} %`, sub: `${fmt(statements.db.hit)} hits, ${fmt(statements.db.read)} reads`, hue: statements.db.ratio > 95 ? 6 : 8, bar: { value: statements.db.ratio, max: 100 } },
          { label: 'shared_buffers', value: setting('shared_buffers').value, sub: `${fmt(sb.total)} pages of 8 kB`, hue: 3 },
          { label: 'pgbench_accounts table', value: bytes(accountsSize), sub: 'bigger than the whole cache', hue: 4 },
        ]}
      />
      <p>
        A ratio of {statements.db.ratio} % looks alarming, and here it is explained: the report and the lookup scanned a table twice the size of
        the cache. Large sequential scans use a small ring of buffers on purpose, so one scan cannot flush everyone else’s pages. The pgbench
        updates of branches and tellers found their pages in the cache almost every time (the table above). A typical OLTP database should sit above 99 %; check the trend, and look per table:
      </p>
      <Proportion
        title={`Recorded with pg_buffercache: what the ${fmt(sb.total)} shared buffers held after the run`}
        parts={sb.top.map((b, i) => ({ label: b.rel, value: b.buffers, hue: ([3, 7, 2, 5, 1, 4, 6] as Hue[])[i % 7], display: `${fmt(b.buffers)} pages` }))}
      />
      <CodeBlock
        title="hit ratio per database and per table"
        language="sql"
        code={`SELECT datname, round(100.0 * blks_hit / nullif(blks_hit + blks_read, 0), 2) AS hit_pct
FROM pg_stat_database WHERE datname IS NOT NULL;

SELECT relname, heap_blks_hit, heap_blks_read, idx_blks_hit, idx_blks_read
FROM pg_statio_user_tables ORDER BY heap_blks_read DESC LIMIT 10;

CREATE EXTENSION pg_buffercache;   -- what is in shared_buffers, by relation
SELECT c.relname, count(*) AS buffers
FROM pg_buffercache b JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
WHERE b.reldatabase = (SELECT oid FROM pg_database WHERE datname = current_database())
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;`}
      />

      <h3>pg_stat_io (PostgreSQL 16+)</h3>
      <p>
        <code>pg_stat_io</code> splits every read, write, extend and fsync by <em>who</em> did it (client backends, autovacuum, the
        checkpointer…), <em>what</em> (tables, or since 18 the WAL) and <em>how</em> (normal, bulk read, vacuum). PostgreSQL 18 also counts bytes.
      </p>
      <Table
        head={['backend_type', 'object', 'context', 'reads', 'read', 'writes', 'hits', 'fsyncs']}
        rows={statements.io.slice(0, 7).map((r) => [r.backend_type, r.object, r.context, fmt(r.reads ?? 0), bytes(r.read_bytes ?? 0), fmt(r.writes ?? 0), fmt(r.hits ?? 0), r.fsyncs === null ? '—' : fmt(r.fsyncs)])}
      />
      <p>
        The bulk reads (the report and the lookup, and the parallel workers helping them) did most of the reading; client backends fsynced the
        WAL {fmt(statements.io.find((r) => r.backend_type === 'client backend' && r.object === 'wal')?.fsyncs ?? 0)} times — once per group of
        commits.
      </p>

      <h2>Replication lag</h2>
      <p>
        On a primary, <code>pg_stat_replication</code> has one row per connected standby; on a standby, compare what arrived with what was
        replayed. Slots that nobody reads keep WAL forever. Not recorded here (one server) — see{' '}
        <a href="#/postgres/replication">Replication and failover</a> for the full story.
      </p>
      <CodeBlock
        title="on the primary (not recorded: needs a standby)"
        language="sql"
        code={`SELECT application_name, state, sync_state,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn)) AS replay_behind,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;`}
      />
      <CodeBlock title="on a standby (not recorded)" language="sql" code={`SELECT now() - pg_last_xact_replay_timestamp() AS replay_delay;   -- grows when the primary is idle, too`} />

      <h2>The server log</h2>
      <p>The log explains what the views only count: which statement was slow, what it waited for, what autovacuum did.</p>
      <Table
        head={['setting', 'default', 'suggested', 'what you get']}
        rows={[
          ['log_min_duration_statement', '-1 (off)', '250ms … 1s', 'every statement slower than this, with its duration'],
          ['auto_explain.log_min_duration', '-1 (off)', '1s', 'the plan of slow statements (load auto_explain via shared_preload_libraries)'],
          ['log_lock_waits', setting('log_lock_waits').default, 'on', 'a line when a lock wait exceeds deadlock_timeout (1 s)'],
          ['log_temp_files', '-1 (off)', '0 or 10MB', 'sorts and hashes that spilled to disk: work_mem too small'],
          ['log_autovacuum_min_duration', '10min', '1s … 1min', 'what each autovacuum run removed and how long it took'],
          ['log_checkpoints', setting('log_checkpoints').default, 'on', 'each checkpoint, its cause and its timing'],
        ]}
      />
      <CodeBlock
        title="turning them on (no restart: reload)"
        language="sql"
        code={`ALTER SYSTEM SET log_min_duration_statement = '250ms';
ALTER SYSTEM SET auto_explain.log_min_duration = '200ms';
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_temp_files = 0;
ALTER SYSTEM SET log_autovacuum_min_duration = 0;
SELECT pg_reload_conf();`}
      />
      <Tabs
        items={[
          { label: 'slow statement', content: <CodeBlock title="recorded" language="text" code={logs.slow ?? ''} /> },
          { label: 'auto_explain', content: <CodeBlock title="recorded" language="text" code={logs.autoExplain ?? ''} /> },
          { label: 'lock wait', content: <CodeBlock title="recorded (the blocking example above)" language="text" code={logs.lockWait ?? ''} /> },
          { label: 'temp file', content: <CodeBlock title="recorded (the work_mem example below)" language="text" code={logs.tempFile ?? ''} /> },
          { label: 'autovacuum', content: <CodeBlock title="recorded" language="text" code={logs.autovacuum ?? ''} /> },
          { label: 'checkpoint', content: <CodeBlock title="recorded" language="text" code={logs.checkpoint ?? ''} /> },
        ]}
      />
      <Callout tone="note" title="A recorded surprise">
        The auto_explain example is a one-row <code>UPDATE</code> by primary key that took a quarter of a second — not a bad plan, but a wait
        for a row lock. When a fast plan is slow, look at the waits.
      </Callout>

      <h2>Memory settings</h2>
      <p>Four settings decide how PostgreSQL uses memory. Only one of them is allocated at start; the others are limits or hints.</p>
      <Table
        head={['setting', `default (${version})`, 'context', 'what it is']}
        rows={['shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem', 'autovacuum_work_mem', 'hash_mem_multiplier', 'max_connections'].map((n) => {
          const s = setting(n)
          const what: Record<string, string> = {
            shared_buffers: 'PostgreSQL’s own page cache, allocated once at start',
            effective_cache_size: 'planner hint: how much the OS + shared_buffers can cache; allocates nothing',
            work_mem: 'per sort or hash operation, per query node — a query can use several',
            maintenance_work_mem: 'VACUUM, CREATE INDEX, ALTER TABLE ADD FOREIGN KEY',
            autovacuum_work_mem: 'each autovacuum worker (-1 = use maintenance_work_mem)',
            hash_mem_multiplier: 'hash tables may use work_mem × this',
            max_connections: 'each connection can use work_mem several times over',
          }
          return [<code key="n">{n}</code>, s.value, s.context === 'postmaster' ? 'restart' : s.context === 'user' ? 'per session' : 'reload', what[n]]
        })}
      />
      <p>
        Recorded: the same sort of 500,000 rows with the default <code>work_mem</code> and with a larger one. With too little memory the sort
        spills to temporary files:
      </p>
      <BarChart
        title="ORDER BY over 500,000 rows: execution time"
        bars={workMem.map((w, i) => ({ label: `work_mem = ${w.workMem}`, value: w.executionMs, display: `${w.executionMs} ms`, hue: (i === 0 ? 8 : 6) as Hue, note: w.method }))}
        unit=" ms"
      />
      <Tabs items={workMem.map((w) => ({ label: `work_mem = ${w.workMem}`, content: <CodeBlock title="EXPLAIN (ANALYZE, BUFFERS) — recorded" language="text" code={w.plan} /> }))} />
      <p>
        The time difference is small here because the temporary files stayed in the OS cache; on a busy server they cost real disk I/O. Do not
        simply raise <code>work_mem</code> globally: a hundred connections each sorting with several nodes multiply it. Raise it for the
        session or role that needs it (<code>SET work_mem = '256MB'</code> in a report job), and size the default from the machine:
      </p>
      <MonitoringMemory />

      <h2>Tuning autovacuum</h2>
      <p>
        Autovacuum vacuums a table once its dead tuples exceed{' '}
        <code>autovacuum_vacuum_threshold + autovacuum_vacuum_scale_factor × rows</code>. With the defaults (50 + 20 %), a table of 2 million
        rows waits for 400,050 dead tuples. Recorded: pgbench for 60 seconds, three times, counting dead tuples in{' '}
        <code>pgbench_accounts</code> every second.
      </p>
      <MonitoringLineChart
        title="Recorded: dead tuples in pgbench_accounts (2 million rows) during 60 s of pgbench"
        series={avRuns.map((r, i) => ({ label: r.label, hue: RUN_HUES[i], dashed: i === 1, points: r.samples.map((s) => ({ x: s.s, y: s.dead })) }))}
        xUnit="s"
        yLabel="n_dead_tup"
        caption={`Off and defaults: dead tuples only grow (${fmt(maxDead(0))} and ${fmt(maxDead(1))}); the defaults would act at 400,050. Tuned: ${tunedVacuums} autovacuum runs in the minute, each bringing the count back near zero. Most updates here were HOT, so page pruning also removed many dead tuples without vacuum.`}
      />
      <CodeBlock
        title="per table (big, busy tables), or globally in postgresql.conf"
        language="sql"
        code={`ALTER TABLE pgbench_accounts SET (
  autovacuum_vacuum_scale_factor = 0.01,   -- 1 % instead of 20 %
  autovacuum_vacuum_threshold    = 1000
);
ALTER SYSTEM SET autovacuum_naptime = '10s';  -- how often each database is checked (default 1min)
SELECT pg_reload_conf();`}
      />
      <Table
        head={['setting', `default (${version})`, 'when to change it']}
        rows={[
          ['autovacuum_vacuum_scale_factor', setting('autovacuum_vacuum_scale_factor').value, 'lower (0.01–0.05) for large tables, per table'],
          ['autovacuum_vacuum_threshold', setting('autovacuum_vacuum_threshold').value, 'raise together with a low scale factor'],
          ['autovacuum_vacuum_max_threshold (new in 18)', fmt(Number(setting('autovacuum_vacuum_max_threshold').value)), 'caps the threshold for huge tables'],
          ['autovacuum_vacuum_insert_scale_factor', setting('autovacuum_vacuum_insert_scale_factor').value, 'insert-only tables also get vacuumed (visibility map, freezing)'],
          ['autovacuum_vacuum_cost_limit / _delay', `${setting('autovacuum_vacuum_cost_limit').value} (uses 200) / ${setting('autovacuum_vacuum_cost_delay').value}`, 'raise the limit (1000–2000) on fast disks so vacuum keeps up'],
          ['autovacuum_max_workers', setting('autovacuum_max_workers').value, `more tables vacuumed at once; 18 can change it with a reload (up to autovacuum_worker_slots = ${setting('autovacuum_worker_slots').value})`],
          ['autovacuum_naptime', setting('autovacuum_naptime').value, 'lower for many busy tables'],
        ]}
      />
      <p>
        Watch transaction-id age too: if autovacuum cannot freeze old rows, the database stops accepting writes before wraparound. Recorded age
        here: {fmt(xidAge[0].xid_age)} of the {fmt(xidAge[0].freeze_max_age)} at which an anti-wraparound vacuum is forced (see{' '}
        <a href="#/postgres/vacuum">Dead tuples, HOT and VACUUM</a>).
      </p>

      <h2>Alerts worth having</h2>
      <p>Graph the counters, but page someone only for what needs a human:</p>
      <Table
        head={['Alert', 'Query (source)', 'Warn when', 'Why']}
        rows={[
          ['connections near the limit', 'count(*) FROM pg_stat_activity', '> 80 % of max_connections', 'the next deploy cannot connect'],
          ['long idle in transaction', 'now() - state_change WHERE state = \'idle in transaction\'', '> 5 min', 'holds locks, blocks vacuum'],
          ['long-running query', 'now() - query_start WHERE state = \'active\'', '> your SLA (e.g. 5 min)', 'runaway query, missing index'],
          ['blocked sessions', 'cardinality(pg_blocking_pids(pid)) > 0', 'any for > 1 min', 'a lock queue is building'],
          ['transaction-id age', 'age(datfrozenxid) FROM pg_database', '> 50 % of 2 billion', 'wraparound protection will stop writes'],
          ['replication lag / slot WAL', 'pg_stat_replication, pg_replication_slots', 'lag > 1 min; retained WAL > 10 % of disk', 'stale reads; disk fills up'],
          ['dead tuples', 'n_dead_tup / n_live_tup', '> 20 % on a big table', 'vacuum is not keeping up'],
          ['cache hit ratio', 'pg_stat_database', '< 99 % for OLTP (trend)', 'working set outgrew memory'],
          ['deadlocks, rollbacks, temp files', 'pg_stat_database deltas', 'sudden increase', 'application or memory problem'],
          ['disk space', 'filesystem; pg_database_size()', '> 80 %', 'PostgreSQL stops when the WAL disk is full'],
          ['checkpoints requested', 'pg_stat_checkpointer.num_requested', 'more than timed ones', 'max_wal_size too small for the write rate'],
        ]}
      />
      <p>
        During this recording, <code>pg_stat_checkpointer</code> counted {M.statements.checkpointer.num_requested} requested and{' '}
        {M.statements.checkpointer.num_timed} timed checkpoints — the heavy pgbench runs filled the default <code>max_wal_size</code> (
        {setting('max_wal_size').value}) again and again. On a production server with this write rate, raise it.
      </p>
      <Callout tone="tip" title="Use an exporter">
        Tools such as postgres_exporter (Prometheus), pgwatch or your cloud provider’s metrics run these queries on a schedule and store the
        differences. The queries on this page are what they run underneath — useful when the dashboard does not answer your question.
      </Callout>

      <h2>Checklist</h2>
      <ul>
        <li>
          <code>shared_preload_libraries = 'pg_stat_statements,auto_explain'</code> and <code>track_io_timing = on</code> from day one (needs a
          restart).
        </li>
        <li>Logging: slow statements (250 ms – 1 s), lock waits, temp files, autovacuum runs, checkpoints.</li>
        <li>Every application sets <code>application_name</code>; application roles get <code>idle_in_transaction_session_timeout</code> and a <code>statement_timeout</code>.</li>
        <li>Memory: shared_buffers ≈ 25 % of RAM, effective_cache_size ≈ 75 %, a modest work_mem raised per job.</li>
        <li>Big, busy tables get a per-table autovacuum scale factor of 1–5 %.</li>
        <li>Alerts on connections, long transactions, blocking, xid age, replication lag, disk.</li>
        <li>When slow: pg_stat_activity (waits) → pg_stat_statements (totals) → EXPLAIN (ANALYZE, BUFFERS) on the worst one.</li>
      </ul>

      <Recap
        points={[
          'pg_stat_activity shows the present: state and wait event per session. Many active sessions are usually waiting, not running.',
          'pg_stat_statements ranks query shapes by total time — fix the top of that list first.',
          'Statistics views are cumulative counters: watch their change over time, and per table.',
          'The log explains the counters: slow statements with plans, lock waits, temp files, autovacuum.',
          'shared_buffers is allocated; work_mem is per operation and multiplies; autovacuum needs lower thresholds on big tables.',
        ]}
      />
    </>
  )
}
