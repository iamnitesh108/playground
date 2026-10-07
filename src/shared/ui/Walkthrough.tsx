import type { ReactNode } from 'react'
import { useStepper } from '@/shared/hooks/useStepper'
import { cx } from '@/shared/utils/cx'
import { Button } from './Button'
import styles from './Walkthrough.module.css'

export interface WalkthroughStep {
  title: string
  body: ReactNode
}

interface WalkthroughProps {
  title: string
  steps: readonly WalkthroughStep[]
  /** Renders the diagram for the current step. */
  children: (index: number) => ReactNode
  intervalMs?: number
}

/** A diagram that advances one step at a time, with a caption per step. */
export function Walkthrough({ title, steps, children, intervalMs }: WalkthroughProps) {
  const stepper = useStepper(steps.length, intervalMs)
  const step = steps[stepper.index]

  return (
    <section className={styles.walkthrough}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Step through</div>
        <h4 className={styles.title}>{title}</h4>
      </header>
      <div className={styles.stage}>{children(stepper.index)}</div>
      <div className={styles.caption} aria-live="polite">
        <div className={styles.stepTitle}>
          <span className={styles.counter}>
            {stepper.index + 1}/{stepper.count}
          </span>
          {step.title}
        </div>
        <div className={styles.stepBody}>{step.body}</div>
      </div>
      <footer className={styles.controls}>
        <div className={styles.dots}>
          {steps.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={`Go to step ${i + 1}`}
              className={cx(styles.dot, i === stepper.index && styles.dotActive, i < stepper.index && styles.dotDone)}
              onClick={() => stepper.goTo(i)}
            />
          ))}
        </div>
        <div className={styles.buttons}>
          <Button size="sm" variant="ghost" onClick={stepper.reset} disabled={stepper.isFirst}>
            Reset
          </Button>
          <Button size="sm" onClick={stepper.previous} disabled={stepper.isFirst}>
            Back
          </Button>
          <Button size="sm" onClick={stepper.togglePlay}>
            {stepper.playing ? 'Pause' : 'Play'}
          </Button>
          <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>
            Next
          </Button>
        </div>
      </footer>
    </section>
  )
}
