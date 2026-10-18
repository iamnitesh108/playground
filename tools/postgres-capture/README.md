# postgres-capture

Records real PostgreSQL behaviour for the `postgres` module, so the lessons replay what the
database actually did instead of hand-written examples.

- `scenarios.mjs` — two concurrent sessions per scenario (MVCC, isolation levels, locks,
  deadlocks, write skew). After every step it records each session's result or error, the
  transaction ids and their status, and every tuple on the table's page via `pageinspect`.
- `capture.mjs` — single-session captures: page header, WAL records (`pg_walinspect`), B-tree
  internals, `EXPLAIN` plans, constraint errors.
- `gen.mjs` — writes `src/modules/postgres/data/scenarios.ts` and `captures.ts`.

## Run

```sh
docker run -d --name pglab -p 55432:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab postgres:18
docker exec pglab psql -U postgres -d lab -c "CREATE EXTENSION pageinspect" -c "CREATE EXTENSION pg_walinspect"
docker exec pglab ps -eo pid,ppid,cmd | grep -v 'ps -eo' > ps.txt     # server processes

npm install
npm run capture
docker rm -f pglab
```

Transaction ids, LSNs and timings differ on every run; the behaviour does not.

## Operations recordings (`ops/`)

Setup, pooling and backup lessons are recorded on Ubuntu 24.04 with packages from
apt.postgresql.org, with a second container acting as a remote client.

```sh
cd ops
podman run --rm -v "$PWD":/out:Z ubuntu:24.04 bash /out/ubuntu.sh        # install, file layout → ubuntu.txt
bash docker.sh                                                         # postgres:18 volume paths → docker.txt

# a lab server (Ubuntu + postgresql-18 + pgbouncer installed, cluster started) on its own network
podman network create --subnet 10.0.1.0/24 opsnet
podman run -d --name opslab --network opsnet --ip 10.0.1.10 -p 56432:6432 -v "$PWD":/out:Z <lab image> sleep infinity

bash setup-host.sh > setup.txt                                         # listen_addresses, pg_hba, roles, privileges
podman exec opslab bash /out/pgbouncer.sh && (cd .. && node ops/pool.mjs)   # pools → pool.json
podman exec opslab bash /out/backup.sh > backup.txt                    # dump, base + incremental backup, DROP
podman exec opslab bash /out/restore.sh "<good point from backup.txt>" > restore.txt   # PITR
node gen-ops.mjs ../../../src/modules/postgres/data/ops.ts
```

## Pooling and monitoring (`capture-operations.mjs`)

Records the "Connection pooling" and "Monitoring and tuning" lessons into
`src/modules/postgres/data/operations.ts`: memory of idle backends (`/proc/<pid>/smaps_rollup`,
`pg_backend_memory_contexts`), connect cost and scaling with `pgbench`, `max_connections` refusals,
what breaks behind PgBouncer in transaction mode (SET, advisory locks, LISTEN, SQL `PREPARE`,
`max_prepared_statements`), statement mode, the client pools in `operations-app/` (HikariCP and
node-postgres), and — under pgbench load — `pg_stat_activity` sampled over time, `pg_stat_statements`,
`pg_stat_user_tables`, cache hit ratio, `pg_buffercache`, `pg_stat_io`, a blocked query,
an idle-in-transaction timeout, `work_mem` sorts, dead tuples with and without autovacuum tuning, and
the log lines the logging settings produce.

```sh
podman run -d --name pg-ops -p 55520:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab \
  docker.io/library/postgres:18 postgres -c shared_preload_libraries=pg_stat_statements,auto_explain
# PgBouncer from apt.postgresql.org on Ubuntu, reaching pg-ops through the host
podman run -d --name pg-ops-bouncer -p 55521:6432 docker.io/library/ubuntu:24.04 sleep infinity
podman exec pg-ops-bouncer bash -c 'apt-get update && apt-get install -y postgresql-common &&
  /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y && apt-get install -y pgbouncer'

(cd operations-app && npm install && gradle --console=plain -q installDist)   # Gradle 8.8, JDK 17
node capture-operations.mjs 55520 55521      # about 15 minutes
podman rm -f pg-ops pg-ops-bouncer
```

The script recreates the `shop` database and the pgbench tables on every run. Throughput numbers
depend on the machine (the recording used 12 CPU threads); the shapes of the curves do not.

## Getting started lessons (`capture-start.mjs`)

Records "Install and configure", "Using PostgreSQL day to day" and "Schema design and data types"
into `src/modules/postgres/data/start.ts`:

- `pg_settings` contexts, `SET` of a session and a restart-only setting, `data_checksums`;
- psql sessions (one psql process per session, so `BEGIN`, `\x` and errors carry over): connecting by
  flags, URI, environment variables and `.pgpass`, `\dt`, `\d`, `\x`, `\timing`, CREATE TABLE, INSERT …
  RETURNING, SELECT, UPDATE, DELETE, joins, GROUP BY, a rolled-back and an aborted transaction,
  ON CONFLICT with `RETURNING old/new`, COPY and `\copy`. psql prints no prompt when it reads a script,
  so the script adds `shop=>`, `shop=*>` (in a transaction) and `shop=!>` (failed transaction) by psql's rules;
- the query playground: every combination of its controls is run on the sample rows and compared with
  the lesson's model (`simulation/usingPostgresQuery.ts`); any difference stops the capture;
- OFFSET vs keyset pagination on one million rows (EXPLAIN ANALYZE, median of five);
- the apps in `start-app-java/` (JDBC + HikariCP, Gradle) and `start-app-ts/` (node-postgres, run with
  Node 24 type stripping); the lesson imports their sources with `?raw`;
- stored sizes (`pg_column_size`), float8 vs numeric sums (checked against `simulation/schemaDesignMoney.ts`),
  timestamp vs timestamptz across time zones and a DST change, varchar/char, overflow, identity, uuid v4/v7,
  1M-row inserts with bigint, uuidv7 and random uuid keys (index size, time, WAL), json/jsonb, arrays,
  enums, constraint errors, each ON DELETE action, ALTER TABLE timings on 1M rows with
  `pg_relation_filenode` before and after (rewrite or not), and a three-session lock queue behind
  `ALTER TABLE`, with and without `lock_timeout`.

```sh
podman run -d --name pg-start -p 55511:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab docker.io/library/postgres:18
(cd start-app-ts && npm install)
GRADLE=/path/to/gradle-8.8/bin/gradle node capture-start.mjs 55511 pg-start    # JDK 17, about 2 minutes
podman rm -f pg-start
```

The script changes the container's `pg_hba.conf` so TCP logins from inside it need a password, and
recreates the `shop`, `play` and `types` databases on every run. Timings, ids and uuids differ per run.

## How it works: internals (`capture-internals.mjs`)

Records "How PostgreSQL runs", "Pages, tuples and TOAST", "Rows are versions (MVCC)" and
"Dead tuples, HOT and VACUUM" into `src/modules/postgres/data/internals.ts`. It talks to the server only
through `podman exec … psql` (no npm packages) and starts extra sessions as background psql processes:

- processes: `ps` while a client query runs, `pg_receivewal` is attached (a walsender) and a slowed-down
  autovacuum worker cleans a table; `pg_stat_activity`; memory settings; the data directory, a table's
  files and their forks; a view expanded by the rewriter; `EXPLAIN (ANALYZE, BUFFERS)` cold and warm after
  `pg_buffercache_evict_relation()`; usage counts from `pg_buffercache`; 1,000 commits vs one transaction
  vs `synchronous_commit = off`, with WAL fsyncs from `pg_stat_io`;
- storage: `page_header` / `heap_page_items` and the raw bytes of one tuple, a checksum after a checkpoint,
  null bitmaps (8 vs 9 columns), column order and padding (checked against `simulation/storageLayout.ts`
  on eight tables), fillfactor 100 vs 70, TOAST (inline, compressed, external, chunks), pglz vs lz4,
  `pg_freespace` and `pg_visibility_map` before and after VACUUM and VACUUM FREEZE;
- MVCC: a snapshot taken while two other sessions hold xids, hint bits before and after the first read,
  a row lock in xmax, an update chain;
- VACUUM: HOT ratio with fillfactor 100 vs 90, page pruning by a SELECT, bloat with `pgstattuple` before
  and after VACUUM and VACUUM FULL, truncation, a REPEATABLE READ snapshot holding cleanup back,
  freezing (`t_infomask`, `age(relfrozenxid)`), and autovacuum crossing (and not crossing) its threshold
  with the server log line (`autovacuum_naptime` is set to 1 s during the run and reset at the end).

```sh
podman run -d --name pg-internals -p 55512:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab docker.io/library/postgres:18
node capture-internals.mjs pg-internals     # about a minute; recreates the public schema of "lab"
podman rm -f pg-internals
```

Xids, oids, LSNs and timings differ per run; the lessons derive every number from the file.

## Query planning, B-tree and index-type lessons (`capture-queries.mjs`)

Records everything the “Query planning and EXPLAIN”, “B-tree indexes” and “Other index types”
lessons show: `pg_stats`, row estimates (good, correlated columns, stale statistics), the cost
settings and `EXPLAIN` costs, the four scan types, nested loop / hash / merge joins (also forced
with `enable_*` to price and time each), parallel query, sorts and hashes spilling past
`work_mem`, multi-column and covering indexes with the visibility map, the write cost of 0/1/3/6
indexes, index bloat and `REINDEX CONCURRENTLY`, `CREATE INDEX` blocking writes and a failed
`CONCURRENTLY` build, `pg_stat_user_indexes`, and partial, expression, GIN (JSONB, arrays,
full-text, `pg_trgm`), GiST (exclusion constraint, nearest neighbour), BRIN and hash indexes with
their sizes. It drives `psql` (needs it on the PATH) and writes
`src/modules/postgres/data/queries.ts`; it refuses to write if the output contains a home
directory or user name.

```sh
podman run -d --name pg-query -p 55514:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab docker.io/library/postgres:18
node capture-queries.mjs ../../src/modules/postgres/data/queries.ts    # ~1 minute; PG_QUERIES_PORT overrides 55514
podman rm -f pg-query
```

Timings, sampled statistics and buffer counts change a little on every run; the plans do not.

## Concurrency recordings (`capture-concurrency.mjs`)

Isolation, locks and constraints lessons. Runs 2–4 real sessions per scenario and records, after
every step, each session's result (or that it is waiting), its state and xid, and what it holds:
`pg_locks` with `pg_blocking_pids` (session names instead of pids), `pgrowlocks` for row locks,
or the SIRead (predicate) locks of serializable transactions. Also records the six anomalies at
all four levels, the row- and table-lock conflict matrices (every pair tried with `NOWAIT`), which
table lock each statement asks for, `log_lock_waits` and deadlock log lines, the timeouts, the
constraint errors (deferrable, exclusion, `WITHOUT OVERLAPS`, ON DELETE actions, FK index timing),
and the output of the TypeScript programs in `concurrency-app/` (retry loop, idempotent payments,
SKIP LOCKED queue). Writes `src/modules/postgres/data/concurrency.ts`; it refuses to write if the
output contains a home directory or user name.

```sh
podman run -d --name pg-conc -p 55513:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab docker.io/library/postgres:18
(cd concurrency-app && npm install)        # pg, used by the script and the programs
node capture-concurrency.mjs 55513 pg-conc ../../src/modules/postgres/data/concurrency.ts
podman rm -f pg-conc
```

The programs also run on their own (Node 24, type stripping): `PGPORT=55513 node concurrency-app/src/queue.ts`.
Timings, pids and xids differ on every run; the outcomes do not (the SKIP LOCKED / FOR UPDATE job
split between workers varies too).

## Durability recordings (`capture-durability.mjs`)

WAL, replication and partitioning lessons, recorded on official `postgres:18` containers named
`pg-dur-*` on the podman network `pg-dur-net` (host ports 55515–55519). The script starts and
removes its own containers; psql runs inside them, so outputs look exactly as psql prints them.
Small TypeScript programs in `durability-app/` (run with node's type stripping) are shown in the
lessons as they ran.

```sh
podman network create pg-dur-net
(cd durability-app && npm install)
node capture-durability.mjs wal    # WAL records, LSNs, full-page writes, checkpoints, synchronous_commit, group commit, a killed server
node capture-durability.mjs repl   # primary + standby (pg_basebackup -R), lag, synchronous standby, slots, conflicts, logical replication, promotion
node capture-durability.mjs part   # range/list/hash partitions, pruning, keys and indexes, DELETE vs DROP, 365 partitions vs one table
node capture-durability.mjs gen    # durability-app/out/*.json → src/modules/postgres/data/durability.ts
podman network rm pg-dur-net
```

Each section writes `durability-app/out/<section>.json`; `gen` refuses to write output containing a
home directory or user name. Timings (tps, fsync latency, lag) depend on the machine and vary
between runs; the lessons say which numbers are medians.
