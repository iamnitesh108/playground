import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Deserializer', definition: 'Consumer component that turns bytes back into objects.', lesson: 'events' },
  { term: 'Header', definition: 'Optional key/value metadata attached to a record.', lesson: 'events' },
  { term: 'Key', definition: 'Optional record identifier; equal keys go to the same partition and stay ordered.', lesson: 'events' },
  { term: 'Record', definition: 'A stored event: key, value, headers, timestamp and offset.', lesson: 'events' },
  { term: 'Serializer', definition: 'Producer component that turns objects into bytes.', lesson: 'events' },
  { term: 'Value', definition: 'The payload bytes of a record.', lesson: 'events' },
]
