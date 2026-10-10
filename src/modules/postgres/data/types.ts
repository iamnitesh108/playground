export type SessionId = 'A' | 'B'

export type StepResult =
  | { kind: 'rows'; columns: string[]; rows: unknown[][]; unblocked?: boolean }
  | { kind: 'tag'; tag: string; unblocked?: boolean }
  | { kind: 'error'; code: string; message: string; detail: string | null; unblocked?: boolean }
  | { kind: 'blocked' }

/** One line pointer of a heap page, as returned by pageinspect's heap_page_items. */
export interface HeapTuple {
  lp: number
  /** 0 unused, 1 normal, 2 redirect, 3 dead */
  lp_flags: number
  lp_off: number
  hot_updated: boolean | null
  heap_only: boolean | null
  xmin: string | null
  xmax: string | null
  ctid: string | null
  [column: string]: unknown
}

export interface Frame {
  step: { s: SessionId; sql: string } | null
  results: Partial<Record<SessionId, StepResult>>
  sessions: Record<SessionId, { xid: string | null; state: string | null; waiting: boolean }>
  page: HeapTuple[]
  xids: Record<string, string>
}

export type Scenario = Frame[]

/** WAL records written by one statement, as pg_walinspect reports them. */
export interface WalCapture {
  sql: string
  records: readonly { start_lsn: string; resource_manager: string; record_type: string; xid: string; description: string }[]
}
