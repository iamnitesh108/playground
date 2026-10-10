import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'

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

const CASES: { title: string; sql: string; error: Err }[] = [
  { title: 'The same request sent twice', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-1', 25.00);`, error: CAPTURE.errors.unique },
  { title: 'A customer that does not exist', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (99, 'req-2', 10.00);`, error: CAPTURE.errors.foreignKey },
  { title: 'A negative amount', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, 'req-3', -5);`, error: CAPTURE.errors.check },
  { title: 'A missing key', sql: `INSERT INTO payments (customer_id, idempotency_key, amount) VALUES (1, NULL, 5);`, error: CAPTURE.errors.notNull },
  { title: 'Deleting a customer who has payments', sql: `DELETE FROM customers WHERE id = 1;`, error: CAPTURE.errors.fkDelete },
]

export default function Constraints() {
  const { doNothing, doNothingNew, doUpdate } = CAPTURE.onConflict
  return (
    <>
      <LessonGoals
        goals={[
          'let the database enforce rules with constraints',
          'read the real error and SQLSTATE each constraint raises',
          'make writes idempotent with a unique key and ON CONFLICT',
          'know what an error does to the rest of the transaction',
        ]}
      />

      <h2>Rules the database guarantees</h2>
      <p>
        Checks in application code race with each other (lesson 5): two requests can both check “does this exist?” and both insert. A{' '}
        <strong>constraint</strong> is checked by the database, under its own locks, for every write from every client. These are the tables used
        below:
      </p>
      <CodeBlock title="schema" code={SCHEMA} />

      <h2>What each violation looks like</h2>
      <p>Every error below was returned by PostgreSQL 18 for exactly this statement. Applications should branch on the SQLSTATE code, not on the message text.</p>
      {CASES.map((c) => (
        <CodeBlock key={c.title} title={c.title} code={`${c.sql}\n\n${show(c.error)}`} />
      ))}
      <Table
        head={['SQLSTATE', 'Name', 'Typical response']}
        rows={[
          ['23505', 'unique_violation', 'Already exists: return the existing row, or 409 Conflict'],
          ['23503', 'foreign_key_violation', 'Referenced row missing (or still referenced): 4xx to the caller'],
          ['23514', 'check_violation', 'Invalid value: 4xx to the caller'],
          ['23502', 'not_null_violation', 'Missing value: 4xx to the caller'],
        ]}
      />

      <h2>Idempotency with ON CONFLICT</h2>
      <p>
        Networks fail, so clients retry. If every request carries a unique <strong>idempotency key</strong>, a retry can be recognised by the
        unique constraint — and <code>ON CONFLICT</code> turns the error into a decision:
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
        <code>EXCLUDED</code> is the row that was proposed for insertion. ON CONFLICT is safe under concurrency: two identical requests at the same
        moment produce one row, and the second waits for the first and then takes the conflict branch.
      </p>

      <Callout tone="note" title={`Why the new payment got id ${doNothingNew.rows[0].id}`}>
        Only one payment existed (id 1), yet the next inserted row got id {doNothingNew.rows[0].id}. Each failed INSERT above, and the skipped DO
        NOTHING, still took a value from the sequence — you can see ids 4 and 5 in the “Failing row contains” details. Sequences are never rolled
        back, so <strong>ids have gaps</strong>. Never use them as a gap-free counter (invoice numbers, for example).
      </Callout>

      <h2>An error poisons the transaction</h2>
      <p>After any error inside <code>BEGIN … </code>, PostgreSQL refuses every further statement until the transaction ends:</p>
      <CodeBlock
        title="inside a transaction"
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
        <code>ROLLBACK TO SAVEPOINT</code> on error — or better, avoid the error with ON CONFLICT. A COMMIT sent to an aborted transaction does
        not commit: it returns <code>ROLLBACK</code>.
      </Callout>

      <Recap
        points={[
          'Constraints (PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK, NOT NULL) hold for every client and cannot race.',
          'Branch on SQLSTATE: 23505 unique, 23503 foreign key, 23514 check, 23502 not null.',
          'A unique idempotency key plus ON CONFLICT makes retries safe; RETURNING with DO NOTHING returns nothing for a duplicate.',
          'Sequences leave gaps. After an error, a transaction accepts nothing but ROLLBACK (25P02).',
        ]}
      />
    </>
  )
}
