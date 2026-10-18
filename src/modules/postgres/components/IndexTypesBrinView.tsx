import { useMemo, useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { matching, summaries, type BrinTable } from '../simulation/indexTypesBrin'
import { QueryPlanningSlider } from './QueryPlanningSlider'
import styles from './IndexTypes.module.css'

const WINDOWS = [
  { value: 3600, label: '1 hour' },
  { value: 86400, label: '1 day' },
  { value: 7 * 86400, label: '1 week' },
]

/** The block-range summaries of a BRIN index, and which ranges a time-window query must read. */
export function IndexTypesBrinView({ table }: { table: BrinTable }) {
  const [ordered, setOrdered] = useState(true)
  const [day, setDay] = useState(31)
  const [win, setWin] = useState(3600)
  const [zoom, setZoom] = useState(true)
  const ranges = useMemo(() => summaries(table, ordered), [table, ordered])
  const end = table.rows * table.step
  const days = Math.floor(end / 86400)
  const from = day * 86400 + 10 * 3600
  const hit = matching(ranges, from, from + win)
  const hitSet = new Set(hit.map((r) => r.page))
  // zoomed: the 24 ranges around the window, with the time axis fitted to them
  const centre = Math.min(Math.max(0, Math.floor((from / end) * ranges.length) - 12), ranges.length - 24)
  const first = zoom ? centre : 0
  const shown = zoom ? ranges.slice(first, first + 24) : ranges
  const t0 = zoom ? Math.min(from, ...shown.map((r) => r.min)) : 0
  const t1 = zoom ? Math.max(from + win, ...shown.map((r) => r.max)) : end
  const W = 720
  const H = 160
  const y = (t: number) => ((t - t0) / (t1 - t0)) * H
  const bw = W / shown.length
  const pagesRead = Math.min(table.pages, hit.length * table.pagesPerRange)
  const fmtDay = (t: number) => `day ${(t / 86400).toFixed(zoom ? 1 : 0)}`

  return (
    <Demo
      title={`BRIN on events.created_at: ${ranges.length} block ranges of ${table.pagesPerRange} pages`}
      hint="One bar per range of 128 pages, in page order. A bar spans the smallest to the largest created_at in that range (earliest at the top). The band labelled “query window” is the time the query asks for: every range whose bar crosses it is read, all 128 pages."
      controls={
        <>
          <Segmented label="rows arrived" value={ordered ? 1 : 0} onChange={(v) => setOrdered(v === 1)} options={[{ value: 1, label: 'in time order' }, { value: 0, label: 'shuffled' }]} />
          <QueryPlanningSlider label="window starts on day" value={day} min={0} max={days - 1} onChange={setDay} />
          <Segmented label="window" value={win} onChange={setWin} options={WINDOWS} />
          <Segmented label="show" value={zoom ? 1 : 0} onChange={(v) => setZoom(v === 1)} options={[{ value: 1, label: '24 ranges around the window' }, { value: 0, label: 'all ranges' }]} />
        </>
      }
    >
      <svg viewBox={`0 0 ${W} ${H + 40}`} className={styles.brinSvg} role="img" aria-label={`${hit.length} of ${ranges.length} ranges match`}>
        <rect x={0} y={y(from)} width={W} height={Math.max(2, y(from + win) - y(from))} className={styles.brinWindow} />
        {shown.map((r, i) => {
          const on = hitSet.has(r.page)
          return (
            <g key={r.page} style={hue(on ? 6 : 7)}>
              {on && <rect x={i * bw} y={0} width={bw} height={H} className={styles.brinHitCol} />}
              <rect x={i * bw + bw * 0.15} y={y(r.min)} width={Math.max(1.5, bw * 0.7)} height={Math.max(1.5, y(r.max) - y(r.min))} className={on ? styles.brinOn : styles.brinOff} />
            </g>
          )
        })}
        <text x={W - 4} y={y(from) > 14 ? y(from) - 4 : Math.min(H - 2, y(from + win) + 12)} textAnchor="end" className={cx(styles.brinAxis, styles.brinWindowLabel)}>
          query window
        </text>
        <text x={0} y={H + 14} className={styles.brinAxis}>
          page {shown[0].page.toLocaleString()}
        </text>
        <text x={W} y={H + 14} className={styles.brinAxis} textAnchor="end">
          page {Math.min(table.pages, shown.at(-1)!.page + table.pagesPerRange).toLocaleString()}
        </text>
        <text x={W / 2} y={H + 30} className={styles.brinAxis} textAnchor="middle">
          ranges in page order → · time from {fmtDay(t0)} (top) to {fmtDay(t1)} (bottom)
        </text>
      </svg>
      <div className={styles.brinStats}>
        <span className={styles.chip}>
          ranges read: {hit.length} of {ranges.length}
        </span>
        <span className={styles.chip}>
          heap pages read: {pagesRead.toLocaleString()} of {table.pages.toLocaleString()}
        </span>
        <span className={styles.chip}>
          rows to recheck: ~{Math.round((pagesRead * table.rows) / table.pages).toLocaleString()} for ~
          {Math.round(win / table.step).toLocaleString()} wanted
        </span>
      </div>
    </Demo>
  )
}
