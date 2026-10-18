import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Cache stampede', definition: 'Many concurrent misses for the same key, each loading it from the source at once (also: thundering herd, dog-piling).', lesson: 'loading' },
  { term: 'Single-flight', definition: 'At most one load per key at a time; other callers for the key wait for its result (also: request coalescing).', lesson: 'loading' },
  { term: 'Loader', definition: 'The function a cache calls to get a missing value.', lesson: 'loading' },
  { term: 'In-flight load', definition: 'A load that has started and not finished; async caches store it as a future or promise that other callers share.', lesson: 'loading' },
  { term: 'Async cache', definition: 'A cache that stores futures (Caffeine AsyncCache, moka::future::Cache) or promises (lru-cache fetch), so waiting costs no thread.', lesson: 'loading' },
  { term: 'Negative caching', definition: 'Caching “not found” (or a failure) for a short time so absent keys do not reach the source on every read.', lesson: 'loading' },
  { term: 'Bulk loading (getAll / loadAll)', definition: 'Loading all missing keys of a multi-key read in one call to the source.', lesson: 'loading' },
  { term: 'Refresh-ahead', definition: 'Reloading hot entries before they expire, in the background, so no reader waits for a load.', lesson: 'loading' },
  { term: 'Recursive load', definition: 'A loader that reads its own cache for a key being loaded: Caffeine throws “Recursive update”, moka deadlocks, lru-cache recurses until the stack overflows.', lesson: 'loading' },
  { term: 'Read buffer', definition: 'Caffeine’s striped, lossy ring buffers that record reads for the policy without a lock; a record is dropped when a buffer is full.', lesson: 'loading' },
  { term: 'Write buffer', definition: 'Caffeine’s bounded queue of pending writes for the policy; never lossy.', lesson: 'loading' },
  { term: 'Contention', definition: 'Threads waiting for the same lock or memory location; why a single-lock LRU gets slower as threads are added.', lesson: 'loading' },
]
