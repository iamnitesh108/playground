import { writeFileSync } from 'node:fs'
import { runScenario } from './runner.mjs'

const accounts = [
  'DROP TABLE IF EXISTS accounts',
  'CREATE TABLE accounts (id int PRIMARY KEY, balance int NOT NULL) WITH (autovacuum_enabled = false)',
  'INSERT INTO accounts VALUES (1, 100), (2, 100)',
]
const acc = { table: 'accounts', columns: [{ name: 'id', type: 'int' }, { name: 'balance', type: 'int' }] }
const read = (id = 1) => `SELECT balance FROM accounts WHERE id = ${id}`
const all = 'SELECT id, balance FROM accounts ORDER BY id'

const scenarios = [
  {
    name: 'mvcc-update',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: 'UPDATE accounts SET balance = 150 WHERE id = 1' },
      { s: 'B', sql: all },
      { s: 'A', sql: all },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: all },
      { s: 'A', sql: 'DELETE FROM accounts WHERE id = 2' },
      { s: 'B', sql: all },
    ],
  },
  {
    name: 'vacuum',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'UPDATE accounts SET balance = 110 WHERE id = 1' },
      { s: 'A', sql: 'UPDATE accounts SET balance = 120 WHERE id = 1' },
      { s: 'A', sql: 'DELETE FROM accounts WHERE id = 2' },
      { s: 'A', sql: 'VACUUM accounts' },
      { s: 'A', sql: 'INSERT INTO accounts VALUES (3, 300)' },
    ],
  },
  {
    name: 'rc-nonrepeatable',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN ISOLATION LEVEL READ COMMITTED' },
      { s: 'A', sql: read() },
      { s: 'B', sql: 'UPDATE accounts SET balance = 200 WHERE id = 1' },
      { s: 'A', sql: read() },
      { s: 'A', sql: 'COMMIT' },
    ],
  },
  {
    name: 'rr-snapshot',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN ISOLATION LEVEL REPEATABLE READ' },
      { s: 'A', sql: read() },
      { s: 'B', sql: 'UPDATE accounts SET balance = 200 WHERE id = 1' },
      { s: 'A', sql: read() },
      { s: 'A', sql: 'COMMIT' },
      { s: 'A', sql: read() },
    ],
  },
  {
    name: 'rc-lost-update',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: read() },
      { s: 'B', sql: 'BEGIN' },
      { s: 'B', sql: read() },
      { s: 'A', sql: 'UPDATE accounts SET balance = 150 WHERE id = 1' },
      { s: 'B', sql: 'UPDATE accounts SET balance = 70 WHERE id = 1' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: read() },
    ],
  },
  {
    name: 'rc-atomic-update',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'B', sql: 'BEGIN' },
      { s: 'A', sql: 'UPDATE accounts SET balance = balance + 50 WHERE id = 1' },
      { s: 'B', sql: 'UPDATE accounts SET balance = balance - 30 WHERE id = 1' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: read() },
    ],
  },
  {
    name: 'rr-update-conflict',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN ISOLATION LEVEL REPEATABLE READ' },
      { s: 'A', sql: read() },
      { s: 'B', sql: 'UPDATE accounts SET balance = balance - 30 WHERE id = 1' },
      { s: 'A', sql: 'UPDATE accounts SET balance = balance + 50 WHERE id = 1' },
      { s: 'A', sql: 'ROLLBACK' },
      { s: 'A', sql: read() },
    ],
  },
  {
    name: 'for-update',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'A', sql: `${read()} FOR UPDATE` },
      { s: 'B', sql: 'BEGIN' },
      { s: 'B', sql: `${read()} FOR UPDATE` },
      { s: 'A', sql: 'UPDATE accounts SET balance = 150 WHERE id = 1' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'UPDATE accounts SET balance = 120 WHERE id = 1' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: read() },
    ],
  },
  {
    name: 'deadlock',
    setup: accounts,
    ...acc,
    steps: [
      { s: 'A', sql: 'BEGIN' },
      { s: 'B', sql: 'BEGIN' },
      { s: 'A', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 1' },
      { s: 'B', sql: 'UPDATE accounts SET balance = balance - 10 WHERE id = 2' },
      { s: 'A', sql: 'UPDATE accounts SET balance = balance + 10 WHERE id = 2' },
      { s: 'B', sql: 'UPDATE accounts SET balance = balance + 10 WHERE id = 1', wait: 2500 },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: 'ROLLBACK' },
      { s: 'A', sql: all },
    ],
  },
  ...['REPEATABLE READ', 'SERIALIZABLE'].map((level) => ({
    name: `write-skew-${level === 'SERIALIZABLE' ? 'serializable' : 'rr'}`,
    setup: [
      'DROP TABLE IF EXISTS doctors',
      'CREATE TABLE doctors (id int PRIMARY KEY, on_call bool NOT NULL) WITH (autovacuum_enabled = false)',
      'INSERT INTO doctors VALUES (1, true), (2, true)',
    ],
    table: 'doctors',
    columns: [{ name: 'id', type: 'int' }, { name: 'on_call', type: 'bool' }],
    steps: [
      { s: 'A', sql: `BEGIN ISOLATION LEVEL ${level}` },
      { s: 'B', sql: `BEGIN ISOLATION LEVEL ${level}` },
      { s: 'A', sql: 'SELECT count(*) AS on_call FROM doctors WHERE on_call' },
      { s: 'B', sql: 'SELECT count(*) AS on_call FROM doctors WHERE on_call' },
      { s: 'A', sql: 'UPDATE doctors SET on_call = false WHERE id = 1' },
      { s: 'B', sql: 'UPDATE doctors SET on_call = false WHERE id = 2' },
      { s: 'A', sql: 'COMMIT' },
      { s: 'B', sql: 'COMMIT' },
      { s: 'A', sql: 'SELECT id, on_call FROM doctors ORDER BY id' },
    ],
  })),
]

const out = []
for (const sc of scenarios) {
  const r = await runScenario(sc)
  out.push(r)
  console.log('==', r.name)
  for (const f of r.frames.slice(1)) {
    const res = Object.entries(f.results).map(([s, v]) => `${s}${v.unblocked ? '(unblocked)' : ''}: ${v.kind === 'rows' ? JSON.stringify(v.rows) : v.kind === 'error' ? `ERROR ${v.code} ${v.message}` : v.kind === 'blocked' ? 'BLOCKED' : v.tag}`).join('  |  ')
    console.log(`  ${f.step.s}> ${f.step.sql.padEnd(60)}  ${res}`)
  }
}
writeFileSync(new URL('./scenarios.json', import.meta.url), JSON.stringify(out, null, 1))
