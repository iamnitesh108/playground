// setTimeout(0) vs setImmediate from the main module: count who wins over many fresh processes.
import { execFileSync } from 'node:child_process'
const RUNS = 200
const code = "setTimeout(() => process.stdout.write('timeout'), 0); setImmediate(() => process.stdout.write('immediate'))"
const firsts = { timeout: 0, immediate: 0 }
for (let i = 0; i < RUNS; i++) {
  const out = execFileSync(process.execPath, ['-e', code], { encoding: 'utf8' })
  firsts[out.startsWith('timeout') ? 'timeout' : 'immediate']++
}
console.log(JSON.stringify({ runs: RUNS, firsts }))
