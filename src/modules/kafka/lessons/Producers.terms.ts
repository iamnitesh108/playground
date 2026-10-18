import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'acks', definition: 'Producer setting for how many replicas must store a record before the write counts as successful: 0, 1 or all.', lesson: 'producers' },
  { term: 'Batch', definition: 'Records for the same partition grouped and sent together by the producer.', lesson: 'producers' },
  { term: 'Idempotent producer', definition: 'Producer that numbers its batches so retries never create duplicates.', lesson: 'producers' },
  { term: 'linger.ms', definition: 'How long a producer waits to fill a batch before sending it.', lesson: 'producers' },
  { term: 'murmur2', definition: 'Hash function the default partitioner applies to key bytes.', lesson: 'producers' },
  { term: 'Partitioner', definition: 'Producer component that chooses a record’s partition.', lesson: 'producers' },
  { term: 'Producer', definition: 'An application that writes records to Kafka.', lesson: 'producers' },
  { term: 'Sticky partitioning', definition: 'For key-less records, send to one partition until about batch.size bytes have gone to it, then switch.', lesson: 'producers' },
  { term: 'Transaction (Kafka)', definition: 'Atomic write across partitions, visible all-or-nothing to read_committed consumers.', lesson: 'producers' },
]
