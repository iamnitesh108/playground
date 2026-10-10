// Checks the reconciliation simulator against the DOM operations recorded from real React.
// Run from the repository root: node tools/react-capture/check-simulator.mjs
import { createServer } from 'vite'
const server = await createServer({ root: new URL('../../', import.meta.url).pathname, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
const { reconcile } = await server.ssrLoadModule('/src/modules/react/simulation/reconcile.ts')
const { CAPTURE } = await server.ssrLoadModule('/src/modules/react/data/captures.ts')
let fail = 0
for (const c of CAPTURE.reconcile) {
  const sim = reconcile(c.from, c.to).ops
  const ok = JSON.stringify(sim) === JSON.stringify(c.ops)
  if (!ok) fail++
  console.log(ok ? 'ok  ' : 'FAIL', c.name, ok ? '' : `\n   react: ${c.ops.join(' | ')}\n   sim:   ${sim.join(' | ')}`)
}
await server.close()
process.exit(fail)
