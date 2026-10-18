import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Dual write', definition: 'Writing to two systems without a shared transaction, risking inconsistency.', lesson: 'outbox' },
  { term: 'Outbox', definition: 'Table where events are written in the same transaction as business data, then relayed to Kafka.', lesson: 'outbox' },
]
