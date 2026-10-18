import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Partial index', definition: 'An index with a WHERE clause, containing only matching rows.', lesson: 'index-types' },
  { term: 'Expression index', definition: 'An index on an expression such as lower(email); queries must use the same expression.', lesson: 'index-types' },
  { term: 'GIN', definition: 'Generalised inverted index: many keys per row. For jsonb, arrays and full-text search.', lesson: 'index-types' },
  { term: 'GiST', definition: 'Generalised search tree: overlaps, containment and nearest-neighbour for ranges, geometry and more.', lesson: 'index-types' },
  { term: 'BRIN', definition: 'Block range index: min/max per range of pages. Tiny, for huge tables whose order follows the column (e.g. time).', lesson: 'index-types' },
  { term: 'Hash index', definition: 'Equality-only index on a hash of the key; rarely better than a B-tree.', lesson: 'index-types' },
  { term: 'Operator class', definition: 'Which operators an index supports for a type, e.g. jsonb_path_ops or gin_trgm_ops.', lesson: 'index-types' },
  { term: 'Full-text search', definition: 'tsvector documents matched by tsquery searches, ranked and indexed with GIN.', lesson: 'index-types' },
  { term: 'Recheck', definition: 'A lossy index returns candidate rows; the condition is checked again on the table row.', lesson: 'index-types' },
]
