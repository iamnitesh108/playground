import type { ReactNode } from 'react'
import styles from './Demo.module.css'

interface DemoProps {
  title: string
  hint?: string
  controls?: ReactNode
  children: ReactNode
}

/** Frame for every interactive piece, so they look and read the same. */
export function Demo({ title, hint, controls, children }: DemoProps) {
  return (
    <section className={styles.demo}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Try it</div>
          <h4 className={styles.title}>{title}</h4>
          {hint && <p className={styles.hint}>{hint}</p>}
        </div>
      </header>
      {controls && <div className={styles.controls}>{controls}</div>}
      <div className={styles.body}>{children}</div>
    </section>
  )
}
