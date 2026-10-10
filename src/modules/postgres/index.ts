import type { LearningModule } from '@/core/module'

export const postgresModule: LearningModule = {
  id: 'postgres',
  title: 'PostgreSQL internals',
  description:
    'How PostgreSQL really works, shown with recordings of a real server: row versions and MVCC, vacuum, isolation levels, locks and deadlocks, constraints, B-tree indexes and query plans, WAL and crash recovery — then installing, pooling and backing it up.',
  tags: ['postgresql', 'mvcc', 'transactions', 'indexes', 'wal', 'pgbouncer', 'backups'],
  groups: [
    {
      title: 'Foundations',
      lessons: [
        { slug: 'architecture', title: 'How PostgreSQL runs', summary: 'Processes, shared memory, pages and files — and the path of one query and one commit.', load: () => import('./lessons/Architecture') },
        { slug: 'mvcc', title: 'Rows are versions (MVCC)', summary: 'Why an UPDATE writes a new row, and how xmin and xmax decide what each transaction sees.', load: () => import('./lessons/Mvcc') },
        { slug: 'vacuum', title: 'Dead tuples, HOT and VACUUM', summary: 'Where old versions go, how heap-only tuples avoid index updates, and why vacuum is not optional.', load: () => import('./lessons/Vacuum') },
      ],
    },
    {
      title: 'Concurrency',
      lessons: [
        { slug: 'isolation', title: 'Isolation levels', summary: 'Read committed, repeatable read and serializable — replayed side by side.', load: () => import('./lessons/Isolation') },
        { slug: 'locks', title: 'Concurrent writes and locks', summary: 'Lost updates, atomic updates, SELECT … FOR UPDATE, serialization failures and deadlocks.', load: () => import('./lessons/Locks') },
        { slug: 'constraints', title: 'Constraints and idempotency', summary: 'Letting the database enforce the rules: the real errors, ON CONFLICT, and safe retries.', load: () => import('./lessons/Constraints') },
      ],
    },
    {
      title: 'Performance and durability',
      lessons: [
        { slug: 'indexes', title: 'B-tree indexes and plans', summary: 'How a B-tree is searched and grows, and reading EXPLAIN for real queries on 100,000 rows.', load: () => import('./lessons/Indexes') },
        { slug: 'wal', title: 'WAL and crash recovery', summary: 'Write-ahead logging, checkpoints, crashes and replay — and how the WAL feeds replication.', load: () => import('./lessons/Wal') },
      ],
    },
    {
      title: 'Operations',
      lessons: [
        { slug: 'setup', title: 'Install and configure', summary: 'Ubuntu packages and Docker, postgresql.conf, pg_hba.conf, and roles with least privilege.', load: () => import('./lessons/Setup') },
        { slug: 'pooling', title: 'Connection pooling', summary: 'Why connections are expensive, PgBouncer session and transaction modes, and what breaks.', load: () => import('./lessons/Pooling') },
        { slug: 'backups', title: 'Backups and point-in-time recovery', summary: 'pg_dump, base and incremental backups, WAL archiving, and undoing a DROP TABLE.', load: () => import('./lessons/Backups') },
      ],
    },
  ],
}
