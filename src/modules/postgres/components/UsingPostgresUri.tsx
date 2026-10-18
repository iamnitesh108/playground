import { hue, type Hue } from '@/shared/figures'
import styles from './UsingPostgresUri.module.css'

export interface UriPart {
  text: string
  label?: string
  hue?: Hue
}

/** A connection string cut into its parts, each part labelled under it. */
export function UsingPostgresUri({ title, parts, caption }: { title: string; parts: readonly UriPart[]; caption?: string }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.parts}>
        {parts.map((p, i) => (
          <span key={i} className={p.label ? styles.part : styles.sep} style={hue(p.hue)}>
            <code className={styles.text}>{p.text}</code>
            {p.label && <span className={styles.label}>{p.label}</span>}
          </span>
        ))}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
