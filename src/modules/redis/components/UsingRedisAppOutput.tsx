import { cx } from '@/shared/utils/cx'
import styles from './UsingRedisAppOutput.module.css'

interface AppOutputProps {
  lines: readonly string[]
  title?: string
}

const isError = (s: string) => /Exception|refused|Cannot reconnect/.test(s)

/** Recorded stdout of the usage app: "call  ->  result" lines shown as call / result rows. */
export function UsingRedisAppOutput({ lines, title = 'recorded app output' }: AppOutputProps) {
  return (
    <figure className={styles.out}>
      <figcaption className={styles.head}>{title}</figcaption>
      <ol className={styles.body}>
        {lines.map((line, i) => {
          if (line.startsWith('# ')) return <li key={i} className={styles.comment}>{`// ${line.slice(2)}`}</li>
          const at = line.indexOf('  ->  ')
          if (at < 0) return <li key={i} className={cx(styles.log, isError(line) && styles.error)}>{line}</li>
          const result = line.slice(at + 6)
          return (
            <li key={i} className={styles.row}>
              <span className={styles.call}>{line.slice(0, at).trimStart()}</span>
              <span className={styles.arrow} aria-hidden="true">→</span>
              <span className={cx(styles.result, isError(result) && styles.error)}>{result}</span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}
