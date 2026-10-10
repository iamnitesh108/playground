// The same 1 second CPU loop, in a worker thread: the main thread keeps ticking.
import { Worker } from 'node:worker_threads'
const t0 = performance.now()
const at = () => Math.round(performance.now() - t0)
const ticks = []
const timer = setInterval(() => ticks.push(at()), 100)
const code = `const { parentPort } = require('node:worker_threads'); const end = performance.now() + 1000; let n = 0; while (performance.now() < end) n++; parentPort.postMessage(n > 0)`
setTimeout(() => {
  const started = at()
  const w = new Worker(code, { eval: true })
  w.on('message', () => { ticks.push(`worker ${started}-${at()}`); w.terminate() })
}, 350)
setTimeout(() => { clearInterval(timer); console.log(JSON.stringify({ ticks })) }, 1900)
