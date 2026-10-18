import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Config provider', definition: 'Kafka Connect mechanism that resolves placeholders like ${file:path:key} so secrets stay out of configs.', lesson: 'kafka-connect' },
  { term: 'Connector', definition: 'A configured Kafka Connect plugin instance that copies data into (source) or out of (sink) Kafka.', lesson: 'kafka-connect' },
  { term: 'Converter', definition: 'Kafka Connect component translating between structured data and bytes (String, JSON, Avro…).', lesson: 'kafka-connect' },
  { term: 'Predicate', definition: 'Condition deciding whether a Connect transform applies to a record.', lesson: 'kafka-connect' },
  { term: 'Sink connector', definition: 'Connector that reads from Kafka and writes to an external system.', lesson: 'kafka-connect' },
  { term: 'SMT', definition: 'Single Message Transform: lightweight per-record change applied by Kafka Connect.', lesson: 'kafka-connect' },
  { term: 'Source connector', definition: 'Connector that reads from an external system and writes into Kafka.', lesson: 'kafka-connect' },
  { term: 'Task', definition: 'Unit of parallel work inside a Kafka Connect connector.', lesson: 'kafka-connect' },
  { term: 'Worker', definition: 'JVM process running Kafka Connect connectors and tasks.', lesson: 'kafka-connect' },
]
