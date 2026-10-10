// What the process is made of: versions, and the threads before and after libuv's pool starts.
import { readdirSync, readFileSync } from 'node:fs'
import { pbkdf2 } from 'node:crypto'
const threads = () => {
  const names = readdirSync('/proc/self/task').map((t) => readFileSync(`/proc/self/task/${t}/comm`, 'utf8').trim())
  return Object.entries(names.reduce((m, n) => ((m[n] = (m[n] ?? 0) + 1), m), {})).map(([name, count]) => ({ name, count }))
}
const { node, v8, uv, openssl, modules } = process.versions
const before = threads()
await new Promise((r) => pbkdf2('x', 'y', 1, 32, 'sha256', r))
console.log(JSON.stringify({ versions: { node, v8, uv, openssl, modules }, pid: typeof process.pid, before, after: threads(), threadpool: process.env.UV_THREADPOOL_SIZE ?? '4 (default)' }))
