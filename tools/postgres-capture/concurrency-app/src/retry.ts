import type pg from 'pg'
import { log, newPool } from './db.ts'

/** SQLSTATEs after which the whole transaction may simply be run again. */
const RETRYABLE = new Set(['40001', '40P01']) // serialization_failure, deadlock_detected

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs `work` in a SERIALIZABLE transaction and retries it from the start
 * when PostgreSQL reports a serialization failure or a deadlock.
 */
export async function serializable<T>(pool: pg.Pool, name: string, work: (tx: pg.PoolClient) => Promise<T>, attempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const tx = await pool.connect()
    try {
      await tx.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
      const result = await work(tx)
      await tx.query('COMMIT')
      log(name, `committed on attempt ${attempt}`)
      return result
    } catch (err) {
      await tx.query('ROLLBACK')
      const code = (err as { code?: string }).code ?? ''
      if (!RETRYABLE.has(code) || attempt === attempts) throw err
      const backoff = 2 ** attempt * 10 + Math.floor(Math.random() * 10) // grows, with jitter
      log(name, `attempt ${attempt} failed with ${code}; retrying in ${backoff} ms`)
      await sleep(backoff)
    } finally {
      tx.release()
    }
  }
}

/** One doctor asks to go off call; allowed only while someone else stays on call. */
async function goOffCall(pool: pg.Pool, doctor: number, pause: Promise<void>) {
  const name = `doctor ${doctor}`
  return serializable(pool, name, async (tx) => {
    const { rows } = await tx.query<{ n: number }>('SELECT count(*)::int AS n FROM doctors WHERE on_call')
    log(name, `sees ${rows[0].n} on call`)
    await pause // both transactions have read before either writes
    if (rows[0].n < 2) {
      log(name, 'stays on call')
      return false
    }
    await tx.query('UPDATE doctors SET on_call = false WHERE id = $1', [doctor])
    log(name, 'went off call')
    return true
  })
}

const pool = newPool()
await pool.query('DROP TABLE IF EXISTS doctors')
await pool.query('CREATE TABLE doctors (id int PRIMARY KEY, on_call bool NOT NULL)')
await pool.query('INSERT INTO doctors VALUES (1, true), (2, true)')

let open!: () => void
const bothRead = new Promise<void>((resolve) => (open = resolve))
setTimeout(open, 50)
await Promise.all([goOffCall(pool, 1, bothRead), goOffCall(pool, 2, bothRead)])

const { rows } = await pool.query('SELECT id, on_call FROM doctors ORDER BY id')
log('result', rows.map((r) => `doctor ${r.id}: ${r.on_call ? 'on call' : 'off call'}`).join(', '))
await pool.end()
