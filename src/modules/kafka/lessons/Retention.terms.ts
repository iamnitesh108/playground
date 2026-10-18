import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'cleanup.policy', definition: 'Topic setting choosing delete (retention), compact, or both.', lesson: 'retention' },
  { term: 'Compaction', definition: 'Cleanup that keeps only the latest record per key.', lesson: 'retention' },
  { term: 'Retention', definition: 'How long or how much data a topic keeps before old segments are deleted.', lesson: 'retention' },
  { term: 'Tombstone', definition: 'A record with a null value marking its key as deleted in a compacted topic.', lesson: 'retention' },
]
