import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Bit rot', definition: 'Silent corruption of stored bits. RustFS detects it with a checksum per 1 MiB block and repairs the shard from the others.', lesson: 'durability' },
  { term: 'Erasure coding', definition: 'Cutting each object into data shards and computing parity shards across drives, so lost shards can be recomputed.', lesson: 'durability' },
  { term: 'Erasure set', definition: 'The group of drives (2–16 in RustFS) one object is spread across.', lesson: 'durability' },
  { term: 'Healing', definition: 'Recomputing missing or damaged shards and writing them back, after a drive or server returns or is replaced.', lesson: 'durability' },
  { term: 'Parity shard', definition: 'A shard computed from the data shards (Reed–Solomon); with m parity shards any m shards may be lost.', lesson: 'durability' },
  { term: 'Quorum', definition: 'How many drives must answer: reads need the data-shard count; writes need it too, plus one when data equals parity.', lesson: 'durability' },
  { term: 'Replication', definition: 'Keeping full copies; three copies survive two losses at three times the space.', lesson: 'durability' },
  { term: 'Shard', definition: 'One piece of an erasure-coded object, stored on one drive of the set.', lesson: 'durability' },
  { term: 'Write quorum', definition: 'The number of drives that must store a write before it is reported as done.', lesson: 'durability' },
]
