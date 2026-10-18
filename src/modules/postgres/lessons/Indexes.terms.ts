import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'B-tree', definition: 'The default index: a balanced tree of sorted keys; serves =, <, >, BETWEEN, ORDER BY and prefix LIKE.', lesson: 'indexes' },
  { term: 'Leaf page', definition: 'Bottom level of a B-tree: key plus the row’s ctid, linked left to right.', lesson: 'indexes' },
  { term: 'Page split', definition: 'A full index page is split in two and a separator added to the parent; the tree grows a level when the root splits.', lesson: 'indexes' },
  { term: 'Index scan', definition: 'Searches the index, then fetches each matching row from the table.', lesson: 'indexes' },
  { term: 'Index-only scan', definition: 'Answers from the index alone, skipping table pages the visibility map marks all-visible.', lesson: 'indexes' },
  { term: 'Covering index', definition: 'An index that INCLUDEs extra columns so a query can be answered by an index-only scan.', lesson: 'indexes' },
  { term: 'Multi-column index', definition: 'An index on (a, b): usable for conditions on a, or a and b — the leftmost prefix — not b alone (except via skip scan in 18).', lesson: 'indexes' },
  { term: 'CREATE INDEX CONCURRENTLY', definition: 'Builds an index without blocking writes, in two passes; slower and cannot run inside a transaction.', lesson: 'indexes' },
]
