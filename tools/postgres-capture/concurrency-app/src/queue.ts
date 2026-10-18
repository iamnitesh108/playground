import type pg from 'pg'
import { log, newPool } from './db.ts'

const JOBS = 24
const WORKERS = 4
const WORK_MS = 30

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Claims the oldest queued job; with SKIP LOCKED, rows other workers hold are passed over. */
const claim = (skipLocked: boolean) => `
  SELECT id FROM jobs
  WHERE status = 'queued'
  ORDER BY id
  LIMIT 1
  FOR UPDATE${skipLocked ? ' SKIP LOCKED' : ''}`

interface Done { job: number; worker: number; start: number; end: number }

async function worker(pool: pg.Pool, n: number, skipLocked: boolean, t0: number, done: Done[]) {
  const db = await pool.connect()
  try {
    for (;;) {
      await db.query('BEGIN')
      const asked = Date.now()
      const { rows } = await db.query<{ id: number }>(claim(skipLocked))
      if (rows.length === 0) {
        await db.query('COMMIT')
        return
      }
      const start = Date.now()
      if (start - asked > 5) log(`worker ${n}`, `waited ${start - asked} ms for a lock, got job ${rows[0].id}`)
      await sleep(WORK_MS) // the actual work: send an email, call an API…
      await db.query(`UPDATE jobs SET status = 'done', worker = $2 WHERE id = $1`, [rows[0].id, n])
      await db.query('COMMIT')
      done.push({ job: rows[0].id, worker: n, start: start - t0, end: Date.now() - t0 })
    }
  } finally {
    db.release()
  }
}

async function run(pool: pg.Pool, skipLocked: boolean) {
  await pool.query('DROP TABLE IF EXISTS jobs')
  await pool.query(`CREATE TABLE jobs (id int PRIMARY KEY, status text NOT NULL DEFAULT 'queued', worker int)`)
  await pool.query('INSERT INTO jobs (id) SELECT generate_series(1, $1)', [JOBS])
  const label = skipLocked ? 'SKIP LOCKED' : 'FOR UPDATE'
  log(label, `${JOBS} jobs, ${WORKERS} workers, ${WORK_MS} ms of work per job`)
  const t0 = Date.now()
  const done: Done[] = []
  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(pool, i + 1, skipLocked, t0, done)))
  const ms = Date.now() - t0
  const per = Array.from({ length: WORKERS }, (_, i) => done.filter((d) => d.worker === i + 1).length)
  log(label, `all ${done.length} jobs done in ${ms} ms; jobs per worker: ${per.join(', ')}`)
  return { label, ms, per, done }
}

const pool = newPool(WORKERS + 1)
const results = [await run(pool, false), await run(pool, true)]
await pool.end()
console.log(JSON.stringify(results))
