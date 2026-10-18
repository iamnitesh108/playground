import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Partition', definition: 'One ordered log within a topic; the unit of parallelism, ordering and replication.', lesson: 'topics-partitions' },
  { term: 'Topic', definition: 'A named stream of records split into partitions.', lesson: 'topics-partitions' },
]
