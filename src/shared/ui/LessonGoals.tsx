import type { ReactNode } from 'react'
import styles from './LessonGoals.module.css'

interface LessonGoalsProps {
  goals: readonly ReactNode[]
  /** Lessons or knowledge that help before starting. */
  before?: ReactNode
}

/** What the reader will be able to do after the lesson, stated up front. */
export function LessonGoals({ goals, before }: LessonGoalsProps) {
  return (
    <section className={styles.goals}>
      <div className={styles.title}>After this lesson you can</div>
      <ul className={styles.list}>
        {goals.map((goal, i) => (
          <li key={i}>{goal}</li>
        ))}
      </ul>
      {before && <div className={styles.before}>Helps to know first: {before}</div>}
    </section>
  )
}

/** A few lines to remember, at the end of a lesson. */
export function Recap({ points }: { points: readonly ReactNode[] }) {
  return (
    <section className={styles.recap}>
      <div className={styles.title}>Remember</div>
      <ul className={styles.list}>
        {points.map((point, i) => (
          <li key={i}>{point}</li>
        ))}
      </ul>
    </section>
  )
}
