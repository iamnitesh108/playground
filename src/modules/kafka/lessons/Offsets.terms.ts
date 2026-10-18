import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'auto.offset.reset', definition: 'Where a consumer starts when its group has no committed offset: earliest, latest, none, or (Kafka 4.0+) by_duration:<ISO duration>.', lesson: 'offsets' },
  { term: 'Committed offset', definition: 'The saved offset a group will resume from after a restart or rebalance.', lesson: 'offsets' },
  { term: 'Consumer lag', definition: 'End offset (the high watermark) minus committed offset: how many records a group still has to read in a partition.', lesson: 'offsets' },
  { term: '__consumer_offsets', definition: 'Internal compacted topic storing committed offsets for every group.', lesson: 'offsets' },
  { term: 'Log-end offset', definition: 'The offset the next record written to a partition will receive.', lesson: 'offsets' },
  { term: 'Offset', definition: 'Sequential position of a record within one partition.', lesson: 'offsets' },
]
