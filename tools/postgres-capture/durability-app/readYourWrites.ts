// Writes an order on the primary, then immediately reads it back from the standby.
// Mode "naive" just reads; mode "wait-lsn" first waits until the standby has replayed the commit.
import pg from 'pg'

const mode = process.argv[2] ?? 'naive'
const conn = (port: number) => new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password: 'lab', database: 'lab' })
const primary = conn(55516)
const standby = conn(55517)
await primary.connect()
await standby.connect()

/** Polls the standby until it has replayed up to `lsn`; returns how long that took in ms. */
async function waitForReplay(lsn: string, timeoutMs = 2000): Promise<number> {
  const start = performance.now()
  for (;;) {
    const r = await standby.query('SELECT pg_last_wal_replay_lsn() >= $1::pg_lsn AS caught_up', [lsn])
    if (r.rows[0].caught_up) return performance.now() - start
    if (performance.now() - start > timeoutMs) throw new Error(`standby did not reach ${lsn}`)
  }
}

const tries = 500
let missing = 0
let waited = 0
for (let i = 0; i < tries; i++) {
  const ins = await primary.query('INSERT INTO orders (customer_id, amount) VALUES ($1, $2) RETURNING id', [7, 19.99])
  const { id } = ins.rows[0]
  if (mode === 'wait-lsn') {
    // asked after the commit returned: the flush position is at or past our commit record.
    // (The insert position can point past the next page header, which replay never "reaches".)
    const pos = await primary.query('SELECT pg_current_wal_flush_lsn() AS lsn')
    waited += await waitForReplay(pos.rows[0].lsn)
  }
  const read = await standby.query('SELECT 1 FROM orders WHERE id = $1', [id])
  if (read.rowCount === 0) missing++
}
console.log(`mode: ${mode}, ${tries} writes, each read back from the standby at once`)
console.log(`not found on the standby: ${missing} (${((missing / tries) * 100).toFixed(1)} %)`)
if (mode === 'wait-lsn') console.log(`average wait for replay: ${(waited / tries).toFixed(2)} ms`)
await primary.end()
await standby.end()
