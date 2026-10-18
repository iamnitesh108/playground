# Playground

Interactive, beginner-friendly guides for backend systems and concepts. Each topic is a
module of short lessons with step-through diagrams and small in-browser simulators.

## Modules

| Module | Covers |
| ------ | ------ |
| Apache Kafka | Using Kafka day to day; events, brokers, topics, partitions, producers, offsets, how consumers work, consumer groups and rebalancing (animated); five hands-on practicals recorded on Kafka 4.3 (CLI and Java/Micronaut, including transactions and share groups); delivery guarantees, replication, retention, Schema Registry, Kafka Streams, Kafka Connect, Debezium CDC, the outbox pattern; security and monitoring; CLI and glossary |
| Kafka from scratch | Production-style setup of Kafka 4.3 (KRaft), PostgreSQL, Kafka Connect and Debezium 3.7 — on Ubuntu with systemd and with Docker, single node and 3 controllers + 3 brokers; every config file explained; pub-sub and CDC from Java; operations and troubleshooting |
| PostgreSQL | Install and configure, using PostgreSQL day to day (SQL, Java, TypeScript), schema design; how it runs, pages and TOAST, MVCC and vacuum; isolation, locks and constraints; query planning and EXPLAIN, B-tree and other index types; WAL, replication and failover, backups and PITR, partitioning; pooling, monitoring and tuning; glossary — recorded on PostgreSQL 18 |
| Redis | Recorded from a real Redis 8.8: using Redis day to day, clients (pools, timeouts, retries), the event loop, RESP and pipelining, data types and encodings, sorted sets, rehashing and SCAN, expiry, eviction, transactions and scripts, locks, rate limits, persistence, replication, Sentinel, Cluster, Pub/Sub and Streams, caching patterns, multi-level caching (Caffeine/lru-cache/moka → Redis → Postgres), design patterns, operations, security, Kubernetes, Redis 8 extras (JSON, search, probabilistic, vector sets) |
| In-process caching | Caffeine (Java), lru-cache (Node.js) and moka (Rust) side by side: what a local cache is, everyday API, eviction (LRU, LFU, W-TinyLFU), expiry and refresh, single-flight loading and concurrency, memory and GC, statistics, frameworks and pitfalls — recorded from real runs |
| Object storage with S3 (RustFS) | From zero: what object storage and S3 are, running RustFS, the console, CLI tools and Micronaut / TypeScript / Rust code, requests and signing, multipart uploads, access policies and presigned links, versioning and lifecycle, erasure coding, production patterns — recorded on a real RustFS |
| Git | Setup, the three areas, history, how Git stores data, branches, merging and rebasing, remotes, fetch vs pull, work and personal accounts on one machine, undoing anything, the everyday toolbox |
| Node.js internals | V8 and libuv, the event loop and microtasks, blocking and the thread pool, async patterns, streams and backpressure, HTTP on the wire, graceful shutdown |
| React internals | Elements and JSX, render and commit, state snapshots and batching, reconciliation and keys, effects, hooks, memoization and the React Compiler, transitions and Suspense, server rendering and hydration |

Lessons are visual (figures, flows, timelines and charts built from data with SVG/CSS) and the outputs they show are
recorded from real software by the scripts in `tools/<topic>-capture`.

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and bundle to dist/
npm run lint
npm test         # architecture tests: discovery, links, glossary terms, dependency rules
```

Requires Node 20.19+ (or 22.12+). Runtime dependencies: `react`, `react-dom` and `highlight.js` (code highlighting, loaded lazily).

## Structure

```
src/
  app/        shell: hash router, layout, pages, theme and progress state
  core/       module contracts (LearningModule, Lesson) and the registry
  shared/     ui primitives, figures (Flow, Timeline, charts), code highlighting, hooks, utils
  styles/     design tokens (light/dark) and base styles
  modules/
    index.ts  discovers every module folder (never edited)
    kafka/
      index.ts      module metadata and lazily loaded lessons
      lessons/      one component per lesson, plus <Lesson>.terms.ts with its glossary terms
      simulation/   pure TypeScript model of Kafka (no React)
      components/   Kafka-specific visuals
```

The simulators are plain TypeScript classes that extend a tiny `Observable`; React binds
to them with `useObservable`. The partitioner is a port of Kafka's murmur2, so keys land on
the same partitions as on a real cluster.

## Adding a module

1. Create `src/modules/<topic>/index.ts` that default-exports a `LearningModule`:

   ```ts
   export const redisModule: LearningModule = {
     id: 'redis',
     order: 70, // position on the home page, lowest first
     title: 'Redis',
     description: '…',
     tags: ['cache', 'key-value'],
     groups: [
       {
         title: 'Foundations',
         lessons: [
           { slug: 'data-types', title: 'Data types', summary: '…', load: () => import('./lessons/DataTypes') },
         ],
       },
     ],
   }

   export default redisModule
   ```

2. Write lessons as default-exported components, composing `@/shared/ui`
   (`Demo`, `Walkthrough`, `Callout`, `CodeBlock`, `TermList`, `Predict`, …) and `@/shared/figures`
   (`Flow`, `Timeline`, `StatTiles`, `BarChart`, `ByteLayout`, `Proportion`).
3. Put each lesson's glossary terms in `lessons/<Lesson>.terms.ts` next to it.

That is all: the module is discovered. Nothing in `app/`, `core/` or `src/modules/index.ts` changes, and
`npm test` checks the conventions (unique ids and slugs, links that resolve, terms next to their lesson, no
re-export-only barrels, simulations without React).
