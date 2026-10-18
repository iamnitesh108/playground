import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Snapshot', definition: 'Which transactions count as committed for a statement (READ COMMITTED) or a whole transaction (REPEATABLE READ and above).', lesson: 'isolation' },
  { term: 'Isolation level', definition: 'READ COMMITTED (default), REPEATABLE READ or SERIALIZABLE: how much of other transactions’ work you can see.', lesson: 'isolation' },
  { term: 'Anomaly', definition: 'A result that could not happen if the transactions had run one after another: dirty read, non-repeatable read, phantom, write skew…', lesson: 'isolation' },
  { term: 'Write skew', definition: 'Two transactions read overlapping data and each write a different row, together breaking a rule neither broke alone.', lesson: 'isolation' },
  { term: 'Serialization failure', definition: 'SQLSTATE 40001: PostgreSQL aborts a transaction to prevent an anomaly. Retry the whole transaction.', lesson: 'isolation' },
  { term: 'SSI', definition: 'Serializable snapshot isolation: snapshot isolation plus tracking of read/write dependencies — how SERIALIZABLE works.', lesson: 'isolation' },
  { term: 'Predicate lock', definition: 'A SIRead lock that blocks nobody; it records what a serializable transaction read.', lesson: 'isolation' },
]
