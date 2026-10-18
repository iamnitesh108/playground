import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Expiry / TTL', definition: 'Time to live: an entry is invalid a fixed time after it was written.', lesson: 'expiry' },
  { term: 'TTI (time to idle)', definition: 'An entry expires after a time without reads (expireAfterAccess in Caffeine, time_to_idle in moka).', lesson: 'expiry' },
  { term: 'Variable (per-entry) expiry', definition: 'Each entry gets its own lifetime, computed when it is created, updated or read (Caffeine Expiry, moka Expiry, lru-cache ttl per set).', lesson: 'expiry' },
  { term: 'Hierarchical timer wheel', definition: 'Rings of time buckets with coarser and coarser spans, used by Caffeine and moka to expire per-entry lifetimes in O(1).', lesson: 'expiry' },
  { term: 'Stale', definition: 'An entry past its lifetime, or one whose source has changed since it was cached.', lesson: 'expiry' },
  { term: 'Refresh / stale-while-revalidate', definition: 'Reloading an entry in the background after a set age while readers keep getting the old value (refreshAfterWrite; lru-cache allowStale with fetch).', lesson: 'expiry' },
  { term: 'Jitter', definition: 'A random spread added to TTLs so entries loaded together do not all expire, and reload, at the same moment.', lesson: 'expiry' },
  { term: 'ttlAutopurge', definition: 'lru-cache option that removes expired entries with a timer per entry instead of waiting for the next access.', lesson: 'expiry' },
  { term: 'Scheduler (Caffeine)', definition: 'An optional thread that runs maintenance when the next entry expires, so an idle cache is cleaned too.', lesson: 'expiry' },
  { term: 'run_pending_tasks', definition: 'moka’s call that runs pending maintenance (expiry, eviction, listeners) now rather than on later cache calls.', lesson: 'expiry' },
]
