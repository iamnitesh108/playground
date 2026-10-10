import { useState } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Transcript.module.css'

export interface Step {
  readonly cmd: string
  readonly out: string
  readonly exit: number
}

interface TranscriptProps {
  steps: readonly Step[]
  title?: string
  /** Shell prompt shown before each command. */
  prompt?: string
}

/** A recorded terminal session: commands, their output, and failures marked. */
export function Transcript({ steps, title = 'recorded', prompt = '$' }: TranscriptProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(steps.map((s) => s.cmd.replace(/\s+#.*$/, '')).filter((c) => !c.startsWith('#')).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <figure className={styles.terminal}>
      <figcaption className={styles.head}>
        <span>{title}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy commands'}
        </button>
      </figcaption>
      <div className={styles.body}>
        {steps.map((s, i) => (
          <div key={i} className={styles.step}>
            <div className={styles.cmd}>
              <span className={styles.prompt}>{prompt}</span> {s.cmd}
              {s.exit !== 0 && <span className={styles.exit}>exit {s.exit}</span>}
            </div>
            {s.out && <pre className={cx(styles.out, s.exit !== 0 && styles.failed)}>{s.out}</pre>}
          </div>
        ))}
      </div>
    </figure>
  )
}
