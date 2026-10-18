import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Acknowledgement (share group)', definition: 'How a share consumer settles each record: accept (done), release (deliver again) or reject (give up on it).', lesson: 'practical-5' },
  { term: 'Delivery count', definition: 'How many times a share group has handed out a record; past group.share.delivery.count.limit the record is archived.', lesson: 'practical-5' },
  { term: 'Share group', definition: 'Queue-like group (Kafka 4.x): several consumers read the same partition, each record is locked for one consumer and acknowledged one by one.', lesson: 'practical-5' },
]
