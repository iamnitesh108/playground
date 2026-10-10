// Checks the event loop simulator against the recorded output of real Node.js. Run from the repository root:
//   node tools/node-capture/check-simulator.mjs
import { createServer } from 'vite'
const server = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { outputOf } = await server.ssrLoadModule('/src/modules/nodejs/simulation/eventLoop.ts')
const { PROGRAMS } = await server.ssrLoadModule('/src/modules/nodejs/simulation/programs.ts')
const { CAPTURE } = await server.ssrLoadModule('/src/modules/nodejs/data/captures.ts')
// A second recording of "basics" in which the timer race went the other way, kept so both outcomes stay covered.
const EARLIER = { esm: { basics: ['sync 1','sync 2','promise.then','queueMicrotask','nextTick','setImmediate','setTimeout 0'] }, cjs: { basics: ['sync 1','sync 2','nextTick','promise.then','queueMicrotask','setImmediate','setTimeout 0'] } }
let fail = 0
for (const kind of ['esm', 'cjs']) for (const p of PROGRAMS) {
  const real = CAPTURE.order[kind][p.id].join(' | ')
  const a = outputOf(p.ops, { kind, timerDueAtStart: false }).join(' | ')
  const b = outputOf(p.ops, { kind, timerDueAtStart: true }).join(' | ')
  const ok = p.racy ? real === a || real === b : real === a && a === b
  const earlier = EARLIER[kind]?.[p.id]?.join(' | ')
  const ok2 = !earlier || earlier === a || earlier === b
  console.log(ok && ok2 ? 'ok  ' : 'FAIL', kind, p.id, ok ? '' : `\n   real: ${real}\n   sim0: ${a}\n   sim1: ${b}`)
  if (!ok || !ok2) fail++
}
await server.close()
process.exit(fail)
