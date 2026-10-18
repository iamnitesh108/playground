import type { ReactNode } from 'react'
import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { SessionPlayer, type PlayerFrame } from '../components/SessionPlayer'
import { LockTable, type LockObservation } from '../components/SessionPlayerLocks'
import { IsolationExplorer, type Anomaly, type IsolationRun } from '../components/IsolationExplorer'
import { CONCURRENCY } from '../data/concurrency'
import { SOURCES } from '../data/concurrencySources'
import { outcomeAt, resultAt, scenario, valueAt } from './frames'

type Rec = PlayerFrame & { readonly t: number; readonly obs?: readonly LockObservation[] }
type Run = IsolationRun<Rec>

const ACC = ['id', 'balance']
const ISO = CONCURRENCY.isolation
const run = (anomaly: string, level: string): Run => ISO[`${anomaly}|${level}` as keyof typeof ISO]

const LEVELS = [
  { value: 'READ UNCOMMITTED', label: 'Read uncommitted' },
  { value: 'READ COMMITTED', label: 'Read committed' },
  { value: 'REPEATABLE READ', label: 'Repeatable read' },
  { value: 'SERIALIZABLE', label: 'Serializable' },
]

const ANOMALIES: Anomaly[] = [
  { id: 'dirty-read', label: 'Dirty read', what: 'reading another transaction’s change before it commits — it may still roll back.' },
  { id: 'non-repeatable-read', label: 'Non-repeatable read', what: 'the same row, read twice in one transaction, has changed in between.' },
  { id: 'phantom', label: 'Phantom', what: 'the same query, run twice, finds rows that were not there before.' },
  { id: 'lost-update', label: 'Lost update', what: 'two read-then-write transactions; the second write silently replaces the first.' },
  { id: 'write-skew', label: 'Write skew', what: 'two transactions check the same rule, then each changes a different row — together they break the rule.' },
  { id: 'read-only-anomaly', label: 'Read-only anomaly', what: 'a transaction that only reads sees a state that no serial order could produce.' },
]

const snapshotNote = (level: string, first: boolean) =>
  level === 'READ COMMITTED' || level === 'READ UNCOMMITTED'
    ? 'This statement takes its own snapshot and drops it when it ends.'
    : first
      ? 'This first statement takes the transaction’s snapshot; A keeps it until COMMIT.'
      : 'It reuses the snapshot taken by the first statement.'


/** Step captions for each recorded anomaly, written from the recorded values. */
function notesFor(anomaly: string, level: string): ReactNode[] {
  const f = run(anomaly, level).frames
  const ru = level === 'READ UNCOMMITTED' ? ' PostgreSQL accepts READ UNCOMMITTED but runs it exactly like READ COMMITTED.' : ''
  switch (anomaly) {
    case 'dirty-read':
      return [
        <>B starts a transaction.</>,
        <>B sets the balance to 999 and does <strong>not</strong> commit.</>,
        <>A starts a {level} transaction.{ru}</>,
        <>
          A reads <strong>{valueAt(f, 4, 'A')}</strong>. B’s change is uncommitted, so no snapshot can see it — at any level. A dirty read is impossible
          in PostgreSQL.
        </>,
        <>B rolls back. Had A read 999, it would have used a value that never existed.</>,
        <>A commits.</>,
      ]
    case 'non-repeatable-read': {
      const a = valueAt(f, 2, 'A'), b = valueAt(f, 4, 'A')
      return [
        <>A starts a {level} transaction.{ru}</>,
        <>A reads {a}. {snapshotNote(level, true)}</>,
        <>B sets the balance to 200 in a one-statement transaction: it commits at once.</>,
        a !== b ? (
          <>
            A runs the same query and gets <strong>{b}</strong>: a new snapshot sees B’s commit. The row changed under A — a{' '}
            <strong>non-repeatable read</strong>.
          </>
        ) : (
          <>
            A runs the same query and still gets <strong>{b}</strong>. {snapshotNote(level, false)} B’s commit happened after it, so it stays invisible.
          </>
        ),
        <>A commits.</>,
      ]
    }
    case 'phantom': {
      const a = outcomeAt(f, 2, 'A'), b = outcomeAt(f, 4, 'A')
      return [
        <>A starts a {level} transaction.{ru}</>,
        <>A counts customer 1’s orders and sums them: {a}. {snapshotNote(level, true)}</>,
        <>B inserts a new order for customer 1 and commits.</>,
        a !== b ? (
          <>
            A runs the same query: <strong>{b}</strong>. A row matching A’s WHERE clause appeared — a <strong>phantom</strong>.
          </>
        ) : (
          <>
            A runs the same query: <strong>{b}</strong>. The new row is not in A’s snapshot. PostgreSQL’s repeatable read prevents phantoms too, which
            the SQL standard does not require.
          </>
        ),
        <>A commits.</>,
      ]
    }
    case 'lost-update': {
      const b = resultAt(f, 6, 'B')
      return [
        <>A starts a {level} transaction. Goal: add 50.{ru}</>,
        <>A reads 100 and computes 100 + 50 = 150 in the application.</>,
        <>B starts one too. Goal: subtract 30.</>,
        <>B also reads 100 and computes 70.</>,
        <>A writes 150 and now holds the row lock until it ends.</>,
        <>B writes 70 and <strong>waits</strong> for A’s row lock.</>,
        b?.kind === 'error' ? (
          <>
            A commits. B wakes up, but the row changed after B’s snapshot and B cannot see that change. Instead of overwriting it, PostgreSQL fails B
            with <code>{b.code}</code> <em>{b.message}</em>.
          </>
        ) : (
          <>
            A commits. B wakes up, re-reads the newest version (150), sees its WHERE clause still matches, and writes its <strong>70</strong> over it.
          </>
        ),
        b?.kind === 'error' ? <>B’s COMMIT answers ROLLBACK: a failed transaction can only roll back. The application retries B from the start.</> : <>B commits.</>,
        <>
          The balance is <strong>{valueAt(f, 9, 'A')}</strong>.{' '}
          {valueAt(f, 9, 'A') === '70' ? 'A’s +50 is gone, with no error anywhere: a lost update.' : 'A’s +50 is kept; B’s −30 will be applied by its retry (giving 120).'}
        </>,
      ]
    }
    case 'write-skew': {
      const end = resultAt(f, 8, 'B')
      return [
        <>A starts a {level} transaction. Rule: at least one doctor stays on call.{ru}</>,
        <>B starts one too.</>,
        <>A counts the doctors on call: 2. “So I can go off call.”{level === 'SERIALIZABLE' && ' The read also leaves a predicate (SIRead) lock — see the table below.'}</>,
        <>B counts too: 2. Both read the same, valid state.</>,
        <>A takes doctor 1 off call.</>,
        <>B takes doctor 2 off call. A different row, so nothing blocks.</>,
        <>A commits.</>,
        end?.kind === 'error' ? (
          <>
            B’s COMMIT fails with <code>{end.code}</code>: <em>{end.message}</em>. SSI saw that each transaction read what the other wrote — no serial order
            gives this result.
          </>
        ) : (
          <>B commits — successfully. Each was correct on its own snapshot and they wrote different rows, so there is no write conflict to detect.</>
        ),
        <>
          Doctors on call: <strong>{valueAt(f, 9, 'A')}</strong>.{' '}
          {valueAt(f, 9, 'A') === '0' ? 'The rule is broken although every check passed: write skew.' : 'The rule holds; B’s retry will count 1 and stay on call.'}
        </>,
      ]
    }
    default: {
      const commit = resultAt(f, 10, 'A')
      return [
        <>A starts a {level} transaction to record a payment.{ru}</>,
        <>A reads the open batch (1) and adds dan’s 40 to batch 1. Not committed yet.</>,
        <>B starts a transaction to close the batch.</>,
        <>B moves the open batch to 2…</>,
        <>…and commits. From now on, batch 1 is closed and final.</>,
        <>C starts a READ ONLY {level} transaction to print the report of the closed batch.</>,
        <>C sees batch {valueAt(f, 7, 'C')} is open, so batch 1 is closed.</>,
        <>
          C totals batch 1: <strong>{outcomeAt(f, 8, 'C')}</strong> (receipts, total). A’s payment is not in C’s snapshot — A has not committed.
        </>,
        <>C commits its report.</>,
        commit?.kind === 'error' ? (
          <>
            A’s COMMIT fails with <code>{commit.code}</code>. Committing it would add a payment to a batch C has already reported as final — a state no
            serial order explains. A retries, reads open batch 2, and lands there.
          </>
        ) : (
          <>A commits. Its payment lands in batch 1 — a batch C already reported as closed with 3 receipts.</>
        ),
        <>
          Batch 1 now: <strong>{outcomeAt(f, 11, 'C')}</strong>.{' '}
          {commit?.kind === 'error' ? 'The report stays true.' : 'The report C printed is wrong, although C only read and every transaction committed.'}
        </>,
      ]
    }
  }
}

const sireadAside = (anomaly: string, level: string) =>
  anomaly === 'write-skew'
    ? (frame: Rec, index: number) => (
        <LockTable
          rows={frame.obs ?? []}
          title="Predicate (SIRead) locks in pg_locks"
          empty={
            level !== 'SERIALIZABLE'
              ? 'none — only SERIALIZABLE takes predicate locks'
              : run(anomaly, level).frames.slice(0, index).some((f) => (f as Rec).obs?.length)
                ? 'none any more — SIRead locks outlive a commit, but are released once every overlapping transaction has ended'
                : 'none yet'
          }
        />
      )
    : undefined

// --- figures built from the recordings ---

const RC = run('non-repeatable-read', 'READ COMMITTED').frames
const RR = run('non-repeatable-read', 'REPEATABLE READ').frames

const ROA = run('read-only-anomaly', 'REPEATABLE READ').frames
const ROA_SER = run('read-only-anomaly', 'SERIALIZABLE').frames
const roaError = resultAt(ROA_SER, 10, 'A')

const WS_SER = run('write-skew', 'SERIALIZABLE').frames as readonly Rec[]
const wsError = resultAt(WS_SER, 8, 'B')

const SSI = CONCURRENCY.ssi
const lastB = (frames: readonly PlayerFrame[]) => resultAt(frames, frames.length - 1, 'B')
const ssiTile = (frames: readonly PlayerFrame[]) => {
  const r = lastB(frames)
  return r?.kind === 'error' ? `${r.code}` : 'both commit'
}
const readStep = (frames: readonly Rec[]) => frames.findIndex((f) => f.step?.s === 'B' && f.step.sql.startsWith('SELECT'))

const retryLog = CONCURRENCY.apps.retry
const retried = (retryLog.match(/doctor (\d) +attempt 1 failed/)?.[1] ?? '?').replace(/^/, 'Doctor ')

export default function Isolation() {
  return (
    <>
      <LessonGoals
        goals={[
          'say when each isolation level takes its snapshot',
          'name the six classic anomalies and which level stops each one — from recorded runs',
          'explain how SERIALIZABLE detects conflicts (SSI) and why it needs a retry loop',
          'choose a level, or a lock or constraint instead, for a given rule',
        ]}
        before={
          <>
            <a href="#/postgres/mvcc">Rows are versions (MVCC)</a> — snapshots and xmin/xmax
          </>
        }
      />

      <h2>Isolation decides which snapshot you get</h2>
      <p>
        An isolation level says how much a transaction may notice of other transactions running at the same time. In PostgreSQL every level is built on
        the MVCC snapshots of the previous lessons; the level mostly decides <strong>when a snapshot is taken</strong> and what happens when two
        transactions collide.
      </p>
      <TermList
        items={[
          { term: 'snapshot', definition: 'The list of transactions that had committed at a moment. A query sees exactly the row versions those transactions made.' },
          { term: 'anomaly', definition: 'A result that could not happen if the transactions had run one after the other.' },
          { term: 'serialization failure', definition: 'SQLSTATE 40001: PostgreSQL refuses a transaction to prevent an anomaly. Retrying it is the fix.' },
          { term: 'SSI', definition: 'Serializable snapshot isolation: how SERIALIZABLE works — snapshot isolation plus tracking of what each transaction read.' },
          { term: 'predicate lock', definition: 'A SIRead “lock” that blocks nobody; it only records what a serializable transaction read.' },
        ]}
      />
      <Table
        head={['Level', 'Snapshot taken', 'On a write conflict', 'Still possible']}
        rows={[
          ['READ COMMITTED (default)', 'by every statement', 'waits, then re-reads the newest row and continues', 'non-repeatable read, phantom, lost update, write skew, read-only anomaly'],
          ['REPEATABLE READ', 'once, by the first statement', 'waits; if the other commits, fails with 40001', 'write skew, read-only anomaly'],
          ['SERIALIZABLE', 'once, by the first statement', 'like repeatable read; also fails on read/write dependency cycles', 'nothing — at the price of retries'],
        ]}
      />
      <Callout tone="note">
        PostgreSQL accepts <code>READ UNCOMMITTED</code> but runs it as READ COMMITTED, and its REPEATABLE READ also prevents phantoms. Both are stricter
        than the SQL standard requires — the recordings below show it.
      </Callout>

      <h2>Snapshots: per statement or per transaction</h2>
      <p>The difference between the two main levels is the moment the snapshot is taken.</p>
      <Timeline
        title="The same two reads, recorded at two levels (each step is one statement)"
        lanes={[
          { id: 'b', label: 'B (writer)' },
          { id: 'rc', label: 'A · read committed' },
          { id: 'rr', label: 'A · repeatable read' },
        ]}
        segments={[
          { lane: 'rc', from: 1, to: 5, label: 'transaction', hue: 1 },
          { lane: 'rr', from: 1, to: 5, label: 'transaction', hue: 1 },
        ]}
        events={[
          { lane: 'b', at: 3, label: 'UPDATE → 200, commit', hue: 2 },
          { lane: 'rc', at: 2, label: `snapshot 1: ${valueAt(RC, 2, 'A')}`, hue: 1 },
          { lane: 'rc', at: 4, label: `snapshot 2: ${valueAt(RC, 4, 'A')}`, hue: 8 },
          { lane: 'rr', at: 2, label: `snapshot: ${valueAt(RR, 2, 'A')}`, hue: 1 },
          { lane: 'rr', at: 4, label: `same snapshot: ${valueAt(RR, 4, 'A')}`, hue: 6 },
        ]}
        start={0}
        end={6}
        unit="step"
      />
      <Predict
        question={
          <p>
            Transaction A reads a balance (100). Meanwhile B changes it to 200 and commits. A runs the same SELECT again. What does A get under READ
            COMMITTED, and under REPEATABLE READ?
          </p>
        }
        options={['100 and 100', '200 and 100', '200 and 200', '100 and 200']}
        answer={1}
        explanation="Read committed takes a new snapshot per statement; repeatable read keeps the first one. Both replays below were recorded, with the table’s page:"
      />
      <Tabs
        items={[
          {
            label: 'Read committed',
            content: (
              <SessionPlayer
                title="READ COMMITTED: each statement sees the latest commits"
                frames={scenario('rc-nonrepeatable')}
                columns={ACC}
                notes={[
                  <>A starts a READ COMMITTED transaction — PostgreSQL’s default level.</>,
                  <>A reads row 1: 100. The statement took a snapshot when it started and dropped it when it finished.</>,
                  <>B updates row 1 to 200 as a one-statement transaction, and commits.</>,
                  <>
                    A runs the <strong>same query again</strong> and gets 200. Every statement takes a fresh snapshot, so it sees everything committed
                    before it started.
                  </>,
                  <>A commits. Within one transaction, the two reads disagreed.</>,
                ]}
              />
            ),
          },
          {
            label: 'Repeatable read',
            content: (
              <SessionPlayer
                title="REPEATABLE READ: one snapshot for the whole transaction"
                frames={scenario('rr-snapshot')}
                columns={ACC}
                notes={[
                  <>A starts a REPEATABLE READ transaction. No snapshot yet — it is taken by the first statement, not by BEGIN.</>,
                  <>A reads 100. This first statement takes the transaction’s snapshot, and A keeps it until the end.</>,
                  <>B updates row 1 to 200 and commits. The new version is on the page (lp 3).</>,
                  <>
                    A reads again and still gets <strong>100</strong>. Its snapshot says B’s transaction had not committed when it was taken, so lp 3 is
                    invisible to A and lp 1 is still A’s version.
                  </>,
                  <>A commits; its snapshot is gone.</>,
                  <>A new query outside that transaction sees 200.</>,
                ]}
              />
            ),
          },
        ]}
      />
      <Callout tone="tip" title="BEGIN does not take the snapshot">
        Under REPEATABLE READ the snapshot comes from the transaction’s first statement. Anything committed between <code>BEGIN</code> and that
        statement is still visible.
      </Callout>

      <h2>Six anomalies, four levels — recorded</h2>
      <p>
        Each cell below is the outcome of a real run: the same statements, in the same order, at each level. Pick a cell (or use the switches) and step
        through the sessions to check the verdict yourself.
      </p>
      <IsolationExplorer anomalies={ANOMALIES} levels={LEVELS} run={run} notes={notesFor} aside={sireadAside} />
      <Table
        head={['Anomaly', 'Typical bug it causes', 'Stopped by']}
        rows={[
          ['Dirty read', 'acting on data that is rolled back a moment later', 'every level (impossible in PostgreSQL)'],
          ['Non-repeatable read', 'a total that disagrees with the rows shown next to it', 'REPEATABLE READ'],
          ['Phantom', 'a report whose count and list differ', 'REPEATABLE READ (in PostgreSQL)'],
          ['Lost update', 'two +1 clicks counting as one; a stock count that drifts', 'REPEATABLE READ (40001), or an atomic UPDATE / FOR UPDATE'],
          ['Write skew', 'double booking; nobody left on call; a limit exceeded by two parallel requests', 'SERIALIZABLE, or explicit locks / constraints'],
          ['Read-only anomaly', 'a report that later becomes untrue', 'SERIALIZABLE'],
        ]}
      />

      <h2>The read-only anomaly</h2>
      <p>
        Snapshot isolation can go wrong even for a transaction that only reads. Three transactions are enough: one adds a payment to the open batch, one
        closes the batch, and one prints the closed batch’s report.
      </p>
      <Timeline
        title="Recorded at REPEATABLE READ (each step is one statement)"
        lanes={[
          { id: 'A', label: 'A · add payment' },
          { id: 'B', label: 'B · close batch' },
          { id: 'C', label: 'C · report' },
        ]}
        segments={[
          { lane: 'A', from: 1, to: 10, hue: 1 },
          { lane: 'B', from: 3, to: 5, hue: 2 },
          { lane: 'C', from: 6, to: 9, label: 'read only', hue: 7 },
        ]}
        events={[
          { lane: 'A', at: 2, label: 'reads batch 1, adds 40', hue: 1 },
          { lane: 'A', at: 10, label: 'commits into batch 1', hue: 8 },
          { lane: 'B', at: 5, label: 'batch 2 open, commit', hue: 2 },
          { lane: 'C', at: 8, label: `batch 1 = ${outcomeAt(ROA, 8, 'C')}`, hue: 7 },
        ]}
        start={0}
        end={11}
        unit="step"
      />
      <p>
        C reports batch 1 as closed with {outcomeAt(ROA, 8, 'C').split(',')[0]} receipts; after A commits, batch 1 holds {outcomeAt(ROA, 11, 'C').split(',')[0]}.
        Under SERIALIZABLE the same run ends differently: A’s COMMIT fails with <code>{roaError?.kind === 'error' ? roaError.code : '—'}</code>, so the report
        stays true. Pick “Read-only anomaly” in the explorer above to replay both.
      </p>

      <h2>How SERIALIZABLE works: SSI</h2>
      <p>
        SERIALIZABLE runs on the same snapshots as REPEATABLE READ and adds bookkeeping: it remembers what each transaction read and looks for a dangerous
        pattern of read/write dependencies.
      </p>
      <Flow
        title="Write skew under SERIALIZABLE, as recorded"
        cols={3}
        rows={3}
        nodes={[
          { id: 'ra', label: 'A: count on call', sub: 'reads 2', col: 0, row: 0, hue: 1 },
          { id: 'rb', label: 'B: count on call', sub: 'reads 2', col: 0, row: 1, hue: 2 },
          { id: 'lk', label: 'SIRead locks', sub: 'what A and B read', col: 1, row: 0, rowSpan: 2, hue: 7, shape: 'store' },
          { id: 'wa', label: 'A: doctor 1 off', col: 2, row: 0, hue: 1 },
          { id: 'wb', label: 'B: doctor 2 off', col: 2, row: 1, hue: 2 },
          { id: 'out', label: 'cycle A ⇄ B', sub: `B’s COMMIT: ${wsError?.kind === 'error' ? wsError.code : '—'}`, col: 1, row: 2, hue: 8 },
        ]}
        edges={[
          { from: 'ra', to: 'lk', label: 'record' },
          { from: 'rb', to: 'lk', label: 'record' },
          { from: 'wa', to: 'lk', label: 'check', dashed: true },
          { from: 'wb', to: 'lk', label: 'check', dashed: true },
          { from: 'lk', to: 'out', label: 'rw-conflicts', hue: 8 },
        ]}
        steps={[
          { title: 'Reads leave predicate locks', body: <>Each SELECT records what it read as a SIRead lock. It blocks nobody — a sequential scan records the whole relation.</>, active: ['ra', 'rb', 'lk', 'ra>lk', 'rb>lk'] },
          { title: 'A writes what B read', body: <>A’s UPDATE matches B’s SIRead lock: an rw-conflict B → A (“B must come before A”, since B did not see A’s change).</>, active: ['wa', 'lk', 'wa>lk'] },
          { title: 'B writes what A read', body: <>B’s UPDATE matches A’s lock: A → B. Now each must come before the other.</>, active: ['wb', 'lk', 'wb>lk'] },
          {
            title: 'No serial order exists',
            body: (
              <>
                A commits first, so B is cancelled at its COMMIT: <code>{wsError?.kind === 'error' ? wsError.message : ''}</code>. Detail:{' '}
                <em>{wsError?.kind === 'error' ? wsError.detail : ''}</em>
              </>
            ),
            active: ['lk', 'out', 'lk>out'],
          },
        ]}
        caption="Nobody waits: SSI lets both transactions run and cancels one when it finds the cycle."
      />
      <Callout tone="note" title="The rule SSI actually checks">
        PostgreSQL does not search for full cycles. It cancels a transaction when it finds a “pivot”: a transaction with an rw-conflict coming in and one
        going out, where the other side has committed. That is cheaper and sometimes cancels a transaction that would have been fine — a{' '}
        <strong>false positive</strong>.
      </Callout>
      <p>How precisely reads are recorded decides how many false positives you get. Three recorded pairs of SERIALIZABLE transactions:</p>
      <StatTiles
        stats={[
          { label: 'different rows, index scans', value: ssiTile(SSI.disjointIndex), sub: 'locks on single tuples and index pages', hue: 6 },
          { label: 'different rows, sequential scans', value: ssiTile(SSI.disjointSeq), sub: 'a lock on the whole table: false positive', hue: 8 },
          { label: 'each writes what the other read', value: ssiTile(SSI.crossIndex), sub: 'a real conflict', hue: 8 },
        ]}
      />
      <Tabs
        items={[
          { label: 'Index scan', content: <LockTable rows={(SSI.disjointIndex as readonly Rec[])[readStep(SSI.disjointIndex)].obs ?? []} title="SIRead locks after both reads (index scans)" /> },
          { label: 'Sequential scan', content: <LockTable rows={(SSI.disjointSeq as readonly Rec[])[readStep(SSI.disjointSeq)].obs ?? []} title="SIRead locks after both reads (sequential scans)" /> },
        ]}
      />
      <Callout tone="tip" title="Fewer false positives">
        Give serializable queries indexes so they record tuples instead of whole tables, keep transactions short, and declare read-only transactions{' '}
        <code>READ ONLY</code> (with <code>DEFERRABLE</code> for long reports: they wait for a safe snapshot and then can never fail). When a transaction
        reads many tuples of one page, or many pages of one table, PostgreSQL merges their locks into one coarser lock
        (<code>max_pred_locks_per_page</code>, <code>max_pred_locks_per_relation</code>), which raises false positives.
      </Callout>

      <h2>Retry loops</h2>
      <p>Under REPEATABLE READ and SERIALIZABLE a failure is part of normal operation, so the application runs the whole transaction in a loop.</p>
      <Flow
        title="A transaction with retries"
        cols={4}
        rows={2}
        nodes={[
          { id: 'begin', label: 'BEGIN', sub: 'SERIALIZABLE', col: 0, row: 0, hue: 1 },
          { id: 'work', label: 'read, decide, write', col: 1, row: 0, hue: 1 },
          { id: 'commit', label: 'COMMIT', col: 2, row: 0, hue: 1 },
          { id: 'ok', label: 'done', col: 3, row: 0, hue: 6, shape: 'actor' },
          { id: 'fail', label: 'an error', sub: 'ROLLBACK', col: 2, row: 1, hue: 8 },
          { id: 'wait', label: 'back off', sub: 'random, growing', col: 0, row: 1, hue: 4 },
          { id: 'give', label: 'give up', sub: 'also after N tries', col: 3, row: 1, hue: 8, shape: 'actor' },
        ]}
        edges={[
          { from: 'begin', to: 'work' },
          { from: 'work', to: 'commit' },
          { from: 'commit', to: 'ok', label: 'ok', hue: 6 },
          { from: 'commit', to: 'fail', label: 'fails', hue: 8, dashed: true },
          { from: 'fail', to: 'wait', label: '40001 / 40P01' },
          { from: 'wait', to: 'begin', label: 'retry' },
          { from: 'fail', to: 'give', label: 'other', dashed: true },
        ]}
        steps={[
          { title: 'Run the whole transaction', body: <>Every attempt starts at BEGIN and re-reads everything: the decision must be made on fresh data.</>, active: ['begin', 'work', 'commit', 'begin>work', 'work>commit'] },
          { title: 'Success', body: <>Most attempts commit the first time.</>, active: ['commit', 'ok', 'commit>ok'] },
          { title: 'Retryable failure', body: <>Any statement or the COMMIT may fail with 40001 (serialization) or 40P01 (deadlock). Roll back, wait a little — longer each time, with randomness so the two do not collide again — and start over.</>, active: ['commit', 'fail', 'wait', 'begin', 'commit>fail', 'fail>wait', 'wait>begin'] },
          { title: 'Other errors and limits', body: <>Constraint violations, bad input or too many attempts are not retried: they go back to the caller.</>, active: ['fail', 'give', 'fail>give'] },
        ]}
      />
      <CodeBlock title="retry.ts — the helper (TypeScript, node-postgres)" language="ts" code={SOURCES.retry} />
      <CodeBlock title="retry.ts — the transaction it runs" language="ts" code={SOURCES.retryUse} />
      <CodeBlock title="output, recorded: both doctors try to go off call at once" language="text" code={retryLog} />
      <p>
        {retried}’s first attempt fails at COMMIT; the retry reads the new state (one doctor on call) and correctly stays on call. No locks, no special
        cases — just the loop.
      </p>
      <Callout tone="warn" title="Retries and side effects">
        Retry only the database work. An email sent or a payment API called inside the loop runs again on every attempt — do such calls after the commit,
        or make them idempotent (see <a href="#/postgres/constraints">Constraints and idempotency</a>).
      </Callout>

      <h2>Design rules</h2>
      <Table
        head={['Situation', 'Choose']}
        rows={[
          ['Simple reads and single-statement writes', 'READ COMMITTED (the default)'],
          ['A counter or balance changed by many clients', 'an atomic UPDATE … SET x = x + 1 at READ COMMITTED'],
          ['Read, decide in code, then write the same row', 'SELECT … FOR UPDATE, or REPEATABLE READ + retry'],
          ['A rule over several rows (on call, no double booking, a limit)', 'SERIALIZABLE + retry, or a constraint (exclusion, unique) where one fits'],
          ['A long report that must be consistent', 'REPEATABLE READ, or SERIALIZABLE READ ONLY DEFERRABLE'],
          ['Many short transactions at SERIALIZABLE', 'indexes on the filtered columns; keep transactions short; retry 40001'],
        ]}
      />
      <p>
        Next: the locks behind “waits” — row locks, table locks and deadlocks — in <a href="#/postgres/locks">Concurrent writes and locks</a>.
      </p>

      <Recap
        points={[
          'READ COMMITTED takes a snapshot per statement; REPEATABLE READ and SERIALIZABLE take one at the first statement.',
          'No level in PostgreSQL ever shows uncommitted data; READ UNCOMMITTED behaves as READ COMMITTED.',
          'REPEATABLE READ stops non-repeatable reads, phantoms and lost updates (with 40001); only SERIALIZABLE stops write skew and the read-only anomaly.',
          'SERIALIZABLE records reads as SIRead locks, cancels a transaction on a dangerous rw-conflict pattern, and can give false positives.',
          'Run REPEATABLE READ and SERIALIZABLE transactions in a retry loop for 40001 and 40P01.',
        ]}
      />
    </>
  )
}
