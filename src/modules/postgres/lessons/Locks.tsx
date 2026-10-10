import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs } from '@/shared/ui'
import { SessionPlayer } from '../components'
import { scenario } from './frames'

const COLUMNS = ['id', 'balance']

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
    The balance is <strong>70</strong>, not 120. A’s +50 is gone without any error: a <strong>lost update</strong>. The bug is the
    read-compute-write pattern, not the database.
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
    A tries to add 50. The row was changed after A’s snapshot, and A cannot see that change — so instead of waiting and re-reading (as read
    committed does), PostgreSQL refuses: <code>40001 could not serialize access due to concurrent update</code>.
  </>,
  <>A rolls back. Nothing was lost; nothing was overwritten.</>,
  <>A fresh transaction sees 70. Retrying A’s work now gives the correct 120.</>,
]

const FOR_UPDATE = [
  <>A begins.</>,
  <>
    A reads the row <strong>FOR UPDATE</strong>: 100, and the row is locked. Look at lp 1: its <code>xmax</code> is now A’s xid, although nothing
    was deleted. A row lock is recorded in the tuple itself, as a “lock-only” xmax.
  </>,
  <>B begins.</>,
  <>B also asks for row 1 FOR UPDATE — and waits. It cannot even read it this way until A is done.</>,
  <>A writes 150, computed from the value it locked.</>,
  <>
    A commits. B’s SELECT … FOR UPDATE finishes and returns <strong>150</strong> — the newest version, not the 100 it would have read
    earlier. B now holds the lock (see lp 3’s <code>xmax</code>).
  </>,
  <>B computes 150 − 30 and writes 120.</>,
  <>B commits.</>,
  <>
    <strong>120</strong>. Read-compute-write is safe when the read takes the lock: the second reader waits and then works on the up-to-date
    value.
  </>,
]

const DEADLOCK = [
  <>A begins: transfer 10 from account 1 to account 2.</>,
  <>B begins: transfer 10 from account 2 to account 1.</>,
  <>A debits account 1 and holds its row lock.</>,
  <>B debits account 2 and holds its row lock.</>,
  <>A wants to credit account 2 — locked by B. A waits.</>,
  <>
    B wants to credit account 1 — locked by A. Now each waits for the other, forever: a <strong>deadlock</strong>. After{' '}
    <code>deadlock_timeout</code> (1 s) a waiting backend checks for cycles and cancels one transaction: A gets{' '}
    <code>40P01 deadlock detected</code>. Its locks are released and B’s update goes through (lp 5: 100 + 10, because A’s 90 is aborted).
  </>,
  <>B commits its transfer.</>,
  <>A’s transaction is already aborted; the application rolls it back. It should now retry the whole transfer.</>,
  <>B’s transfer is applied, A’s is not (yet). The database stayed consistent; the retry is the application’s job.</>,
]

export default function Locks() {
  return (
    <>
      <LessonGoals
        goals={[
          'spot a lost update and fix it three ways',
          'see row locks in a page (xmax) and in the waiting session',
          'understand deadlocks and the errors to retry',
        ]}
        before="Lesson 4 — isolation levels"
      />

      <h2>Writers do wait for writers</h2>
      <p>
        MVCC lets readers and writers run side by side, but two transactions cannot change the same row at once. The first UPDATE or DELETE takes a{' '}
        <strong>row lock</strong>, held until its transaction ends; a second writer of that row waits. What happens when it wakes up depends on the
        isolation level.
      </p>

      <Predict
        question={
          <p>
            Balance 100. Two transactions each read it, then A writes <code>100 + 50</code> and B writes <code>100 − 30</code>, as values computed in
            the application. Both commit without errors (READ COMMITTED). What is the final balance?
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
      <Table
        head={['Mode', 'Taken by', 'Blocks']}
        rows={[
          ['FOR UPDATE', 'SELECT … FOR UPDATE, DELETE, UPDATE of a key column', 'all other row locks'],
          ['FOR NO KEY UPDATE', 'UPDATE that changes no key column', 'all but FOR KEY SHARE'],
          ['FOR SHARE', 'SELECT … FOR SHARE', 'updates and deletes'],
          ['FOR KEY SHARE', 'foreign-key checks', 'deletes and key updates only'],
        ]}
      />
      <p>
        That last pair is why inserting an order that references a customer does not block an update of the customer’s email: the foreign key only
        needs the key to stay. For work queues, <code>FOR UPDATE SKIP LOCKED</code> lets many workers each grab a different row without waiting.
      </p>

      <h2>Deadlocks</h2>
      <SessionPlayer title="Two transfers in opposite directions" frames={scenario('deadlock')} columns={COLUMNS} notes={DEADLOCK} />
      <Callout tone="tip" title="Avoiding deadlocks">
        Take locks in the same order everywhere — for a transfer, lock the lower account id first (for example with{' '}
        <code>SELECT … WHERE id IN (1, 2) ORDER BY id FOR UPDATE</code>). Keep transactions short, and never wait for user input or a remote call
        while holding locks.
      </Callout>
      <CodeBlock
        title="errors to retry (the whole transaction, not the statement)"
        code={`40001  serialization_failure    could not serialize access …
40P01  deadlock_detected        deadlock detected`}
      />
      <p>
        Table-level locks exist too. Most statements take weak ones that do not conflict with each other, but schema changes such as{' '}
        <code>ALTER TABLE</code> take an <code>ACCESS EXCLUSIVE</code> lock that also blocks reads. Set a short <code>lock_timeout</code> before
        migrations so one does not queue behind a long query and block everything behind it.
      </p>

      <Recap
        points={[
          'A row lock is held until the transaction ends; a second writer of the row waits.',
          'Read-then-write in the application loses updates under READ COMMITTED. Use an atomic UPDATE, FOR UPDATE, or a stricter level with retries.',
          'Row locks are recorded in the tuple’s xmax.',
          'Deadlocks are detected after deadlock_timeout; one transaction gets 40P01. Lock in a consistent order and retry.',
        ]}
      />
    </>
  )
}
