# Playground

Interactive, beginner-friendly guides for backend systems and concepts. Each topic is a
module of short lessons with step-through diagrams and small in-browser simulators.

## Modules

| Module | Covers |
| ------ | ------ |
| Apache Kafka | Events, brokers, topics, partitions, producers, offsets, consumer groups, delivery guarantees, replication, retention, Kafka Connect, Debezium CDC, the transactional outbox pattern, CLI and glossary |
| Kafka from scratch | Production-style setup of Kafka 4.3 (KRaft), PostgreSQL, Kafka Connect and Debezium 3.7 — on Ubuntu with systemd and with Docker, single node and 3 controllers + 3 brokers; every config file explained; pub-sub and CDC from Java; operations and troubleshooting |

## Run

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and bundle to dist/
npm run lint
```

Requires Node 20.19+ (or 22.12+). Runtime dependencies: `react` and `react-dom` only.

## Structure

```
src/
  app/        shell: hash router, layout, pages, theme and progress state
  core/       module contracts (LearningModule, Lesson) and the registry
  shared/     ui primitives, diagram pieces, hooks, utils
  styles/     design tokens (light/dark) and base styles
  modules/
    index.ts  registers every module
    kafka/
      index.ts      module metadata and lazily loaded lessons
      lessons/      one component per lesson
      simulation/   pure TypeScript model of Kafka (no React)
      components/   Kafka-specific visuals
```

The simulators are plain TypeScript classes that extend a tiny `Observable`; React binds
to them with `useObservable`. The partitioner is a port of Kafka's murmur2, so keys land on
the same partitions as on a real cluster.

## Adding a module

1. Create `src/modules/<topic>/index.ts` exporting a `LearningModule`:

   ```ts
   export const redisModule: LearningModule = {
     id: 'redis',
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
   ```

2. Write lessons as default-exported components, composing `@/shared/ui`
   (`Demo`, `Walkthrough`, `Box`, `Connector`, `Callout`, `CodeBlock`, `TermList`, …).
3. Add it to the registry in `src/modules/index.ts`.

Nothing in `app/` or `core/` needs to change.
