import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'pg_stat_activity', definition: 'One row per server process: state, wait event, transaction start and current query.', lesson: 'monitoring' },
  { term: 'Wait event', definition: 'What an active session waits for: Lock, LWLock (e.g. WALWrite), IO, Client…', lesson: 'monitoring' },
  { term: 'Idle in transaction', definition: 'A session inside BEGIN doing nothing: holds locks and blocks vacuum. Limit with idle_in_transaction_session_timeout.', lesson: 'monitoring' },
  { term: 'pg_blocking_pids()', definition: 'Returns the process ids blocking a given session.', lesson: 'monitoring' },
  { term: 'pg_stat_statements', definition: 'Extension summing time, calls, rows and buffers per query shape; needs shared_preload_libraries.', lesson: 'monitoring' },
  { term: 'Query id', definition: 'Hash of a query’s shape with constants removed; groups calls in pg_stat_statements.', lesson: 'monitoring' },
  { term: 'pg_stat_user_tables', definition: 'Per-table counters: sequential and index scans, live and dead tuples, last (auto)vacuum and analyze.', lesson: 'monitoring' },
  { term: 'Cache hit ratio', definition: 'Share of page reads found in shared buffers (blks_hit / (blks_hit + blks_read)).', lesson: 'monitoring' },
  { term: 'pg_stat_io', definition: 'PostgreSQL 16+: reads, writes, extends, hits and fsyncs by backend type, object and context; bytes since 18.', lesson: 'monitoring' },
  { term: 'pg_buffercache', definition: 'Extension showing which relations’ pages are in shared buffers right now.', lesson: 'monitoring' },
  { term: 'log_min_duration_statement', definition: 'Logs every statement slower than this, with its duration.', lesson: 'monitoring' },
  { term: 'auto_explain', definition: 'Module that logs the plans of slow statements.', lesson: 'monitoring' },
  { term: 'log_lock_waits', definition: 'Logs a line when a session has waited longer than deadlock_timeout for a lock.', lesson: 'monitoring' },
  { term: 'effective_cache_size', definition: 'Planner hint for how much data the OS and shared buffers can cache; allocates nothing.', lesson: 'monitoring' },
  { term: 'maintenance_work_mem', definition: 'Memory for VACUUM, CREATE INDEX and adding foreign keys.', lesson: 'monitoring' },
  { term: 'autovacuum_vacuum_scale_factor', definition: 'Autovacuum runs once dead tuples exceed autovacuum_vacuum_threshold (50) + this fraction of the rows (default 0.2); lower it per table for big tables.', lesson: 'monitoring' },
]
