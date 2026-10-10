# node-capture

Records real Node.js behaviour for the `nodejs` module. Each file in `experiments/` is a small
program; `capture.mjs` runs them all with the current `node`, shortens local paths to `/app/`,
and writes `src/modules/nodejs/data/captures.ts`.

```sh
node capture.mjs ../../src/modules/nodejs/data/captures.ts
```

- `order.mjs` / `order.cjs` — the same five programs as an ES module and as CommonJS; the event
  loop simulator is tested against both outputs.
- `race.mjs` — `setTimeout(0)` vs `setImmediate` in 200 fresh processes.
- `blocking.mjs`, `worker.mjs`, `threadpool.mjs` — a blocked loop, the same work in a worker,
  and libuv's thread pool at sizes 1, 2 and 4.
- `streams.mjs`, `http.mjs`, `shutdown.mjs`, `modules.mjs` — streams and backpressure, raw HTTP
  over a socket, SIGTERM handling, CommonJS and ES modules.

Timings depend on the machine; orders and behaviour do not (except the timer race, which is
reported as counts).

Check the event loop simulator against the recordings (from the repository root):

```sh
node tools/node-capture/check-simulator.mjs
```
