// A 100 ms interval, and a synchronous 1 second loop in the middle of it.
import { monitorEventLoopDelay } from 'node:perf_hooks'
const t0 = performance.now()
const at = () => Math.round(performance.now() - t0)
const ticks = []
const h = monitorEventLoopDelay({ resolution: 10 })
h.enable()
const timer = setInterval(() => ticks.push(at()), 100)
setTimeout(() => {
  const start = at()
  const end = performance.now() + 1000
  while (performance.now() < end) {} // busy: nothing else can run
  ticks.push(`blocked ${start}-${at()}`)
}, 350)
setTimeout(() => {
  clearInterval(timer)
  h.disable()
  console.log(JSON.stringify({ ticks, delayMs: { mean: Math.round(h.mean / 1e6), max: Math.round(h.max / 1e6), p50: Math.round(h.percentile(50) / 1e6) } }))
}, 1900)
