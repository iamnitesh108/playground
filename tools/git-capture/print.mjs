// Prints one experiment's transcripts, for checking a recording before capturing.
// Usage: node print.mjs <experiment>
import { Session } from './session.mjs'

const name = process.argv[2]
const mod = await import(`./experiments/${name}.mjs`)
const s = new Session()
try {
  const out = mod.run(s)
  const print = (steps) => steps.map((x) => `$ ${x.cmd}${x.exit ? `   [exit ${x.exit}]` : ''}\n${x.out}`).join('\n')
  const walk = (v, k) => {
    if (Array.isArray(v) && v[0]?.cmd !== undefined) console.log(`== ${k}\n${print(v)}`)
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x.steps ?? x, `${k}[${i}] ${x.label ?? ''}`))
    else if (v && typeof v === 'object') Object.entries(v).forEach(([kk, vv]) => walk(vv, `${k}.${kk}`))
    else console.log(`== ${k}: ${typeof v === 'string' && v.length > 80 ? `${v.slice(0, 80)}…` : v}`)
  }
  walk(out, name)
} finally {
  s.dispose()
}
