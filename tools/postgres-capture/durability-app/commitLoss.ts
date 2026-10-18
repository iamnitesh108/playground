// Inserts rows one transaction at a time and remembers the last one the server acknowledged.
// The server is killed while this runs; afterwards we count which acknowledged rows survived.
import pg from 'pg'

const level = process.argv[2] ?? 'on'
const client = new pg.Client({ host: '127.0.0.1', port: 55515, user: 'postgres', password: 'lab', database: 'lab' })
client.on('error', () => {}) // the server is about to be killed; the failed query reports it
await client.connect()
await client.query(`SET synchronous_commit = ${level === 'off' ? 'off' : 'on'}`)

let acked = 0
try {
  for (let id = 1; ; id++) {
    await client.query('INSERT INTO ledger (id) VALUES ($1)', [id]) // autocommit: one transaction each
    acked = id // COMMIT returned: the application believes this row is saved
  }
} catch (e) {
  console.log(`synchronous_commit = ${level}`)
  console.log(`connection lost: ${(e as Error).message}`)
  console.log(`last acknowledged id: ${acked}`)
}
