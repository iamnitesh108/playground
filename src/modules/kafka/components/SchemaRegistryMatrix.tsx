import { hue } from '@/shared/figures'
import styles from './SchemaRegistryMatrix.module.css'

export interface MatrixRow {
  readonly change: string
  /** One verdict per mode, in the order of `modes`. */
  readonly allowed: readonly boolean[]
  /** Shown under the change, e.g. "recorded below". */
  readonly note?: string
}

interface MatrixProps {
  title: string
  modes: readonly { readonly name: string; readonly sub: string }[]
  rows: readonly MatrixRow[]
  caption?: string
}

/** Which schema changes each compatibility mode accepts: a grid of allowed / rejected, each cell labelled. */
export function SchemaRegistryMatrix({ title, modes, rows, caption }: MatrixProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>
        <table className={styles.grid}>
          <thead>
            <tr>
              <th scope="col">Change to the schema</th>
              {modes.map((m) => (
                <th key={m.name} scope="col">
                  <span className={styles.mode}>{m.name}</span>
                  <span className={styles.sub}>{m.sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.change}>
                <th scope="row">
                  {r.change}
                  {r.note && <span className={styles.note}>{r.note}</span>}
                </th>
                {r.allowed.map((ok, i) => (
                  <td key={i}>
                    <span className={ok ? styles.ok : styles.no} style={ok ? undefined : hue(8)}>
                      {ok ? '✓ allowed' : '✗ rejected'}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
