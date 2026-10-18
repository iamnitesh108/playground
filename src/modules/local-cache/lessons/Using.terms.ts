import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'getIfPresent / get', definition: 'Read a key without loading: returns the value or nothing (null, undefined, None).', lesson: 'using' },
  { term: 'Get-with-loader', definition: 'Read a key and, on a miss, compute it with a function and store the result: Caffeine get(key, fn), lru-cache fetch(), moka get_with.', lesson: 'using' },
  { term: 'Loading cache', definition: 'A cache built with its loader, so every get loads on a miss (Caffeine LoadingCache; lru-cache with fetchMethod).', lesson: 'using' },
  { term: 'Invalidate', definition: 'Remove one key, several or all entries on purpose, typically after the source changed.', lesson: 'using' },
  { term: 'Removal listener', definition: 'A callback told when an entry leaves the cache, with the cause (explicit, replaced, expired, size, collected).', lesson: 'using' },
  { term: 'Removal cause', definition: 'Why an entry left: EXPLICIT, REPLACED, EXPIRED, SIZE or COLLECTED in Caffeine; evict, set, expire, delete or fetch in lru-cache; Explicit, Replaced, Expired or Size in moka.', lesson: 'using' },
  { term: 'Maintenance', definition: 'The work a cache defers and does in batches: applying recorded reads and writes to the policy, evicting, expiring, notifying listeners.', lesson: 'using' },
  { term: 'estimatedSize / entry_count', definition: 'The number of entries, which may lag behind until pending maintenance has run.', lesson: 'using' },
]
