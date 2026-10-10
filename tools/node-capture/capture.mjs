// Runs every experiment with this Node.js and writes the lesson data file.
// Usage: node capture.mjs ../../src/modules/nodejs/data/captures.ts
import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [, , outFile] = process.argv
const here = fileURLToPath(new URL('./experiments/', import.meta.url))
/** Local paths in stack traces are shortened to /app/. */
const clean = (text) => text.replaceAll(here, '/app/').replace(/\n\s+at .+/g, '').replace(/\nNode\.js v[\d.]+\n?/, '').trim()

function run(file, args = [], env = {}) {
  const r = spawnSync(process.execPath, [here + file, ...args], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120_000 })
  return { stdout: clean(r.stdout), stderr: clean(r.stderr), exit: r.status }
}
const json = (file, args, env) => JSON.parse(run(file, args, env).stdout)
const lines = (file, args) => run(file, args).stdout.split('\n')

const PROGRAMS = ['basics', 'nested', 'io', 'async', 'timers']
const capture = {
  node: process.version,
  runtime: json('runtime.mjs'),
  order: {
    esm: Object.fromEntries(PROGRAMS.map((p) => [p, lines('order.mjs', [p])])),
    cjs: Object.fromEntries(PROGRAMS.map((p) => [p, lines('order.cjs', [p])])),
  },
  race: json('race.mjs'),
  starve: json('starve.mjs'),
  blocking: json('blocking.mjs'),
  worker: json('worker.mjs'),
  threadpool: [1, 2, 4].map((n) => json('threadpool.mjs', [], { UV_THREADPOOL_SIZE: String(n) })),
  async: json('async.mjs'),
  errors: { unhandled: run('unhandled.mjs'), tryCatch: run('trycatch.mjs'), awaitCatch: run('awaitcatch.mjs') },
  streams: json('streams.mjs'),
  http: json('http.mjs'),
  shutdown: json('shutdown.mjs'),
  modules: json('modules.mjs'),
}
const header = `// Recorded with Node.js ${process.version} on Linux by tools/node-capture — do not edit by hand.\n\n`
writeFileSync(outFile, `${header}export const CAPTURE = ${JSON.stringify(capture, null, 1)} as const\n`)
console.log('wrote', outFile)
