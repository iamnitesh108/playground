import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'isolation.level', definition: 'Consumer setting: read_uncommitted (default, sees every record) or read_committed (skips aborted transactions and waits for open ones).', lesson: 'practical-4' },
  { term: 'read_committed', definition: 'isolation.level value that hides records of aborted transactions and stops at the last stable offset.', lesson: 'practical-4' },
  { term: 'transactional.id', definition: 'Stable producer id that enables transactions and fences an older instance of the same producer.', lesson: 'practical-4' },
]
