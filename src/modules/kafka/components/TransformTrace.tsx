import type { TransformStage } from '../simulation'
import styles from './TransformTrace.module.css'

const show = (value: unknown) => (typeof value === 'string' ? JSON.stringify(value) : JSON.stringify(value, null, 2))

/** Shows a record before and after each SMT in a chain. */
export function TransformTrace({ stages }: { stages: readonly TransformStage[] }) {
  return (
    <ol className={styles.trace}>
      {stages.map((stage, i) => (
        <li key={`${stage.label}-${i}`} className={styles.stage}>
          <div className={styles.head}>
            <span className={styles.index}>{i === 0 ? 'in' : i}</span>
            <span className={styles.label}>{stage.label}</span>
            <span className={styles.description}>{stage.description}</span>
          </div>
          {stage.record ? (
            <div className={styles.record}>
              <div className={styles.row}>
                <span className={styles.field}>topic</span>
                <code className={styles.value}>{stage.record.topic}</code>
              </div>
              <div className={styles.row}>
                <span className={styles.field}>key</span>
                <code className={styles.value}>{show(stage.record.key)}</code>
              </div>
              <div className={styles.row}>
                <span className={styles.field}>value</span>
                <pre className={styles.json}>{show(stage.record.value)}</pre>
              </div>
            </div>
          ) : (
            <div className={styles.dropped}>record dropped</div>
          )}
        </li>
      ))}
    </ol>
  )
}
