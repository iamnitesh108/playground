import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'WAL', definition: 'Write-ahead log: every change is logged and flushed before COMMIT returns; data pages are written later.', lesson: 'wal' },
  { term: 'WAL record', definition: 'Description of one change, e.g. “insert this tuple into page 7” or “transaction 758 committed”.', lesson: 'wal' },
  { term: 'LSN', definition: 'Log sequence number: a byte position in the WAL, written like 0/2A22E68.', lesson: 'wal' },
  { term: 'WAL segment', definition: 'One 16 MB file in pg_wal/.', lesson: 'wal' },
  { term: 'fsync', definition: 'Asking the OS to put written data on the disk itself, not only in its cache.', lesson: 'wal' },
  { term: 'Checkpoint', definition: 'Writes all dirty pages and records a redo point; recovery never needs older WAL. Triggered by checkpoint_timeout or max_wal_size.', lesson: 'wal' },
  { term: 'Full-page image', definition: 'A copy of a whole page in the WAL, written at its first change after a checkpoint, protecting against torn pages.', lesson: 'wal' },
  { term: 'synchronous_commit', definition: 'When COMMIT returns: after the local WAL flush (on), before it (off: may lose the last commits in a crash), or after standbys confirm.', lesson: 'wal' },
  { term: 'Group commit', definition: 'Transactions committing at the same moment share one WAL flush.', lesson: 'wal' },
  { term: 'Crash recovery', definition: 'After a crash, replaying the WAL from the last checkpoint’s redo point to bring the data files up to date.', lesson: 'wal' },
]
