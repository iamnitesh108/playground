import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo } from '@/shared/ui'
import { interpolate, rowsRead, type PagePoint } from '../simulation/usingPostgresPaging'
import styles from './UsingPostgresPaging.module.css'

const TOTAL = 1_000_000
const PAGE = 20

/** Drag to a page deep in a million rows: how much of the index each method walks, and the recorded time. */
export function UsingPostgresPaging({ points }: { points: readonly PagePoint[] }) {
  const [skip, setSkip] = useState(500_000)
  const methods = [
    { id: 'offset' as const, name: 'OFFSET', sql: `LIMIT ${PAGE} OFFSET ${skip.toLocaleString('en')}`, h: 8 as const, ms: interpolate(points, skip, 'offsetMs') },
    { id: 'keyset' as const, name: 'keyset', sql: `WHERE id > ${skip.toLocaleString('en')} LIMIT ${PAGE}`, h: 6 as const, ms: interpolate(points, skip, 'keysetMs') },
  ]
  const recorded = points.some((p) => p.offset === skip)
  return (
    <Demo
      title="Page deep into one million rows"
      hint="Each bar is the primary-key index, id 1 on the left to 1,000,000 on the right. The coloured part is what the server walks through to return one page of 20."
      controls={
        <label className={styles.slider}>
          <span>skip</span>
          <input type="range" min={0} max={TOTAL - PAGE} step={10_000} value={skip} onChange={(e) => setSkip(Number(e.target.value))} aria-label="rows to skip" />
          <strong>{skip.toLocaleString('en')} rows</strong>
        </label>
      }
    >
      {methods.map((m) => {
        const read = rowsRead(m.id, skip, PAGE)
        const from = m.id === 'offset' ? 0 : skip
        return (
          <div key={m.id} className={styles.row} style={hue(m.h)}>
            <div className={styles.head}>
              <strong>{m.name}</strong> <code>{m.sql}</code>
            </div>
            <div className={styles.track} role="img" aria-label={`${m.name} reads ${read} index entries`}>
              <span className={styles.read} style={{ left: `${(from / TOTAL) * 100}%`, width: `max(3px, ${(read / TOTAL) * 100}%)` }} />
              <span className={styles.page} style={{ left: `${(skip / TOTAL) * 100}%` }} />
            </div>
            <div className={styles.facts}>
              reads <strong>{read.toLocaleString('en')}</strong> rows, returns 20 · {recorded ? 'recorded' : 'about'} <strong>{m.ms < 1 ? m.ms.toFixed(3) : m.ms.toFixed(1)} ms</strong>
            </div>
          </div>
        )
      })}
      <p className={styles.note}>
        Times are EXPLAIN ANALYZE execution times recorded at 0; 10,000; 100,000; 500,000 and 900,000 rows skipped (median of five, all
        pages in memory); positions in between are interpolated from them.
      </p>
    </Demo>
  )
}
