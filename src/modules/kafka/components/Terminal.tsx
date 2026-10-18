import { cx } from '@/shared/utils/cx'
import styles from './Terminal.module.css'
import { Highlighted } from '@/shared/code'

export interface TerminalStep {
  readonly cmd: string
  readonly out?: string
  /** A comment line shown above the command. */
  readonly label?: string
}

interface TerminalProps {
  steps: readonly TerminalStep[]
  title?: string
}

/** Recorded shell commands and their real output. Long commands wrap; the output keeps its columns. */
export function Terminal({ steps, title = 'recorded terminal' }: TerminalProps) {
  return (
    <figure className={styles.terminal}>
      <figcaption className={styles.head}>{title}</figcaption>
      <div className={styles.body}>
        {steps.map((s, i) => (
          <div key={i} className={styles.step}>
            {s.label && <div className={styles.label}># {s.label}</div>}
            <div className={styles.cmd}>
              <span className={styles.prompt}>$</span> <Highlighted code={s.cmd} language="bash" />
            </div>
            {s.out && <pre className={cx(styles.out, /Exception|ERROR|Error/.test(s.out) && styles.error)}><Highlighted language="output" code={s.out} /></pre>}
          </div>
        ))}
      </div>
    </figure>
  )
}
