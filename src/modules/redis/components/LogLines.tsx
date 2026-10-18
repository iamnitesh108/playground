import styles from './LogLines.module.css'

interface LogLinesProps {
  lines: readonly string[]
  title: string
  /** Lines matching this are emphasised. */
  highlight?: RegExp
}

/** Lines from a real server log, timestamps and process ids removed. */
export function LogLines({ lines, title, highlight }: LogLinesProps) {
  return (
    <figure className={styles.log}>
      <figcaption className={styles.head}>{title}</figcaption>
      <ol className={styles.body}>
        {lines.map((l, i) => (
          <li key={i} className={highlight?.test(l) ? styles.mark : undefined}>
            {l}
          </li>
        ))}
      </ol>
    </figure>
  )
}
