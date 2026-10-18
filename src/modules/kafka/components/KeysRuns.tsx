import type { Run } from './KeysRunsParse'
import styles from './KeysFigures.module.css'

/** Recorded key-less sends as one strip: each block is a run of consecutive records on one partition. */
export function KeysRuns({ title, runs, caption }: { title: string; runs: readonly Run[]; caption?: string }) {
  const total = runs.length ? runs[runs.length - 1].to : 0
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.strip} role="img" aria-label={runs.map((r) => `records ${r.from} to ${r.to} on partition ${r.partition}`).join(', ')}>
        {runs.map((r) => {
          const share = ((r.to - r.from + 1) / total) * 100
          return (
            <span key={r.from} className={styles.run} style={{ flexBasis: `${share}%` }} title={`records ${r.from}–${r.to} → P${r.partition}`}>
              {share >= 9 ? `P${r.partition}` : ''}
            </span>
          )
        })}
      </div>
      <div className={styles.runLegend}>
        {runs.map((r) => (
          <span key={r.from}>
            {r.from}–{r.to} → P{r.partition}
          </span>
        ))}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
