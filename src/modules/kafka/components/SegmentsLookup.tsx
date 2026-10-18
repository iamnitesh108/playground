import { useMemo, useState, type ReactNode } from 'react'
import { hue } from '@/shared/figures'
import { Walkthrough } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { SegmentedLog, fileName, type Lookup } from '../simulation/segmentedLog'
import { formatBytes } from './SegmentsParse'
import styles from './SegmentsFigures.module.css'

/** A v2 record batch has a 61-byte header; the records follow it. */
const BATCH_HEADER = 61

interface Shape {
  records: number
  perBatch: number
  batchBytes: number
  segmentBytes: number
}

/** The recorded topic rebuilt in the model: same records, batch sizes and segment.bytes. */
function buildLog({ records, perBatch, batchBytes, segmentBytes }: Shape) {
  const recordBytes = (batchBytes - BATCH_HEADER) / perBatch
  const log = new SegmentedLog({ segmentBytes, segmentMs: Number.POSITIVE_INFINITY, indexIntervalBytes: 4096 })
  for (let left = records; left > 0; left -= perBatch) {
    const n = Math.min(perBatch, left)
    log.append(n, BATCH_HEADER + n * recordBytes, 0)
  }
  return log
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.lookupRow}>
      <div className={styles.lookupLabel}>{label}</div>
      <div className={styles.lookupItems}>{children}</div>
    </div>
  )
}

function Stage({ log, found, target, step }: { log: SegmentedLog; found: Lookup; target: number; step: number }) {
  const seg = log.segments[found.segment]
  const at = found.entry ? seg.index.indexOf(found.entry) : -1
  const shown = seg.index.slice(Math.max(0, at - 2), Math.max(0, at - 2) + 5)
  const hit = found.scanned[found.scanned.length - 1]
  return (
    <div className={styles.lookup}>
      <Row label="1 · segments (in memory, by base offset)">
        {log.segments.map((s, i) => (
          <span key={s.base} className={cx(styles.item, i === found.segment && styles.itemOn)} style={hue(3)}>
            {fileName(s.base, 'log').replace(/^0+(?=\d)/, '…')}
            <small>{i === found.segment ? `largest base ≤ ${target}` : s.base > target ? `> ${target}` : 'too early'}</small>
          </span>
        ))}
      </Row>
      {step >= 1 && (
        <Row label={`2 · ${fileName(seg.base, 'index').replace(/^0+(?=\d)/, '…')} (binary search)`}>
          {found.entry ? (
            shown.map((e) => (
              <span key={e.offset} className={cx(styles.item, e === found.entry && styles.itemOn)} style={hue(3)}>
                offset {e.offset} → byte {e.position}
                <small>{e === found.entry ? `largest entry ≤ ${target}` : e.offset > target ? `> ${target}` : 'earlier'}</small>
              </span>
            ))
          ) : (
            <span className={cx(styles.item, styles.itemOn)} style={hue(3)}>
              no entry ≤ {target}
              <small>start at byte 0</small>
            </span>
          )}
        </Row>
      )}
      {step >= 2 && (
        <Row label={`3 · ${fileName(seg.base, 'log').replace(/^0+(?=\d)/, '…')} (scan batch headers)`}>
          {found.scanned.map((b) => (
            <span key={b.base} className={cx(styles.item, b === hit && styles.itemOn)} style={hue(b === hit ? 1 : 3)}>
              batch {b.base}–{b.last} at byte {b.position}
              <small>{b === hit ? `holds ${target}` : `ends at ${b.last}, skip ${formatBytes(b.size)}`}</small>
            </span>
          ))}
        </Row>
      )}
      {step >= 3 && (
        <Row label="4 · fetch response">
          <span className={cx(styles.item, styles.itemOn)} style={hue(1)}>
            bytes from {hit.position} sent to the consumer
            <small>{target > hit.base ? `it drops ${hit.base}–${target - 1} and keeps ${target} onwards` : `it keeps ${target} onwards`}</small>
          </span>
        </Row>
      )}
    </div>
  )
}

/** Finding one offset: segment by base offset, then the sparse .index, then a short scan of the .log. */
export function SegmentsLookup({ shape, initial }: { shape: Shape; initial: number }) {
  const log = useMemo(() => buildLog(shape), [shape])
  const [target, setTarget] = useState(initial)
  const found = log.lookup(target)
  if (!found) return null
  const hit = found.scanned[found.scanned.length - 1]
  const seg = log.segments[found.segment]
  const steps = [
    { title: 'Pick the segment', body: <p>The broker keeps every segment of the partition in a sorted map keyed by base offset — the number in the file name. The one for offset {target} is the last whose base is ≤ {target}: <code>{fileName(seg.base, 'log')}</code>.</p> },
    { title: 'Look it up in the sparse index', body: <p>The <code>.index</code> file is memory-mapped and sorted, so a binary search finds the largest entry ≤ {target}{found.entry ? <>: offset {found.entry.offset} starts at byte {found.entry.position}</> : <>. There is none, so the read starts at byte 0</>}. The index has only {seg.index.length} entries for {formatBytes(seg.bytes)} of log — one per ~4 KB, not one per record.</p> },
    { title: 'Scan a few batch headers', body: <p>From that byte the broker reads batch headers only (base offset, last offset, size), jumping from one to the next, until a batch holds {target}. Here that is {found.scanned.length} batch{found.scanned.length === 1 ? '' : 'es'}, {formatBytes(found.scanned.reduce((n, b) => n + b.size, 0))} — instead of {formatBytes(hit.position)} from the start of the file.</p> },
    { title: 'Send whole batches', body: <p>The broker sends the file bytes from byte {hit.position} as they are, without unpacking records (on a plaintext listener the operating system copies them straight from the page cache to the socket; with TLS the broker encrypts them first). The consumer gets batch {hit.base}–{hit.last} and skips the records before {target} itself.</p> },
  ]
  return (
    <figure className={styles.figure}>
      <label className={styles.slider}>
        offset to read
        <input type="range" min={log.logStart} max={log.logEnd - 1} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        <output>{target}</output>
      </label>
      <Walkthrough title={`Where is offset ${target}?`} steps={steps}>
        {(i) => <Stage log={log} found={found} target={target} step={i} />}
      </Walkthrough>
    </figure>
  )
}
