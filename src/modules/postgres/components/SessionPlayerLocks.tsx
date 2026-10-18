import { hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import { SESSION_HUE } from './SessionPlayerColours'
import styles from './SessionPlayerLocks.module.css'

/** One row of pg_locks as recorded, with pids replaced by session names. */
export interface LockObservation {
  readonly session: string
  readonly lock: string
  readonly target: string
  readonly mode: string
  readonly granted: boolean
  readonly blockedBy: readonly string[]
}

/** One locked tuple as pgrowlocks reads it from the page. */
export interface RowLockObservation {
  readonly row: string
  readonly multi: boolean
  readonly modes: readonly string[]
  readonly sessions: readonly string[]
}

const Session = ({ s }: { s: string }) => (
  <span className={styles.session} style={hue(SESSION_HUE[s])}>
    {s}
  </span>
)

/** The pg_locks rows of the sessions after a step: who holds what, who waits for whom. */
export function LockTable({ rows, title = 'pg_locks after this step', empty = 'no locks held' }: { rows: readonly LockObservation[]; title?: string; empty?: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.length === 0 ? (
        <div className={styles.empty}>{empty}</div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>session</th>
                <th>lock on</th>
                <th>mode</th>
                <th>granted</th>
                <th>pg_blocking_pids</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={cx(!r.granted && styles.waitRow)}>
                  <td>
                    <Session s={r.session} />
                  </td>
                  <td className={styles.mono}>
                    {r.lock === 'relation' ? '' : `${r.lock} `}
                    {r.target}
                  </td>
                  <td className={styles.mono}>{r.mode}</td>
                  <td>
                    <span className={styles.state} style={hue(r.granted ? 6 : 8)}>
                      {r.granted ? 'granted' : 'waiting'}
                    </span>
                  </td>
                  <td>{r.blockedBy.length ? r.blockedBy.map((b) => <Session key={b} s={b} />) : <span className={styles.faint}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}

/** Row locks as stored in the tuples (pgrowlocks): which row, which mode, which session. */
export function RowLockTable({ rows, title = 'pgrowlocks after this step' }: { rows: readonly RowLockObservation[]; title?: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {rows.length === 0 ? (
        <div className={styles.empty}>no row locks</div>
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>row (ctid)</th>
                <th>lock mode stored in the tuple</th>
                <th>held by</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.row}>
                  <td className={styles.mono}>{r.row}</td>
                  <td className={styles.mono}>
                    {r.modes.join(' + ')}
                    {r.multi && <span className={styles.faint}> (multixact)</span>}
                  </td>
                  <td>{r.sessions.map((s, i) => <Session key={`${s}${i}`} s={s} />)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
