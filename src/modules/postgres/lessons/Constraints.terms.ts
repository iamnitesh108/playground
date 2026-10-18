import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Constraint', definition: 'A rule the database enforces on every write: NOT NULL, CHECK, UNIQUE, PRIMARY KEY, FOREIGN KEY, EXCLUDE.', lesson: 'constraints' },
  { term: 'Foreign key', definition: 'A column that must match a key in another table; can cascade deletes and updates.', lesson: 'constraints' },
  { term: 'Deferrable constraint', definition: 'A UNIQUE, PRIMARY KEY, EXCLUDE or FOREIGN KEY constraint declared DEFERRABLE: checked at the end of the statement, or at COMMIT when deferred, instead of row by row.', lesson: 'constraints' },
  { term: 'Exclusion constraint', definition: 'No two rows may match pairwise under given operators, e.g. same room and overlapping time range.', lesson: 'constraints' },
  { term: 'SQLSTATE', definition: 'Five-character error code, e.g. 23505 unique violation, 23503 foreign key violation, 40001 serialization failure.', lesson: 'constraints' },
  { term: 'Idempotency key', definition: 'A unique id sent with a request so a retry is recognised and not executed twice.', lesson: 'constraints' },
  { term: 'Aborted transaction', definition: 'After an error, every further statement fails (25P02) until ROLLBACK — or use a SAVEPOINT.', lesson: 'constraints' },
]
