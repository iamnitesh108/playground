// Everyday PostgreSQL tasks from TypeScript with node-postgres (`pg`). Run: node demo.ts
import pg from 'pg'
import type { PoolClient } from 'pg'

const say = (section: string) => console.log(`# ${section}`)

// numeric arrives as a string by default (it may not fit a JS number); bigint (int8) too
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://app@localhost:5432/shop',
  max: 5,
  idleTimeoutMillis: 30_000,
})

/** Runs fn inside BEGIN … COMMIT on one pooled connection; any error rolls back. */
async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

say('connect')
const who = await pool.query('SELECT current_user, current_database()')
console.log(who.rows[0])

say('insert')
const inserted = await pool.query<{ id: string }>(
  'INSERT INTO customers (name, email, city) VALUES ($1, $2, $3) RETURNING id',
  ['Fay', 'fay@example.com', 'Rome'],
)
const customerId = inserted.rows[0].id
console.log('new customer id =', customerId, typeof customerId)

say('select')
const lisbon = await pool.query('SELECT id, name FROM customers WHERE city = $1 ORDER BY name', ['Lisbon'])
console.log(lisbon.rows)
const prices = await pool.query('SELECT name, price FROM products WHERE price > $1 ORDER BY price', [40])
console.log(prices.rows, typeof prices.rows[0].price)

say('errors')
try {
  await pool.query('INSERT INTO customers (name, email, city) VALUES ($1, $2, $3)', ['Fay', 'fay@example.com', 'Rome'])
} catch (e) {
  const err = e as pg.DatabaseError
  console.log(err.code, err.constraint, '-', err.detail)
}

say('transaction')
try {
  await withTransaction(async (tx) => {
    await tx.query('INSERT INTO orders (customer_id, product_id, quantity, amount) VALUES ($1, 3, 1, 180.00)', [customerId])
    await tx.query('INSERT INTO orders (customer_id, product_id, quantity, amount) VALUES ($1, 999, 1, 10.00)', [customerId])
  })
} catch (e) {
  console.log('rolled back:', (e as pg.DatabaseError).code, (e as Error).message)
}
const count = await pool.query('SELECT count(*) FROM orders WHERE customer_id = $1', [customerId])
console.log('orders for Fay after rollback =', count.rows[0].count)

say('batch')
// many rows in one statement: one array parameter per column, unnest() turns them into rows
const quantities = Array.from({ length: 1000 }, (_, i) => 1 + (i % 3))
const t0 = performance.now()
const batch = await pool.query(
  `INSERT INTO orders (customer_id, product_id, quantity, amount)
   SELECT $1, 2, q, q * 20.00 FROM unnest($2::int[]) AS q`,
  [customerId, quantities],
)
console.log(`inserted ${batch.rowCount} rows in one statement, ${Math.round(performance.now() - t0)} ms`)

say('upsert')
const upsert = `INSERT INTO stock (product_id, quantity) VALUES ($1, $2)
  ON CONFLICT (product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity
  RETURNING old.quantity AS before, new.quantity AS after`
for (const add of [5, 5]) console.log((await pool.query(upsert, [3, add])).rows[0])

say('keyset')
let after = '0'
for (let page = 1; ; page++) {
  const rows = (await pool.query<{ id: string }>('SELECT id FROM orders WHERE customer_id = $1 AND id > $2 ORDER BY id LIMIT 400', [customerId, after])).rows
  if (rows.length === 0) break
  after = rows[rows.length - 1].id
  console.log(`page ${page}: ${rows.length} rows, last id ${after}`)
}

await pool.end()
