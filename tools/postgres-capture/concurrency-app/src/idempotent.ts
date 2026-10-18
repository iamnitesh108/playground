import type pg from 'pg'
import { log, newPool } from './db.ts'

interface PaymentRequest { key: string; customerId: number; amount: string }
interface Reply { status: 201 | 200 | 422; paymentId?: string; amount?: string }

/**
 * Creates a payment at most once per idempotency key. A repeated request gets
 * the stored payment back; the same key with a different body is refused.
 */
async function createPayment(db: pg.Pool, req: PaymentRequest): Promise<Reply> {
  const inserted = await db.query<{ id: string; amount: string }>(
    `INSERT INTO payments (idempotency_key, customer_id, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, amount`,
    [req.key, req.customerId, req.amount],
  )
  if (inserted.rowCount === 1) return { status: 201, paymentId: inserted.rows[0].id, amount: inserted.rows[0].amount }

  // The key was used before: return what the first request created.
  const existing = await db.query<{ id: string; customer_id: number; amount: string }>(
    'SELECT id, customer_id, amount FROM payments WHERE idempotency_key = $1',
    [req.key],
  )
  const row = existing.rows[0]
  if (row.customer_id !== req.customerId || row.amount !== req.amount) return { status: 422 }
  return { status: 200, paymentId: row.id, amount: row.amount }
}

const show = (r: Reply) => (r.paymentId ? `${r.status}  payment ${r.paymentId}, amount ${r.amount}` : `${r.status}  key reused with a different body`)

const db = newPool()
await db.query('DROP TABLE IF EXISTS payments')
await db.query(`CREATE TABLE payments (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  idempotency_key text NOT NULL UNIQUE,
  customer_id     int NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at      timestamptz NOT NULL DEFAULT now()
)`)

const pay = { key: 'k-7f3a', customerId: 1, amount: '25.00' }
log('client', `POST /payments ${pay.key} → ${show(await createPayment(db, pay))}`)
log('client', `timeout, retry ${pay.key} → ${show(await createPayment(db, pay))}`)
log('client', `same key, amount 99.00 → ${show(await createPayment(db, { ...pay, amount: '99.00' }))}`)

// Five copies of one request at the same moment, each on its own connection.
const burst = { key: 'k-91c2', customerId: 2, amount: '40.00' }
const replies = await Promise.all(Array.from({ length: 5 }, () => createPayment(db, burst)))
replies.forEach((r, i) => log(`copy ${i + 1}`, `${burst.key} → ${show(r)}`))

const { rows } = await db.query('SELECT idempotency_key, count(*)::int AS payments FROM payments GROUP BY 1 ORDER BY 1')
log('result', rows.map((r) => `${r.idempotency_key}: ${r.payments} payment`).join(', '))
await db.end()
