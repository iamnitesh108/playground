import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './VersioningHistory.module.css'

export interface Snapshot {
  title: string
  versions: readonly (readonly [string, boolean, number?])[]
  markers: readonly (readonly [string, boolean])[]
}

/** Recorded version lists of one key, side by side: how the stack changed after each step. */
export function VersioningHistory({ title, snapshots, labelOf }: { title: string; snapshots: readonly Snapshot[]; labelOf: (id: string) => string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.columns}>
        {snapshots.map((s) => {
          // newest first: the latest entry, then versions in listed order (S3 lists newest first)
          const entries = [
            ...s.markers.map(([id, latest]) => ({ id, latest, marker: true })),
            ...s.versions.map(([id, latest]) => ({ id, latest, marker: false })),
          ].sort((a, b) => Number(b.latest) - Number(a.latest))
          return (
            <div key={s.title} className={styles.column}>
              <div className={styles.head}>{s.title}</div>
              {entries.map((e) => (
                <div key={e.id} className={e.marker ? styles.marker : styles.version} style={hue(e.marker ? HUE.error : e.latest ? HUE.ok : HUE.data)}>
                  <span>{e.marker ? 'delete marker' : labelOf(e.id)}</span>
                  <code>{e.id.slice(0, 8)}</code>
                  {e.latest && <strong>latest</strong>}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </figure>
  )
}
