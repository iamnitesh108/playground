/*
 * The MVCC visibility rule, reduced to its two checks (as in HeapTupleSatisfiesMVCC):
 * was the creating transaction (xmin) done before my snapshot, and is the
 * deleting transaction (xmax) not done before my snapshot?
 */

/** What a transaction id on a tuple means to the reader. */
export type XidCase =
  | 'none' // xmax only: 0, never deleted
  | 'committed' // committed before the snapshot was taken
  | 'running' // still in progress (listed in the snapshot, or started after it)
  | 'committed-later' // committed, but after the snapshot was taken
  | 'aborted'
  | 'mine' // the reader's own transaction

export interface Check {
  label: string
  passed: boolean
  reason: string
}

export interface Verdict {
  visible: boolean
  checks: Check[]
}

const XMIN_REASON: Record<Exclude<XidCase, 'none'>, [boolean, string]> = {
  committed: [true, 'the inserting transaction committed before my snapshot'],
  mine: [true, 'I inserted it myself'],
  running: [false, 'the inserting transaction has not committed (for my snapshot it is still running)'],
  'committed-later': [false, 'it committed after my snapshot was taken, so for me it is still running'],
  aborted: [false, 'the inserting transaction rolled back: this version never existed'],
}

const XMAX_REASON: Record<XidCase, [boolean, string]> = {
  none: [true, 'xmax is 0: nobody deleted or replaced it'],
  aborted: [true, 'the deleting transaction rolled back, so the delete never happened'],
  running: [true, 'the deleting transaction has not committed: for me the row still exists'],
  'committed-later': [true, 'the delete committed after my snapshot: I still see the row'],
  committed: [false, 'the delete committed before my snapshot: the row is gone for me'],
  mine: [false, 'I deleted or updated it myself'],
}

/**
 * Which xmax values can occur on a tuple with this xmin. Only a transaction that can see a
 * version can delete it: a row whose insert is still running or rolled back can only have been
 * deleted by its own inserter, and nobody else can touch a row I inserted and have not committed.
 */
const POSSIBLE_XMAX: Record<Exclude<XidCase, 'none'>, readonly XidCase[]> = {
  committed: ['none', 'committed', 'committed-later', 'running', 'aborted', 'mine'],
  'committed-later': ['none', 'committed-later', 'running', 'aborted'],
  running: ['none', 'running', 'aborted'],
  aborted: ['none', 'aborted'],
  mine: ['none', 'aborted', 'mine'],
}

export const possibleXmax = (xmin: Exclude<XidCase, 'none'>): readonly XidCase[] => POSSIBLE_XMAX[xmin]

export function isVisible(xmin: Exclude<XidCase, 'none'>, xmax: XidCase): Verdict {
  const [okMin, whyMin] = XMIN_REASON[xmin]
  const checks: Check[] = [{ label: 'xmin: was the insert done for me?', passed: okMin, reason: whyMin }]
  if (!okMin) return { visible: false, checks }
  const [okMax, whyMax] = XMAX_REASON[xmax]
  checks.push({ label: 'xmax: is the row still undeleted for me?', passed: okMax, reason: whyMax })
  return { visible: okMax, checks }
}

export interface Snapshot {
  xmin: number
  xmax: number
  xip: readonly number[]
}

/** How a snapshot classifies one xid: done (look up its commit status), running, or in the future. */
export function classify(xid: number, s: Snapshot): 'done' | 'running' | 'future' {
  if (xid >= s.xmax) return 'future'
  if (xid >= s.xmin && s.xip.includes(xid)) return 'running'
  return 'done'
}

/** Parses pg_current_snapshot() text: "xmin:xmax:xip,xip". */
export function parseSnapshot(text: string): Snapshot {
  const [xmin, xmax, xip] = text.split(':')
  return { xmin: Number(xmin), xmax: Number(xmax), xip: xip ? xip.split(',').map(Number) : [] }
}

// t_infomask bits (src/include/access/htup_details.h)
const INFOMASK: [number, string][] = [
  [0x0001, 'HEAP_HASNULL'],
  [0x0002, 'HEAP_HASVARWIDTH'],
  [0x0004, 'HEAP_HASEXTERNAL'],
  [0x0010, 'HEAP_XMAX_KEYSHR_LOCK'],
  [0x0040, 'HEAP_XMAX_EXCL_LOCK'],
  [0x0080, 'HEAP_XMAX_LOCK_ONLY'],
  [0x0100, 'HEAP_XMIN_COMMITTED'],
  [0x0200, 'HEAP_XMIN_INVALID'],
  [0x0400, 'HEAP_XMAX_COMMITTED'],
  [0x0800, 'HEAP_XMAX_INVALID'],
  [0x1000, 'HEAP_XMAX_IS_MULTI'],
  [0x2000, 'HEAP_UPDATED'],
]

/** The flag names set in a t_infomask; XMIN_COMMITTED + XMIN_INVALID together mean frozen. */
export function infomaskFlags(mask: number): string[] {
  const names = INFOMASK.filter(([bit]) => (mask & bit) === bit).map(([, n]) => n)
  if ((mask & 0x0300) === 0x0300) return [...names.filter((n) => n !== 'HEAP_XMIN_COMMITTED' && n !== 'HEAP_XMIN_INVALID'), 'HEAP_XMIN_FROZEN']
  return names
}

export const hex4 = (n: number) => `0x${n.toString(16).padStart(4, '0')}`
