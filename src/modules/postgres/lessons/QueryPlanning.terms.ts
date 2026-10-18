import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Planner', definition: 'Chooses how to run a query: which scans, join order and join methods, by estimating the cost of the alternatives.', lesson: 'query-planning' },
  { term: 'Plan', definition: 'A tree of nodes (scans, joins, sorts); rows flow from the leaves up.', lesson: 'query-planning' },
  { term: 'Statistics', definition: 'Per-column summaries ANALYZE stores in pg_statistic: most common values, distinct count, histogram, correlation.', lesson: 'query-planning' },
  { term: 'Selectivity', definition: 'Fraction of rows a condition keeps; estimated rows = selectivity × table rows.', lesson: 'query-planning' },
  { term: 'Cost', definition: 'The planner’s price for a plan, in units where reading one page sequentially costs 1.0 (seq_page_cost).', lesson: 'query-planning' },
  { term: 'EXPLAIN ANALYZE', definition: 'Runs the query and shows the plan with real row counts and times beside the estimates; since PostgreSQL 18 it also shows buffers (page reads) by default.', lesson: 'query-planning' },
  { term: 'Sequential scan', definition: 'Reads every page of a table; the right choice when many rows match.', lesson: 'query-planning' },
  { term: 'Bitmap heap scan', definition: 'Collects matching row addresses from an index first, then reads the table pages in physical order.', lesson: 'query-planning' },
  { term: 'Nested loop', definition: 'For each outer row, look up matches in the inner side — fast when the outer side is small and the inner is indexed.', lesson: 'query-planning' },
  { term: 'Hash join', definition: 'Builds a hash table of the smaller input, then probes it with each row of the other.', lesson: 'query-planning' },
  { term: 'Merge join', definition: 'Walks two inputs sorted on the join key side by side.', lesson: 'query-planning' },
  { term: 'Parallel query', definition: 'Worker processes scan parts of a table at once; a Gather node combines their rows.', lesson: 'query-planning' },
]
