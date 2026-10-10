import type { ReactNode } from 'react'
import { Box, Callout, Connector, LessonGoals, Predict, Recap, Table, TermList, Walkthrough } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const { runtime } = CAPTURE

type Node = 'js' | 'bindings' | 'loop' | 'pool' | 'kernel'

const STEPS: { title: string; body: ReactNode; on: Node[]; edge?: string }[] = [
  {
    title: 'Your code calls an API',
    body: <p><code>fs.readFile('orders.csv', callback)</code> runs on the <strong>main thread</strong>, like all your JavaScript. It returns immediately.</p>,
    on: ['js', 'bindings'],
    edge: 'js-bindings',
  },
  {
    title: 'File work goes to the thread pool',
    body: <p>Through Node’s C++ bindings, libuv hands the file read to its <strong>thread pool</strong>. Ordinary files cannot be read without blocking on Linux, so a pool thread does the waiting.</p>,
    on: ['bindings', 'loop', 'pool'],
    edge: 'loop-pool',
  },
  {
    title: 'The main thread is free',
    body: <p>While a pool thread reads the file, the main thread keeps running other callbacks: timers, other requests, anything.</p>,
    on: ['js', 'pool'],
  },
  {
    title: 'The result is queued for the poll phase',
    body: <p>When the read finishes, libuv queues the completion. In the event loop’s <strong>poll</strong> phase it is picked up…</p>,
    on: ['pool', 'loop'],
    edge: 'pool-loop',
  },
  {
    title: '…and your callback runs on the main thread',
    body: <p><code>callback(err, data)</code> runs on the main thread again. JavaScript code never runs on the thread pool.</p>,
    on: ['loop', 'js'],
    edge: 'loop-js',
  },
  {
    title: 'Network I/O needs no thread at all',
    body: <p>Sockets are different: libuv registers them with the kernel (<code>epoll</code> on Linux) and is told when data arrives. Ten thousand open connections cost no threads.</p>,
    on: ['loop', 'kernel'],
    edge: 'loop-kernel',
  },
]

function Path() {
  return (
    <Walkthrough title="Where a call goes" steps={STEPS} intervalMs={3000}>
      {(i) => {
        const { on, edge } = STEPS[i]
        const a = (n: Node) => on.includes(n)
        return (
          <div className={own.flow7}>
            <Box title="Your JavaScript" caption="main thread (V8)" active={a('js')} />
            <Connector active={edge === 'js-bindings' || edge === 'loop-js'} direction={edge === 'loop-js' ? 'left' : 'right'} />
            <Box title="Node.js APIs" caption="node:fs, node:net … C++ bindings" active={a('bindings')} />
            <Connector active={edge === 'js-bindings' || edge === 'loop-js'} direction={edge === 'loop-js' ? 'left' : 'right'} label={edge === 'loop-js' ? 'callback' : undefined} />
            <Box title="libuv event loop" caption="main thread" active={a('loop')} />
            <Connector active={edge === 'loop-kernel'} label="epoll" />
            <Box title="Kernel" caption="sockets, pipes, signals" active={a('kernel')} />

            <span className={own.under}>
              <Connector direction={edge === 'pool-loop' ? 'up' : 'down'} active={edge === 'loop-pool' || edge === 'pool-loop'} label={edge === 'pool-loop' ? 'done' : 'work'} />
            </span>
            <span className={own.under}>
              <Box title="Thread pool" caption="fs, dns.lookup, crypto, zlib" active={a('pool')} />
            </span>
          </div>
        )
      }}
    </Walkthrough>
  )
}

export default function Runtime() {
  const before = runtime.before.reduce((n, t) => n + t.count, 0)
  const after = runtime.after.reduce((n, t) => n + t.count, 0)
  return (
    <>
      <LessonGoals
        goals={[
          'name the parts of Node.js: V8, libuv, bindings and the standard library',
          'know which thread runs your JavaScript, and which threads exist besides it',
          'tell work that uses the thread pool from work that needs no thread',
        ]}
      />

      <h2>Not a language: a runtime</h2>
      <p>
        JavaScript is the language. <strong>Node.js</strong> is a program that runs it outside a browser and gives it access to files, the network
        and processes. Four parts:
      </p>
      <TermList
        items={[
          { term: 'V8', definition: 'The JavaScript engine (also in Chrome). Compiles and runs your code, manages its memory with a garbage collector.' },
          { term: 'libuv', definition: 'A C library that provides the event loop, asynchronous I/O and a thread pool, the same way on Linux, macOS and Windows.' },
          { term: 'bindings', definition: 'C++ glue that exposes V8 and libuv (and OpenSSL, zlib …) to JavaScript.' },
          { term: 'standard library', definition: 'The node: modules — node:fs, node:http, node:stream … — mostly written in JavaScript on top of the bindings.' },
        ]}
      />
      <Table
        head={['process.versions', 'recorded']}
        rows={[
          ['node', runtime.versions.node],
          ['v8', runtime.versions.v8],
          ['uv (libuv)', runtime.versions.uv],
          ['openssl', runtime.versions.openssl],
          ['modules (native addon ABI)', runtime.versions.modules],
        ]}
      />

      <h2>“Single-threaded”, precisely</h2>
      <Predict
        question={<p>How many threads does a freshly started Node.js process have?</p>}
        options={['1 — Node.js is single-threaded', 'A handful', 'One per CPU core']}
        answer={1}
        explanation={`Your JavaScript runs on one thread, but the process has more. Recorded on Linux: ${before} threads at start, ${after} after the first call that used the thread pool.`}
      />
      <Table
        head={['thread name', 'at start', 'after one crypto.pbkdf2()', 'what it does']}
        rows={runtime.after.map((t) => [
          <code key="n">{t.name}</code>,
          String(runtime.before.find((b) => b.name === t.name)?.count ?? 0),
          String(t.count),
          {
            MainThread: 'the event loop and all your JavaScript',
            V8Worker: 'V8’s helpers: garbage collection and compilation in the background',
            DelayedTaskSche: 'schedules V8’s delayed background tasks',
            SignalInspector: 'waits for SIGUSR1 to start the debugger',
            'libuv-worker': 'libuv’s thread pool: started on first use, 4 threads by default',
          }[t.name] ?? '',
        ])}
      />
      <p>
        So “single-threaded” means: <strong>your JavaScript runs on one thread</strong>, one callback at a time. Two callbacks never run in parallel,
        so you never need locks around your own variables — and one slow callback delays all others (lesson 5).
      </p>

      <h2>Who does the waiting</h2>
      <Path />
      <Table
        head={['Operation', 'Done by', 'Notes']}
        rows={[
          ['TCP, UDP, HTTP, pipes', 'the kernel, watched by the event loop (epoll / kqueue / IOCP)', 'no thread per connection'],
          ['fs.* (async)', 'thread pool', 'file reads block in the OS, so a pool thread waits'],
          ['dns.lookup() — used by http.get, fetch …', 'thread pool', 'calls the system resolver (getaddrinfo)'],
          ['crypto: pbkdf2, scrypt, randomBytes (callback)', 'thread pool', 'CPU work'],
          ['zlib (async)', 'thread pool', 'CPU work'],
          ['your JavaScript, JSON.parse, sorting …', 'main thread', 'always'],
        ]}
      />
      <Callout tone="note" title="Default pool size: 4">
        <code>UV_THREADPOOL_SIZE</code> (an environment variable, read when the pool first starts) sets the pool size; the default is 4, maximum 1024. Lesson 5
        measures what that means.
      </Callout>

      <Recap
        points={[
          'Node.js = V8 (runs JavaScript) + libuv (event loop, async I/O, thread pool) + bindings + the node: standard library.',
          'Your JavaScript runs on the main thread only, one callback at a time.',
          'Sockets need no threads; files, dns.lookup, crypto and zlib use the 4-thread pool.',
        ]}
      />
    </>
  )
}
