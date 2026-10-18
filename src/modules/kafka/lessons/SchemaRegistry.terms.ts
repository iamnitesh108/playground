import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Schema Registry', definition: 'Service storing record schemas under subjects with versions and ids, and checking that a new version is compatible, so producers and consumers agree on formats.', lesson: 'schema-registry' },
  { term: 'Avro', definition: 'Compact binary data format whose schema (in JSON) lives outside the data; the most common format with Schema Registry.', lesson: 'schema-registry' },
  { term: 'BACKWARD compatibility', definition: 'Schema Registry default: consumers on the new schema can read data written with the previous one (e.g. add a field with a default).', lesson: 'schema-registry' },
  { term: 'Magic byte', definition: 'The first byte (0) of a record value written by a Schema Registry serializer, followed by the 4-byte schema id.', lesson: 'schema-registry' },
  { term: 'Subject', definition: 'Name under which Schema Registry keeps the versions of one schema; by default <topic>-key and <topic>-value.', lesson: 'schema-registry' },
]
