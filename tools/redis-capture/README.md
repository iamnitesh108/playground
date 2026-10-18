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

## Using Redis day to day / Clients (`capture-usage.mjs`)

Records the two application-side lessons into `src/modules/redis/data/usage.ts`:

- redis-cli sessions for the everyday commands (connecting with flags and a URL, strings,
  counters, expiry, hashes, lists as a queue, sets, sorted sets, Pub/Sub, SCAN, MULTI, `--pipe`),
  client-side caching with `CLIENT TRACKING … REDIRECT`, and `MOVED` from a three-node cluster;
- the output of `usage-app/`, a small Micronaut 4 app using micronaut-redis-lettuce (Lettuce).
  `APP_MODE` picks one demo: `usage`, `async`, `pubsub`, `pipeline`, `watch`, `config`, `timeout`
  (the script runs `DEBUG SLEEP 2` from another connection while the app waits with a 500 ms
  timeout) and `reconnect` (the script restarts the server while the app increments a counter).

The lessons import the app's source files with Vite `?raw`, so the code shown is the code that ran.

```sh
cd tools/redis-capture/usage-app
gradle installDist              # Gradle 8.8, Java 17+
cd ..
node capture-usage.mjs ../../src/modules/redis/data/usage.ts   # ~30 seconds
```

Servers use ports 17100–17199 (rewritten to 6379 and 7000–7002). The script refuses to write a
recording that contains the user name or home directory.

## Security, Kubernetes and Redis 8 data types

Three more scripts record the lessons “Securing Redis”, “Redis on Kubernetes” and “Beyond the
core types”. Each writes its own data file and refuses to write one that contains the user name
or home directory.

```sh
node capture-security.mjs ../../src/modules/redis/data/security.ts      # ~20 seconds
KUBECONFORM=/path/to/kubeconform \
node capture-kubernetes.mjs ../../src/modules/redis/data/kubernetes.ts  # ~2 minutes, podman
node capture-beyond.mjs ../../src/modules/redis/data/beyond.ts          # ~2 minutes, podman
```

- **capture-security.mjs** — local `redis-server` on ports 17200–17229. Records protected mode
  from a second, non-loopback address of the machine (rewritten to 192.168.1.20), the protected
  configs, ACL users (categories, `~`, `%R~`, `&`, selectors, DRYRUN, LOG), aclfile vs
  `CONFIG REWRITE`, `rename-command`, and TLS with a private CA made by `openssl`.
- **capture-kubernetes.mjs** — no cluster is used. The files in `k8s/` (ConfigMap scripts and
  `redis.conf`, the Secret's ACL file) are mounted into podman containers of `docker.io/redis:8.10.2`
  named `redis-sec-k8s-*` (host ports 17240–17249), the way a pod mounts them, and the start
  script, users, replication, probes (also while loading), shutdown and `redis-cli --rdb` backup are
  run for real. With `KUBECONFORM` set, the manifests are also validated against the Kubernetes
  schemas. Sentinel and Cluster announce-hostname settings are checked with local binaries.
  The lesson imports the manifests from `k8s/` with Vite `?raw`.
- **capture-beyond.mjs** — runs `docker.io/redis:8` as container `redis-beyond-1` on host port
  17250 and records JSON, the Query Engine, time series, Bloom/Cuckoo/Count-min/Top-K/t-digest and
  vector sets, plus memory and accuracy measurements against exact core types (generated data
  from a fixed seed).

All containers, volumes and the podman network are removed when the scripts finish.
