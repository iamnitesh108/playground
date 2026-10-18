import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Per-entry overhead', definition: 'Memory a cache uses for an entry beyond its key and value: table slot, policy node, links, timestamps.', lesson: 'memory' },
  { term: 'Weight / weigher', definition: 'A number per entry (usually bytes) computed by a weigher function; the cache keeps the total under maximumWeight / maxSize / max_capacity.', lesson: 'memory' },
  { term: 'sizeCalculation', definition: 'lru-cache’s weigher: returns the size of an entry, summed against maxSize.', lesson: 'memory' },
  { term: 'Soft values', definition: 'Caffeine values behind SoftReferences, cleared by the garbage collector under memory pressure. Usually worse than a size bound.', lesson: 'memory' },
  { term: 'Weak keys / values', definition: 'Caffeine entries the garbage collector removes once nothing else references the key or value; keys then compare by identity (==).', lesson: 'memory' },
  { term: 'GC pause', definition: 'Time the garbage collector stops application threads. A large cache makes the live set, and some pauses, bigger.', lesson: 'memory' },
  { term: 'Live set', definition: 'Objects still reachable when the collector runs. Cache entries are long-lived, so they stay in it.', lesson: 'memory' },
  { term: 'Zipf distribution', definition: 'Popularity where the k-th most popular key gets about 1/k^s of requests: a few keys get most of the traffic.', lesson: 'memory' },
  { term: 'Off-heap cache', definition: 'Entries stored in native memory the GC does not scan (Ehcache off-heap, Chronicle Map, OHC); reads deserialise a copy.', lesson: 'memory' },
]
