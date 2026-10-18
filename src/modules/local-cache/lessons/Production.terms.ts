import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'recordStats', definition: 'Caffeine builder option that turns on hit, miss, load and eviction counters (off by default).', lesson: 'production' },
  { term: 'CacheStats', definition: 'Caffeine’s snapshot of the counters: hitCount, missCount, hitRate, loadSuccessCount, loadFailureCount, totalLoadTime, averageLoadPenalty, evictionCount.', lesson: 'production' },
  { term: 'Load penalty', definition: 'The average time a load takes (averageLoadPenalty, in nanoseconds in Caffeine): what one miss costs a caller.', lesson: 'production' },
  { term: 'CaffeineCacheMetrics', definition: 'Micrometer binder that exports a Caffeine cache’s statistics as meters: cache.gets, cache.puts, cache.evictions, cache.load, cache.size…', lesson: 'production' },
  { term: '@Cacheable', definition: 'Annotation (Micronaut, Spring) that caches a method’s result by its parameters.', lesson: 'production' },
  { term: 'atomic / sync', definition: 'The @Cacheable attribute (atomic in Micronaut, sync in Spring) that makes concurrent misses wait for one call instead of each running the method.', lesson: 'production' },
  { term: '@CacheInvalidate / @CacheEvict', definition: 'Annotations that remove cached entries after a method runs; the key is built from all parameters unless you name them.', lesson: 'production' },
  { term: 'Memoisation', definition: 'Caching a function’s result by its arguments; lru-cache’s memo() for synchronous functions, the cached crate in Rust.', lesson: 'production' },
  { term: 'Unbounded cache', definition: 'A cache with no size or weight limit: Caffeine.newBuilder().build(), moka builder without max_capacity. A memory leak with a hit rate.', lesson: 'production' },
]
