import { Callout, CodeBlock, ConfigExplorer, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { PoolPlayground } from '../components'
import { PGBOUNCER_INI } from '../configs/pgbouncer'
import { OPS } from '../data/ops'

const { queue, leak, session, prepared } = OPS.pool

type Pools = { cl_active: number; cl_waiting: number; sv_active: number; sv_idle: number; pool_mode: string }
const poolRow = (p: Pools) => [String(p.cl_active), String(p.cl_waiting), String(p.sv_active), String(p.sv_idle), p.pool_mode]
const POOL_HEAD = ['cl_active', 'cl_waiting', 'sv_active', 'sv_idle', 'pool_mode']

export default function Pooling() {
  const backends = new Set(prepared.map((p) => p.pid))
  return (
    <>
      <LessonGoals
        goals={[
          'explain why thousands of direct connections hurt PostgreSQL',
          'choose between session and transaction pooling',
          'know which features break in transaction mode, and the fixes',
          'size pools so the sum fits max_connections',
        ]}
        before="Lesson 1 — one process per connection"
      />

      <h2>Connections are processes</h2>
      <p>
        Every connection is a backend process with its own memory and caches. Opening one takes a fork and authentication; keeping thousands
        mostly idle still costs memory and makes every snapshot more expensive to take. Most applications need far fewer <em>active</em>{' '}
        connections than they open.
      </p>
      <p>
        A <strong>pooler</strong> keeps a few server connections open and lends them to many clients. There are two levels, and they combine:
      </p>
      <Table
        head={['Where', 'Example', 'Shares connections between']}
        rows={[
          ['inside the application', 'the driver’s pool (HikariCP, node-postgres Pool, SQLAlchemy pool)', 'threads or requests of one process'],
          ['in front of the database', 'PgBouncer', 'all processes, instances and services'],
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
      <Table
        head={['client', 'PostgreSQL backend (pid)', 'answer after']}
        rows={queue.results.map((r) => [`client ${r.client}`, String(r.backend), `${r.doneAfterS} s`])}
      />
      <p>Five clients, two backends. In the middle of it, the admin console showed:</p>
      <Table head={['SHOW POOLS', ...POOL_HEAD]} rows={[['shop', ...poolRow(queue.during)]]} />

      <h2>Try it</h2>
      <PoolPlayground />
      <p>
        In <strong>session</strong> mode, the first clients keep their server connections while they sit in application code, and the rest
        never get one. In <strong>transaction</strong> mode the same connections serve everyone, because a connection is only lent for the
        length of one transaction.
      </p>

      <h2>Session mode, recorded</h2>
      <p>
        Two clients connected through a session-mode pool of size 2, ran one query each and then did nothing. A third client’s{' '}
        <code>SELECT 1</code> waited {session.waitedS} seconds — until one of the idle clients disconnected:
      </p>
      <Table head={['SHOW POOLS', ...POOL_HEAD]} rows={[['shop_session', ...poolRow(session.during)]]} />

      <h2>What transaction mode breaks</h2>
      <p>
        In transaction mode, consecutive transactions of one client may run on different backends, and other clients use “your” backend in
        between. Anything that lives in the <em>session</em> rather than in a transaction stays on the backend. Recorded with a pool of one
        connection:
      </p>
      <Table head={['client', 'statement', 'result']} rows={leak.map((s) => [s.who, <code key="q">{s.sql}</code>, s.result])} />
      <p>
        Client A’s <code>SET</code> changed the shared backend, and client B inherited a 5-second statement timeout it never asked for.{' '}
        <code>SET LOCAL</code> inside a transaction ends with the transaction and leaks nothing.
      </p>
      <Table
        head={['Session feature', 'In transaction mode', 'Instead']}
        rows={[
          ['SET', 'leaks to other clients', 'SET LOCAL in a transaction, ALTER ROLE … SET, or connection parameters PgBouncer tracks'],
          ['pg_advisory_lock()', 'held by a backend other clients use', 'pg_advisory_xact_lock(), released at commit'],
          ['LISTEN / NOTIFY', 'LISTEN does not stay with the client', 'a direct connection for the listener'],
          ['temporary tables, WITH HOLD cursors', 'may be gone or belong to someone else', 'ON COMMIT DROP, or a session-mode pool'],
          ['PREPARE (SQL statement)', 'not tracked', 'protocol-level prepared statements (drivers use these): supported since PgBouncer 1.21'],
        ]}
      />
      <p>
        The last row was recorded too: three clients each used a named prepared statement twice. PgBouncer prepared it on the backend as
        needed; all {prepared.length} executions succeeded, on {backends.size} backend{backends.size > 1 ? 's' : ''}.
      </p>

      <h2>pgbouncer.ini</h2>
      <ConfigExplorer file="/etc/pgbouncer/pgbouncer.ini" format="raw" entries={PGBOUNCER_INI} />
      <CodeBlock
        title="/etc/pgbouncer/userlist.txt"
        code={`"app_rw" "SCRAM-SHA-256$4096:…"     -- copied from: SELECT rolpassword FROM pg_authid WHERE rolname = 'app_rw'
"pooladmin" "admin-secret"`}
      />

      <h2>Sizing</h2>
      <p>Add up every pool that can reach the database — it must fit:</p>
      <CodeBlock
        title="the budget"
        code={`  application instances × driver pool size      (if they connect directly)
+ Σ PgBouncer default_pool_size (per database + role)
+ replication, backups, monitoring, admin sessions
≤ max_connections − superuser_reserved_connections (3)`}
      />
      <Callout tone="tip" title="Smaller pools are often faster">
        A backend running SQL competes for CPU and disk with the others. Past a point, more concurrent queries only add contention, so a pool
        of a few times the CPU core count usually beats hundreds. Measure: if <code>cl_waiting</code> stays high while the database is idle,
        grow the pool; if the database is saturated, a larger pool will not help.
      </Callout>

      <Recap
        points={[
          'A pooler lends a few server connections to many clients; waiting clients queue instead of failing.',
          'Session mode lends a connection until the client disconnects; transaction mode, for one transaction.',
          'In transaction mode, session state (SET, advisory locks, LISTEN, temp tables) leaks or disappears — use transaction-scoped versions.',
          'All pools together must fit within max_connections.',
        ]}
      />
    </>
  )
}
