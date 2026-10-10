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
