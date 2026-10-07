import { Observable } from '@/shared/utils/observable'

export type Row = { id: number; status: string; amount: number }
/** The old row as logged in the WAL; columns not logged are null. */
export type RowImage = { id: number; status: string | null; amount: number | null }
export type Operation = 'c' | 'u' | 'd'

/**
 * How much of the old row Postgres writes to the WAL for UPDATE and DELETE.
 * default: only the primary key (and only when the key changes on UPDATE).
 * full:    every column.
 */
export type ReplicaIdentity = 'default' | 'full'

/** One entry in Postgres' write-ahead log, decoded by the pgoutput plugin. */
export interface WalEntry {
  lsn: number
  op: Operation
  before: RowImage | null
  after: Row | null
}

/** The value Debezium writes to Kafka for every row change. */
export interface ChangeEvent {
  key: { id: number }
  value: {
    before: RowImage | null
    after: Row | null
    source: { connector: string; db: string; schema: string; table: string; lsn: number }
    op: Operation
    ts_ms: number
  }
}

const SCHEMA = 'public'
const TABLE = 'orders'
const STATUSES = ['NEW', 'PAID', 'SHIPPED', 'DELIVERED']

/**
 * Database → WAL → replication slot → Debezium → topic.
 * The slot remembers the last LSN Debezium confirmed, so Postgres keeps
 * every newer WAL entry until the connector catches up.
 */
export class CdcPipeline extends Observable {
  readonly topicName = `app.${SCHEMA}.${TABLE}`
  rows: Row[] = []
  wal: WalEntry[] = []
  events: ChangeEvent[] = []
  confirmedLsn = 0
  connectorRunning = true
  replicaIdentity: ReplicaIdentity = 'default'
  private nextId = 1
  private nextLsn = 100

  get retainedWal(): WalEntry[] {
    return this.wal.filter((entry) => entry.lsn > this.confirmedLsn)
  }

  insert(): void {
    const row: Row = { id: this.nextId++, status: STATUSES[0], amount: 10 * (1 + Math.floor(Math.random() * 20)) }
    this.rows = [...this.rows, row]
    this.write('c', null, row)
  }

  advanceStatus(id: number): void {
    const before = this.rows.find((r) => r.id === id)
    if (!before) return
    const next = STATUSES[Math.min(STATUSES.indexOf(before.status) + 1, STATUSES.length - 1)]
    const after = { ...before, status: next }
    this.rows = this.rows.map((r) => (r.id === id ? after : r))
    this.write('u', before, after)
  }

  remove(id: number): void {
    const before = this.rows.find((r) => r.id === id)
    if (!before) return
    this.rows = this.rows.filter((r) => r.id !== id)
    this.write('d', before, null)
  }

  setReplicaIdentity(identity: ReplicaIdentity): void {
    this.replicaIdentity = identity
    this.notify()
  }

  setConnectorRunning(running: boolean): void {
    this.connectorRunning = running
    if (running) this.capture()
    this.notify()
  }

  reset(): void {
    this.rows = []
    this.wal = []
    this.events = []
    this.confirmedLsn = 0
    this.connectorRunning = true
    this.nextId = 1
    this.nextLsn = 100
    this.notify()
  }

  private write(op: Operation, before: Row | null, after: Row | null): void {
    this.wal = [...this.wal, { lsn: this.nextLsn, op, before: this.oldImage(op, before), after }]
    this.nextLsn += 8 + Math.floor(Math.random() * 40)
    if (this.connectorRunning) this.capture()
    this.notify()
  }

  /** What the WAL keeps of the old row, depending on REPLICA IDENTITY. */
  private oldImage(op: Operation, before: Row | null): RowImage | null {
    if (!before || this.replicaIdentity === 'full') return before
    // Default identity: nothing for an UPDATE that keeps its key, only the key for a DELETE.
    return op === 'd' ? { id: before.id, status: null, amount: null } : null
  }

  /** Debezium streams every unconfirmed WAL entry, then confirms the slot. */
  private capture(): void {
    for (const entry of this.retainedWal) {
      this.events = [...this.events, toChangeEvent(entry)]
      this.confirmedLsn = entry.lsn
    }
  }
}

function toChangeEvent(entry: WalEntry): ChangeEvent {
  const row = (entry.after ?? entry.before)!
  return {
    key: { id: row.id },
    value: {
      before: entry.before,
      after: entry.after,
      source: { connector: 'postgresql', db: 'appdb', schema: SCHEMA, table: TABLE, lsn: entry.lsn },
      op: entry.op,
      ts_ms: Date.now(),
    },
  }
}
