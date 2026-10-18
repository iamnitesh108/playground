import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'CDC', definition: 'Change data capture: turning every database insert, update and delete into an event.', lesson: 'debezium' },
  { term: 'Change event', definition: 'Debezium record describing a row change, with before, after, source, op and ts_ms.', lesson: 'debezium' },
  { term: 'Debezium', definition: 'Open-source CDC platform implemented as Kafka Connect source connectors.', lesson: 'debezium' },
  { term: 'Heartbeat (Debezium)', definition: 'Periodic record that lets Debezium commit its position, so the replication slot advances on quiet tables.', lesson: 'debezium' },
  { term: 'Logical replication slot', definition: 'Postgres cursor over decoded WAL that retains it until the reader confirms.', lesson: 'debezium' },
  { term: 'LSN', definition: 'Log sequence number: a position in the Postgres WAL.', lesson: 'debezium' },
  { term: 'pgoutput', definition: 'Postgres’ built-in logical decoding plugin used by Debezium.', lesson: 'debezium' },
  { term: 'Publication', definition: 'Postgres object listing the tables included in logical replication.', lesson: 'debezium' },
  { term: 'Snapshot', definition: 'Debezium’s initial read of existing rows before streaming changes.', lesson: 'debezium' },
  { term: 'WAL', definition: 'Write-ahead log: Postgres’ ordered, durable record of every change.', lesson: 'debezium' },
]
