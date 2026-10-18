import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Primary', definition: 'The server that accepts writes.', lesson: 'replication' },
  { term: 'Standby', definition: 'A server continuously replaying the primary’s WAL; a hot standby also answers read-only queries.', lesson: 'replication' },
  { term: 'Streaming replication', definition: 'The standby connects to the primary and receives WAL as it is written (walsender → walreceiver).', lesson: 'replication' },
  { term: 'Replication slot', definition: 'A record on the primary of how far a consumer got, so needed WAL is kept — and fills the disk if the consumer disappears.', lesson: 'replication' },
  { term: 'Synchronous standby', definition: 'A standby the primary waits for before confirming COMMIT (synchronous_standby_names).', lesson: 'replication' },
  { term: 'Replication lag', definition: 'How far a standby is behind: bytes of WAL (LSN difference) or time (write_lag, flush_lag, replay_lag).', lesson: 'replication' },
  { term: 'Promotion', definition: 'Ending recovery on a standby so it becomes a primary, on a new timeline (pg_promote()).', lesson: 'replication' },
  { term: 'Logical replication', definition: 'Publishes row changes of chosen tables (PUBLICATION) to subscribers (SUBSCRIPTION), across versions.', lesson: 'replication' },
]
