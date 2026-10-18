import type { LearningModule } from '@/core/module'

export const redisModule: LearningModule = {
  id: 'redis',
  order: 70,
  title: 'Redis internals and design',
  description:
    'Just want to use Redis? Start with “Using Redis day to day”. Otherwise: how Redis really works, shown with recordings of a real server: the single-threaded event loop, the wire protocol, every data type and its encodings, expiry and eviction, transactions and scripts, locks and rate limits, persistence and crashes, replication, Sentinel and Cluster, Pub/Sub and Streams — then caching and design patterns for real systems, and running it in production.',
  tags: ['redis', 'caching', 'data structures', 'persistence', 'replication', 'cluster', 'streams', 'system design'],
  groups: [
    {
      title: 'Foundations',
      lessons: [
        { slug: 'architecture', title: 'How Redis runs', summary: 'One thread, an event loop and memory — and what one slow command does to every other client.', load: () => import('./lessons/Architecture') },
        { slug: 'protocol', title: 'RESP, round trips and pipelining', summary: 'The exact bytes on the wire, why round trips dominate, and how pipelining removes them.', load: () => import('./lessons/Protocol') },
        { slug: 'types', title: 'Data types and their encodings', summary: 'Strings, lists, hashes, sets, sorted sets and streams — and the compact encodings Redis switches between.', load: () => import('./lessons/Types') },
        { slug: 'sorted-sets', title: 'Inside a sorted set', summary: 'A skiplist plus a hash table: how ranks, ranges and leaderboards stay fast.', load: () => import('./lessons/SortedSets') },
        { slug: 'keyspace', title: 'The keyspace: hashing, rehashing and SCAN', summary: 'How Redis finds a key, grows its table without pausing, and why SCAN is safe where KEYS is not.', load: () => import('./lessons/Keyspace') },
      ],
    },
    {
      title: 'Time and memory',
      lessons: [
        { slug: 'expiry', title: 'Expiration', summary: 'TTL rules, lazy and active expiry, and why expired keys can linger in memory.', load: () => import('./lessons/Expiry') },
        { slug: 'eviction', title: 'maxmemory and eviction', summary: 'What happens when memory is full: the policies, approximated LRU and LFU, and which keys survive.', load: () => import('./lessons/Eviction') },
      ],
    },
    {
      title: 'Correctness',
      lessons: [
        { slug: 'transactions', title: 'Transactions and scripts', summary: 'MULTI/EXEC, WATCH, Lua scripts and functions: what is atomic, and what is never rolled back.', load: () => import('./lessons/Transactions') },
        { slug: 'locks', title: 'Locks, rate limits and idempotency', summary: 'SET NX PX, expired locks, fencing tokens, three rate limiters and idempotency keys — replayed for real.', load: () => import('./lessons/Locks') },
      ],
    },
    {
      title: 'Durability and scale',
      lessons: [
        { slug: 'persistence', title: 'RDB, AOF and crashes', summary: 'Snapshots, the append-only file, fsync policies — and what 100,000 writes look like after kill -9.', load: () => import('./lessons/Persistence') },
        { slug: 'replication', title: 'Replication and Sentinel', summary: 'Full and partial resync, the backlog, WAIT, and an automatic failover recorded second by second.', load: () => import('./lessons/Replication') },
        { slug: 'cluster', title: 'Redis Cluster', summary: '16384 hash slots, hash tags, MOVED and ASK, and a primary failing in a six-node cluster.', load: () => import('./lessons/Cluster') },
      ],
    },
    {
      title: 'Messaging',
      lessons: [
        { slug: 'messaging', title: 'Pub/Sub, lists and Streams', summary: 'Fire-and-forget messages, reliable queues, and consumer groups with pending entries.', load: () => import('./lessons/Messaging') },
      ],
    },
    {
      title: 'System design',
      lessons: [
        { slug: 'caching', title: 'Caching patterns', summary: 'Cache-aside and its alternatives, invalidation, TTLs — and stampedes, penetration and hot keys.', load: () => import('./lessons/Caching') },
        { slug: 'tiered-caching', title: 'Multi-level caching: L1 → Redis → Postgres', summary: 'An in-process cache (Caffeine, lru-cache, moka) in front of Redis in front of Postgres: read and write paths, invalidation across instances, stampedes and a recorded benchmark — in Micronaut, TypeScript and Rust.', load: () => import('./lessons/TieredCaching') },
        { slug: 'patterns', title: 'Design patterns with Redis', summary: 'Sessions, counters, leaderboards, unique counts, presence, geo and more — and when not to use Redis.', load: () => import('./lessons/Patterns') },
      ],
    },
    {
      title: 'Operations',
      lessons: [
        { slug: 'operations', title: 'Run it in production', summary: 'Install and configure, ACL users, memory and latency, the slow log, big keys and a checklist.', load: () => import('./lessons/Operations') },
      ],
    },
    {
      title: 'Using Redis in applications',
      lessons: [
        { slug: 'using-redis', title: 'Using Redis day to day', summary: 'The commands you will actually use — strings, hashes, lists, sets, sorted sets, TTLs — from redis-cli and from Java code, without the internals.', load: () => import('./lessons/UsingRedis') },
        { slug: 'clients', title: 'Clients: pools, timeouts and retries', summary: 'Connecting from an application: Lettuce in Micronaut, connection handling, timeouts, retries, pipelining and failover from the client side.', load: () => import('./lessons/Clients') },
      ],
    },
    {
      title: 'Beyond the basics',
      lessons: [
        { slug: 'security', title: 'Securing Redis', summary: 'Network exposure, protected mode, ACL users, TLS and secrets — what an attacker tries and how each setting stops it.', load: () => import('./lessons/Security') },
        { slug: 'kubernetes', title: 'Redis on Kubernetes', summary: 'StatefulSets, persistent volumes, Sentinel or Cluster in pods, probes, resources and the traps of running a stateful store there.', load: () => import('./lessons/Kubernetes') },
        { slug: 'beyond-core', title: 'Beyond the core types', summary: 'JSON documents, search and indexing, vector sets and probabilistic structures — what Redis 8 adds and when to use them.', load: () => import('./lessons/BeyondCore') },
      ],
    },
  ],
}

export default redisModule
