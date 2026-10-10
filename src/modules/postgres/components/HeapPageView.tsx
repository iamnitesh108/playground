import { cx } from '@/shared/utils/cx'
import type { HeapTuple } from '../data/types'
import styles from './HeapPageView.module.css'

const LP_STATE = ['unused', 'normal', 'redirect', 'dead'] as const

interface HeapPageViewProps {
  tuples: readonly HeapTuple[]
  /** Previous frame, to highlight what changed. */
  previous?: readonly HeapTuple[]
  /** Transaction status by xid: committed / in progress / aborted. */
  xids: Record<string, string>
  /** Data columns to show, in order. */
  columns: readonly string[]
}

const FIELDS = ['lp_flags', 'xmin', 'xmax', 'ctid', 'hot_updated', 'heap_only'] as const

function changed(tuple: HeapTuple, previous: readonly HeapTuple[] | undefined, fields: readonly string[]): Set<string> {
  const before = previous?.find((t) => t.lp === tuple.lp)
  const result = new Set<string>()
  if (!previous) return result
  if (!before) return new Set(['new'])
  for (const f of fields) if (String(before[f]) !== String(tuple[f])) result.add(f)
  return result
}

function XidChip({ xid, xids }: { xid: string | null; xids: Record<string, string> }) {
  if (!xid || xid === '0') return <span className={styles.none}>0</span>
  const status = xids[xid] ?? 'unknown'
  return (
    <span className={styles.xid} data-status={status} title={`transaction ${xid}: ${status}`}>
      {xid}
    </span>
  )
}

/**
 * One 8 KB heap page as pageinspect sees it: line pointers grow from the
 * start of the page, tuple data grows from the end.
 */
export function HeapPageView({ tuples, previous, xids, columns }: HeapPageViewProps) {
  const byOffset = [...tuples].filter((t) => t.lp_flags === 1).sort((a, b) => a.lp_off - b.lp_off)

  return (
    <div className={styles.view}>
      <div className={styles.strip} aria-label="Page layout">
        <div className={cx(styles.cell, styles.header)}>header</div>
        {tuples.map((t) => (
          <div key={`lp${t.lp}`} className={cx(styles.cell, styles.pointer)} data-state={LP_STATE[t.lp_flags]} title={`line pointer ${t.lp}: ${LP_STATE[t.lp_flags]}`}>
            lp{t.lp}
          </div>
        ))}
        <div className={styles.free}>free space</div>
        {byOffset.map((t) => (
          <div key={`t${t.lp}`} className={cx(styles.cell, styles.tuple)} title={`tuple of lp${t.lp} at byte ${t.lp_off}`}>
            {t.lp_off}
          </div>
        ))}
        <div className={styles.end}>8192</div>
      </div>

      <div className={styles.tuples}>
        {tuples.map((t) => {
          const diff = changed(t, previous, [...FIELDS, ...columns])
          const state = LP_STATE[t.lp_flags]
          return (
            <div key={t.lp} className={cx(styles.card, diff.has('new') && styles.fresh)} data-state={state}>
              <div className={styles.cardHead}>
                <span className={styles.lp}>lp {t.lp}</span>
                <span className={cx(styles.state, diff.has('lp_flags') && styles.changed)}>{state}</span>
                {t.lp_flags === 2 && <span className={styles.redirect}>→ lp {t.lp_off}</span>}
                {t.hot_updated && <span className={cx(styles.flag, diff.has('hot_updated') && styles.changed)}>HOT updated</span>}
                {t.heap_only && <span className={cx(styles.flag, diff.has('heap_only') && styles.changed)}>heap-only</span>}
              </div>
              {t.lp_flags === 1 && (
                <dl className={styles.fields}>
                  <div className={styles.pair}>
                    <dt>xmin</dt>
                    <dd className={cx(diff.has('xmin') && styles.changed)}><XidChip xid={t.xmin} xids={xids} /></dd>
                  </div>
                  <div className={styles.pair}>
                    <dt>xmax</dt>
                    <dd className={cx(diff.has('xmax') && styles.changed)}><XidChip xid={t.xmax} xids={xids} /></dd>
                  </div>
                  <div className={styles.pair}>
                    <dt>ctid</dt>
                    <dd className={cx(diff.has('ctid') && styles.changed)}>{t.ctid}</dd>
                  </div>
                  {columns.map((c) => (
                    <div key={c} className={styles.pair}>
                      <dt>{c}</dt>
                      <dd className={cx(styles.data, diff.has(c) && styles.changed)}>{String(t[c])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.legend}>
        <span className={styles.xid} data-status="committed">committed</span>
        <span className={styles.xid} data-status="in progress">in progress</span>
        <span className={styles.xid} data-status="aborted">aborted</span>
        <span className={styles.legendNote}>highlighted = changed by this step</span>
      </div>
    </div>
  )
}
