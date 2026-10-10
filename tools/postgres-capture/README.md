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
