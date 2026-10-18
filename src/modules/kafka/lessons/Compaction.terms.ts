import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Log cleaner', definition: 'Background broker threads that compact logs with cleanup.policy=compact, dirtiest log first.', lesson: 'compaction' },
  { term: 'Dirty ratio', definition: 'Dirty bytes ÷ (clean + dirty bytes) of a compacted log; it is cleaned once this is above min.cleanable.dirty.ratio (default 0.5).', lesson: 'compaction' },
  { term: 'Dirty section', definition: 'The part of a compacted log written since its last cleaning, up to the active segment.', lesson: 'compaction' },
  { term: 'Offset map', definition: 'The cleaner’s hash table of MD5(key) → last offset in the dirty section; 24 bytes per key.', lesson: 'compaction' },
  { term: 'Delete horizon', definition: 'Time set in a tombstone’s batch by its first cleaning (now + delete.retention.ms); a later cleaning after it drops the tombstone.', lesson: 'compaction' },
  { term: 'Cleaner checkpoint', definition: 'cleaner-offset-checkpoint file in each log directory: per partition, the offset cleaned up to.', lesson: 'compaction' },
  { term: 'min.compaction.lag.ms', definition: 'Minimum age before a record may be compacted (default 0).', lesson: 'compaction' },
  { term: 'max.compaction.lag.ms', definition: 'Age at which a log becomes eligible for cleaning even below the dirty ratio (default: no limit).', lesson: 'compaction' },
]
