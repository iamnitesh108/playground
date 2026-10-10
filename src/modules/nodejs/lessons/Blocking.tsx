import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { ThreadPoolChart, TickTimeline } from '../components'
import { CAPTURE } from '../data/captures'

const BLOCKING = `const ticks = []
setInterval(() => ticks.push(elapsed()), 100)        // should fire every 100 ms

setTimeout(() => {
  const end = performance.now() + 1000
  while (performance.now() < end) {}                 // 1 second of synchronous work
}, 350)`

const WORKER = `import { Worker } from 'node:worker_threads'

// heavy.js runs on its own thread, with its own V8 instance and event loop
const worker = new Worker('./heavy.js')
worker.on('message', (result) => console.log(result))
worker.postMessage({ orders })     // copied to the worker, not shared`

export default function Blocking() {
  const { blocking, worker, threadpool } = CAPTURE
  const [one, , four] = threadpool
  return (
    <>
      <LessonGoals
        goals={[
          'see what one synchronous function does to every other callback',
          'measure event loop delay',
          'know what runs on the thread pool, and what its size changes',
          'move CPU-heavy work to a worker thread',
        ]}
        before="Lesson 1 — threads; lesson 3 — the event loop"
      />

      <h2>One slow callback stops everything</h2>
      <Predict
        question={<p>A 100 ms interval is running. At 350 ms, a callback runs a synchronous loop for 1 second. What happens to the interval?</p>}
        options={['It keeps firing every 100 ms', 'It skips the ticks during that second, then continues', 'It fires ten times at once afterwards']}
        answer={1}
        explanation="The interval cannot fire while the main thread is busy. Missed ticks are not made up; it simply fires as soon as it can and continues. Recorded:"
      />
      <CodeBlock title="the program" code={BLOCKING} />
      <TickTimeline title="setInterval(100) firings, recorded" ticks={blocking.ticks} />
      <p>
        Every 100 ms until 350 ms, then nothing for a full second. In a server, “nothing” means no request is answered, no timer fires, no health
        check responds — for every user at once. Typical causes: big <code>JSON.parse</code>/<code>JSON.stringify</code>, sorting large arrays,
        synchronous crypto or compression, <code>fs.readFileSync</code> in a request handler, a regular expression with catastrophic backtracking.
      </p>

      <h2>Measure it</h2>
      <CodeBlock
        title="node:perf_hooks"
        code={`import { monitorEventLoopDelay } from 'node:perf_hooks'
const h = monitorEventLoopDelay({ resolution: 10 })
h.enable()
// … later
console.log(h.percentile(50) / 1e6, h.max / 1e6)   // nanoseconds → milliseconds`}
      />
      <Table
        head={['Event loop delay during the run above', 'ms']}
        rows={[
          ['median', String(blocking.delayMs.p50)],
          ['mean', String(blocking.delayMs.mean)],
          ['max', String(blocking.delayMs.max)],
        ]}
      />
      <p>
        The median is about the sampling resolution: normally the loop is idle and responsive. The maximum shows the one-second stall. Export these
        numbers as metrics; a high p99 means users are waiting on someone else’s request.
      </p>

      <h2>The thread pool</h2>
      <p>
        Async <code>crypto.pbkdf2</code> runs on libuv’s thread pool, so the main thread stays free (it was free after{' '}
        {one.mainThreadFreeAfterMs} ms). But the pool has a size. Four hashes of about 100 ms each, started at once, recorded with three pool
        sizes:
      </p>
      <ThreadPoolChart runs={threadpool} />
      <p>
        With one thread the hashes queue and finish one after another (last at {one.tasks.at(-1)!.doneMs} ms). With four, all run in parallel
        (last at {Math.max(...four.tasks.map((t) => t.doneMs))} ms). The same queueing happens to everything else on the pool: a burst of password
        hashes can delay <code>fs</code> calls and DNS lookups behind them.
      </p>
      <Callout tone="tip" title="Sizing the pool">
        Raise <code>UV_THREADPOOL_SIZE</code> when the pool is the bottleneck (many concurrent file, DNS or crypto calls) — but not beyond the CPU
        cores for CPU-bound work: past that, threads only compete for the same cores and each task gets slower. Set it in the environment before Node.js starts.
      </Callout>

      <h2>Worker threads for your own CPU work</h2>
      <p>
        The thread pool only runs Node.js’s built-in operations. For your own heavy JavaScript, start a <strong>worker thread</strong>: a separate
        thread with its own V8 instance and event loop, talking to the main thread through messages.
      </p>
      <CodeBlock title="main.js" code={WORKER} />
      <TickTimeline title="the same 1 s loop, in a worker — setInterval(100) on the main thread, recorded" ticks={worker.ticks} />
      <p>The main thread’s interval kept firing every 100 ms while the worker computed for a second.</p>
      <Table
        head={['Option', 'Use for']}
        rows={[
          ['split the work, yield with setImmediate between parts', 'moderate loops you cannot move'],
          ['worker_threads (a pool such as piscina)', 'CPU-heavy JavaScript: image processing, parsing big files, report generation'],
          ['a separate process or service', 'work that should scale or fail independently'],
          ['cluster / several processes behind a load balancer', 'using all cores for a server’s request handling'],
        ]}
      />

      <Recap
        points={[
          'Synchronous work blocks every callback: timers, requests, health checks.',
          'monitorEventLoopDelay measures how long callbacks wait.',
          'fs, dns.lookup, crypto and zlib share libuv’s pool (default 4 threads); tasks beyond that queue.',
          'Move CPU-heavy JavaScript to worker threads.',
        ]}
      />
    </>
  )
}
