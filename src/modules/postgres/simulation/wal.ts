import { Observable } from '@/shared/utils/observable'

/*
 * Write-ahead logging and crash recovery, reduced to the rules that matter:
 *  1. A change is written to the WAL (in memory) and to the page in shared buffers.
 *  2. COMMIT appends a commit record and flushes the WAL to disk — only then is it durable.
 *  3. A dirty page may be written to disk only after the WAL describing it is on disk.
 *  4. A checkpoint writes all dirty pages and records a redo point.
 *  5. After a crash, replay the WAL from the last checkpoint's redo point.
 * Simplified: one row per key, page-level LSNs, no full-page images, no clog files.
 */

export interface Version {
  value: number
  xid: number
}

export interface Page {
  id: string
  /** LSN of the last WAL record applied to this page. */
  lsn: number
  rows: Record<string, Version[]>
}

export type WalRecord =
  | { lsn: number; kind: 'update'; xid: number; page: string; key: string; value: number }
  | { lsn: number; kind: 'commit'; xid: number }
  | { lsn: number; kind: 'checkpoint'; redo: number }

export type Phase = 'running' | 'crashed' | 'recovered'

export interface LogLine {
  id: number
  text: string
  tone: 'info' | 'ok' | 'warn' | 'bad'
}

const PAGES: Record<string, string[]> = { 'page 0': ['a', 'b'], 'page 1': ['c', 'd'] }
const clone = (p: Page): Page => ({ id: p.id, lsn: p.lsn, rows: Object.fromEntries(Object.entries(p.rows).map(([k, v]) => [k, [...v]])) })

export class WalSimulator extends Observable {
  disk: Record<string, Page> = {}
  buffers: Record<string, Page & { dirty: boolean }> = {}
  walBuffer: WalRecord[] = []
  walDisk: WalRecord[] = []
  /** Transaction whose changes are not committed yet. */
  open: { xid: number; changes: number } | null = null
  phase: Phase = 'running'
  log: LogLine[] = []
  private nextLsn = 100
  private nextXid = 501
  private seq = 0

  constructor() {
    super()
    this.reset()
  }

  reset(): void {
    this.disk = {}
    for (const [id, keys] of Object.entries(PAGES)) {
      this.disk[id] = { id, lsn: 0, rows: Object.fromEntries(keys.map((k) => [k, [{ value: 10, xid: 1 }]])) }
    }
    this.buffers = {}
    this.walBuffer = []
    this.walDisk = []
    this.open = null
    this.phase = 'running'
    this.log = []
    this.nextLsn = 100
    this.nextXid = 501
    this.say('Two data pages on disk. Every key starts at 10, written by transaction 1 (committed long ago).', 'info')
    this.notify()
  }

  get committed(): Set<number> {
    const xids = new Set<number>([1])
    for (const r of this.walDisk) if (r.kind === 'commit') xids.add(r.xid)
    return xids
  }

  /** What a query sees: the newest version of each key written by a committed transaction. */
  visible(page: Page): Record<string, number> {
    const committed = this.committed
    return Object.fromEntries(
      Object.entries(page.rows).map(([key, versions]) => {
        const v = [...versions].reverse().find((x) => committed.has(x.xid) || x.xid === this.open?.xid)
        return [key, v?.value ?? NaN]
      }),
    )
  }

  /** The current page: from shared buffers if cached, else from disk. */
  page(id: string): Page {
    return this.buffers[id] ?? this.disk[id]
  }

  update(key: string, value: number): void {
    if (this.phase === 'crashed') return
    const pageId = Object.keys(PAGES).find((p) => PAGES[p].includes(key))!
    if (!this.open) this.open = { xid: this.nextXid++, changes: 0 }
    const xid = this.open.xid
    if (!this.buffers[pageId]) {
      this.buffers[pageId] = { ...clone(this.disk[pageId]), dirty: false }
      this.say(`${pageId} read from disk into shared buffers.`, 'info')
    }
    const lsn = this.nextLsn++
    this.walBuffer.push({ lsn, kind: 'update', xid, page: pageId, key, value })
    const buffer = this.buffers[pageId]
    buffer.rows[key] = [...buffer.rows[key], { value, xid }]
    buffer.lsn = lsn
    buffer.dirty = true
    this.open.changes++
    this.say(`xid ${xid}: ${key} = ${value}. WAL record ${lsn} added to the WAL buffer (memory); the page in shared buffers is changed and dirty. Nothing on disk yet.`, 'info')
    this.phase = 'running'
    this.notify()
  }

  commit(): void {
    if (!this.open || this.phase === 'crashed') return
    const lsn = this.nextLsn++
    this.walBuffer.push({ lsn, kind: 'commit', xid: this.open.xid })
    this.flushWal()
    this.say(`COMMIT of xid ${this.open.xid}: commit record ${lsn} appended and the WAL flushed to disk (fsync). The data pages are still only in memory — and that is fine.`, 'ok')
    this.open = null
    this.notify()
  }

  /** Background writer / checkpointer writing one dirty page — WAL first. */
  writePage(id: string): void {
    const buffer = this.buffers[id]
    if (!buffer?.dirty || this.phase === 'crashed') return
    const needed = buffer.lsn
    if (this.walBuffer.some((r) => r.lsn <= needed)) {
      this.flushWal()
      this.say(`Write-ahead rule: before writing ${id}, the WAL up to ${needed} is flushed first.`, 'warn')
    }
    this.disk[id] = clone(buffer)
    buffer.dirty = false
    this.say(`${id} written to disk (page LSN ${buffer.lsn}).`, 'info')
    this.notify()
  }

  checkpoint(): void {
    if (this.phase === 'crashed') return
    const redo = this.nextLsn
    for (const id of Object.keys(this.buffers)) this.writePage(id)
    const lsn = this.nextLsn++
    this.walBuffer.push({ lsn, kind: 'checkpoint', redo })
    this.flushWal()
    this.say(`CHECKPOINT: every dirty page is on disk; recovery would start at redo point ${redo}. Older WAL is no longer needed for crash recovery.`, 'ok')
    this.notify()
  }

  crash(): void {
    if (this.phase === 'crashed') return
    const lost = this.walBuffer.length
    this.buffers = {}
    this.walBuffer = []
    const open = this.open
    this.open = null
    this.phase = 'crashed'
    this.say(
      `CRASH. Shared buffers and the WAL buffer are gone${lost ? ` (${lost} unflushed WAL records lost)` : ''}.${open ? ` xid ${open.xid} never committed.` : ''} Disk holds the data files and the flushed WAL.`,
      'bad',
    )
    this.notify()
  }

  recover(): void {
    if (this.phase !== 'crashed') return
    const checkpoint = [...this.walDisk].reverse().find((r) => r.kind === 'checkpoint')
    const redo = checkpoint && checkpoint.kind === 'checkpoint' ? checkpoint.redo : 0
    let replayed = 0
    let skipped = 0
    for (const record of this.walDisk) {
      if (record.lsn < redo || record.kind !== 'update') continue
      const page = this.buffers[record.page] ?? { ...clone(this.disk[record.page]), dirty: false }
      this.buffers[record.page] = page
      if (record.lsn <= page.lsn) {
        skipped++
        continue
      }
      page.rows[record.key] = [...page.rows[record.key], { value: record.value, xid: record.xid }]
      page.lsn = record.lsn
      page.dirty = true
      replayed++
    }
    this.phase = 'recovered'
    this.say(
      `RECOVERY from redo point ${redo || 'start'}: ${replayed} WAL record(s) replayed${skipped ? `, ${skipped} skipped (page already newer)` : ''}. Committed changes are back; changes of transactions without a commit record stay invisible (treated as aborted).`,
      'ok',
    )
    this.notify()
  }

  private flushWal(): void {
    this.walDisk = [...this.walDisk, ...this.walBuffer]
    this.walBuffer = []
  }

  private say(text: string, tone: LogLine['tone']): void {
    this.log = [{ id: ++this.seq, text, tone }, ...this.log].slice(0, 30)
  }
}
