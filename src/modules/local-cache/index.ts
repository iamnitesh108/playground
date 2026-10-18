import type { LearningModule } from '@/core/module'

export const localCacheModule: LearningModule = {
  id: 'local-cache',
  title: 'In-process caching',
  description:
    'Caches that live inside your application: Caffeine (Java), lru-cache (Node.js) and moka (Rust). How to use them, how they decide what to keep (LRU, LFU, W-TinyLFU), expiry and refresh, loading under concurrency, memory and garbage collection, and running them in production — recorded from real runs in all three languages. The L1 of a multi-level cache.',
  tags: ['caffeine', 'lru-cache', 'moka', 'cache', 'eviction', 'tinylfu', 'java', 'typescript', 'rust'],
  groups: [
    {
      title: 'Basics',
      lessons: [
        { slug: 'why', title: 'What an in-process cache is', summary: 'A map with rules: how it differs from a HashMap and from Redis, what it costs and saves, and when to use one.', load: () => import('./lessons/Why') },
        { slug: 'using', title: 'Using it day to day', summary: 'get, put, get-with-loader, size limits and TTL in Caffeine, lru-cache and moka — side by side, with Micronaut.', load: () => import('./lessons/Using') },
      ],
    },
    {
      title: 'How it decides',
      lessons: [
        { slug: 'eviction', title: 'Eviction: LRU, LFU and W-TinyLFU', summary: 'What to throw out when the cache is full: recency vs frequency, scans that flush an LRU, and how a frequency sketch admits only the useful.', load: () => import('./lessons/Eviction') },
        { slug: 'expiry', title: 'Expiry and refresh', summary: 'Time to live vs time to idle, per-entry expiry, timer wheels, and refreshing in the background instead of expiring.', load: () => import('./lessons/Expiry') },
      ],
    },
    {
      title: 'Under load',
      lessons: [
        { slug: 'loading', title: 'Loading, single-flight and concurrency', summary: 'Many threads, one miss: coalesced loads, async caches, refresh-ahead, caching failures and absent keys — and how the caches stay fast under contention.', load: () => import('./lessons/Loading') },
        { slug: 'memory', title: 'Memory, weight and garbage collection', summary: 'What an entry really costs on the heap, weighing entries by size, and what a big cache does to the garbage collector.', load: () => import('./lessons/Memory') },
      ],
    },
    {
      title: 'In production',
      lessons: [
        { slug: 'production', title: 'Statistics, frameworks and pitfalls', summary: 'Hit-rate metrics, @Cacheable in Micronaut and Spring, a recorded benchmark, the mistakes that hurt, design rules and a glossary.', load: () => import('./lessons/Production') },
      ],
    },
  ],
}
