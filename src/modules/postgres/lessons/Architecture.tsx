import { BarChart, Flow, Proportion, StatTiles, Timeline, type FlowNode } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { ArchitectureBufferCache } from '../components/ArchitectureBufferCache'
import { CAPTURE } from '../data/captures'
import { INTERNALS, INTERNALS_VERSION } from '../data/internals'

const A = INTERNALS.architecture
const setting = (name: string) => A.settings.find((s) => s.name === name)!
/** A setting in bytes, from its value and unit as pg_settings reports them. */
const bytesOf = (name: string) => {
  const s = setting(name)
  const unit = s.unit === '8kB' ? 8192 : s.unit === 'kB' ? 1024 : 1
  return Number(s.setting) * unit
}
const mb = (b: number) => (b >= 1024 ** 3 ? `${b / 1024 ** 3} GB` : `${b / 1024 ** 2} MB`)

// the recorded process list, grouped by process type
const procs = A.ps.split('\n').slice(1).map((l) => l.trim().split(/\s+/).slice(2).join(' '))
const count = (prefix: string) => procs.filter((p) => p.startsWith(`postgres: ${prefix}`)).length
const BACKEND = procs.find((p) => / lab \[local\]/.test(p))!

/** "shared read=3" / "shared hit=1 read=636" from an EXPLAIN (BUFFERS) plan's first Buffers line. */
const buffers = (plan: string) => {
  const line = plan.split('\n').find((l) => l.includes('Buffers: shared'))!
  return { hit: Number(line.match(/hit=(\d+)/)?.[1] ?? 0), read: Number(line.match(/read=(\d+)/)?.[1] ?? 0) }
}
const pointCold = buffers(A.pointCold)
const pointWarm = buffers(A.pointWarm)
const scanCold = buffers(A.scanCold)
const scanWarm = buffers(A.scanWarm)
const usage = (rows: readonly { usagecount: number; buffers: number }[]) => [1, 2, 3, 4, 5].map((u) => rows.find((r) => r.usagecount === u)?.buffers ?? 0)

const insert = CAPTURE.wal.find((w) => w.label === 'insert')!
const walLines = insert.records.map((r) => `${r.start_lsn.padEnd(11)} ${r.resource_manager.padEnd(12)} ${r.record_type.padEnd(12)} ${r.description}`).join('\n')

const C = A.commits
const files = A.files
const relLines = files.relFiles.split('\n').map((l) => {
  const [size, path] = l.split(' ')
  return { size: Number(size), path }
})

const PROCESS_NODES: FlowNode[] = [
  { id: 'app', label: 'your app', sub: 'one connection', col: 0, row: 0, hue: 1, shape: 'actor' },
  { id: 'pm', label: 'postmaster', sub: 'PID 1, listens on 5432', col: 1, row: 0, span: 2, hue: 7 },
  { id: 'recv', label: 'pg_receivewal', sub: 'streams the WAL', col: 3, row: 0, hue: 5, shape: 'actor' },
  { id: 'backend', label: 'client backend', sub: 'runs your SQL', col: 0, row: 1, hue: 1 },
  { id: 'avw', label: `autovacuum worker`, sub: 'cleans one table', col: 1, row: 1, hue: 3 },
  { id: 'io', label: `io worker ×${count('io worker')}`, sub: 'reads pages (18)', col: 2, row: 1, hue: 4 },
  { id: 'walsender', label: 'walsender', sub: 'one per replica', col: 3, row: 1, hue: 5 },
  { id: 'ckpt', label: 'checkpointer', sub: 'all dirty pages', col: 0, row: 2, hue: 4 },
  { id: 'avl', label: 'autovac. launcher', sub: 'picks tables', col: 1, row: 2, hue: 3 },
  { id: 'bgw', label: 'background writer', sub: 'some dirty pages', col: 2, row: 2, hue: 4 },
  { id: 'walw', label: 'walwriter', sub: 'flushes WAL', col: 3, row: 2, hue: 4 },
]

export default function Architecture() {
  return (
    <>
      <LessonGoals
        goals={[
          'name the processes of a running server and say what each one does',
          'follow one query through parser, rewriter, planner and executor',
          'explain shared buffers, hits and reads, and how the clock sweep chooses what to evict',
          'say exactly where a change is when COMMIT returns',
          'find a table’s files in the data directory',
        ]}
        before={<>running SQL from <a href="#/postgres/using-postgres">Using PostgreSQL day to day</a></>}
      />

      <h2>A server is a family of processes</h2>
      <p>
        PostgreSQL runs as several cooperating operating-system processes, not as one process with threads. The first one, the{' '}
        <strong>postmaster</strong>, listens for connections and starts a new <strong>backend</strong> process for every client. A handful of
        background processes do the housekeeping.
      </p>
      <p>
        This is the real process list of the {INTERNALS_VERSION} server used for these lessons, recorded while one client ran a query, a WAL
        receiver was attached and autovacuum was cleaning a table:
      </p>
      <Flow
        title="Recorded: every process is a child of the postmaster"
        cols={4}
        rows={3}
        rowHeight={80}
        nodes={PROCESS_NODES}
        edges={[
          { from: 'app', to: 'pm', hue: 1 },
          { from: 'app', to: 'backend', label: 'SQL', hue: 1, flow: true },
          { from: 'recv', to: 'walsender', label: 'replication', hue: 5, both: true },
          { from: 'avl', to: 'avw', label: 'start', hue: 3, dashed: true },
        ]}
        caption={`The app connects to the postmaster, which forks a backend; from then on the app talks only to that backend. In the ps output below every server process has PPID 1, the postmaster. The postmaster forked “${BACKEND}” for the client. The logical replication launcher (not drawn) starts workers for logical subscriptions.`}
      />
      <CodeBlock title="recorded: ps -eo pid,ppid,cmd   (inside the server's container)" language="text" code={A.ps} />
      <TermList
        items={[
          { term: 'postmaster', definition: 'The first server process. Accepts connections, forks backends, restarts any child that dies (after a crash it resets every backend).' },
          { term: 'backend', definition: 'The process that serves one client connection for its whole life. Its ps title shows user, database, client and the current command.' },
          { term: 'background writer', definition: 'Writes some dirty pages ahead of time, so backends rarely have to write one themselves before reusing a buffer.' },
          { term: 'checkpointer', definition: 'At every checkpoint writes all dirty pages and records a redo point: crash recovery starts from there.' },
          { term: 'walwriter', definition: 'Flushes WAL buffers to disk in the background (for asynchronous commits, and to keep the buffers empty).' },
          { term: 'autovacuum', definition: 'The launcher picks tables that need VACUUM or ANALYZE and starts a worker for each.' },
          { term: 'io worker', definition: 'New in PostgreSQL 18: performs reads for asynchronous I/O (io_method = worker, the default; 3 workers).' },
          { term: 'walsender', definition: 'Streams WAL to one replica or backup client.' },
        ]}
      />
      <Callout tone="note" title="One process per connection">
        Every connection costs a process and its private memory (several MB once it has run queries). That is why <code>max_connections</code> is{' '}
        {setting('max_connections').setting} by default and applications use a pool — see <a href="#/postgres/pooling">Connection pooling</a>.
      </Callout>
      <p>The same processes, seen from SQL. <code>wait_event</code> says what each one is doing right now:</p>
      <CodeBlock title="recorded: pg_stat_activity" language="text" code={A.activityText} />

      <h2>Memory: shared and private</h2>
      <p>
        All processes share one big block of memory, mostly the page cache called <strong>shared buffers</strong>; each backend also has private
        memory for sorting and hashing.
      </p>
      <StatTiles
        title={`Recorded: the default memory settings of ${INTERNALS_VERSION}`}
        stats={[
          { label: 'shared_buffers', value: mb(bytesOf('shared_buffers')), sub: `${Number(setting('shared_buffers').setting).toLocaleString()} buffers of 8 kB, shared`, hue: 3 },
          { label: 'wal_buffers', value: mb(bytesOf('wal_buffers')), sub: '1/32 of shared_buffers, shared', hue: 4 },
          { label: 'work_mem', value: mb(bytesOf('work_mem')), sub: 'per sort or hash, per backend', hue: 1 },
          { label: 'maintenance_work_mem', value: mb(bytesOf('maintenance_work_mem')), sub: 'VACUUM, CREATE INDEX', hue: 1 },
        ]}
      />
      <TermList
        items={[
          { term: 'shared buffers', definition: 'Copies of 8 kB pages from the data files. Every read and every change of a table or index goes through them.' },
          { term: 'dirty page', definition: 'A buffer changed in memory and not yet written back to its data file.' },
          { term: 'WAL buffers', definition: 'Recently generated write-ahead log records, not yet written to pg_wal/.' },
          { term: 'work_mem', definition: 'Private memory one sort or hash may use before it spills to temporary files. A query can use several multiples of it.' },
        ]}
      />
      <Callout tone="tip" title="Sizing">
        A dedicated server typically gets <code>shared_buffers</code> ≈ 25 % of RAM. The rest is not wasted: the operating system caches the same
        files, so a “read” in PostgreSQL’s statistics is often a copy from the OS page cache rather than from the disk.
      </Callout>

      <h2>The path of a query</h2>
      <p>A statement passes four stages inside its backend before the first row comes back.</p>
      <Flow
        title="One SELECT inside a backend"
        cols={4}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'client', label: 'client', sub: 'SELECT … paid_orders', col: 0, row: 0, rowSpan: 2, hue: 1, shape: 'actor' },
          { id: 'parse', label: 'parser', sub: 'text → parse tree', col: 1, row: 0, hue: 7 },
          { id: 'rewrite', label: 'rewriter', sub: 'views, rules', col: 2, row: 0, hue: 7 },
          { id: 'plan', label: 'planner', sub: 'cheapest plan', col: 3, row: 0, hue: 7 },
          { id: 'exec', label: 'executor', sub: 'runs the plan', col: 3, row: 1, hue: 1 },
          { id: 'buf', label: 'shared buffers', sub: '8 kB pages', col: 3, row: 2, hue: 3, shape: 'store' },
          { id: 'disk', label: 'data files', sub: 'base/…', col: 2, row: 2, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'client', to: 'parse', hue: 1 },
          { from: 'parse', to: 'rewrite', hue: 7 },
          { from: 'rewrite', to: 'plan', hue: 7 },
          { from: 'plan', to: 'exec', hue: 7 },
          { from: 'exec', to: 'buf', label: 'get page', hue: 3, both: true },
          { from: 'buf', to: 'disk', label: 'miss', hue: 4, dashed: true },
          { from: 'exec', to: 'client', label: 'rows', hue: 6, flow: true },
        ]}
        steps={[
          { title: 'Parse', body: <p>The text is checked for syntax and turned into a parse tree; names are then looked up in the system catalogs (does <code>paid_orders</code> exist, what are its columns and types?).</p>, active: ['client', 'parse', 'client>parse'] },
          { title: 'Rewrite', body: <p>The rule system replaces every view with its definition. <code>paid_orders</code> becomes <code>orders WHERE status = 'paid'</code> — the recorded plan below never mentions the view.</p>, active: ['parse', 'rewrite', 'parse>rewrite'] },
          { title: 'Plan', body: <p>The planner considers scans and join orders, estimates their cost from table statistics, and keeps the cheapest: here an index scan on the primary key. See <a href="#/postgres/query-planning">Query planning and EXPLAIN</a>.</p>, active: ['rewrite', 'plan', 'rewrite>plan'] },
          { title: 'Execute', body: <p>The executor runs the plan as a tree of nodes, each pulling rows from the one below. Every page it needs is requested from shared buffers; only a miss goes to the data file.</p>, active: ['plan', 'exec', 'buf', 'disk', 'plan>exec', 'exec>buf', 'buf>disk'] },
          { title: 'Return rows', body: <p>Rows stream back to the client as they are produced; a big result does not have to fit in memory first.</p>, active: ['exec', 'client', 'exec>client'] },
        ]}
      />
      <CodeBlock title="recorded: the view is gone after rewriting" language="text" code={A.rewrite} />

      <h2>Shared buffers: hits and reads</h2>
      <p>Before a backend can use a page it must be in shared buffers: a <strong>hit</strong> finds it there, a <strong>read</strong> loads it first.</p>
      <p>
        <code>EXPLAIN (ANALYZE, BUFFERS)</code> counts both. The recording first emptied the cache for the table with{' '}
        <code>pg_buffercache_evict_relation()</code> (new in 18), then ran each query twice:
      </p>
      <StatTiles
        stats={[
          { label: 'lookup by id, cold', value: `${pointCold.read} reads`, sub: 'index root, index leaf, heap page', hue: 4 },
          { label: 'same lookup, warm', value: `${pointWarm.hit} hits`, sub: 'no I/O at all', hue: 6 },
          { label: 'count(*), cold', value: `${scanCold.read} reads`, sub: `${scanCold.hit} hit — the table has ${A.ordersPages} pages`, hue: 4 },
          { label: 'count(*), warm', value: `${scanWarm.hit} hits`, sub: 'every page already cached', hue: 6 },
        ]}
      />
      <CodeBlock title="recorded: the same lookup, cold then warm" language="text" code={`${A.pointCold}\n\n${A.pointWarm}`} />
      <p>
        Shared buffers are full most of the time, so a read must <strong>evict</strong> some other page. PostgreSQL does not keep an exact LRU
        list; it uses a <strong>clock sweep</strong>: each buffer has a usage count from 0 to 5, every access raises it, and a clock hand going
        round the buffers lowers it. The first buffer the hand finds at 0 is reused.
      </p>
      <BarChart
        title={`Recorded (pg_buffercache): usage counts of the table's ${A.ordersPages} buffers after 2 scans`}
        bars={usage(A.usageAfter2).map((n, i) => ({ label: `usage ${i + 1}`, value: n, hue: 3 }))}
        max={A.ordersPages}
      />
      <BarChart
        title="… and after 4 more scans: every page has reached the maximum"
        bars={usage(A.usageAfter6).map((n, i) => ({ label: `usage ${i + 1}`, value: n, hue: 3 }))}
        max={A.ordersPages}
      />
      <Predict
        question={<p>Pages p1–p3 are read over and over. Then a one-off scan reads 11 other pages through 8 buffers. Do p1–p3 survive?</p>}
        options={['No — the scan pushes them out like any LRU', 'Yes — their high usage counts make the hand pass them several times', 'Only p1']}
        answer={1}
        explanation="Frequently used pages collect usage counts up to 5; one pass of the hand only lowers each count by one, so the scan’s fresh pages (count 1) are evicted first. Try it, then press “hot pages again”."
      />
      <ArchitectureBufferCache />
      <Callout tone="note" title="Big scans use a ring">
        A sequential scan of a table larger than a quarter of shared buffers, VACUUM and COPY do not use the whole cache: they cycle through a small
        private ring of buffers (256 kB for scans), so one report cannot flush everyone else’s hot pages.
      </Callout>

      <h2>The path of a commit</h2>
      <p>A change is durable once its WAL record is on disk — the table’s own file is written much later.</p>
      <Flow
        title="One INSERT and its COMMIT"
        cols={4}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'client', label: 'client', sub: 'INSERT, COMMIT', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'backend', label: 'backend', sub: 'one per connection', col: 1, row: 0, hue: 1 },
          { id: 'buf', label: 'shared buffers', sub: 'page now dirty', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'walbuf', label: 'WAL buffers', sub: 'records in memory', col: 1, row: 1, hue: 4 },
          { id: 'wal', label: 'pg_wal/', sub: '16 MB segments', col: 1, row: 2, hue: 4, shape: 'log' },
          { id: 'writer', label: 'bgwriter', sub: 'or checkpointer', col: 3, row: 1, hue: 4 },
          { id: 'data', label: 'data file', sub: `base/${files.dbOid}/…`, col: 2, row: 2, span: 2, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'client', to: 'backend', hue: 1, both: true },
          { from: 'backend', to: 'buf', label: 'edit', hue: 3 },
          { from: 'backend', to: 'walbuf', label: 'log it', hue: 4 },
          { from: 'walbuf', to: 'wal', label: 'fsync', hue: 4, flow: true },
          { from: 'buf', to: 'writer', hue: 4, dashed: true },
          { from: 'writer', to: 'data', label: 'later', hue: 4, dashed: true },
        ]}
        steps={[
          { title: 'Change the page in memory', body: <p>The backend finds the table’s page in shared buffers, adds the new tuple and marks the buffer dirty. Nothing is on disk yet.</p>, active: ['client', 'backend', 'buf', 'client>backend', 'backend>buf'] },
          { title: 'Describe the change in the WAL', body: <p>In the same step a WAL record saying exactly what changed (heap insert, index insert) goes into the WAL buffers. The rule: a dirty page may never reach its data file before its WAL record is on disk. The recording below shows the real records.</p>, active: ['backend', 'walbuf', 'backend>walbuf'] },
          { title: 'COMMIT: flush the WAL', body: <p>COMMIT adds a commit record, then writes and <code>fsync</code>s the WAL up to it. Only then does the client get <code>COMMIT</code> back. This one sequential write is the whole cost of durability.</p>, active: ['client', 'backend', 'walbuf', 'wal', 'walbuf>wal', 'client>backend'] },
          { title: 'Data files catch up later', body: <p>The dirty page is written to its data file by the background writer, the checkpointer or a backend that needs the buffer — seconds or minutes later. After a crash, replaying the WAL rebuilds it: see <a href="#/postgres/wal">WAL and crash recovery</a>.</p>, active: ['buf', 'writer', 'data', 'buf>writer', 'writer>data'] },
        ]}
      />
      <CodeBlock title={`recorded (pg_walinspect): the WAL records of ${insert.sql}`} language="text" code={walLines} />
      <Predict
        question={<p>A client runs an INSERT and gets <code>COMMIT</code> back. Where is the change now guaranteed to be on disk?</p>}
        options={['In the table’s data file', 'In the WAL', 'In both', 'Nowhere yet']}
        answer={1}
        explanation="COMMIT waits only for the WAL flush. The changed page stays in shared buffers and reaches the data file later; after a crash it is rebuilt from the WAL."
      />
      <p>
        So every commit pays for one <code>fsync</code>. The recording inserted {C.n.toLocaleString()} rows three ways and counted the WAL fsyncs in{' '}
        <code>pg_stat_io</code>:
      </p>
      <BarChart
        title={`Recorded: ${C.n.toLocaleString()} one-row INSERTs, total time in ms`}
        bars={[
          { label: `${C.n.toLocaleString()} transactions`, value: C.each.ms, display: `${Math.round(C.each.ms)} ms · ${C.each.fsyncs} fsyncs`, hue: 4 },
          { label: 'same, synchronous_commit = off', value: C.eachAsync.ms, display: `${C.eachAsync.ms.toFixed(1)} ms · ${C.eachAsync.fsyncs} fsyncs`, hue: 8 },
          { label: 'one transaction', value: C.oneTx.ms, display: `${C.oneTx.ms.toFixed(1)} ms · ${C.oneTx.fsyncs} fsync`, hue: 6 },
        ]}
      />
      <Callout tone="warn" title="synchronous_commit = off is a trade">
        It returns before the flush (the walwriter flushes within about 3 × <code>wal_writer_delay</code> = 600 ms). A crash can lose the last
        commits the client was told had succeeded — but never corrupts the database. Batching many rows into one transaction is the safe way to
        get the same speed.
      </Callout>
      <Timeline
        title="Schematic: when each copy of one change reaches disk"
        lanes={[
          { id: 'mem', label: 'shared buffers' },
          { id: 'wal', label: 'pg_wal/' },
          { id: 'data', label: 'data file' },
        ]}
        segments={[
          { lane: 'mem', from: 0, to: 60, label: 'dirty page in memory', hue: 3 },
          { lane: 'wal', from: 1, to: 60, label: 'durable from COMMIT on', hue: 4 },
          { lane: 'data', from: 42, to: 60, label: 'written at checkpoint', hue: 4 },
        ]}
        events={[
          { lane: 'wal', at: 1, label: 'COMMIT returns', hue: 6 },
          { lane: 'data', at: 42, label: 'checkpoint', hue: 4 },
        ]}
        end={60}
        unit="s"
      />

      <h2>Files on disk</h2>
      <p>Everything lives under one <strong>data directory</strong> (<code>$PGDATA</code>), and every table and index is a plain file in it.</p>
      <Table
        head={['Path', 'Holds']}
        rows={[
          [<code key="b">base/&lt;database oid&gt;/</code>, 'one directory per database, one file per table or index (named by its relfilenode)'],
          [<code key="g">global/</code>, 'cluster-wide catalogs: roles, databases, tablespaces'],
          [<code key="w">pg_wal/</code>, 'the write-ahead log, in 16 MB segment files'],
          [<code key="x">pg_xact/</code>, 'the commit log: 2 bits per transaction — in progress, committed, aborted (used by MVCC)'],
          [<code key="m">pg_multixact/</code>, 'groups of transactions that lock the same row together'],
          [<code key="s">pg_stat/</code>, 'statistics saved at shutdown'],
          [<code key="c">postgresql.conf, pg_hba.conf</code>, 'configuration and client authentication (see Install and configure)'],
        ]}
      />
      <CodeBlock title="recorded: ls -p $PGDATA" language="text" code={files.pgdata.split('\n').reduce<string[][]>((rows, f, i) => (i % 5 ? rows[rows.length - 1].push(f) : rows.push([f]), rows), []).map((r) => r.map((f) => f.padEnd(22)).join('').trimEnd()).join('\n')} />
      <CodeBlock title="recorded: which file is the orders table?" language="text" code={`${files.databases}\n\n${files.filepath}`} />
      <Flow
        title={`Recorded: the files of one table, ${files.path}`}
        cols={3}
        rows={relLines.length}
        rowHeight={60}
        nodes={[
          { id: 'db', label: `base/${files.dbOid}/`, sub: 'database lab', col: 0, row: 0, rowSpan: relLines.length, hue: 4, shape: 'store' },
          ...relLines.map((f, i) => {
            const name = f.path.split('/').pop()!
            const kind = name.endsWith('_fsm') ? 'free space map' : name.endsWith('_vm') ? 'visibility map' : i === 0 ? 'the table' : 'primary-key index'
            return { id: `f${i}`, label: `${name} · ${kind} · ${(f.size / 1024).toLocaleString()} kB`, col: 1, row: i, span: 2, hue: (i === relLines.length - 1 ? 7 : 3) as 3 | 7 }
          }),
        ]}
        edges={relLines.map((_, i) => ({ from: 'db', to: `f${i}`, hue: 4 }))}
        caption={`A table is a main file plus a free space map (_fsm) and a visibility map (_vm). Files are split into ${mb(Number(setting('segment_size').setting) * 8192)} segments (${files.relfilenode}.1, .2, …).`}
      />
      <Proportion
        title="Recorded: bytes on disk for the orders table and its primary key"
        parts={[
          { label: 'table (main fork)', value: files.sizes.main, hue: 3, display: `${(files.sizes.main / 1024 / 1024).toFixed(1)} MB` },
          { label: 'primary-key index', value: files.sizes.pkey, hue: 7, display: `${(files.sizes.pkey / 1024 / 1024).toFixed(1)} MB` },
          { label: 'free space + visibility maps', value: files.sizes.fsm + files.sizes.vm, hue: 5, display: `${(files.sizes.fsm + files.sizes.vm) / 1024} kB` },
        ]}
      />
      <p>
        Inside each file everything is cut into 8 kB <strong>pages</strong> — header, line pointers, tuples. The next lesson,{' '}
        <a href="#/postgres/storage">Pages, tuples and TOAST</a>, opens one up.
      </p>
      <Callout tone="warn" title="Never touch the files">
        Copying, deleting or editing files under <code>$PGDATA</code> while the server runs corrupts it. Use SQL (<code>DROP</code>,{' '}
        <code>TRUNCATE</code>, <code>VACUUM FULL</code>) and backup tools (see <a href="#/postgres/backups">Backups</a>).
      </Callout>

      <h2>Design rules</h2>
      <p>What this architecture means for the way you use PostgreSQL.</p>
      <Table
        head={['Rule', 'Because']}
        rows={[
          ['Keep connections few and pooled', 'every connection is a process with its own memory'],
          ['Commit in sensible batches for bulk loads', 'each COMMIT waits for one WAL fsync'],
          ['Give shared_buffers ~25 % of RAM, leave the rest to the OS', 'both caches serve reads; the OS cache also holds what shared buffers evicted'],
          ['Watch the hit ratio and reads in EXPLAIN (BUFFERS)', 'reads are where queries spend their time'],
          ['Do not raise work_mem globally without arithmetic', 'it is per sort or hash, per backend: 100 connections × several sorts each'],
          ['Keep pg_wal on fast, reliable storage', 'commit latency is the WAL fsync latency'],
        ]}
      />

      <Recap
        points={[
          'The postmaster forks one backend per connection; background processes write pages (bgwriter, checkpointer), flush WAL (walwriter), vacuum (autovacuum), stream WAL (walsender) and read (io workers).',
          'A query is parsed, rewritten (views expanded), planned and executed; every page goes through shared buffers.',
          'Shared buffers evict with a clock sweep over usage counts 0–5: pages used often survive one-off scans.',
          'COMMIT returns after the WAL is flushed; data files are written later and rebuilt from the WAL after a crash.',
          'Each table and index is a file under base/<database oid>/, with _fsm and _vm forks, split into 1 GB segments.',
        ]}
      />
    </>
  )
}
