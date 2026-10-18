import type { ReactNode } from 'react'
import styles from './KeysFigures.module.css'

/** A framed figure with a title and caption, for lesson pieces built from other components. */
export function KeysFigure({ title, caption, children }: { title: string; caption?: ReactNode; children: ReactNode }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>{children}</div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
