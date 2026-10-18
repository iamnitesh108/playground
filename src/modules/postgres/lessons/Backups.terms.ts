import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Logical dump', definition: 'pg_dump: SQL definitions and rows of one database as of the dump’s start; restore with psql or pg_restore.', lesson: 'backups' },
  { term: 'Base backup', definition: 'A copy of the whole data directory taken while the server runs (pg_basebackup).', lesson: 'backups' },
  { term: 'Incremental backup', definition: 'PostgreSQL 17+: pg_basebackup --incremental copies only changed blocks; pg_combinebackup rebuilds a full one.', lesson: 'backups' },
  { term: 'WAL archive', definition: 'Every finished WAL segment copied somewhere safe (archive_command or archive_library).', lesson: 'backups' },
  { term: 'PITR', definition: 'Point-in-time recovery: restore a base backup, then replay archived WAL up to a chosen moment.', lesson: 'backups' },
  { term: 'Timeline', definition: 'A numbered WAL history; each recovery that opens for writes starts a new one.', lesson: 'backups' },
]
