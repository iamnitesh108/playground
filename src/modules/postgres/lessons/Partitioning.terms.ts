import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Partitioned table', definition: 'A parent table that stores no rows itself; rows live in its partitions.', lesson: 'partitioning' },
  { term: 'Partition', definition: 'An ordinary table attached to the parent, holding the rows whose key falls in its bounds.', lesson: 'partitioning' },
  { term: 'Partition key', definition: 'The column(s) deciding where a row goes; range, list or hash.', lesson: 'partitioning' },
  { term: 'Partition pruning', definition: 'Leaving out partitions whose bounds prove they cannot match, at planning or execution time.', lesson: 'partitioning' },
  { term: 'Default partition', definition: 'Catches rows that fit no other partition.', lesson: 'partitioning' },
  { term: 'DETACH PARTITION', definition: 'Turns a partition into a standalone table in a quick catalog change — then drop it to delete old data instantly.', lesson: 'partitioning' },
]
