import { hue } from '@/shared/figures'
import { classify, parseSnapshot } from '../simulation/mvccVisibility'
import styles from './MvccFigures.module.css'

interface MvccSnapshotLineProps {
  title: string
  /** pg_current_snapshot() as text, e.g. "905:907:905". */
  snapshot: string
  /** Rows on the page: who inserted them, and the commit status recorded at that moment. */
  rows: readonly { xid: string; label: string; status: string }[]
}

const ZONE = {
  done: { hue: 6 as const, text: 'finished before my snapshot' },
  running: { hue: 8 as const, text: 'in xip: still running' },
  future: { hue: 8 as const, text: '≥ xmax: counts as running' },
}

/** A snapshot drawn on the xid number line, with the rows each transaction inserted. */
export function MvccSnapshotLine({ title, snapshot, rows }: MvccSnapshotLineProps) {
  const snap = parseSnapshot(snapshot)
  const xids = rows.map((r) => Number(r.xid))
  const from = Math.min(snap.xmin - 1, ...xids)
  const to = Math.max(snap.xmax + 1, ...xids)
  const span = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.line}>
        {span.map((x) => {
          const zone = classify(x, snap)
          const row = rows.find((r) => Number(r.xid) === x)
          const visible = zone === 'done' && row?.status === 'committed'
          return (
            <div key={x} className={styles.xid} style={hue(row ? (visible ? 6 : 8) : undefined)} data-zone={zone}>
              <div className={styles.marks}>
                {x === snap.xmin && <span className={styles.mark}>xmin</span>}
                {x === snap.xmax && <span className={styles.mark}>xmax</span>}
              </div>
              <div className={styles.num}>{x}</div>
              <div className={styles.zone}>{ZONE[zone].text}</div>
              {row ? (
                <div className={styles.row} data-visible={visible || undefined}>
                  <span>{row.label}</span>
                  <strong>{visible ? 'visible' : 'invisible'}</strong>
                </div>
              ) : (
                <div className={styles.rowEmpty}>no row here</div>
              )}
            </div>
          )
        })}
      </div>
      <div className={styles.caption}>
        Snapshot <code>{snapshot}</code> = xmin {snap.xmin} : xmax {snap.xmax} : running {snap.xip.join(', ') || 'none'}. xmax is one past the latest
        finished transaction, so higher xids are not listed in the running list: everything ≥ xmax counts as running.
      </div>
    </figure>
  )
}
