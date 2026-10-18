import pg from 'pg'

/** Connection settings: a local lab server (override with PGHOST / PGPORT). */
export const config: pg.PoolConfig = {
  host: process.env.PGHOST ?? '127.0.0.1',
  port: Number(process.env.PGPORT ?? 5432),
  user: 'postgres',
  password: 'lab',
  database: 'lab',
}

export const newPool = (max = 10): pg.Pool => new pg.Pool({ ...config, max })

const started = Date.now()
/** Prints one line, prefixed with the milliseconds since the program started. */
export const log = (who: string, text: string): void => {
  console.log(`[${String(Date.now() - started).padStart(4)} ms] ${who.padEnd(9)} ${text}`)
}
