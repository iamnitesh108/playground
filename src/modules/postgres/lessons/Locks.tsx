import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { SessionPlayer, type PlayerFrame } from '../components/SessionPlayer'
import { LockTable, RowLockTable, type LockObservation, type RowLockObservation } from '../components/SessionPlayerLocks'
import { LocksConflictMatrix } from '../components/LocksConflictMatrix'
import { LocksQueuePlayground } from '../components/LocksQueuePlayground'
import { CONCURRENCY } from '../data/concurrency'
import { SOURCES } from '../data/concurrencySources'
import { finishedAt, resultAt, scenario } from './frames'

type LockFrame = PlayerFrame & { readonly t: number; readonly obs: readonly LockObservation[] }
type RowFrame = PlayerFrame & { readonly t: number; readonly obs: readonly RowLockObservation[] }

const L = CONCURRENCY.locks
const COLUMNS = ['id', 'balance']

const lockAside = (frame: LockFrame) => <LockTable rows={frame.obs} />
const rowAside = (frame: RowFrame) => <RowLockTable rows={frame.obs} />

/** "AccessExclusiveLock" → "ACCESS EXCLUSIVE" */
const modeName = (pgMode: string) =>
  pgMode
    .replace(/Lock$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toUpperCase()

const TABLE_MODES = ['ACCESS SHARE', 'ROW SHARE', 'ROW EXCLUSIVE', 'SHARE UPDATE EXCLUSIVE', 'SHARE', 'SHARE ROW EXCLUSIVE', 'EXCLUSIVE', 'ACCESS EXCLUSIVE']
const SHORT: Record<string, string> = {
  'ACCESS SHARE': 'AS',
  'ROW SHARE': 'RS',
  'ROW EXCLUSIVE': 'RE',
  'SHARE UPDATE EXCLUSIVE': 'SUE',
  SHARE: 'S',
  'SHARE ROW EXCLUSIVE': 'SRE',
  EXCLUSIVE: 'E',
  'ACCESS EXCLUSIVE': 'AE',
}
const ROW_MODES = ['FOR KEY SHARE', 'FOR SHARE', 'FOR NO KEY UPDATE', 'FOR UPDATE']
const ROW_SHORT: Record<string, string> = { 'FOR KEY SHARE': 'key share', 'FOR SHARE': 'share', 'FOR NO KEY UPDATE': 'no key upd.', 'FOR UPDATE': 'update' }

/** Short names for the recorded statements, by their SQL. */
const STATEMENT_LABEL: Record<string, string> = {
  'SELECT * FROM orders': 'SELECT',
  'SELECT * FROM orders FOR UPDATE': 'SELECT … FOR UPDATE / SHARE',
  'INSERT INTO orders (id, customer_id) VALUES (2, 1)': 'INSERT',
  "UPDATE orders SET status = 'paid' WHERE id = 1": 'UPDATE',
  'DELETE FROM orders WHERE id = 1': 'DELETE',
  'VACUUM orders': 'VACUUM',
  'ANALYZE orders': 'ANALYZE',
  'CREATE INDEX CONCURRENTLY ON orders (status)': 'CREATE INDEX CONCURRENTLY',
  'CREATE INDEX ON orders (status)': 'CREATE INDEX',
  'ALTER TABLE orders VALIDATE CONSTRAINT orders_amount_check': 'VALIDATE CONSTRAINT',
  'ALTER TABLE orders ADD FOREIGN KEY (customer_id) REFERENCES customers': 'ADD FOREIGN KEY',
  'CREATE TRIGGER noop BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION suppress_redundant_updates_trigger()': 'CREATE TRIGGER',
  'ALTER TABLE orders ADD COLUMN note text': 'ADD COLUMN',
  "ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'open'": 'SET DEFAULT',
  'ALTER TABLE orders ALTER COLUMN amount TYPE bigint': 'ALTER COLUMN TYPE',
  'TRUNCATE orders': 'TRUNCATE',
  'VACUUM FULL orders': 'VACUUM FULL',
  'DROP TABLE orders': 'DROP TABLE',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY order_totals': 'REFRESH MATERIALIZED VIEW CONCURRENTLY',
}
/** A recorded row-lock statement, said in a few words. */
const rowStatement = (sql: string) =>
  sql.startsWith('SELECT') ? `SELECT … ${sql.slice(sql.indexOf(' FOR ') + 1)}`
  : sql.startsWith('INSERT') ? 'INSERT of a referencing row'
  : sql.startsWith('UPDATE items SET id') ? 'UPDATE of the key'
  : sql.startsWith('UPDATE') ? 'UPDATE of other columns'
  : sql.startsWith('DELETE') ? 'DELETE'
  : sql

const statementsTaking = (mode: string) =>
  L.statements
    .filter((s) => s.mode && modeName(s.mode) === mode)
    .map((s) => STATEMENT_LABEL[s.sql] ?? s.sql)
    .join(', ')

// --- the recorded pile-up ---
const PILE = L.pileup.frames as readonly LockFrame[]
const pileEnd = PILE[PILE.length - 1].t
const PILE_NOTES = [
  <>A starts a transaction — a slow report, or an application that forgot to commit.</>,
  <>
    A’s SELECT takes <strong>ACCESS SHARE</strong> on <code>orders</code>. The query is done, but the lock stays until the transaction ends (A is
    “idle in transaction”).
  </>,
  <>
    B runs a migration: <code>ALTER TABLE … ADD COLUMN</code> needs <strong>ACCESS EXCLUSIVE</strong>, which conflicts with A’s lock. B waits — that
    alone would be fine.
  </>,
  <>
    C runs an ordinary SELECT. It needs only ACCESS SHARE, compatible with A’s lock — and still <strong>waits</strong>: granting it would let it jump
    ahead of B. <code>pg_blocking_pids</code> names B, not A.
  </>,
  <>D’s UPDATE (ROW EXCLUSIVE) queues behind B too. Every new query on the table now piles up: to the application, the table is down.</>,
  <>
    One second later nothing has moved. With <code>log_lock_waits</code> on, each waiter is logged once it has waited <code>deadlock_timeout</code>{' '}
    (1 s) — the log is below.
  </>,
  <>A commits. B gets its lock and runs (the ALTER itself takes milliseconds), then C and D run. The whole queue drains at once.</>,
]

const TIMEOUT = L.pileupTimeout as readonly LockFrame[]
const timeoutErr = resultAt(TIMEOUT, 4, 'B')
const TIMEOUT_NOTES = [
  <>A starts a transaction…</>,
  <>…and holds ACCESS SHARE on orders.</>,
  <>
    This time the migration first sets <code>lock_timeout = '2s'</code>: wait at most 2 seconds for any lock.
  </>,
  <>B’s ALTER TABLE waits for A, as before.</>,
  <>C’s SELECT queues behind B, as before.</>,
  <>
    After 2 seconds B gives up: <code>{timeoutErr?.kind === 'error' ? `${timeoutErr.code} ${timeoutErr.message}` : ''}</code>. Its place in the queue
    is gone, so C runs at once. The outage lasted 2 seconds instead of “until A ends”.
  </>,
  <>A commits whenever it likes. The migration tool tries the ALTER again later.</>,
]

// --- deadlock ---
const DEADLOCK = [
  <>A begins: transfer 10 from account 1 to account 2.</>,
  <>B begins: transfer 10 from account 2 to account 1.</>,
  <>A debits account 1 and holds its row lock.</>,
  <>B debits account 2 and holds its row lock.</>,
  <>A wants to credit account 2 — locked by B. A waits.</>,
  <>
    B wants to credit account 1 — locked by A. Now each waits for the other, forever: a <strong>deadlock</strong>. After{' '}
    <code>deadlock_timeout</code> (1 s) a waiting backend checks for cycles and cancels one transaction: A gets <code>40P01 deadlock detected</code>.
    Its locks are released and B’s update goes through (lp 5: 100 + 10, because A’s 90 is aborted).
  </>,
  <>B commits its transfer.</>,
  <>A’s transaction is already aborted; the application rolls it back. It should now retry the whole transfer.</>,
  <>B’s transfer is applied, A’s is not (yet). The database stayed consistent; the retry is the application’s job.</>,
]

// --- the lost update and its fixes ---
const LOST = [
  <>A begins (READ COMMITTED). Goal: add 50 to the balance.</>,
  <>A reads 100 into the application and computes 100 + 50 = 150.</>,
  <>B begins. Goal: subtract 30.</>,
  <>B reads 100 too, and computes 100 − 30 = 70.</>,
  <>A writes the value it computed: 150. A now holds a <strong>row lock</strong> on row 1 until it ends.</>,
  <>B writes its value, 70 — and <strong>waits</strong>: the row is locked by A’s uncommitted update.</>,
  <>
    A commits. B wakes up, finds the newest committed version (150), sees the WHERE clause still matches, and replaces it with 70 — the value it
    computed from an <em>old</em> read. (On lp 4, <code>xmax</code> equal to B’s own xid is only a row lock B carries, not a delete.)
  </>,
  <>B commits.</>,
  <>
    The balance is <strong>70</strong>, not 120. A’s +50 is gone without any error: a <strong>lost update</strong>. The bug is the read-compute-write
    pattern, not the database.
  </>,
]
const ATOMIC = [
  <>A begins.</>,
  <>B begins.</>,
  <>A runs <code>balance = balance + 50</code>: the database computes the value. 150, uncommitted; A holds the row lock.</>,
  <>B runs <code>balance = balance - 30</code> and waits for A’s lock.</>,
  <>
    A commits. B wakes up, re-reads the newest version (150) and evaluates <code>balance - 30</code> <strong>on it</strong>: 120.
  </>,
  <>B commits.</>,
  <>
    <strong>120</strong> — both changes kept. Letting the database do the arithmetic in one statement removes the race.
  </>,
]
const RR = [
  <>A begins a REPEATABLE READ transaction.</>,
  <>A reads 100; its snapshot is fixed now.</>,
  <>B subtracts 30 and commits: 70.</>,
  <>
    A tries to add 50. The row was changed after A’s snapshot, and A cannot see that change — so instead of waiting and re-reading (as read committed
    does), PostgreSQL refuses: <code>40001 could not serialize access due to concurrent update</code>.
  </>,
  <>A rolls back. Nothing was lost; nothing was overwritten.</>,
  <>A fresh transaction sees 70. Retrying A’s work now gives the correct 120.</>,
]
const FOR_UPDATE = [
  <>A begins.</>,
  <>
    A reads the row <strong>FOR UPDATE</strong>: 100, and the row is locked. Look at lp 1: its <code>xmax</code> is now A’s xid, although nothing was
    deleted. A row lock is recorded in the tuple itself, as a “lock-only” xmax.
  </>,
  <>B begins.</>,
  <>B also asks for row 1 FOR UPDATE — and waits. It cannot even read it this way until A is done.</>,
  <>A writes 150, computed from the value it locked.</>,
  <>
    A commits. B’s SELECT … FOR UPDATE finishes and returns <strong>150</strong> — the newest version, not the 100 it would have read earlier. B now
    holds the lock (see lp 3’s <code>xmax</code>).
  </>,
  <>B computes 150 − 30 and writes 120.</>,
  <>B commits.</>,
  <>
    <strong>120</strong>. Read-compute-write is safe when the read takes the lock: the second reader waits and then works on the up-to-date value.
  </>,
]

// --- SKIP LOCKED ---
const SKIP = L.skipLocked as readonly RowFrame[]
const SKIP_NOTES = [
  <>Worker A starts a transaction.</>,
  <>
    A claims the oldest queued job with <code>FOR UPDATE SKIP LOCKED</code>: job 1, now row-locked by A (pgrowlocks reads the lock from the tuple).
  </>,
  <>Worker B starts a transaction.</>,
  <>B runs the same query. Job 1 is locked, so it is <strong>skipped</strong>: B gets job 2 without waiting.</>,
  <>
    C tries <code>NOWAIT</code> instead: it does not skip, it fails at once on job 1 — <code>{(() => { const r = resultAt(SKIP, 5, 'C'); return r?.kind === 'error' ? `${r.code} ${r.message}` : '' })()}</code>.
  </>,
  <>C tries a plain FOR UPDATE: it waits for job 1’s lock — exactly what a queue must not do.</>,
  <>A marks job 1 done (the lock becomes the UPDATE’s own lock).</>,
  <>A commits. C wakes up, finds job 1 is no longer queued, moves on — and now waits for job 2, locked by B.</>,
  <>B marks job 2 done.</>,
  <>
    B commits. Only now does C get a job: <strong>job {(() => { const r = resultAt(SKIP, 6, 'C'); return r?.kind === 'rows' ? String(r.rows[0]?.[0]) : '?' })()}</strong>, after
    waiting through two other workers’ transactions.
  </>,
]

const RUNS = CONCURRENCY.apps.queue.runs
const queueEnd = Math.max(...RUNS.map((r) => r.ms)) + 20
const queueTimeline = (label: string) => {
  const r = RUNS.find((x) => x.label === label)!
  return (
    <Timeline
      title={`${label}: which worker ran which job (recorded, ${r.ms} ms in total)`}
      lanes={[1, 2, 3, 4].map((w) => ({ id: String(w), label: `worker ${w} · ${r.per[w - 1]} job${Number(r.per[w - 1]) === 1 ? '' : 's'}` }))}
      segments={r.done.map((d) => ({ lane: String(d.worker), from: d.start, to: d.end, label: String(d.job), hue: label === 'SKIP LOCKED' ? 6 : 1 }))}
      end={queueEnd}
      unit="ms"
    />
  )
}

// --- advisory locks ---
const ADVISORY = L.advisory as readonly LockFrame[]
const ADVISORY_NOTES = [
  <>A takes advisory lock 42 with the non-blocking <code>pg_try_advisory_lock</code>: true.</>,
  <>B tries the same key: false. B could now skip the work (“someone else is already running the nightly job”).</>,
  <>B asks with the blocking <code>pg_advisory_lock</code> instead and waits.</>,
  <>A releases it; B gets the lock at once. Session-level advisory locks survive COMMIT and are held until unlocked or the session ends.</>,
  <>A starts a transaction…</>,
  <>
    …and takes a <strong>transaction-level</strong> advisory lock on a name, hashed to a number with <code>hashtext</code>.
  </>,
  <>B tries the same key: false.</>,
  <>A commits — transaction-level advisory locks are released automatically.</>,
  <>B tries again: true.</>,
]

const firstWait = (frames: readonly LockFrame[], s: string) => frames.findIndex((f) => f.results[s]?.kind === 'blocked')

export default function Locks() {
  const deadlockErr = resultAt(L.deadlock.frames, 5, 'A')
  const settings = L.timeouts.defaults
  return (
    <>
      <LessonGoals
        goals={[
          'spot a lost update and fix it three ways',
          'read the row-lock and table-lock conflict tables, and know which statement takes which lock',
          'explain the migration pile-up and prevent it with lock_timeout',
          'recognise deadlocks in the log, and build a job queue with SKIP LOCKED',
        ]}
        before={
          <>
            <a href="#/postgres/isolation">Isolation levels</a> and <a href="#/postgres/mvcc">MVCC</a>
          </>
        }
      />

      <h2>Writers do wait for writers</h2>
      <p>
        MVCC lets readers and writers run side by side, but two transactions cannot change the same row at once. The first UPDATE or DELETE takes a{' '}
        <strong>row lock</strong>, held until its transaction ends; a second writer of that row waits. Separately, every statement takes a{' '}
        <strong>table lock</strong> that decides which schema changes can run next to it.
      </p>
      <TermList
        items={[
          { term: 'row lock', definition: 'Stored in the tuple itself (its xmax), so locking a million rows costs no memory. Four strengths, from FOR KEY SHARE to FOR UPDATE.' },
          { term: 'table lock', definition: 'Held in shared memory (pg_locks), eight modes from ACCESS SHARE to ACCESS EXCLUSIVE. Every statement takes one.' },
          { term: 'lock queue', definition: 'Requests that cannot be granted wait in arrival order; a new request also waits if it conflicts with one already waiting.' },
          { term: 'deadlock', definition: 'Two or more transactions each waiting for a lock another one holds. PostgreSQL detects it and cancels one.' },
          { term: 'advisory lock', definition: 'A lock on a number of your choosing, for coordinating application work; the database attaches no meaning to it.' },
        ]}
      />

      <h2>The lost update and three fixes</h2>
      <p>The classic race: read a value into the application, compute, write it back.</p>
      <Predict
        question={
          <p>
            Balance 100. Two transactions each read it, then A writes <code>100 + 50</code> and B writes <code>100 − 30</code>, as values computed in the
            application. Both commit without errors (READ COMMITTED). What is the final balance?
          </p>
        }
        options={['120', '150', '70', 'An error is raised']}
        answer={2}
        explanation="B waits for A, then overwrites A’s value with one computed from a stale read. Replay it, then the three fixes:"
      />
      <Tabs
        items={[
          { label: 'The bug: lost update', content: <SessionPlayer title="Read, compute in the app, write — under READ COMMITTED" frames={scenario('rc-lost-update')} columns={COLUMNS} notes={LOST} /> },
          { label: 'Fix 1: atomic UPDATE', content: <SessionPlayer title="Let the database compute: SET balance = balance + 50" frames={scenario('rc-atomic-update')} columns={COLUMNS} notes={ATOMIC} /> },
          { label: 'Fix 2: SELECT … FOR UPDATE', content: <SessionPlayer title="Lock the row when reading it" frames={scenario('for-update')} columns={COLUMNS} notes={FOR_UPDATE} /> },
          { label: 'Fix 3: REPEATABLE READ', content: <SessionPlayer title="Let the database detect the conflict" frames={scenario('rr-update-conflict')} columns={COLUMNS} notes={RR} /> },
        ]}
      />
      <Table
        head={['Fix', 'Use when']}
        rows={[
          ['UPDATE … SET x = x + …', 'The change can be written as one statement. Simplest and fastest.'],
          ['SELECT … FOR UPDATE', 'You must read, decide in code, then write (e.g. check a limit first).'],
          ['REPEATABLE READ / SERIALIZABLE + retry', 'Many rows or complex logic; you accept retrying on 40001.'],
          ['Version column (optimistic locking)', 'Long “think time” between read and write: UPDATE … WHERE id = $1 AND version = $2, and treat 0 rows updated as a conflict.'],
        ]}
      />

      <h2>Row lock modes</h2>
      <p>A row lock comes in four strengths, so that a foreign-key check does not block an ordinary update of the same row.</p>
      <LocksConflictMatrix
        title="Row locks: can two transactions hold these on the same row? (recorded with NOWAIT)"
        modes={ROW_MODES}
        cells={L.rowMatrix.cells}
        short={(m) => ROW_SHORT[m] ?? m}
        takenBy={(m) =>
          L.rowMatrix.takes
            .filter((t) => t.modes.some((x) => x.toUpperCase().replace(/^FOR /, '') === m.replace(/^FOR /, '')))
            .map((t) => rowStatement(t.sql))
            .join(' · ')
        }
      />
      <Table
        head={['Statement (recorded)', 'Row lock pgrowlocks found in the tuple']}
        rows={L.rowMatrix.takes.map((t) => [<code key="s">{t.sql}</code>, t.modes.join(', ')])}
      />
      <Callout tone="warn" title="What counts as a “key”">
        A key column is any column with a unique index that a foreign key could use — not only the primary key. Updating <code>id</code> took the full{' '}
        <em>Update</em> lock above, and so does updating a <code>UNIQUE</code> email: that update <strong>waits</strong> for a transaction that just
        inserted a referencing row (recorded in <a href="#/postgres/constraints">Constraints and idempotency</a>). An UPDATE that does not change a key
        column takes the weaker <em>No Key Update</em> and does not wait.
      </Callout>
      <CodeBlock
        title="NOWAIT: fail instead of waiting (recorded)"
        language="text"
        code={`SELECT * FROM items WHERE id = 1 FOR UPDATE NOWAIT;\nERROR:  ${L.rowMatrix.nowaitError.kind === 'error' ? L.rowMatrix.nowaitError.message : ''}\nSQLSTATE: ${L.rowMatrix.nowaitError.kind === 'error' ? L.rowMatrix.nowaitError.code : ''}`}
      />

      <h2>Table lock modes</h2>
      <p>
        Every statement takes a table lock before it touches a table. Most take weak modes that never conflict with each other; schema changes take strong
        ones.
      </p>
      <LocksConflictMatrix
        title="Table locks: 64 pairs, each tried with LOCK TABLE … NOWAIT; under each mode, the statements recorded taking it"
        modes={TABLE_MODES}
        cells={L.tableMatrix}
        short={(m) => SHORT[m]}
        takenBy={statementsTaking}
        caption="AS ACCESS SHARE · RS ROW SHARE · RE ROW EXCLUSIVE · SUE SHARE UPDATE EXCLUSIVE · S SHARE · SRE SHARE ROW EXCLUSIVE · E EXCLUSIVE · AE ACCESS EXCLUSIVE"
      />
      <Table
        head={['If you need…', 'Prefer', 'Because']}
        rows={[
          ['a new index on a busy table', 'CREATE INDEX CONCURRENTLY (SUE)', 'plain CREATE INDEX (SHARE) blocks every INSERT, UPDATE and DELETE until it ends'],
          ['a new constraint', 'ADD CONSTRAINT … NOT VALID, then VALIDATE CONSTRAINT (SUE)', 'validation scans the table without blocking writes'],
          ['to shrink a table', 'VACUUM, or pg_repack-style tools', 'VACUUM FULL takes ACCESS EXCLUSIVE for the whole rewrite'],
          ['to change a column type', 'add a new column, backfill in batches, swap', 'ALTER COLUMN TYPE usually rewrites the table under ACCESS EXCLUSIVE'],
        ]}
      />

      <h2>The migration pile-up</h2>
      <p>The most common lock outage is not a slow ALTER TABLE — it is a fast one that has to wait.</p>
      <Predict
        question={
          <p>
            A holds ACCESS SHARE on <code>orders</code> (an open transaction that ran a SELECT). B’s <code>ALTER TABLE orders ADD COLUMN</code> waits for
            it. Now C runs a plain <code>SELECT</code>, which needs only ACCESS SHARE — compatible with A. Does C wait?
          </p>
        }
        options={['No — ACCESS SHARE does not conflict with ACCESS SHARE', 'Yes — it queues behind B’s ACCESS EXCLUSIVE request', 'C gets an error']}
        answer={1}
        explanation="A new request waits if it conflicts with a request already in the queue, so the ALTER cannot be starved. Recorded with four sessions:"
      />
      <SessionPlayer title="ALTER TABLE queued behind an open transaction" frames={PILE} notes={PILE_NOTES} sessions={['A', 'B', 'C', 'D']} aside={lockAside} />
      <Timeline
        title="The same recording on a time axis (ms)"
        lanes={[
          { id: 'A', label: 'A · report' },
          { id: 'B', label: 'B · ALTER' },
          { id: 'C', label: 'C · SELECT' },
          { id: 'D', label: 'D · UPDATE' },
        ]}
        segments={[
          { lane: 'A', from: PILE[2].t, to: pileEnd, label: 'holds ACCESS SHARE', hue: 1 },
          ...(['B', 'C', 'D'] as const).map((s) => ({ lane: s, from: PILE[firstWait(PILE, s)].t, to: PILE[finishedAt(PILE, firstWait(PILE, s), s)].t, label: 'waiting', striped: true, hue: 8 as const })),
        ]}
        events={[
          { lane: 'A', at: pileEnd, label: 'COMMIT', hue: 1 },
          { lane: 'B', at: pileEnd, label: 'ALTER runs', hue: 6 },
          { lane: 'C', at: pileEnd, label: 'runs', hue: 6 },
          { lane: 'D', at: pileEnd, label: 'runs', hue: 6 },
        ]}
        end={pileEnd + 150}
        unit="ms"
      />
      <CodeBlock title="server log with log_lock_waits = on (recorded)" language="text" code={L.pileup.log.join('\n')} />
      <p>
        The log names the holder (<code>Process holding the lock</code>) and the whole queue. Live, the same picture comes from <code>pg_locks</code> and{' '}
        <code>pg_blocking_pids</code>:
      </p>
      <CodeBlock
        title="who blocks whom, right now"
        language="sql"
        code={`SELECT a.pid, pg_blocking_pids(a.pid) AS blocked_by, a.wait_event_type, a.state,
       now() - a.xact_start AS in_transaction, left(a.query, 60) AS query
FROM pg_stat_activity a
WHERE a.datname = current_database() AND a.pid <> pg_backend_pid()
ORDER BY a.xact_start;`}
      />
      <LocksQueuePlayground />

      <h2>Timeouts: wait less, fail fast</h2>
      <p>A timeout turns an unbounded wait into an error the application can handle. All are off (0) by default:</p>
      <Table
        head={['Setting', 'Default (recorded)', 'Ends…', 'Error']}
        rows={[
          ['lock_timeout', `${settings.find((s) => s.name === 'lock_timeout')?.setting} ms`, 'a statement that waited this long for one lock', '55P03 lock_not_available'],
          ['statement_timeout', `${settings.find((s) => s.name === 'statement_timeout')?.setting} ms`, 'a statement that ran this long', '57014 query_canceled'],
          ['idle_in_transaction_session_timeout', `${settings.find((s) => s.name === 'idle_in_transaction_session_timeout')?.setting} ms`, 'the session, when idle inside a transaction', '25P03, connection closed'],
          ['transaction_timeout (PostgreSQL 17+)', `${settings.find((s) => s.name === 'transaction_timeout')?.setting} ms`, 'the session, when a transaction lasts this long', '25P04, connection closed'],
          ['deadlock_timeout', `${settings.find((s) => s.name === 'deadlock_timeout')?.setting} ms`, 'nothing — it is how long to wait before checking for a deadlock', '—'],
        ]}
      />
      <SessionPlayer title="The pile-up again, with lock_timeout = 2s on the migration" frames={TIMEOUT} notes={TIMEOUT_NOTES} sessions={['A', 'B', 'C']} aside={lockAside} />
      <Tabs
        items={[
          { label: 'statement_timeout', content: <CodeBlock title="recorded" language="text" code={`${L.timeouts.statement.sql}\nERROR:  ${L.timeouts.statement.result.kind === 'error' ? L.timeouts.statement.result.message : ''}`} /> },
          { label: 'idle in transaction', content: <CodeBlock title="recorded" language="text" code={`${L.timeouts.idle.sql}\nFATAL:  ${L.timeouts.idle.server?.message ?? ''}  (SQLSTATE ${L.timeouts.idle.server?.code ?? ''}; the server closes the connection)`} /> },
          { label: 'transaction_timeout', content: <CodeBlock title="recorded" language="text" code={`${L.timeouts.transaction.sql}\nFATAL:  ${L.timeouts.transaction.result.kind === 'error' ? `${L.timeouts.transaction.result.message}  (SQLSTATE ${L.timeouts.transaction.result.code})` : ''}`} /> },
        ]}
      />
      <CodeBlock
        title="a safe migration step (not recorded — adapt to your migration tool)"
        language="bash"
        code={`for attempt in 1 2 3 4 5; do
  psql -v ON_ERROR_STOP=1 \\
    -c "SET lock_timeout = '2s'" \\
    -c "SET statement_timeout = '1min'" \\
    -c "ALTER TABLE orders ADD COLUMN note text" && break
  sleep $((attempt * 10))   # the lock holder is still there: try again later
done`}
      />
      <Callout tone="tip" title="Also limit the other side">
        Set <code>idle_in_transaction_session_timeout</code> (for example 1 min) for application roles, so a forgotten open transaction cannot hold its
        locks for hours: <code>ALTER ROLE app SET idle_in_transaction_session_timeout = '1min'</code>.
      </Callout>

      <h2>Deadlocks</h2>
      <p>A deadlock is a cycle of waits; no amount of waiting can end it, so PostgreSQL breaks it.</p>
      <Flow
        title="Two transfers in opposite directions: the wait-for cycle"
        cols={3}
        rows={2}
        nodes={[
          { id: 'A', label: 'transaction A', sub: '1 → 2', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'r2', label: 'account 2', sub: 'row lock', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'B', label: 'transaction B', sub: '2 → 1', col: 2, row: 1, hue: 2, shape: 'actor' },
          { id: 'r1', label: 'account 1', sub: 'row lock', col: 0, row: 1, hue: 3, shape: 'store' },
        ]}
        edges={[
          { from: 'r1', to: 'A', label: 'held by' },
          { from: 'r2', to: 'B', label: 'held by' },
          { from: 'A', to: 'r2', label: 'waits for', hue: 8, dashed: true },
          { from: 'B', to: 'r1', label: 'waits for', hue: 8, dashed: true },
        ]}
        steps={[
          { title: 'Each debits its own account', body: <>A locks account 1, B locks account 2. No conflict yet.</>, active: ['A', 'B', 'r1', 'r2', 'r1>A', 'r2>B'] },
          { title: 'A waits for B', body: <>A wants account 2, held by B. An ordinary wait.</>, active: ['A', 'r2', 'B', 'A>r2', 'r2>B'] },
          { title: 'B waits for A: a cycle', body: <>B wants account 1, held by A. Each waits for the other.</>, active: ['A', 'B', 'r1', 'r2', 'A>r2', 'r2>B', 'B>r1', 'r1>A'] },
          {
            title: 'Detected after deadlock_timeout',
            body: (
              <>
                A has waited 1 s, so its backend searches the wait-for graph, finds the cycle and cancels its own transaction:{' '}
                <code>{deadlockErr?.kind === 'error' ? `${deadlockErr.code} ${deadlockErr.message}` : ''}</code>. B continues.
              </>
            ),
            active: ['A', 'r1', 'r1>A'],
          },
        ]}
      />
      <SessionPlayer title="Two transfers in opposite directions" frames={scenario('deadlock')} columns={COLUMNS} notes={DEADLOCK} />
      <CodeBlock title="what the server logs (recorded)" language="text" code={L.deadlock.log.join('\n')} />
      <Callout tone="tip" title="Avoiding deadlocks">
        Take locks in the same order everywhere — for a transfer, lock the lower account id first (for example with{' '}
        <code>SELECT … WHERE id IN (1, 2) ORDER BY id FOR UPDATE</code>). Keep transactions short, never wait for user input or a remote call while
        holding locks, and retry 40P01 like 40001.
      </Callout>

      <h2>Job queues with SKIP LOCKED</h2>
      <p>
        A table can be a reliable job queue: each worker locks one job, works, marks it done and commits. <code>SKIP LOCKED</code> makes workers pass over
        jobs another worker holds instead of waiting for them.
      </p>
      <SessionPlayer title="Three workers, one jobs table" frames={SKIP} notes={SKIP_NOTES} sessions={['A', 'B', 'C']} aside={rowAside} />
      <CodeBlock title="queue.ts — one worker (TypeScript, node-postgres)" language="ts" code={SOURCES.worker} />
      <StatTiles
        stats={RUNS.map((r) => ({
          label: r.label === 'SKIP LOCKED' ? 'with SKIP LOCKED' : 'plain FOR UPDATE',
          value: `${r.ms} ms`,
          sub: `24 jobs × 30 ms, 4 workers · per worker ${r.per.join(' / ')}`,
          hue: r.label === 'SKIP LOCKED' ? 6 : 8,
          bar: { value: r.ms, max: queueEnd },
        }))}
      />
      {queueTimeline('FOR UPDATE')}
      {queueTimeline('SKIP LOCKED')}
      <BarChart
        title="Time to drain the queue (recorded)"
        bars={RUNS.map((r) => ({ label: r.label, value: r.ms, display: `${r.ms} ms`, hue: r.label === 'SKIP LOCKED' ? 6 : 8 }))}
        marker={{ value: (24 * 30) / 4, label: 'ideal: 180 ms' }}
      />
      <CodeBlock title="queue.ts output (recorded)" language="text" code={CONCURRENCY.apps.queue.log} />
      <Callout tone="note" title="Why plain FOR UPDATE serialises">
        Every worker asks for the oldest queued job, so all of them wait on the same row; when it is released, they re-check it, find it done, and queue
        on the next one. One worker works at a time and some never get a job. With SKIP LOCKED each worker takes the next free row. Keep an index that
        matches the WHERE and ORDER BY (here the primary key), and delete or archive done jobs so the scan stays short.
      </Callout>

      <h2>Advisory locks</h2>
      <p>Advisory locks lock an idea rather than a row: “only one instance runs the nightly report”, “one importer per customer”.</p>
      <SessionPlayer title="Session and transaction advisory locks" frames={ADVISORY} notes={ADVISORY_NOTES} aside={lockAside} />
      <Table
        head={['Function', 'Waits?', 'Released']}
        rows={[
          ['pg_advisory_lock(key)', 'yes', 'pg_advisory_unlock(key) or end of session'],
          ['pg_try_advisory_lock(key)', 'no — returns true / false', 'pg_advisory_unlock(key) or end of session'],
          ['pg_advisory_xact_lock(key)', 'yes', 'end of the transaction'],
          ['pg_try_advisory_xact_lock(key)', 'no — returns true / false', 'end of the transaction'],
        ]}
      />
      <Callout tone="warn" title="Advisory locks and poolers">
        Session-level advisory locks belong to the server connection. Behind a transaction-mode pooler the next transaction may run on another connection
        — use the <code>_xact_</code> variants there (see <a href="#/postgres/pooling">Connection pooling</a>).
      </Callout>

      <h2>Checklist</h2>
      <Table
        head={['Do', 'Why']}
        rows={[
          ['Write read-modify-write as one UPDATE, or lock the row with FOR UPDATE', 'no lost updates'],
          ['Lock rows in a consistent order (ORDER BY id FOR UPDATE)', 'no deadlocks'],
          ['Set lock_timeout (and statement_timeout) in every migration, and retry', 'a waiting ALTER cannot block all traffic'],
          ['Use CREATE INDEX CONCURRENTLY and NOT VALID + VALIDATE on busy tables', 'weaker locks, writes keep flowing'],
          ['Set idle_in_transaction_session_timeout for application roles', 'forgotten transactions release their locks'],
          ['Turn on log_lock_waits; watch pg_blocking_pids', 'you see waits before users report them'],
          ['Use FOR UPDATE SKIP LOCKED for job queues', 'workers never wait for each other'],
          ['Retry 40P01 and 40001 for the whole transaction', 'deadlocks and serialization failures are normal events'],
        ]}
      />

      <Recap
        points={[
          'A row lock is stored in the tuple and held until the transaction ends; a second writer of the row waits.',
          'Four row-lock strengths: FOR KEY SHARE (foreign-key checks) does not conflict with updates of non-key columns.',
          'Eight table-lock modes; ACCESS EXCLUSIVE (most ALTER TABLE, TRUNCATE, DROP, VACUUM FULL) conflicts with everything, even SELECT.',
          'A waiting lock request also blocks every later conflicting request: one ALTER behind an open transaction stops the table. Use lock_timeout.',
          'Deadlocks are detected after deadlock_timeout; one transaction gets 40P01 and should be retried.',
          'SKIP LOCKED turns a table into a job queue; advisory locks lock application-defined keys.',
        ]}
      />
    </>
  )
}
