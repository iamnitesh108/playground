import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Event', definition: 'An immutable fact that something happened.', lesson: 'why-kafka' },
  { term: 'Log', definition: 'An ordered, append-only sequence of records.', lesson: 'why-kafka' },
]
