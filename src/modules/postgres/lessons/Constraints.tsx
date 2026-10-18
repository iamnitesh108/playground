import { BarChart, Flow, Proportion, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { SessionPlayer, type PlayerFrame, type PlayerResult } from '../components/SessionPlayer'
import { LockTable, RowLockTable, type LockObservation, type RowLockObservation } from '../components/SessionPlayerLocks'
import { ConstraintsOnDelete } from '../components/ConstraintsOnDelete'
import { CAPTURE } from '../data/captures'
import { CONCURRENCY } from '../data/concurrency'
import { SOURCES } from '../data/concurrencySources'
import { resultAt } from './frames'

type LockFrame = PlayerFrame & { readonly obs: readonly LockObservation[] }
type RowFrame = PlayerFrame & { readonly obs: readonly RowLockObservation[] }

const C = CONCURRENCY.constraints

const SCHEMA = `CREATE TABLE customers (
  id    int  PRIMARY KEY,
  email text NOT NULL UNIQUE
);

CREATE TABLE payments (
  id              bigserial     PRIMARY KEY,
  customer_id     int           NOT NULL REFERENCES customers (id),
  idempotency_key text          NOT NULL UNIQUE,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0)
);

INSERT INTO customers VALUES (1, 'ann@example.com');
INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00);`

type Err = { code: string; message: string; detail: string | null }
const show = (e: Err) => `ERROR:  ${e.message}${e.detail ? `\nDETAIL:  ${e.detail}` : ''}\nSQLSTATE: ${e.code}`

/** A recorded result, printed the way psql would. */
const psql = (r: PlayerResult | { readonly kind: string; readonly tag?: string; readonly code?: string; readonly message?: string; readonly detail?: string | null }) =>
  r.kind === 'error' && 'message' in r ? `ERROR:  ${r.message}${r.detail ? `\nDETAIL:  ${r.detail}` : ''}` : 'tag' in r ? String(r.tag) : ''

const CASES: { title: string; sql: string; error: Err }[] = [
  { title: 'The same request sent twice', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00);`, error: CAPTURE.errors.unique },
  { title: 'A customer that does not exist', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (99, 'req-2', 10.00);`, error: CAPTURE.errors.foreignKey },
  { title: 'A negative amount', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-3', -5);`, error: CAPTURE.errors.check },
  { title: 'A missing key', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, NULL, 5);`, error: CAPTURE.errors.notNull },
  { title: 'Deleting a customer who has payments', sql: `DELETE FROM customers WHERE id = 1;`, error: CAPTURE.errors.fkDelete },
]

const lockAside = (frame: LockFrame) => <LockTable rows={frame.obs} empty="no lock waits" />
const rowAside = (frame: RowFrame) => <RowLockTable rows={frame.obs} title="pgrowlocks('customers') after this step" />

// --- the unique race ---
const RACE_COMMIT = C.uniqueRaceCommit as readonly LockFrame[]
const RACE_ROLLBACK = C.uniqueRaceRollback as readonly LockFrame[]
const raceNotes = (commit: boolean) => {
  const b = resultAt(commit ? RACE_COMMIT : RACE_ROLLBACK, 3, 'B')
  return [
    <>A starts a transaction.</>,
    <>A inserts key req-9: the heap tuple is written and the key goes into the unique index — not committed yet.</>,
    <>
      B inserts the same key. The index already holds req-9 from a transaction that is still running, so B cannot decide yet: it waits on A’s
      transaction id (a <code>ShareLock</code> on A’s xid in pg_locks).
    </>,
    commit ? (
      <>
        A commits, so its key is real: B fails with <code>{b?.kind === 'error' ? `${b.code} ${b.message}` : ''}</code>.
      </>
    ) : (
      <>
        A rolls back, so its key never existed: B’s insert goes through — <code>{b?.kind === 'tag' ? b.tag : ''}</code>.
      </>
    ),
  ]
}

// --- ON CONFLICT under concurrency ---
const OC = C.onConflictRace as readonly LockFrame[]
const OC_NOTES = [
  <>A starts a transaction.</>,
  <>A inserts req-9 with ON CONFLICT DO NOTHING: no conflict, one row (not committed).</>,
  <>B sends the same request. Its insert meets A’s uncommitted key and waits for A, like a plain INSERT would.</>,
  <>
    A commits. B wakes up and takes the conflict branch: <code>{(() => { const r = resultAt(OC, 3, 'B'); return r?.kind === 'tag' ? r.tag : '' })()}</code>, no error and no second
    row.
  </>,
  <>B reads the row by its key — the one A created — and answers with it.</>,
]

// --- foreign keys ---
const FK = C.fkKeyShare as readonly RowFrame[]
const fkB = (step: number) => resultAt(FK, step, 'B')
const FK_NOTES = [
  <>A starts a transaction.</>,
  <>
    A inserts a payment for customer 1. To be sure the customer exists — and keeps existing until A commits — the foreign-key check locks the customer
    row <strong>FOR KEY SHARE</strong>. pgrowlocks shows it.
  </>,
  <>
    B updates the customer’s <code>name</code>: <code>{fkB(3)?.kind === 'tag' ? (fkB(3) as { tag: string }).tag : ''}</code> at once. A non-key column
    takes FOR NO KEY UPDATE, which is compatible with KEY SHARE.
  </>,
  <>
    B updates the <code>email</code> — and <strong>waits</strong>. <code>email</code> is UNIQUE, so it counts as a key column: the update takes FOR
    UPDATE, which conflicts with A’s KEY SHARE.
  </>,
  <>A commits; B’s email update goes through.</>,
  <>A starts another transaction…</>,
  <>…and inserts a second payment: KEY SHARE on the customer again.</>,
  <>B tries to delete the customer and waits — a DELETE needs the strongest row lock.</>,
  <>
    A commits. B wakes up, re-checks, and fails:{' '}
    <code>{(() => { const r = fkB(8); return r?.kind === 'error' ? `${r.code} ${r.detail}` : '' })()}</code>
  </>,
]

const execMs = (plan: readonly string[]) => Number(plan.find((l) => l.startsWith('Execution Time'))?.match(/([\d.]+) ms/)?.[1] ?? 0)

// --- idempotency app ---
const IDEM = CONCURRENCY.apps.idempotent
const copies = IDEM.split('\n').filter((l) => l.includes(' copy '))
const created = copies.filter((l) => l.includes('→ 201')).length
const replayed = copies.filter((l) => l.includes('→ 200')).length

// --- exclusion constraint ---
const hour = (hhmm: string) => Number(hhmm.slice(0, 2)) + Number(hhmm.slice(3)) / 60
const BOOKINGS = C.bookings
const rejected = BOOKINGS.filter((b) => b.result.kind === 'error')
const excl = rejected[0]?.result
const overlaps = C.withoutOverlaps[1]

export default function Constraints() {
  const { doNothing, doNothingNew, doUpdate } = CAPTURE.onConflict
  return (
    <>
      <LessonGoals
        goals={[
          'let the database enforce rules with constraints, and read the error each one raises',
          'explain how a unique index enforces UNIQUE — including two inserts racing',
          'use deferrable, exclusion and foreign-key constraints, and know the locks they take',
          'make writes idempotent with a unique key and ON CONFLICT',
        ]}
        before={
          <>
            <a href="#/postgres/locks">Concurrent writes and locks</a> — row locks and waiting
          </>
        }
      />

      <h2>Rules the database guarantees</h2>
      <p>
        A constraint is a rule the database checks on every write, from every client. Checks in application code race with each other: two requests can
        both ask “does this exist?” and both insert. A constraint is checked under the database’s own locks, so it cannot race.
      </p>
      <TermList
        items={[
          { term: 'constraint', definition: 'PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, NOT NULL or EXCLUDE: a rule stored with the table.' },
          { term: 'backing index', definition: 'The index that makes PRIMARY KEY, UNIQUE and EXCLUDE fast to check. It is created with the constraint and shares its name.' },
          { term: 'deferrable', definition: 'A constraint that may be checked at the end of the statement or at COMMIT instead of row by row.' },
          { term: 'exclusion constraint', definition: 'No two rows may match pairwise under given operators — e.g. same room AND overlapping time.' },
          { term: 'idempotency key', definition: 'A unique id the client sends with a request, so a retried request can be recognised and answered without doing the work twice.' },
        ]}
      />
      <CodeBlock title="the tables used below" language="sql" code={SCHEMA} />

      <h2>What each violation looks like</h2>
      <p>Every error below was returned by PostgreSQL 18 for exactly this statement. Applications should branch on the SQLSTATE code, not on the message text.</p>
      {CASES.map((c) => (
        <CodeBlock key={c.title} title={c.title} language="text" code={`${c.sql}\n\n${show(c.error)}`} />
      ))}
      <Table
        head={['SQLSTATE', 'Name', 'Typical response']}
        rows={[
          ['23505', 'unique_violation', 'Already exists: return the existing row, or 409 Conflict'],
          ['23503', 'foreign_key_violation', 'Referenced row missing (or still referenced): 4xx to the caller'],
          ['23514', 'check_violation', 'Invalid value: 4xx to the caller'],
          ['23502', 'not_null_violation', 'Missing value: 4xx to the caller'],
          ['23P01', 'exclusion_violation', 'Overlaps an existing row (a booking): 409 Conflict'],
          ['23001', 'restrict_violation', 'ON DELETE RESTRICT: still referenced'],
        ]}
      />

      <h2>How UNIQUE is enforced</h2>
      <p>A UNIQUE or PRIMARY KEY constraint is a unique B-tree index; the check happens while the new key is put into it.</p>
      <Table
        head={['Constraint (recorded from pg_constraint)', 'Type', 'Checked with index', 'Method']}
        rows={C.uniqueIndex.map((r) => [
          <code key="c">{r.constraint_name}</code>,
          ({ p: 'primary key', u: 'unique', f: 'foreign key' } as Record<string, string>)[r.type] ?? r.type,
          <code key="i">{r.backing_index}</code>,
          r.method,
        ])}
      />
      <p>The foreign key has no index of its own: it uses the referenced table’s primary key to find the customer.</p>
      <Flow
        title="INSERT into a table with a unique index"
        cols={4}
        rows={2}
        nodes={[
          { id: 'ins', label: 'INSERT req-9', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'heap', label: 'heap tuple', sub: 'written first', col: 1, row: 0, hue: 3, shape: 'store' },
          { id: 'idx', label: 'unique B-tree', sub: 'look for req-9', col: 2, row: 0, hue: 7, shape: 'store' },
          { id: 'ok', label: 'inserted', sub: 'no live equal key', col: 3, row: 0, hue: 6 },
          { id: 'wait', label: 'wait for its xid', sub: 'inserter still running', col: 2, row: 1, hue: 4 },
          { id: 'dup', label: '23505', sub: 'inserter committed', col: 3, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'ins', to: 'heap' },
          { from: 'heap', to: 'idx', label: 'index entry' },
          { from: 'idx', to: 'ok', hue: 6 },
          { from: 'idx', to: 'wait', label: 'equal key', hue: 4 },
          { from: 'wait', to: 'dup', label: 'commit', hue: 8 },
          { from: 'wait', to: 'ok', label: 'rollback', dashed: true },
        ]}
        steps={[
          { title: 'The row goes to the heap', body: <>The new tuple is written to a table page first, like any insert.</>, active: ['ins', 'heap', 'ins>heap'] },
          { title: 'The index checks for an equal key', body: <>Inserting the index entry, the B-tree looks at the entries with the same key on that leaf page. If none is visible and alive, the insert is done.</>, active: ['heap', 'idx', 'ok', 'heap>idx', 'idx>ok'] },
          { title: 'Same key, transaction still running', body: <>If the equal key belongs to a transaction that has not finished, nobody can know yet whether it will exist: the inserter waits on that transaction id.</>, active: ['idx', 'wait', 'idx>wait'] },
          { title: 'The other transaction decides', body: <>It commits → 23505. It rolls back → its key never existed, and this insert succeeds. Either way the dead heap tuple of the loser stays behind for vacuum.</>, active: ['wait', 'dup', 'ok', 'wait>dup', 'wait>ok'] },
        ]}
      />
      <Tabs
        items={[
          { label: 'The first one commits', content: <SessionPlayer title="Two inserts of the same key" frames={RACE_COMMIT} notes={raceNotes(true)} aside={lockAside} /> },
          { label: 'The first one rolls back', content: <SessionPlayer title="Two inserts of the same key" frames={RACE_ROLLBACK} notes={raceNotes(false)} aside={lockAside} /> },
        ]}
      />
      <Callout tone="note" title="NULLs are never equal — unless you say so">
        In a plain UNIQUE column two NULLs are allowed (recorded: {C.nullsDistinct.map((r) => psql(r)).join(', ')}). With{' '}
        <code>UNIQUE NULLS NOT DISTINCT</code> (PostgreSQL 15+) the second NULL is a duplicate:{' '}
        <code>{psql(C.nullsNotDistinct[1]).split('\n')[0]}</code>.
      </Callout>

      <h2>When a constraint is checked: deferrable</h2>
      <p>By default a constraint is checked immediately; a deferrable one can be checked later, at the end of the statement or at COMMIT.</p>
      <Predict
        question={
          <p>
            <code>playlist</code> has positions 1, 2, 3 and <code>UNIQUE (pos)</code>. Does <code>UPDATE playlist SET pos = pos + 1</code> work? The
            result has no duplicates.
          </p>
        }
        options={['Yes — the final positions 2, 3, 4 are unique', 'No — 23505 while it is halfway', 'Only at SERIALIZABLE']}
        answer={1}
        explanation={`A non-deferrable unique index is checked row by row: moving 1 → 2 meets the old 2. Recorded: “${C.shiftImmediate.kind === 'error' ? C.shiftImmediate.message : ''}”. Declared DEFERRABLE, the same UPDATE answered ${C.shiftDeferrable.kind === 'tag' ? C.shiftDeferrable.tag : ''}.`}
      />
      <Timeline
        title="Schematic: when each kind of constraint is checked during one transaction"
        lanes={[
          { id: 'imm', label: 'UNIQUE (default)' },
          { id: 'stmt', label: 'DEFERRABLE' },
          { id: 'tx', label: 'DEFERRED' },
        ]}
        segments={[
          { lane: 'imm', from: 1, to: 4, hue: 1 },
          { lane: 'stmt', from: 1, to: 4, label: 'UPDATE …', hue: 1 },
          { lane: 'tx', from: 1, to: 4, label: 'UPDATE …', hue: 1 },
          { lane: 'tx', from: 5, to: 8, label: 'more statements', hue: 1 },
        ]}
        events={[
          { lane: 'imm', at: 1.5, label: 'row 1', hue: 7 },
          { lane: 'imm', at: 2.5, label: 'row 2', hue: 7 },
          { lane: 'imm', at: 3.5, label: 'row 3', hue: 7 },
          { lane: 'stmt', at: 4, label: 'end of statement', hue: 7 },
          { lane: 'tx', at: 9, label: 'COMMIT', hue: 7 },
        ]}
        start={0}
        end={10}
        unit="step"
      />
      <Tabs
        items={[
          {
            label: 'Shift every position',
            content: (
              <CodeBlock
                title="recorded"
                language="text"
                code={`-- UNIQUE (pos)
UPDATE playlist SET pos = pos + 1;
${psql(C.shiftImmediate)}

ALTER TABLE playlist DROP CONSTRAINT playlist_pos_key;
ALTER TABLE playlist ADD CONSTRAINT playlist_pos_key UNIQUE (pos) DEFERRABLE;
UPDATE playlist SET pos = pos + 1;
${psql(C.shiftDeferrable)}`}
              />
            ),
          },
          {
            label: 'Swap two rows',
            content: (
              <CodeBlock
                title="recorded: positions a = 2, b = 3, c = 4"
                language="text"
                code={`BEGIN;
SET CONSTRAINTS playlist_pos_key DEFERRED;
UPDATE playlist SET pos = 4 WHERE song = 'a';   -- ${psql(C.swap[0])}, a duplicate for now
UPDATE playlist SET pos = 2 WHERE song = 'c';   -- ${psql(C.swap[1])}
COMMIT;                                          -- ${psql(C.swap[2])}

BEGIN;
SET CONSTRAINTS playlist_pos_key DEFERRED;
UPDATE playlist SET pos = 3 WHERE song = 'a';   -- ${psql(C.swapBroken[0])}
COMMIT;
${psql(C.swapBroken[1])}`}
              />
            ),
          },
          {
            label: 'Child before parent',
            content: (
              <CodeBlock
                title="recorded: REFERENCES orders DEFERRABLE INITIALLY DEFERRED"
                language="text"
                code={`BEGIN;
INSERT INTO order_lines VALUES (7, 1);   -- ${psql(C.deferredFk[0])}: order 7 does not exist yet
INSERT INTO orders VALUES (7);           -- ${psql(C.deferredFk[1])}
COMMIT;                                  -- ${psql(C.deferredFk[2])}

BEGIN;
INSERT INTO order_lines VALUES (8, 1);   -- ${psql(C.deferredFkFail[0])}
COMMIT;
${psql(C.deferredFkFail[1])}`}
              />
            ),
          },
        ]}
      />
      <Callout tone="warn" title="Deferred means the error moves to COMMIT">
        A deferred violation surfaces only at COMMIT, far from the statement that caused it, and the whole transaction is lost. Defer only constraints
        that are temporarily broken on purpose (swaps, cycles of references). <code>NOT NULL</code> and <code>CHECK</code> can never be deferred.
      </Callout>

      <h2>Exclusion constraints: no overlapping bookings</h2>
      <p>
        UNIQUE says “no two rows with equal keys”. An exclusion constraint generalises it: “no two rows where <em>these</em> operators all match” — for
        bookings, the same room <strong>and</strong> overlapping times.
      </p>
      <CodeBlock
        title="bookings"
        language="sql"
        code={`CREATE EXTENSION btree_gist;   -- lets a GiST index handle "room WITH ="

CREATE TABLE bookings (
  id     int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room   int NOT NULL,
  during tstzrange NOT NULL,
  EXCLUDE USING gist (room WITH =, during WITH &&)
);`}
      />
      <Timeline
        title="Five booking attempts on 2 November, in order (recorded)"
        lanes={[
          { id: '101', label: 'room 101' },
          { id: '102', label: 'room 102' },
          { id: 'x', label: 'rejected' },
        ]}
        segments={BOOKINGS.map((b, i) => ({
          lane: b.result.kind === 'error' ? 'x' : String(b.room),
          from: hour(b.from),
          to: hour(b.to),
          label: b.result.kind === 'error' ? `#${i + 1} room ${b.room}: 23P01` : `#${i + 1} ${b.from}–${b.to}`,
          hue: b.result.kind === 'error' ? 8 : b.room === 101 ? 1 : 2,
          striped: b.result.kind === 'error',
        }))}
        start={9}
        end={13}
        unit="h"
      />
      <p>
        Ranges are half-open (<code>[from, to)</code>), so 10:00–11:30 starts exactly where 09:00–10:00 ends without overlapping. The rejected attempt
        overlapped room 101’s 10:00–11:30:
      </p>
      <CodeBlock title="recorded" language="text" code={excl ? psql(excl) : ''} />
      <Callout tone="tip" title="PostgreSQL 18: WITHOUT OVERLAPS">
        PostgreSQL 18 can say the same as a primary key: <code>PRIMARY KEY (room, during WITHOUT OVERLAPS)</code>. It creates a{' '}
        {C.withoutOverlapsIndex[0]?.method ?? 'gist'} index ({C.withoutOverlapsIndex[0]?.index}) and rejects overlaps with the same SQLSTATE — recorded:{' '}
        <code>{overlaps.kind === 'error' ? overlaps.message : ''}</code>. It still needs <code>btree_gist</code> for the plain column.
      </Callout>
      <p>
        Like UNIQUE, an exclusion constraint waits for an uncommitted conflicting row, so two parallel requests for the same slot cannot both succeed — at
        any isolation level. That is write skew prevented without SERIALIZABLE.
      </p>

      <h2>Foreign keys: locks and cascades</h2>
      <p>
        A foreign key is checked by a hidden trigger that looks up the referenced row — and locks it, so it cannot disappear before you commit. (For
        this recording <code>customers</code> also has a plain <code>name</code> column.)
      </p>
      <SessionPlayer title="What a foreign-key check locks" frames={FK} notes={FK_NOTES} aside={rowAside} />
      <Table
        head={['Row lock held by the FK check', 'Concurrent statement on the customer row', 'Result (recorded)']}
        rows={[
          ['FOR KEY SHARE', 'UPDATE customers SET name = …', 'runs at once (NO KEY UPDATE is compatible)'],
          ['FOR KEY SHARE', 'UPDATE customers SET email = … (UNIQUE column)', 'waits for the inserting transaction'],
          ['FOR KEY SHARE', 'DELETE FROM customers …', 'waits, then 23503 if the payment committed'],
        ]}
      />
      <p>When a referenced row is deleted, the foreign key’s ON DELETE action decides what happens to the rows that point at it:</p>
      <ConstraintsOnDelete
        before={[
          { id: 1, order_id: 1 },
          { id: 2, order_id: 1 },
          { id: 3, order_id: 1 },
          { id: 4, order_id: 2 },
        ]}
        outcomes={C.onDelete}
      />
      <p>
        NO ACTION (the default) and RESTRICT both refuse; NO ACTION checks at the end of the statement (and can be deferred), RESTRICT immediately. CASCADE
        deletes the children, SET NULL (or SET DEFAULT) keeps them detached.
      </p>
      <BarChart
        title="Deleting 100 orders with no lines, 400 000 lines in the child table (recorded EXPLAIN ANALYZE)"
        bars={[
          { label: 'no index on order_lines.order_id', value: execMs(C.fkIndex.without), display: `${execMs(C.fkIndex.without).toLocaleString()} ms`, hue: 8 },
          { label: 'with that index', value: execMs(C.fkIndex.with), display: `${execMs(C.fkIndex.with)} ms`, hue: 6 },
        ]}
      />
      <CodeBlock title="without the index (recorded)" language="text" code={`EXPLAIN (ANALYZE) ${C.fkIndex.sql}\n${C.fkIndex.without.join('\n')}`} />
      <Callout tone="warn" title="Index the referencing column">
        PostgreSQL indexes the referenced key (it must be unique) but not the referencing column. Without that index every DELETE or key UPDATE of a
        parent scans the child table once per row — the “Trigger for constraint” line above. Create <code>CREATE INDEX ON order_lines (order_id)</code>{' '}
        for every foreign key whose parent rows are ever deleted.
      </Callout>

      <h2>Idempotency with ON CONFLICT</h2>
      <p>
        Networks fail, so clients retry. If every request carries a unique <strong>idempotency key</strong>, a retry is recognised by the unique
        constraint — and <code>ON CONFLICT</code> turns the error into a decision.
      </p>
      <Predict
        question={
          <p>
            <code>req-1</code> already exists. What does <code>INSERT … VALUES (1, 'req-1', 25.00) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id</code>{' '}
            return?
          </p>
        }
        options={['An error 23505', 'The id of the existing row', 'No rows: INSERT 0 0']}
        answer={2}
        explanation="DO NOTHING skips the row silently, and RETURNING only returns rows that were actually inserted. To get the existing row, select it afterwards — or use DO UPDATE."
      />
      <Table
        head={['Statement', 'Result (recorded)']}
        rows={[
          [<code key="sql">… ('req-1', 25.00) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id</code>, `INSERT 0 ${doNothing.rowCount} — no rows returned`],
          [<code key="sql">… ('req-4', 40.00) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id</code>, `INSERT 0 ${doNothingNew.rowCount} — id = ${doNothingNew.rows[0].id}`],
          [
            <code key="sql">… ('req-1', 30.00) ON CONFLICT (idempotency_key) DO UPDATE SET amount = EXCLUDED.amount RETURNING id, amount</code>,
            `INSERT 0 ${doUpdate.rowCount} — id = ${doUpdate.rows[0].id}, amount = ${doUpdate.rows[0].amount}`,
          ],
        ]}
      />
      <p>
        <code>EXCLUDED</code> is the row that was proposed for insertion. For idempotency, prefer DO NOTHING plus a lookup: a retry must not change the
        stored payment.
      </p>
      <Flow
        title="A payment request, its lost reply, and the retry"
        cols={3}
        rows={2}
        nodes={[
          { id: 'client', label: 'client', sub: 'key k-7f3a', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'api', label: 'payment API', col: 1, row: 0, hue: 1 },
          { id: 'db', label: 'payments', sub: 'UNIQUE (key)', col: 2, row: 0, hue: 3, shape: 'store' },
          { id: 'lookup', label: 'SELECT by key', sub: 'the stored row', col: 1, row: 1, hue: 7 },
          { id: 'resp', label: 'same answer', sub: '200, payment 1', col: 0, row: 1, hue: 6 },
        ]}
        edges={[
          { from: 'client', to: 'api', label: 'POST' },
          { from: 'api', to: 'db', label: 'ON CONFLICT' },
          { from: 'db', to: 'lookup', label: '0 rows', dashed: true },
          { from: 'lookup', to: 'resp' },
          { from: 'resp', to: 'client' },
        ]}
        steps={[
          { title: 'First request', body: <>The client generates a key and sends it with the request. <code>INSERT … ON CONFLICT DO NOTHING RETURNING</code> creates payment 1 → 201.</>, active: ['client', 'api', 'db', 'client>api', 'api>db'] },
          { title: 'The reply is lost', body: <>A timeout: the client cannot know whether the payment happened. Sending it again without a key could charge twice.</>, active: ['client', 'api'] },
          { title: 'The retry, same key', body: <>The INSERT conflicts and does nothing (0 rows). The API selects the row by its key and answers exactly as the first time: 200, payment 1.</>, active: ['client', 'api', 'db', 'lookup', 'resp', 'client>api', 'api>db', 'db>lookup', 'lookup>resp', 'resp>client'] },
          { title: 'Same key, different body', body: <>The stored row does not match the request: answer 422 — the client reused a key by mistake.</>, active: ['api', 'lookup'] },
        ]}
      />
      <CodeBlock title="idempotent.ts (TypeScript, node-postgres)" language="ts" code={SOURCES.payment} />
      <CodeBlock title="output (recorded)" language="text" code={IDEM} />
      <Proportion
        title="Five copies of one request sent at the same moment (recorded)"
        parts={[
          { label: 'created (201)', value: created, hue: 6 },
          { label: 'answered from the stored row (200)', value: replayed, hue: 7 },
        ]}
        unit=""
      />
      <SessionPlayer title="Why concurrent copies are safe: ON CONFLICT waits too" frames={OC} notes={OC_NOTES} aside={lockAside} />
      <Callout tone="note" title={`Why ids have gaps (payment ${IDEM.match(/copy 1 .*payment (\d+)/)?.[1] ?? ''} above)`}>
        Every INSERT takes a value from the sequence before the conflict is found, and sequences never roll back. The failed and skipped inserts above
        used ids too, so the next payment got a higher number. Ids have gaps — never use them as a gap-free counter (invoice numbers, for example).
      </Callout>

      <h2>An error poisons the transaction</h2>
      <p>After any error inside a transaction block, PostgreSQL refuses every further statement until the transaction ends.</p>
      <CodeBlock
        title="inside a transaction (recorded)"
        language="text"
        code={`BEGIN;
INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00);
ERROR:  ${CAPTURE.errors.unique.message}
SELECT 1;
ERROR:  ${CAPTURE.abortedTx.message}
SQLSTATE: ${CAPTURE.abortedTx.code}
ROLLBACK;`}
      />
      <Callout tone="tip" title="Recovering inside a transaction">
        If an error is expected and the transaction should continue, wrap the risky statement in a <code>SAVEPOINT</code> and{' '}
        <code>ROLLBACK TO SAVEPOINT</code> on error — or better, avoid the error with ON CONFLICT. A COMMIT sent to an aborted transaction does not
        commit: it returns <code>ROLLBACK</code>.
      </Callout>

      <h2>Design rules</h2>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Put every invariant you can in a constraint: NOT NULL, CHECK, UNIQUE, FK, EXCLUDE', 'checked for every client, cannot race'],
          ['Name constraints and map SQLSTATEs (23505, 23503, 23514, 23P01) to API errors', 'stable error handling, not message parsing'],
          ['Index every referencing (FK) column whose parent rows get deleted or re-keyed', 'no table scan per deleted parent'],
          ['Use an exclusion constraint (or WITHOUT OVERLAPS) for “no overlap” rules', 'no double booking without SERIALIZABLE'],
          ['Give every retried write an idempotency key with a UNIQUE constraint', 'retries never do the work twice'],
          ['Use ON CONFLICT DO NOTHING + lookup for idempotency; DO UPDATE for upserts', 'no 23505 in the normal path'],
          ['Defer only constraints that are broken on purpose inside a transaction', 'errors stay next to their cause'],
          ['Add constraints to big tables as NOT VALID, then VALIDATE CONSTRAINT', 'weaker lock while the table is scanned'],
        ]}
      />

      <Recap
        points={[
          'Constraints hold for every client and cannot race; branch on SQLSTATE: 23505, 23503, 23514, 23502, 23P01.',
          'UNIQUE is a unique index: a second insert of an uncommitted key waits for the first transaction, then fails (commit) or succeeds (rollback).',
          'Non-deferrable unique checks run row by row; DEFERRABLE checks at statement end, DEFERRED at COMMIT.',
          'Exclusion constraints forbid overlaps (bookings); PostgreSQL 18 adds PRIMARY KEY … WITHOUT OVERLAPS.',
          'A foreign-key check locks the parent row FOR KEY SHARE; index the referencing column.',
          'A unique idempotency key plus ON CONFLICT DO NOTHING and a lookup makes retries safe; sequences leave gaps.',
        ]}
      />
    </>
  )
}
