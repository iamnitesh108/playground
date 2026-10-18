import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Null key', definition: 'A record without a key (stored as key length -1). The producer spreads such records with sticky partitioning; compacted topics reject them.', lesson: 'keys' },
  { term: 'Empty key', definition: 'A key of zero bytes. Unlike a null key it is hashed, so all empty-key records land on one partition.', lesson: 'keys' },
  { term: 'Built-in partitioner', definition: 'The Java producer’s default since 3.3: murmur2 of the key bytes, or uniform sticky partitioning for key-less records.', lesson: 'keys' },
  { term: 'Adaptive partitioning', definition: 'partitioner.adaptive.partitioning.enable: when switching sticky partitions, prefer leaders with fewer queued batches.', lesson: 'keys' },
  { term: 'partitioner.ignore.keys', definition: 'Producer setting: when true, keys are not hashed and keyed records are spread like key-less ones.', lesson: 'keys' },
  { term: 'Custom partitioner', definition: 'A class implementing org.apache.kafka.clients.producer.Partitioner, set with partitioner.class.', lesson: 'keys' },
  { term: 'Hot key', definition: 'A key carrying a large share of the traffic, overloading one partition and the consumer that owns it.', lesson: 'keys' },
  { term: 'Composite key', definition: 'A key built from several fields, e.g. tenant:order.', lesson: 'keys' },
  { term: 'Co-partitioning', definition: 'Topics with the same key bytes, partition count and partitioner, so equal keys sit in equal partition numbers; required for joins.', lesson: 'keys' },
]
