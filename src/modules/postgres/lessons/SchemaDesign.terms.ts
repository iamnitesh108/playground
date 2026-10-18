import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Data type', definition: 'What a column holds and how it is stored, e.g. bigint is 8 bytes, text a length plus the bytes.', lesson: 'schema-design' },
  { term: 'numeric', definition: 'Exact decimal type for money and quantities; slower than integers but never rounds like float.', lesson: 'schema-design' },
  { term: 'timestamptz', definition: 'Timestamp with time zone: stored as UTC, shown in the session’s time zone. The right type for moments in time.', lesson: 'schema-design' },
  { term: 'Identity column', definition: 'GENERATED ALWAYS AS IDENTITY: an auto-numbered column backed by a sequence; the standard replacement for serial.', lesson: 'schema-design' },
  { term: 'uuid', definition: '128-bit identifier. uuidv7() (PostgreSQL 18) is time-ordered, so it inserts into a B-tree like a growing number.', lesson: 'schema-design' },
  { term: 'Natural key', definition: 'An identifier from the real world: an email, a country code, a SKU.', lesson: 'schema-design' },
  { term: 'Surrogate key', definition: 'An identifier the database makes up (identity number or uuid) with no meaning of its own.', lesson: 'schema-design' },
  { term: 'Normal form', definition: 'Rules against storing the same fact twice. 3NF: every column depends on the key, the whole key and nothing but the key.', lesson: 'schema-design' },
  { term: 'jsonb', definition: 'Binary JSON: parsed once, indexable with GIN. Good for truly variable attributes, not for core relational data.', lesson: 'schema-design' },
  { term: 'Enum', definition: 'A type with a fixed list of labels, 4 bytes, sorted in declared order; values can be added or renamed, never removed.', lesson: 'schema-design' },
  { term: 'Migration', definition: 'A versioned script that changes the schema while the application keeps running.', lesson: 'schema-design' },
]
