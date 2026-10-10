import type { ReactNode } from 'react'
import { Callout, LessonGoals, Predict, Recap, Table, Tabs } from '@/shared/ui'
import { SessionPlayer } from '../components'
import { scenario } from './frames'

const ACC = ['id', 'balance']
const DOC = ['id', 'on_call']

const RC_NOTES = [
  <>A starts a READ COMMITTED transaction — PostgreSQL’s default level.</>,
  <>A reads row 1: 100. The statement took a snapshot when it started and dropped it when it finished.</>,
  <>B updates row 1 to 200 as a one-statement transaction, and commits.</>,
  <>
    A runs the <strong>same query again</strong> inside the same transaction and gets 200. Every statement takes a fresh snapshot, so it sees
    everything committed before it started. This is a <strong>non-repeatable read</strong>.
  </>,
  <>A commits. Within one transaction, the two reads disagreed.</>,
]

const RR_NOTES = [
  <>A starts a REPEATABLE READ transaction. No snapshot yet — it is taken by the first statement, not by BEGIN.</>,
  <>A reads 100. This first statement takes the transaction’s snapshot, and A keeps it until the end.</>,
  <>B updates row 1 to 200 and commits. The new version is on the page (lp 3).</>,
  <>
    A reads again and still gets <strong>100</strong>. Its snapshot says B’s transaction had not committed when it was taken, so lp 3 is
    invisible to A and lp 1 is still A’s version.
  </>,
  <>A commits; its snapshot is gone.</>,
  <>A new query outside that transaction sees 200.</>,
]

const skewNotes = (level: string, end: ReactNode, result: ReactNode) => [
  <>A starts a {level} transaction. Rule of the hospital: at least one doctor must stay on call.</>,
  <>B starts one too.</>,
  <>A counts the doctors on call: 2. “So I can go off call.”</>,
  <>B counts too: 2. “So I can go off call.” Both read the same, valid state.</>,
  <>A sets doctor 1 off call.</>,
  <>B sets doctor 2 off call. A <em>different</em> row, so nothing blocks — neither transaction sees the other’s change.</>,
  <>A commits.</>,
  end,
  result,
]

const SKEW_RR = skewNotes(
  'REPEATABLE READ',
  <>
    B commits — <strong>successfully</strong>. Each transaction was correct on its own snapshot, and they wrote different rows, so repeatable
    read sees no conflict.
  </>,
  <>
    Nobody is on call. Each check was true when it ran, but the combined result breaks the rule. This anomaly is called{' '}
    <strong>write skew</strong>.
  </>,
)

const SKEW_SER = skewNotes(
  'SERIALIZABLE',
  <>
    B’s COMMIT fails with <code>40001</code>. SERIALIZABLE tracked what each transaction <em>read</em> and noticed that there is no order in
    which running them one after the other gives this result. One of them must fail.
  </>,
  <>
    Doctor 2 is still on call. B’s application should <strong>retry</strong> the whole transaction; on retry its count returns 1 and it
    refuses to go off call.
  </>,
)

export default function Isolation() {
  return (
    <>
      <LessonGoals
        goals={[
          'know when a snapshot is taken at each isolation level',
          'recognise non-repeatable reads and write skew',
          'know which errors to retry under SERIALIZABLE',
        ]}
        before="Lesson 2 — snapshots and visibility"
      />

      <h2>Isolation = which snapshot you get</h2>
      <p>
        In PostgreSQL, the isolation level mostly decides <strong>when the snapshot is taken</strong>. All levels use the MVCC rules from lesson 2;
        none of them ever shows uncommitted data.
      </p>
      <Table
        head={['Level', 'Snapshot', 'What can still happen']}
        rows={[
          ['READ COMMITTED (default)', 'new one for every statement', 'non-repeatable reads, phantoms, lost updates, write skew'],
          ['REPEATABLE READ', 'one, at the first statement, kept until the end', 'write skew; updating a row changed since the snapshot fails with 40001'],
          ['SERIALIZABLE', 'like repeatable read + tracking of reads', 'nothing — but transactions may fail with 40001 and must be retried'],
        ]}
      />
      <Callout tone="note">
        PostgreSQL accepts <code>READ UNCOMMITTED</code> but runs it as READ COMMITTED, and its REPEATABLE READ also prevents phantom rows — both
        are stricter than the SQL standard requires.
      </Callout>

      <h2>Same query, two answers</h2>
      <Predict
        question={
          <p>
            Transaction A reads a balance (100). Meanwhile B changes it to 200 and commits. A runs the same SELECT again. What does A get under READ
            COMMITTED, and under REPEATABLE READ?
          </p>
        }
        options={['100 and 100', '200 and 100', '200 and 200', '100 and 200']}
        answer={1}
        explanation="Read committed takes a new snapshot per statement; repeatable read keeps the first one. Both replays below were recorded:"
      />
      <Tabs
        items={[
          { label: 'Read committed', content: <SessionPlayer title="READ COMMITTED: each statement sees the latest commits" frames={scenario('rc-nonrepeatable')} columns={ACC} notes={RC_NOTES} /> },
          { label: 'Repeatable read', content: <SessionPlayer title="REPEATABLE READ: one snapshot for the whole transaction" frames={scenario('rr-snapshot')} columns={ACC} notes={RR_NOTES} /> },
        ]}
      />

      <h2>Write skew: when snapshots are not enough</h2>
      <p>
        Two doctors are on call; the rule is that at least one must remain. Each transaction checks the rule, then takes its own doctor off call.
        Run it under both levels:
      </p>
      <Tabs
        items={[
          { label: 'Repeatable read', content: <SessionPlayer title="Write skew under REPEATABLE READ" frames={scenario('write-skew-rr')} columns={DOC} notes={SKEW_RR} /> },
          { label: 'Serializable', content: <SessionPlayer title="The same under SERIALIZABLE" frames={scenario('write-skew-serializable')} columns={DOC} notes={SKEW_SER} /> },
        ]}
      />
      <Callout tone="warn" title="SERIALIZABLE needs retries">
        Under SERIALIZABLE, any statement or the COMMIT itself can fail with <code>40001 could not serialize access</code>. That is not a bug — it
        is how the guarantee is kept. Run the transaction in a retry loop (a few attempts, small random backoff), and keep transactions short.
        If you stay at READ COMMITTED, protect rules like this with constraints or explicit row locks (next lesson).
      </Callout>

      <Recap
        points={[
          'READ COMMITTED: a new snapshot per statement. REPEATABLE READ: one snapshot, from the first statement on.',
          'No level in PostgreSQL ever shows uncommitted data.',
          'Write skew — two valid transactions producing an invalid result — is prevented only by SERIALIZABLE.',
          'Under REPEATABLE READ and SERIALIZABLE, retry transactions that fail with 40001.',
        ]}
      />
    </>
  )
}
