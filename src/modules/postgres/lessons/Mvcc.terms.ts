import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'MVCC', definition: 'Multi-version concurrency control: an UPDATE writes a new row version, so readers see a consistent snapshot without waiting for writers.', lesson: 'mvcc' },
  { term: 'xid', definition: 'Transaction id: a 32-bit counter assigned at a transaction’s first write.', lesson: 'mvcc' },
  { term: 'xmin', definition: 'The transaction that created a tuple version.', lesson: 'mvcc' },
  { term: 'xmax', definition: 'The transaction that deleted, replaced or locked a tuple version; 0 if none.', lesson: 'mvcc' },
  { term: 'ctid', definition: 'A tuple’s physical address (page, line pointer); in an old version it points to the newer one.', lesson: 'mvcc' },
  { term: 'Hint bits', definition: 'Flags on a tuple caching whether xmin/xmax committed, set by the first reader — why a SELECT can dirty pages.', lesson: 'mvcc' },
  { term: 'pg_xact', definition: 'The commit log: two bits per transaction id saying in progress, committed or aborted.', lesson: 'mvcc' },
]
