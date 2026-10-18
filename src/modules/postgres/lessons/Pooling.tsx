import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { PoolPlayground } from '../components/PoolPlayground'
import { MonitoringLineChart } from '../components/MonitoringLineChart'
import { PoolingBudget } from '../components/PoolingBudget'
import { PoolingModes } from '../components/PoolingModes'
import { PoolingSizer } from '../components/PoolingSizer'
import { PGBOUNCER_INI } from '../configs/pgbouncer'
import { OPS } from '../data/ops'
import { OPERATIONS } from '../data/operations'
import { CLIENT_POOLS } from '../data/operationsApp'

const { queue, leak, session, prepared } = OPS.pool
const P = OPERATIONS.pool
const { memory, connectCost, tooMany, scaling, advisory, listen, sqlPrepare, statementMode, bouncerBench, bouncer, clients } = P

type Pools = { cl_active: number; cl_waiting: number; sv_active: number; sv_idle: number; pool_mode: string }
const poolRow = (p: Pools) => [String(p.cl_active), String(p.cl_waiting), String(p.sv_active), String(p.sv_idle), p.pool_mode]
const POOL_HEAD = ['cl_active', 'cl_waiting', 'sv_active', 'sv_idle', 'pool_mode']

const mb = (kb: number) => `${(kb / 1024).toFixed(1)} MB`
const kbOf = (bytes: number) => bytes / 1024
const ms = (v: number | null) => (v === null ? '—' : v < 10 ? `${v.toFixed(2)} ms` : `${Math.round(v)} ms`)
const prepNoCache = P.prepared.find((p) => p.max === 0)!
const prepCache = P.prepared.find((p) => p.max !== 0)!
const firstError = prepNoCache.results.find((r) => !r.ok)?.error ?? '—'
const peak = scaling.select.reduce((a, b) => (b.tps > a.tps ? b : a))
const plateauMin = Math.min(...scaling.select.filter((p) => p.clients >= 16).map((p) => p.tps))
const writes1 = scaling.tpcb[0]
const writes64 = scaling.tpcb.at(-1)!

export default function Pooling() {
  const backends = new Set(prepared.map((p) => p.pid))
  return (
    <>
      <LessonGoals
        goals={[
          'explain, with recorded numbers, why every connection costs a process, memory and setup time',
          'choose between session, transaction and statement pooling',
          'know what breaks in transaction mode — SET, advisory locks, LISTEN, prepared statements — and the fixes',
          'size pools from the CPU count and make every pool fit max_connections',
          'configure the pool inside the application (HikariCP, node-postgres) sensibly',
        ]}
        before={
          <>
            <a href="#/postgres/architecture">How PostgreSQL runs</a> (one process per connection) and{' '}
            <a href="#/postgres/using-postgres">Using PostgreSQL day to day</a>
          </>
        }
      />

      <h2>Connections are processes</h2>
      <p>
        Every connection to PostgreSQL gets its own operating-system process, called a <strong>backend</strong>. Opening one means a TCP (and
        often TLS) handshake, password authentication, and the postmaster forking a new process that then loads its caches.
      </p>
      <Flow
        title="What one new connection costs"
        cols={4}
        rows={2}
        nodes={[
          { id: 'app', label: 'application', sub: 'connect()', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'pm', label: 'postmaster', sub: 'listens on 5432', col: 1, row: 0, hue: 3 },
          { id: 'be', label: 'new backend', sub: 'fork()', col: 1, row: 1, hue: 3 },
          { id: 'mem', label: 'private memory', sub: 'caches, plans', col: 2, row: 1, hue: 3 },
          { id: 'sb', label: 'shared buffers', sub: 'shared by all', col: 3, row: 0, rowSpan: 2, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'app', to: 'pm', label: 'TCP + TLS', hue: 1 },
          { from: 'pm', to: 'be', label: 'fork', hue: 3 },
          { from: 'be', to: 'mem', hue: 3 },
          { from: 'be', to: 'sb', hue: 3, dashed: true },
          { from: 'app', to: 'be', label: 'SCRAM, SQL', hue: 1, dashed: true },
        ]}
        steps={[
          { title: 'Handshake', body: <p>TCP connect, then TLS if enabled: a few network round trips before PostgreSQL sees anything.</p>, active: ['app', 'pm', 'app>pm'] },
          { title: 'Fork', body: <p>The postmaster forks a backend process for this one client. It lives until the client disconnects.</p>, active: ['pm', 'be', 'pm>be'] },
          { title: 'Authenticate', body: <p>SCRAM-SHA-256 runs 4,096 hashing rounds on purpose, to make password guessing slow — and every new connection pays them.</p>, active: ['app', 'be', 'app>be'] },
          { title: 'Warm up', body: <p>The backend fills private caches (table and column definitions, plans) as queries arrive. That memory belongs to this connection alone.</p>, active: ['be', 'mem', 'sb', 'be>mem', 'be>sb'] },
        ]}
        caption="Blue: the application. Green: PostgreSQL’s processes and memory. Step through what one connect() sets in motion."
      />
      <p>Both costs were measured on the server used for this module: the time to connect, and the memory each idle backend keeps.</p>
      <StatTiles
        title={`Recorded: ${memory.connections} idle connections, PostgreSQL ${OPERATIONS.recordedWith.split(' ')[0]}`}
        stats={[
          { label: 'private memory per new backend', value: mb(memory.fresh.proc.privateKb), sub: `after one SELECT 1 (RSS ${mb(memory.fresh.proc.rssKb)}, mostly shared)`, hue: 3 },
          { label: 'after touching 200 tables', value: mb(memory.warm.proc.privateKb), sub: `the same backend’s catalog caches grew`, hue: 3 },
          { label: 'memory contexts of one backend', value: mb(kbOf(memory.warm.ctx.totalBytes)), sub: `fresh: ${mb(kbOf(memory.fresh.ctx.totalBytes))} (pg_backend_memory_contexts)`, hue: 7 },
          { label: 'new connection, TCP + SCRAM', value: ms(connectCost.reconnect.connectMs), sub: `then the query itself takes ${ms(connectCost.persistent.latencyMs)}`, hue: 1 },
        ]}
      />
      <BarChart
        title="Recorded: SELECT by primary key, 8 clients for 8 s, over the network — transactions per second"
        bars={[
          { label: 'keep the connection', value: bouncerBench.persistent.tps, hue: 6 },
          { label: 'connect per query, via PgBouncer', value: bouncerBench.pooled.tps, hue: 1, note: `connect: ${ms(bouncerBench.pooled.connectMs)} — no fork, the server connection is reused` },
          { label: 'connect per query, direct', value: bouncerBench.direct.tps, hue: 8, note: `connect: ${ms(bouncerBench.direct.connectMs)} — fork + backend start each time` },
        ]}
      />
      <p>
        Reconnecting for every query cut throughput to {((bouncerBench.direct.tps / bouncerBench.persistent.tps) * 100).toFixed(1)} % of what
        the same clients did on kept connections. Connecting to PgBouncer instead is cheaper (no new process), but still pays the handshake
        and SCRAM — which is why applications keep a pool of their own too. Idle connections are not free either: each one is a process with its own caches, and
        every snapshot a query takes has to look at every connection’s transaction state.
      </p>
      <CodeBlock
        title="the three runs above, from another host (-C opens a new connection for every transaction)"
        language="bash"
        code={`pgbench -h $DB_HOST -p 5432 -U app_rw -n -S -c 8 -j 4 -T 8 shop           # keep connections
pgbench -h $DB_HOST -p 6432 -U app_rw -n -S -C -c 8 -j 4 -T 8 shop_bench  # reconnect, via PgBouncer
pgbench -h $DB_HOST -p 5432 -U app_rw -n -S -C -c 8 -j 4 -T 8 shop        # reconnect, direct`}
      />
      <TermList
        items={[
          { term: 'backend', definition: 'The server process serving one connection; it lives as long as the connection.' },
          { term: 'connection pool', definition: 'A set of open connections that are lent out and returned, instead of opened and closed per request.' },
          { term: 'pool size', definition: 'The most server connections a pool keeps open; extra requests wait for one to come back.' },
          { term: 'PgBouncer', definition: 'A small proxy that speaks the PostgreSQL protocol and pools server connections for many clients.' },
          { term: 'pool mode', definition: 'When PgBouncer takes a server connection back: at disconnect (session), at COMMIT (transaction) or after each statement.' },
          { term: 'max_connections', definition: 'The server’s hard limit on connections (default 100); changing it needs a restart.' },
        ]}
      />

      <h2>Running out: max_connections</h2>
      <p>
        PostgreSQL refuses new connections once <code>max_connections</code> is reached. A few slots are kept for superusers (
        <code>superuser_reserved_connections</code>, default {tooMany.superuserReserved}), so an administrator can still get in.
      </p>
      <p>Recorded: an application role opened connections until the server said no.</p>
      <StatTiles
        stats={[
          { label: 'max_connections', value: tooMany.maxConnections, hue: 3 },
          { label: 'opened by the application role', value: tooMany.opened, sub: 'before the first refusal', hue: 1, bar: { value: tooMany.opened, max: tooMany.maxConnections } },
          { label: 'reserved for superusers', value: tooMany.superuserReserved, sub: typeof tooMany.superuserConnectedWith === 'number' ? 'a superuser still got in' : 'superuser also refused', hue: 4 },
        ]}
      />
      <CodeBlock title="what the next application connection got" language="text" code={`FATAL:  ${tooMany.error?.message ?? ''}\nSQLSTATE ${tooMany.error?.code ?? ''} (too_many_connections)`} />
      <p>
        The usual cause is not one big application but many small pools: ten instances × a pool of 20 is already 200. The interactive budget at
        the end of this lesson adds them up.
      </p>

      <h2>A pooler in front</h2>
      <p>
        A <strong>pooler</strong> keeps a few server connections open and lends them to many clients. There are two places to pool, and they
        combine:
      </p>
      <Flow
        title="Two levels of pooling"
        cols={4}
        rows={2}
        nodes={[
          { id: 'i1', label: 'app instance 1', sub: 'driver pool: 10', col: 0, row: 0, hue: 1 },
          { id: 'i2', label: 'app instance 2', sub: 'driver pool: 10', col: 0, row: 1, hue: 2 },
          { id: 'pgb', label: 'PgBouncer', sub: 'pool_size 20', col: 1, row: 0, rowSpan: 2, shape: 'queue' },
          { id: 'pg', label: 'PostgreSQL', sub: '20 backends', col: 2, row: 0, rowSpan: 2, span: 2, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'i1', to: 'pgb', label: '10', hue: 1, flow: true },
          { from: 'i2', to: 'pgb', label: '10', hue: 2, flow: true },
          { from: 'pgb', to: 'pg', label: '≤ 20', hue: 3, flow: true },
        ]}
        caption="The driver pool saves each request the connect; PgBouncer shares server connections across all processes, instances and services."
      />
      <Table
        head={['Where', 'Example', 'Shares connections between']}
        rows={[
          ['inside the application', 'the driver’s pool (HikariCP, node-postgres Pool, SQLAlchemy pool)', 'threads or requests of one process'],
          ['in front of the database', 'PgBouncer (also Pgpool-II, PgCat, Odyssey, cloud proxies)', 'all processes, instances and services'],
        ]}
      />

      <Predict
        question={
          <p>
            PgBouncer in transaction mode, pool size 2. Five clients each send <code>SELECT pg_sleep(1)</code> at the same moment. When does the
            last one get its answer?
          </p>
        }
        options={['After 1 second', 'After 3 seconds', 'After 5 seconds', 'It fails: no free connection']}
        answer={1}
        explanation="Two run, three wait in PgBouncer’s queue — nobody gets an error. Rounds of two: 1 s, 2 s, 3 s. Recorded:"
      />
      <Timeline
        title="Recorded: five clients, two server connections (pool_mode = transaction)"
        lanes={queue.results.map((r) => ({ id: String(r.client), label: `client ${r.client}` }))}
        segments={queue.results.flatMap((r) => [
          ...(r.doneAfterMs > 1100 ? [{ lane: String(r.client), from: 0, to: r.doneAfterMs - 1000, label: 'waiting', hue: 8 as const, striped: true }] : []),
          { lane: String(r.client), from: r.doneAfterMs - 1000, to: r.doneAfterMs, label: `backend ${r.backend}`, hue: (r.backend === queue.results[0].backend ? 3 : 7) as 3 | 7 },
        ])}
        end={3200}
        unit="ms"
        playable
      />
      <p>Two backends (pids {queue.results[0].backend} and {queue.results[1].backend}) served all five. In the middle of it, the admin console showed:</p>
      <Table head={['SHOW POOLS', ...POOL_HEAD]} rows={[['shop', ...poolRow(queue.during)]]} />

      <h2>Session, transaction and statement pooling</h2>
      <p>The pool mode decides when PgBouncer takes a server connection back from a client. Step through each:</p>
      <PoolingModes />

      <h2>Try it</h2>
      <PoolPlayground />
      <p>
        In <strong>session</strong> mode, the first clients keep their server connections while they sit in application code, and the rest
        never get one. In <strong>transaction</strong> mode the same connections serve everyone, because a connection is only lent for the
        length of one transaction.
      </p>

      <h3>Session mode, recorded</h3>
      <p>
        Two clients connected through a session-mode pool of size 2, ran one query each and then did nothing. A third client’s{' '}
        <code>SELECT 1</code> waited {session.waitedS} seconds — until one of the idle clients disconnected:
      </p>
      <Table head={['SHOW POOLS', ...POOL_HEAD]} rows={[['shop_session', ...poolRow(session.during)]]} />

      <h2>What transaction mode breaks</h2>
      <p>
        Anything that lives in the <em>session</em> rather than in a transaction stays on the backend, where other clients find it. In
        transaction mode one client’s transactions may run on different backends, and other clients use “its” backend in between. Every row
        below was recorded through PgBouncer {bouncer.version.replace(/^PgBouncer /, '')} with a pool of one connection, so the clients
        always share it.
      </p>
      <Tabs
        items={[
          {
            label: 'SET',
            content: (
              <>
                <Table head={['client', 'statement', 'result']} rows={leak.map((s) => [s.who, <code key="q">{s.sql}</code>, s.result])} />
                <p>
                  Client A’s <code>SET</code> changed the shared backend, and client B inherited a 5-second statement timeout it never asked for.{' '}
                  <code>SET LOCAL</code> inside a transaction ends with the transaction and leaks nothing.
                </p>
              </>
            ),
          },
          {
            label: 'advisory locks',
            content: (
              <>
                <Table head={['client', 'statement', 'result']} rows={advisory.steps.map((s) => [s.who, <code key="q">{s.sql}</code>, s.result || '(void: done)'])} />
                <p>
                  B “got” the lock A holds: both run on the same backend, and a session-level advisory lock belongs to the backend. The same{' '}
                  <code>pg_try_advisory_lock(42)</code> on a direct connection returned <code>{advisory.directTry}</code>, as it should. The
                  transaction-level <code>pg_advisory_xact_lock()</code> is released at <code>COMMIT</code>: afterwards no advisory lock is left
                  on the shared backend.
                </p>
              </>
            ),
          },
          {
            label: 'LISTEN',
            content: (
              <p>
                A listener ran <code>LISTEN order_created</code> and another client sent one <code>NOTIFY</code>. On direct connections the listener
                received {listen.direct} notification; through transaction pooling it received {listen.transactionMode}. Once the{' '}
                <code>LISTEN</code> statement ended, the backend went back to the pool — the listener was no longer attached to it. Keep a direct
                (or session-mode) connection for listeners.
              </p>
            ),
          },
          {
            label: 'PREPARE',
            content: (
              <>
                <Table head={['client', 'statement', 'result']} rows={sqlPrepare.map((s) => [s.who, <code key="q">{s.sql}</code>, s.result])} />
                <p>
                  SQL-level <code>PREPARE</code> is invisible to PgBouncer: the statement stays on the backend, where B can run it and where it
                  collides with B’s own. Drivers use <em>protocol-level</em> prepared statements instead, which PgBouncer 1.21+ tracks:
                </p>
                <StatTiles
                  stats={[
                    { label: 'max_prepared_statements = 0', value: `${prepNoCache.results.filter((r) => r.ok).length} of ${prepNoCache.results.length} ok`, sub: firstError, hue: 8 },
                    { label: `max_prepared_statements = ${prepCache.max}`, value: `${prepCache.results.filter((r) => r.ok).length} of ${prepCache.results.length} ok`, sub: `default in ${bouncer.version}: ${bouncer.defaults.max_prepared_statements}`, hue: 6 },
                  ]}
                />
                <p>
                  Three clients each ran the named statement <code>order_count</code> twice. With tracking on, PgBouncer prepares it on whichever
                  backend the client lands on. The original recording ({prepared.length} executions on {backends.size} backend
                  {backends.size > 1 ? 's' : ''}) showed the same.
                </p>
              </>
            ),
          },
          {
            label: 'statement mode',
            content: (
              <>
                <Table head={['statement', 'result']} rows={statementMode.map((s) => [<code key="q">{s.sql}</code>, s.result])} />
                <p>Statement mode allows autocommit statements only.</p>
              </>
            ),
          },
        ]}
      />
      <Table
        head={['Session feature', 'In transaction mode', 'Instead']}
        rows={[
          ['SET', 'leaks to other clients', 'SET LOCAL in a transaction, ALTER ROLE … SET, or startup parameters PgBouncer tracks (track_extra_parameters)'],
          ['pg_advisory_lock()', 'held by a backend other clients use', 'pg_advisory_xact_lock(), released at commit'],
          ['LISTEN / NOTIFY', 'LISTEN does not stay with the client', 'a direct connection for the listener (NOTIFY itself is fine)'],
          ['temporary tables, WITH HOLD cursors', 'may be gone or belong to someone else', 'ON COMMIT DROP, or a session-mode pool'],
          ['PREPARE (SQL statement)', 'not tracked, leaks', 'protocol-level prepared statements with max_prepared_statements > 0 (PgBouncer 1.21+)'],
        ]}
      />
      <Callout tone="warn" title="Drivers that prepare by themselves">
        The PostgreSQL JDBC driver switches to named server-side statements after a statement has run 5 times (<code>prepareThreshold</code>);
        node-postgres does so for queries given a <code>name</code>. On PgBouncer older than 1.21, or with <code>max_prepared_statements = 0</code>,
        set <code>prepareThreshold=0</code> in the JDBC URL — or upgrade PgBouncer.
      </Callout>

      <h2>Configuring PgBouncer</h2>
      <p>PgBouncer is configured in one ini file. Click a line to see what it does:</p>
      <ConfigExplorer file="/etc/pgbouncer/pgbouncer.ini" format="raw" entries={PGBOUNCER_INI} />
      <CodeBlock
        title="/etc/pgbouncer/userlist.txt"
        language="text"
        code={`"app_rw" "SCRAM-SHA-256$4096:…"     -- copied from: SELECT rolpassword FROM pg_authid WHERE rolname = 'app_rw'
"pooladmin" "admin-secret"`}
      />
      <CodeBlock
        title="the admin console (a pseudo database called pgbouncer)"
        language="bash"
        code={`psql -h 127.0.0.1 -p 6432 -U pooladmin pgbouncer
SHOW POOLS;      -- per database/role: cl_active, cl_waiting, sv_active, sv_idle, maxwait
SHOW STATS;      -- transactions, queries, bytes, average wait time
SHOW CLIENTS;  SHOW SERVERS;  SHOW CONFIG;
RELOAD;          -- re-read pgbouncer.ini
PAUSE shop;  RESUME shop;   -- drain a database, e.g. around a failover`}
      />
      <Table
        head={['Setting (recorded with SHOW CONFIG)', 'Meaning']}
        rows={[
          [`pool_mode = ${bouncer.defaults.pool_mode}`, 'session, transaction or statement (per database too); set in the lab’s ini, the default is session'],
          [`default_pool_size = ${bouncer.defaults.default_pool_size}`, 'server connections per database + user pair; set small in the lab to make queues visible, the default is 20'],
          [`max_client_conn = ${bouncer.defaults.max_client_conn}`, 'client connections PgBouncer accepts (they are cheap); set in the lab’s ini, the default is 100'],
          [`max_prepared_statements = ${bouncer.defaults.max_prepared_statements}`, 'protocol-level prepared statements tracked per server connection; 0 turns tracking off (default)'],
          [`server_reset_query = ${bouncer.defaults.server_reset_query || '(empty)'}`, 'run when a session-mode client disconnects, to clear its state (default)'],
          [`query_wait_timeout = ${bouncer.defaults.query_wait_timeout}`, 'seconds a client may wait in the queue before it gets an error (default)'],
        ]}
      />
      <p>
        The <code>cl_waiting</code> column of <code>SHOW POOLS</code> is the one to watch: clients queued for a server connection. A pool that
        is rarely idle and often has waiting clients is too small — or the database behind it is too slow.
      </p>

      <h2>Pools inside the application</h2>
      <p>
        The driver’s pool keeps connections open inside one process and lends one per request. Both apps below ran against the same server: a
        pool of 5, twenty requests at once, each a 200 ms query, then a pool where every connection was taken and never given back.
      </p>
      <Tabs
        items={[
          { label: 'Java · HikariCP', content: <CodeBlock title={CLIENT_POOLS.java.title} language="java" code={CLIENT_POOLS.java.code} /> },
          { label: 'TypeScript · node-postgres', content: <CodeBlock title={CLIENT_POOLS.ts.title} language="ts" code={CLIENT_POOLS.ts.code} /> },
        ]}
      />
      <MonitoringLineChart
        title="Recorded (node-postgres): 20 requests, pool of 5 — requests waiting for a connection"
        series={[
          { label: 'waiting for a connection', hue: 8, points: clients.node.samples.map((s) => ({ x: s.ms, y: s.waiting })) },
          { label: 'connections open', hue: 1, points: clients.node.samples.map((s) => ({ x: s.ms, y: s.total })) },
        ]}
        xUnit="ms since the burst"
        yLabel="requests"
        caption={`Four rounds of five: the last request finished after ${clients.node.lastDoneMs} ms, on ${clients.node.pids} backends. HikariCP did the same in ${clients.java.lastDoneMs} ms on ${clients.java.pids} backends (100 ms in: ${clients.java.during.active} active, ${clients.java.during.waiting} threads waiting).`}
      />
      <p>When every connection is checked out and never returned, the next caller waits for the timeout and then fails:</p>
      <CodeBlock
        title="recorded: the sixth caller"
        language="text"
        code={`HikariCP     (connectionTimeout 1 s, waited ${clients.java.timeout.waitedMs} ms):
  ${clients.java.timeout.error}
node-postgres (connectionTimeoutMillis 2 s, waited ${clients.node.timeout.waitedMs} ms):
  Error: ${clients.node.timeout.message}`}
      />
      <Table
        head={['What', 'HikariCP', 'node-postgres Pool', 'Advice']}
        rows={[
          ['most connections', 'maximumPoolSize (10)', 'max (10)', 'small: see sizing below'],
          ['kept open when idle', 'minimumIdle (= max)', 'min (0; opens on demand)', 'Hikari: leave equal to max (a fixed pool)'],
          ['wait for a free connection', 'connectionTimeout (30 s)', 'connectionTimeoutMillis (0 = forever)', 'a few seconds: fail fast, never forever'],
          ['close idle connections', 'idleTimeout (10 min)', 'idleTimeoutMillis (10 s)', 'only matters if the pool shrinks'],
          ['replace old connections', 'maxLifetime (30 min)', 'maxLifetimeSeconds (0 = never)', 'shorter than any proxy/firewall idle cut-off'],
          ['test idle connections', 'keepaliveTime (0 = off)', 'keepAlive (TCP keepalive, off)', 'a few minutes: keeps NAT and load balancers from dropping them'],
          ['name in pg_stat_activity', 'ApplicationName property', 'application_name', 'always set it: monitoring needs it'],
        ]}
      />
      <Callout tone="warn" title="Leaks look like a slow database">
        A code path that borrows a connection and never returns it (no <code>finally</code>, no try-with-resources) shrinks the pool by one
        each time, until every request times out as above. HikariCP’s <code>leakDetectionThreshold</code> logs where a connection was
        borrowed if it is held longer than the threshold.
      </Callout>

      <h2>How big should a pool be?</h2>
      <p>
        A pool should be about as large as the number of queries the server can usefully run <em>at the same time</em> — which is set by its
        CPU cores and disks, not by the number of users.
      </p>
      <MonitoringLineChart
        title={`Recorded: pgbench on ${scaling.cpus} CPU threads — transactions per second by concurrent clients`}
        series={[{ label: 'read-only: SELECT by primary key (best of 3 runs)', hue: 1, points: scaling.select.map((p) => ({ x: p.clients, y: p.tps })) }]}
        xUnit="concurrent clients"
        yLabel="tps"
        categorical
        caption={`Throughput climbed until the clients outnumbered the ${scaling.cpus} CPU threads, then levelled off: ${plateauMin.toLocaleString()}–${peak.tps.toLocaleString()} tps from 16 to 64 clients, while each query took longer (below). The read-write pgbench workload behaves differently: it waits on WAL flushes at COMMIT, and commits that wait together are flushed together, so it went from ${writes1.tps.toLocaleString()} tps with 1 client to ${writes64.tps.toLocaleString()} with 64. Waiting is what more connections can hide.`}
      />
      <BarChart
        title="Read-only: average latency per transaction"
        bars={scaling.select.map((p) => ({ label: `${p.clients} clients`, value: p.latencyMs ?? 0, display: ms(p.latencyMs), hue: 1 }))}
      />
      <p>The PostgreSQL wiki’s starting point is a formula, from the same idea:</p>
      <CodeBlock title="a starting point, then measure" language="text" code={`pool size ≈ (CPU cores × 2) + effective spindle count

8 cores, SSD (count 1)  →  17 connections — for the whole server, shared by every application`} />
      <PoolingSizer />
      <p>Then add up every pool that can reach the server — it must fit:</p>
      <CodeBlock
        title="the budget"
        language="text"
        code={`  application instances × driver pool size      (if they connect directly)
+ Σ PgBouncer default_pool_size (per database + user)
+ replication, backups, monitoring, admin sessions
≤ max_connections − superuser_reserved_connections (${tooMany.superuserReserved}) − reserved_connections`}
      />
      <PoolingBudget backendKb={memory.warm.proc.privateKb} refusal={tooMany.error?.message ?? 'too many connections'} />
      <Callout tone="tip" title="Smaller pools are often faster">
        Past the saturation point, more concurrent queries only add contention. Measure: if <code>cl_waiting</code> (or Hikari’s pending
        threads) stays high while the database is idle, grow the pool; if the database is saturated, a larger pool will not help — fix the
        slow queries (see <a href="#/postgres/monitoring">Monitoring and tuning</a>).
      </Callout>

      <h2>Design rules</h2>
      <ul>
        <li>Always use a driver pool; never open a connection per request.</li>
        <li>Put PgBouncer (transaction mode) in front when many instances, serverless functions or short-lived processes connect.</li>
        <li>In transaction mode: <code>SET LOCAL</code>, <code>pg_advisory_xact_lock</code>, a direct connection for <code>LISTEN</code>, PgBouncer 1.21+ for prepared statements.</li>
        <li>Size pools from cores, not users: start near cores × 2, then watch waiting clients and query latency.</li>
        <li>Keep a written budget so every pool together stays under <code>max_connections</code>.</li>
        <li>Set a short connection timeout, a max lifetime, and <code>application_name</code>; return connections in <code>finally</code>.</li>
      </ul>

      <Recap
        points={[
          `Every connection is a process: connecting costs a fork and authentication (${ms(connectCost.reconnect.connectMs)} recorded), and each backend keeps megabytes of private memory.`,
          'A pooler lends a few server connections to many clients; waiting clients queue instead of failing.',
          'Session mode lends a connection until disconnect; transaction mode, for one transaction; statement mode, for one statement.',
          'In transaction mode, session state (SET, advisory locks, LISTEN, SQL PREPARE) leaks or disappears — use the transaction-scoped versions.',
          'Throughput stops growing near the core count; all pools together must fit within max_connections.',
        ]}
      />
    </>
  )
}
