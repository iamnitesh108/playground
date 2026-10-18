import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'At-least-once', definition: 'Delivery guarantee where nothing is lost but records may be processed more than once. Process, then commit.', lesson: 'delivery' },
  { term: 'At-most-once', definition: 'Delivery guarantee where records are never processed twice but may be lost. Commit, then process.', lesson: 'delivery' },
  { term: 'Commit', definition: 'Saving a consumer group’s position in a partition so it can resume there later.', lesson: 'delivery' },
  { term: 'Dead letter queue', definition: 'A topic where records that cannot be processed are sent for inspection.', lesson: 'delivery' },
  { term: 'Exactly-once', definition: 'Each record’s effect happens once; achieved with Kafka transactions, or at-least-once plus idempotent processing.', lesson: 'delivery' },
  { term: 'Idempotent consumer', definition: 'A handler for which processing a record twice has the same effect as once.', lesson: 'delivery' },
  { term: 'Poison pill', definition: 'A record that fails every time it is processed.', lesson: 'delivery' },
]
