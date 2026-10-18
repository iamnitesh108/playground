import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Changelog topic', definition: 'Compacted internal topic that backs up a Kafka Streams state store so the store can be rebuilt on another instance.', lesson: 'kafka-streams' },
  { term: 'exactly_once_v2', definition: 'Kafka Streams processing guarantee that wraps reading, state updates and output in Kafka transactions.', lesson: 'kafka-streams' },
  { term: 'GlobalKTable', definition: 'A Kafka Streams table fully copied to every instance, used for joins without repartitioning.', lesson: 'kafka-streams' },
  { term: 'KStream', definition: 'A Kafka Streams view of a topic as an unbounded stream of independent events.', lesson: 'kafka-streams' },
  { term: 'KTable', definition: 'A Kafka Streams view of a topic as a table: the latest value per key.', lesson: 'kafka-streams' },
  { term: 'Repartition topic', definition: 'Internal topic Kafka Streams writes to when an operation changes the key, so records with the same new key meet in one task.', lesson: 'kafka-streams' },
  { term: 'State store', definition: 'Local key-value store (RocksDB by default) holding a Kafka Streams aggregation, backed up to a changelog topic.', lesson: 'kafka-streams' },
  { term: 'Stream task', definition: 'The Kafka Streams unit of work: one per input partition; tasks are spread over app instances and threads.', lesson: 'kafka-streams' },
  { term: 'Topology', definition: 'The graph of a Kafka Streams app: source topics, processors and sinks, printed by topology.describe().', lesson: 'kafka-streams' },
  { term: 'Window', definition: 'A Kafka Streams time bucket for aggregations: tumbling, hopping, sliding or session.', lesson: 'kafka-streams' },
]
