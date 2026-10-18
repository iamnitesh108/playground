import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Database', definition: 'A named container of schemas and tables. A connection is always to exactly one database.', lesson: 'using-postgres' },
  { term: 'Schema', definition: 'A namespace inside a database. New tables go to public unless you name another schema.', lesson: 'using-postgres' },
  { term: 'psql', definition: 'The command-line client that ships with PostgreSQL. Lines starting with a backslash (\\dt, \\d) are psql commands, not SQL.', lesson: 'using-postgres' },
  { term: 'Transaction', definition: 'Statements that succeed or fail together (BEGIN … COMMIT). Without BEGIN each statement is its own transaction.', lesson: 'using-postgres' },
  { term: 'NULL', definition: 'No value. It equals nothing, not even NULL, so filters use IS NULL / IS NOT NULL.', lesson: 'using-postgres' },
  { term: 'RETURNING', definition: 'Clause of INSERT, UPDATE and DELETE that returns columns of the changed rows, e.g. the generated id.', lesson: 'using-postgres' },
  { term: 'Upsert', definition: 'INSERT … ON CONFLICT DO UPDATE / DO NOTHING: insert, or update the row that already has this key, atomically.', lesson: 'using-postgres' },
  { term: 'COPY', definition: 'Bulk load or unload rows to and from files or the client, far faster than many INSERTs.', lesson: 'using-postgres' },
  { term: 'Keyset pagination', definition: 'Paging with WHERE id > last_seen ORDER BY id LIMIT n instead of OFFSET, so deep pages stay fast.', lesson: 'using-postgres' },
]
