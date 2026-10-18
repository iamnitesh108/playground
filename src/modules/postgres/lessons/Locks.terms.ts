import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Lost update', definition: 'Two read-modify-write cycles overlap and one overwrites the other’s change.', lesson: 'locks' },
  { term: 'Row lock', definition: 'Stored in the tuple’s xmax; FOR KEY SHARE, FOR SHARE, FOR NO KEY UPDATE or FOR UPDATE.', lesson: 'locks' },
  { term: 'SELECT … FOR UPDATE', definition: 'Reads rows and locks them against other writers until the transaction ends.', lesson: 'locks' },
  { term: 'Table lock', definition: 'One of eight modes in pg_locks, from ACCESS SHARE (every SELECT) to ACCESS EXCLUSIVE (most ALTER TABLE).', lesson: 'locks' },
  { term: 'Lock queue', definition: 'Waiting requests in arrival order; a new request also waits if it conflicts with one already waiting — the migration pile-up.', lesson: 'locks' },
  { term: 'lock_timeout', definition: 'Gives up waiting for a lock after this long; essential around schema migrations.', lesson: 'locks' },
  { term: 'Deadlock', definition: 'Transactions each waiting for a lock another holds. Detected after deadlock_timeout; one is aborted (SQLSTATE 40P01).', lesson: 'locks' },
  { term: 'SKIP LOCKED', definition: 'FOR UPDATE SKIP LOCKED skips rows another transaction has locked — the basis of job queues in PostgreSQL.', lesson: 'locks' },
  { term: 'Advisory lock', definition: 'A lock on a number of your choosing for coordinating application work; session- or transaction-scoped.', lesson: 'locks' },
]
