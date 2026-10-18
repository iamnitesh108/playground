# local-cache-capture

Records real behaviour of in-process caches — Caffeine (Java), lru-cache (Node.js) and moka (Rust) — for the
`local-cache` module, so the lessons show what the libraries actually did instead of hand-written examples.
Each script below writes one data file in `src/modules/local-cache/data/`.

## capture-basics.mjs → data/basics.ts

For "What an in-process cache is" and "Using it day to day".

```
node capture-basics.mjs ../../src/modules/local-cache/data/basics.ts   # SKIP_BUILD=1 reuses existing builds
```

Needs Java 17, Gradle 8.8 (`GRADLE` overrides the path), Node 24, Rust/cargo and `redis-server` on the PATH.
It builds and runs:

- `basics-java/` (Caffeine 3.1.8, Lettuce), `basics-ts/` (lru-cache 11, ioredis), `basics-rust/` (moka 0.12, redis):
  `using` walks the everyday API in sections (`## build`, `## get-put`, … printed by the program; the lessons show the
  `#region` blocks of the same files); `why` measures heap growth of an unbounded map vs a cache bounded at 10,000
  entries over 1,000,000 distinct keys, and the median cost of a cache hit, a map lookup, rebuilding the value and a
  Redis GET on localhost (run 3 times; the median of the three is kept).
- `basics-micronaut/` (Micronaut 4.5, micronaut-cache-caffeine): a `@Cacheable` service called five times, with a
  correct and a wrong `@CacheInvalidate`.
- `basics-ts/model-check.ts`: the same scripted session against lru-cache and against the lesson's model
  (`simulation/usingCache.ts`); `modelCheck.matches` records whether removals and recency order were identical.

A throwaway `redis-server` runs on port 17500 with no persistence and is stopped afterwards. Numbers come from one
machine (the CPU model is recorded); the output is refused if it contains the home directory or user name.

## capture-policies.mjs → data/policies.ts

For "Eviction: LRU, LFU and W-TinyLFU" and "Expiry and refresh".

```
node capture-policies.mjs ../../src/modules/local-cache/data/policies.ts   # GRADLE=/path/to/gradle if not on the PATH
```

Needs Java 17, Gradle 8.8, Node 24 and Rust/cargo; no servers. It builds and runs `policies-java/` (Caffeine 3.1.8),
`policies-ts/` (lru-cache 11) and `policies-rust/` (moka 0.12, `sync`), which all take the same commands and print
JSON lines:

- `replay <trace> <sizes…>`: six deterministic traces of 1,000,000 requests (Zipf 0.6/0.8/1.0, Zipf + scans, a loop
  of 6,000 keys, a shifting hot set) are written to `policies-traces/` (git-ignored) by
  `src/modules/local-cache/simulation/evictionTraces.ts`, then replayed (read; put on a miss) at 500, 1,000, 2,500 and
  5,000 entries. moka runs twice, TinyLFU (default) and `EvictionPolicy::lru()`. Caffeine also reports its admission
  window size every 10,000 requests, read by reflection (demo only). The script then runs the lesson's own models
  (`simulation/evictionPolicies.ts`: FIFO, LRU, LFU, TinyLFU, W-TinyLFU with and without hill climbing, and Belady's
  optimal) on the same traces, so the lesson can compare them with the libraries.
- `order 4 a b c d …`: a few requests into a cache of four, with contents and evictions after each one.
- Expiry: lazy cleanup (`lazy`), an idle cache with and without a Caffeine `Scheduler` / lru-cache `ttlAutopurge` /
  moka housekeeping (`scheduler`, `autopurge`, `idle`), write vs access expiry, per-entry expiry and the timer wheel
  (`per-entry`), refresh vs expire with a 200 ms loader (`refresh`, `fetch`, `reload`), and synchronized expiry with
  and without ±10 % jitter (`jitter`). Caffeine uses a hand-moved `Ticker` where the experiment allows it; lru-cache and
  moka run in real time with short lifetimes (moka's mock clock is crate-private).

Hit ratios do not depend on the machine; Caffeine (random admission of warm candidates) and moka (time-based
housekeeping) can differ by a few tenths of a point between runs. Timings are single runs on one machine. The output
is refused if it contains the home directory or user name.

## capture-runtime.mjs → data/runtime.ts

For "Loading, single-flight and concurrency", "Memory, weight and garbage collection" and "Statistics, frameworks
and pitfalls".

```
node capture-runtime.mjs ../../src/modules/local-cache/data/runtime.ts   # GRADLE=/path/to/gradle if not on the PATH
```

Needs Java 17, Gradle 8.8, Node 24 and Rust/cargo; no servers. It builds `runtime-java/` (Caffeine 3.1.8, Micrometer
1.12 with the Prometheus registry), `runtime-micronaut/` (Micronaut 4.5, micronaut-cache-caffeine), `runtime-ts/`
(lru-cache 11) and `runtime-rust/` (moka 0.12 `sync` + `future`, tokio, `lru` for the single-lock baseline), then runs
each experiment as its own process and keeps the JSON lines it prints (stderr is not recorded):

- `singleflight`: 50 callers on one cold key with a 200 ms loader, check-load-put vs single-flight (Caffeine
  `get(key, fn)` and `AsyncCache`, lru-cache `fetch()`, moka `get_with` with threads and `future::Cache` with tokio
  tasks); a loader that throws after 100 ms (10 callers); absent keys (null / undefined / None vs Optional, a sentinel,
  `Option<V>`); Caffeine `getAll` with `loadAll`; a loader that calls its own cache (3 s timeout); refresh vs expire.
- `throughput` (Java, Rust): reads/s from 1, 2, 4 and 8 threads, Caffeine vs a synchronized access-ordered
  `LinkedHashMap` vs `ConcurrentHashMap`, moka vs `Mutex<lru::LruCache>` vs `RwLock<HashMap>`; 65,536 keys, Zipf 0.99,
  median of 5 runs of 200 ms after a warm-up.
- `footprint`: bytes per entry for 1,000,000 entries — Java heap after `System.gc()` (`-Xmx3g`), Node.js `heapUsed +
  arrayBuffers` after `gc()` (`--expose-gc`), Rust bytes counted by a global allocator wrapper.
- `weight`: the same writes into a 1 MB weight-bounded cache in all three libraries; `soft` (Java, `-Xmx96m`):
  `softValues()` vs unbounded vs `maximumWeight`; `gc` (Java, `-Xmx2g`, G1): 10 s of requests with 10,000, 200,000
  and 600,000 entries of 1 KB, every collection recorded from the JVM's GC notifications.
- `stats`: 20,000 Zipf requests over 10,000 keys into 1,000 entries — Caffeine `recordStats()`, Micrometer
  `CaffeineCacheMetrics` meters and a Prometheus scrape; counting wrappers for lru-cache and moka; lru-cache `memo()`.
- `pitfalls`: unbounded builders, a mutated cached object, keys without equality. `runtime-micronaut`: `@Cacheable`,
  a wrong and a right `@CacheInvalidate`, and 20 concurrent misses with `atomic = false` / `true`.
- `bench`: one thread, gets that hit and puts with eviction, median of 7 passes after 5 warm-up passes.

Benchmarks are from one machine (core count recorded), single runs with other work possibly running: compare shapes,
not absolute numbers. The output is refused if it contains the home directory or user name.
