// Four pbkdf2 hashes at once. Run with UV_THREADPOOL_SIZE=1, 2 and 4.
import { pbkdf2 } from 'node:crypto'
const ITER = 300000
const t0 = performance.now()
const tasks = Array.from({ length: 4 }, (_, i) => new Promise((resolve) => {
  pbkdf2('secret', `salt${i}`, ITER, 64, 'sha512', () => resolve({ task: i + 1, doneMs: Math.round(performance.now() - t0) }))
}))
const mainThreadFreeAfterMs = Math.round(performance.now() - t0)
console.log(JSON.stringify({ pool: Number(process.env.UV_THREADPOOL_SIZE ?? 4), mainThreadFreeAfterMs, tasks: await Promise.all(tasks) }))
