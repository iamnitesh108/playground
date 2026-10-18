# redis-capture

Records real Redis behaviour for the `redis` module, so the lessons replay what the server
actually did instead of hand-written examples. Every experiment runs against throwaway
`redis-server` / `redis-sentinel` processes in one temporary directory (removed on exit);
nothing touches an installed Redis. No dependencies: a small RESP client lives in `lib/`.

- `lib/resp.mjs` — RESP2 client: several connections, pipelines, pub/sub messages.
- `lib/format.mjs` — prints replies exactly as an interactive `redis-cli` does. Before every
  capture, `lib/selfcheck.mjs` runs a set of commands through it and through the real
  `redis-cli --no-raw` and stops on any difference.
- `lib/server.mjs` — starts, kills (`SIGKILL` = a crash) and restarts servers; reads their logs.
- `experiments/*.mjs` — one file per lesson topic (architecture, protocol, types, keyspace,
  expiry, eviction, transactions, locks, persistence, replication, cluster, messaging,
  patterns, operations).
- `capture.mjs` — runs the experiments and writes `src/modules/redis/data/captures.ts`. Paths of
  the temporary directory are replaced by `/data/…`; the run fails if the output contains the
  current user's name or home directory.
- `check-simulator.mjs` — compares the module's TypeScript simulators with a real server and
  with the recordings: CRC16 hash slots (recorded keys and 300 random ones), cluster slot
  ranges, encoding rules, the LFU counter, both rate limiters, SCAN cursor order, crash
  survival, partial/full resync, the consumer-group replay, LFU vs LRU vs random under a burst,
  and LRU in a burst vs spread out (the one-second LRU clock).

## Run

Needs `redis-server`, `redis-cli`, `redis-sentinel`, `redis-benchmark` and `redis-check-aof`
on the `PATH` (recorded with Redis 8.8.3) and Linux (`/proc` is read for thread names).

```sh
cd tools/redis-capture
npm run capture                 # all experiments, ~2–3 minutes
node capture.mjs ../../src/modules/redis/data/captures.ts eviction cluster   # only some
npm run check                   # simulators vs real Redis
```

Timings, ids, ports and memory numbers differ on every run and machine; the behaviour does not.
Ports are rewritten to the conventional ones (6379, 6380, 7001–7006) in the recordings.
