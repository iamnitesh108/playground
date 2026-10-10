import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { SessionPlayer } from '../components'
import { scenario, xidAt, xmaxAt } from './frames'

const frames = scenario('mvcc-update')
const a = xidAt(frames, 2, 'A')
const del = xmaxAt(frames, 7, 2)

const NOTES = [
  <>Session A opens a transaction. It has no transaction id yet: PostgreSQL assigns one (an <strong>xid</strong>) only when a transaction first writes.</>,
  <>
    A updates row 1 and gets xid {a}. The old version at lp 1 is <strong>not overwritten</strong>: its <code>xmax</code> is set to {a}{' '}
    (“deleted by {a}”) and its <code>ctid</code> now points to (0,3), where the new version lives with <code>xmin = {a}</code> and balance 150.
  </>,
  <>
    B reads and still sees 100. For B, the new version’s <code>xmin</code> ({a}) is in progress, so it is invisible; the old version’s{' '}
    <code>xmax</code> is in progress too, so the old version still counts. B was not blocked: <strong>readers never wait for writers</strong>.
  </>,
  <>A reads its own change: a transaction always sees what it wrote itself.</>,
  <>
    A commits. Look at the page: <strong>nothing in it changed</strong>. Only the status of {a} flipped to committed (it is kept in the commit
    log, <code>pg_xact</code>). Committing is cheap because no row has to be touched.
  </>,
  <>B reads again. Now {a} is committed, so the old version is deleted and the new one is live: B sees 150.</>,
  <>
    A deletes row 2 (as its own one-statement transaction, xid {del}). A DELETE writes no new version — it only sets <code>xmax = {del}</code>{' '}
    on lp 2. The row’s bytes are still on the page.
  </>,
  <>
    B sees only row 1. The page holds three tuples, but two of them are now <strong>dead</strong>: no transaction can ever see them again.
    Removing them is VACUUM’s job — next lesson.
  </>,
]

export default function Mvcc() {
  return (
    <>
      <LessonGoals
        goals={[
          'see that an UPDATE writes a new row version instead of changing the old one',
          'read xmin, xmax and ctid on a real page',
          'decide which version a transaction sees',
        ]}
        before="Lesson 1 — pages and line pointers"
      />

      <h2>Two people, one row</h2>
      <p>
        If one transaction is changing a row while another reads it, what should the reader see? Many databases make the reader wait. PostgreSQL
        keeps <strong>several versions</strong> of the row instead, and each transaction picks the version that is right for it. This is{' '}
        <strong>multi-version concurrency control (MVCC)</strong>.
      </p>
      <TermList
        items={[
          { term: 'tuple', definition: 'One physical version of a row on a page.' },
          { term: 'xid', definition: 'Transaction id: a 32-bit counter, assigned at a transaction’s first write.' },
          { term: 'xmin', definition: 'The xid that created this version (INSERT or UPDATE).' },
          { term: 'xmax', definition: 'The xid that deleted or replaced this version (DELETE or UPDATE), or that locked it; 0 if none.' },
          { term: 'ctid', definition: 'Where the newer version of this row is: (page, line pointer). Points to itself if this is the newest.' },
        ]}
      />

      <Predict
        question={
          <p>
            Table <code>accounts</code> has row <code>(1, 100)</code>. A transaction runs <code>UPDATE accounts SET balance = 150 WHERE id = 1</code>{' '}
            and commits. How many versions of row 1 are now physically on the page?
          </p>
        }
        options={['1 — the value was changed in place', '2 — the old one and the new one', '0 — the row moved to a new page']}
        answer={1}
        explanation="An UPDATE is a DELETE of the old version plus an INSERT of a new one, in one step. Both stay on the page until vacuum. Watch it happen:"
      />

      <SessionPlayer title="UPDATE, COMMIT and DELETE, seen from two sessions" frames={frames} columns={['id', 'balance']} notes={NOTES} />
      <p>
        Ignore the <em>HOT updated</em> and <em>heap-only</em> labels for now; lesson 3 explains them. Hover a transaction id to see its status.
      </p>

      <h2>The visibility rule</h2>
      <p>
        When a query starts, it takes a <strong>snapshot</strong>: which transactions had committed at that moment. A tuple is visible to it when:
      </p>
      <Table
        head={['Check', 'Visible if…']}
        rows={[
          ['xmin', 'the creating transaction committed before the snapshot — or it is my own transaction'],
          ['xmax', 'is 0, or the deleting transaction aborted, or it had not committed at snapshot time (and it is not me)'],
        ]}
      />
      <p>
        Exactly one version of a row passes both checks for a given snapshot (or none, if the row is deleted). The real rules have more cases —
        subtransactions, row locks recorded in <code>xmax</code>, hint bits that cache the commit status on the tuple — but they all come back to
        these two checks.
      </p>

      <Callout tone="note" title="What MVCC costs">
        Every UPDATE leaves an old version behind, so tables collect dead tuples that must be cleaned up. And because transaction ids are 32-bit
        counters, very old tuples must eventually be <em>frozen</em>. Both are handled by VACUUM.
      </Callout>

      <Recap
        points={[
          'An UPDATE writes a new tuple and marks the old one with xmax; a DELETE only sets xmax.',
          'Each statement sees the versions allowed by its snapshot — readers do not block writers, writers do not block readers.',
          'COMMIT changes no tuple: it only records the transaction as committed in pg_xact.',
        ]}
      />
    </>
  )
}
