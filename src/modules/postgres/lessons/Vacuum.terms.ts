import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Dead tuple', definition: 'A row version no running or future transaction can see any more; space that vacuum can reclaim.', lesson: 'vacuum' },
  { term: 'VACUUM', definition: 'Removes dead tuples, records free space, updates the visibility map and freezes old rows. Does not lock out reads or writes.', lesson: 'vacuum' },
  { term: 'VACUUM FULL', definition: 'Rewrites the whole table compactly under an ACCESS EXCLUSIVE lock. Returns space to the OS, but blocks everything.', lesson: 'vacuum' },
  { term: 'HOT update', definition: 'Heap-only tuple: an update that adds no index entries because no indexed column changed and the new version fits on the same page.', lesson: 'vacuum' },
  { term: 'Pruning', definition: 'Cleaning dead versions inside one page while it is read or updated, without VACUUM.', lesson: 'vacuum' },
  { term: 'Freezing', definition: 'Marking old tuples as visible to everyone, so their xmin no longer matters when the xid counter wraps.', lesson: 'vacuum' },
  { term: 'Wraparound', definition: 'The 32-bit xid counter wrapping; unfrozen rows would seem to be in the future. PostgreSQL stops writes before it can happen.', lesson: 'vacuum' },
  { term: 'Bloat', definition: 'Space in a table or index taken by dead tuples or left empty after vacuum.', lesson: 'vacuum' },
  { term: 'ANALYZE', definition: 'Samples a table and stores column statistics for the planner; autovacuum runs it too.', lesson: 'vacuum' },
]
