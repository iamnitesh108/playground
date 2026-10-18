import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'In-process (local) cache', definition: 'A cache that lives in the application’s own memory: a lookup is a method call, with no network and no serialisation.', lesson: 'why' },
  { term: 'Hit / miss', definition: 'A lookup that finds a value in the cache / one that does not and must go to the source.', lesson: 'why' },
  { term: 'Hit ratio', definition: 'Hits divided by lookups. The number that says whether a cache earns its memory.', lesson: 'why' },
  { term: 'Bound', definition: 'The limit that keeps a cache from growing forever: a maximum number of entries or a maximum total weight.', lesson: 'why' },
  { term: 'Source of truth', definition: 'Where the data really lives (a database, a service). The cache may be emptied at any time without losing anything.', lesson: 'why' },
  { term: 'L1 / near cache', definition: 'An in-process cache in front of a shared cache such as Redis (the L2) in a multi-level design.', lesson: 'why' },
  { term: 'Caffeine', definition: 'The standard in-process cache for Java: ConcurrentHashMap-based, W-TinyLFU eviction, expiry, refresh, async loading, statistics.', lesson: 'why' },
  { term: 'lru-cache', definition: 'The most used in-process cache for Node.js: LRU eviction, size and TTL bounds, fetch() with in-flight deduplication.', lesson: 'why' },
  { term: 'moka', definition: 'A concurrent in-process cache for Rust, modelled on Caffeine: TinyLFU admission, LRU eviction, TTL/TTI and per-entry expiry, sync and async APIs.', lesson: 'why' },
]
