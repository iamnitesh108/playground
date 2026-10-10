import { useState, type ReactNode } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Predict.module.css'

interface PredictProps {
  question: ReactNode
  options: readonly string[]
  /** Index of the correct option. */
  answer: number
  /** Shown after answering, right or wrong. */
  explanation: ReactNode
}

/**
 * Asks the reader to commit to a prediction before seeing the answer —
 * retrieval practice, which makes the following explanation stick.
 */
export function Predict({ question, options, answer, explanation }: PredictProps) {
  const [chosen, setChosen] = useState<number | null>(null)
  const answered = chosen !== null

  return (
    <section className={styles.predict}>
      <div className={styles.eyebrow}>Predict first</div>
      <div className={styles.question}>{question}</div>
      <div className={styles.options}>
        {options.map((option, i) => (
          <button
            key={option}
            type="button"
            disabled={answered}
            className={cx(styles.option, answered && i === answer && styles.correct, answered && i === chosen && i !== answer && styles.wrong)}
            onClick={() => setChosen(i)}
          >
            {option}
          </button>
        ))}
      </div>
      {answered && (
        <div className={styles.explanation} aria-live="polite">
          <strong>{chosen === answer ? 'Right.' : `Not quite — it is “${options[answer]}”.`}</strong> {explanation}
          <button type="button" className={styles.retry} onClick={() => setChosen(null)}>
            try again
          </button>
        </div>
      )}
    </section>
  )
}
