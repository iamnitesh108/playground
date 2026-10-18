import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'JMX', definition: 'Java Management Extensions: how brokers and Java clients expose their metrics (MBeans), read by tools or a Prometheus exporter.', lesson: 'monitoring' },
  { term: 'OfflinePartitionsCount', definition: 'Controller metric: partitions without a leader, so nobody can read or write them. Should be 0.', lesson: 'monitoring' },
  { term: 'UnderReplicatedPartitions', definition: 'Broker metric: partitions this broker leads whose ISR is smaller than the replica set. Should be 0.', lesson: 'monitoring' },
]
