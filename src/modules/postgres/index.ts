import type { LearningModule } from '@/core/module'

export const postgresModule: LearningModule = {
  id: 'postgres',
  order: 30,
  title: 'PostgreSQL',
  description:
    'Just want to use PostgreSQL? Start with “Using PostgreSQL day to day”. Then see how it really works, recorded on a real server: pages and row versions (MVCC), vacuum, isolation and locks, query plans and every index type, WAL, replication, backups and partitioning — and running it: pooling, monitoring and tuning.',
  tags: ['postgresql', 'sql', 'mvcc', 'transactions', 'indexes', 'explain', 'wal', 'replication', 'pgbouncer', 'backups'],
  groups: [
    {
      title: 'Getting started',
      lessons: [
        { slug: 'setup', title: 'Install and configure', summary: 'Ubuntu packages and Docker, postgresql.conf, pg_hba.conf, and roles with least privilege.', load: () => import('./lessons/Setup') },
        { slug: 'using-postgres', title: 'Using PostgreSQL day to day', summary: 'psql, creating tables, insert/select/update/delete, joins, transactions and upserts — from the shell and from Java and TypeScript code.', load: () => import('./lessons/UsingPostgres') },
        { slug: 'schema-design', title: 'Schema design and data types', summary: 'Choosing types, keys and constraints, normalising, and when JSONB, arrays and enums are the right tool.', load: () => import('./lessons/SchemaDesign') },
      ],
    },
    {
      title: 'How it works',
      lessons: [
        { slug: 'architecture', title: 'How PostgreSQL runs', summary: 'Processes, shared memory, pages and files — and the path of one query and one commit.', load: () => import('./lessons/Architecture') },
        { slug: 'storage', title: 'Pages, tuples and TOAST', summary: 'The 8 kB page, the tuple header, alignment and padding, fillfactor, and where large values go.', load: () => import('./lessons/Storage') },
        { slug: 'mvcc', title: 'Rows are versions (MVCC)', summary: 'Why an UPDATE writes a new row, and how xmin and xmax decide what each transaction sees.', load: () => import('./lessons/Mvcc') },
        { slug: 'vacuum', title: 'Dead tuples, HOT and VACUUM', summary: 'Where old versions go, how heap-only tuples avoid index updates, and why vacuum is not optional.', load: () => import('./lessons/Vacuum') },
      ],
    },
    {
      title: 'Transactions and concurrency',
      lessons: [
        { slug: 'isolation', title: 'Isolation levels', summary: 'Read committed, repeatable read and serializable — replayed side by side.', load: () => import('./lessons/Isolation') },
        { slug: 'locks', title: 'Concurrent writes and locks', summary: 'Lost updates, row and table lock modes, migrations that block everyone, timeouts, deadlocks, SKIP LOCKED job queues and advisory locks.', load: () => import('./lessons/Locks') },
        { slug: 'constraints', title: 'Constraints and idempotency', summary: 'Letting the database enforce the rules: the real errors, ON CONFLICT, and safe retries.', load: () => import('./lessons/Constraints') },
      ],
    },
    {
      title: 'Making queries fast',
      lessons: [
        { slug: 'query-planning', title: 'Query planning and EXPLAIN', summary: 'How the planner estimates rows and costs, scan types, nested loop, hash and merge joins, and reading EXPLAIN ANALYZE.', load: () => import('./lessons/QueryPlanning') },
        { slug: 'indexes', title: 'B-tree indexes', summary: 'How a B-tree is searched and grows, multi-column and covering indexes, and what an index costs on writes.', load: () => import('./lessons/Indexes') },
        { slug: 'index-types', title: 'Other index types', summary: 'Partial and expression indexes, GIN for JSONB, arrays and full-text search, GiST, BRIN and hash — when each one wins.', load: () => import('./lessons/IndexTypes') },
      ],
    },
    {
      title: 'Durability and scale',
      lessons: [
        { slug: 'wal', title: 'WAL and crash recovery', summary: 'Write-ahead logging, checkpoints, crashes and replay — and how the WAL feeds replication.', load: () => import('./lessons/Wal') },
        { slug: 'replication', title: 'Replication and failover', summary: 'Streaming replicas, synchronous commit, replication slots, logical replication and promoting a standby.', load: () => import('./lessons/Replication') },
        { slug: 'backups', title: 'Backups and point-in-time recovery', summary: 'pg_dump, base and incremental backups, WAL archiving, and undoing a DROP TABLE.', load: () => import('./lessons/Backups') },
        { slug: 'partitioning', title: 'Partitioning', summary: 'Range, list and hash partitions, partition pruning, and dropping old data in milliseconds.', load: () => import('./lessons/Partitioning') },
      ],
    },
    {
      title: 'Operations',
      lessons: [
        { slug: 'pooling', title: 'Connection pooling', summary: 'Why connections are expensive, PgBouncer session and transaction modes, and what breaks.', load: () => import('./lessons/Pooling') },
        { slug: 'monitoring', title: 'Monitoring and tuning', summary: 'pg_stat_statements, the statistics views, autovacuum, memory settings and the alerts worth having.', load: () => import('./lessons/Monitoring') },
      ],
    },
    {
      title: 'Reference',
      lessons: [
        { slug: 'glossary', title: 'Glossary and cheat sheet', summary: 'Every term in the module, searchable, and the commands you will use most.', load: () => import('./lessons/Glossary') },
      ],
    },
  ],
}

export default postgresModule
