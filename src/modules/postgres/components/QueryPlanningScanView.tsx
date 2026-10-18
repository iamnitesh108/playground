import { useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { HEAP_PAGES, NOT_ALL_VISIBLE, summarise, visits, type ScanType } from '../simulation/queryPlanningScans'
import styles from './QueryPlanning.module.css'

const SCANS: { value: ScanType; label: string; text: string }[] = [
  { value: 'seq', label: 'Seq Scan', text: 'Reads every page from first to last and tests every row. Sequential reads are the cheapest kind, but it reads everything.' },
  { value: 'index', label: 'Index Scan', text: 'Descends the tree, then for each matching entry jumps to its heap page — in key order, so pages are visited out of order and some twice.' },
  { value: 'bitmap', label: 'Bitmap Scan', text: 'First collects the page numbers of all matches into a bitmap, then reads each page once, in physical order. Wins between “a few rows” and “most of the table”.' },
  { value: 'indexOnly', label: 'Index Only Scan', text: 'Answers from the index alone. Only for pages the visibility map does not mark all-visible does it check the heap page.' },
]

/** One query, four access paths: which pages each reads, and in what order. Schematic: 20 heap pages. */
export function QueryPlanningScanView() {
  const [scan, setScan] = useState<ScanType>('index')
  const v = visits(scan)
  const sum = summarise(v)
  const firstVisit = new Map<number, number>()
  const visitsPerPage = new Map<number, number[]>()
  v.forEach((x, i) => {
    if (x.kind !== 'heap') return
    const p = x.page as number
    if (!firstVisit.has(p)) firstVisit.set(p, i + 1)
    visitsPerPage.set(p, [...(visitsPerPage.get(p) ?? []), i + 1])
  })
  const usesIndex = sum.indexPages > 0
  const info = SCANS.find((s) => s.value === scan)!

  return (
    <Demo
      title="Four ways to read the same rows"
      hint="Schematic: the matching rows live on 5 of the table’s 20 pages. Numbers give the order each page is read in."
      controls={<Segmented label="scan" value={scan} onChange={setScan} options={SCANS.map(({ value, label }) => ({ value, label }))} />}
    >
      <div className={styles.scanRow}>
        <span className={styles.scanLabel}>index</span>
        <div className={styles.scanIndex} style={hue(7)}>
          {['root', 'leaf'].map((p, i) => (
            <span key={p} className={cx(styles.scanPage, usesIndex && styles.scanOn)} style={hue(7)}>
              {p}
              {usesIndex && <span className={styles.scanNo}>{i + 1}</span>}
            </span>
          ))}
        </div>
      </div>
      {scan === 'indexOnly' && (
        <div className={styles.scanRow}>
          <span className={styles.scanLabel}>visibility map</span>
          <div className={styles.scanPages}>
            {Array.from({ length: HEAP_PAGES }, (_, p) => (
              <span key={p} className={cx(styles.vmBit, NOT_ALL_VISIBLE.has(p) ? styles.vmNo : styles.vmYes)} title={`page ${p}: ${NOT_ALL_VISIBLE.has(p) ? 'not all-visible' : 'all-visible'}`}>
                {NOT_ALL_VISIBLE.has(p) ? '0' : '1'}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className={styles.scanRow}>
        <span className={styles.scanLabel}>heap pages</span>
        <div className={styles.scanPages} style={hue(3)}>
          {Array.from({ length: HEAP_PAGES }, (_, p) => {
            const seen = visitsPerPage.get(p)
            return (
              <span key={p} className={cx(styles.scanPage, seen && styles.scanOn)} style={hue(3)} title={`page ${p}`}>
                <span className={styles.scanPageNo}>{p}</span>
                {seen && <span className={styles.scanNo}>{seen.length > 2 ? `${seen[0]}…` : seen.join(',')}</span>}
              </span>
            )
          })}
        </div>
      </div>
      <p className={styles.scanText}>{info.text}</p>
      <div className={styles.histResult}>
        <span className={styles.counterTile}>index pages: {sum.indexPages}</span>
        <span className={styles.counterTile}>
          heap reads: {sum.heapVisits}
          {sum.heapVisits !== sum.distinctHeapPages ? ` (${sum.distinctHeapPages} distinct pages)` : ''}
        </span>
        {scan === 'indexOnly' && <span className={styles.counterTile}>visibility-map checks: {sum.vmChecks}</span>}
      </div>
    </Demo>
  )
}
