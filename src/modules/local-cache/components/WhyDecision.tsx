import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, Demo } from '@/shared/ui'
import { walk, VERDICTS } from '../simulation/whyDecision'
import styles from './WhyFigures.module.css'

/** "Should this be in a local cache?" — answer yes or no until a verdict is reached. */
export function WhyDecision() {
  const [answers, setAnswers] = useState<boolean[]>([])
  const { asked, verdict } = walk(answers)
  const answer = (yes: boolean) => setAnswers([...answers, yes])
  return (
    <Demo title="Should this be in a local cache?" hint="Think of one piece of data from your own system and answer for it. Every answer is shown; go back to change one.">
      <ol className={styles.path}>
        {asked.map((q, i) => (
          <li key={q.id} className={styles.step}>
            <div className={styles.question}>{i + 1}. {q.text}</div>
            <div className={styles.hint}>{q.hint}</div>
            {i < answers.length ? (
              <div className={styles.answer}>answered: {answers[i] ? 'yes' : 'no'}</div>
            ) : (
              <div className={styles.buttons}>
                <Button onClick={() => answer(true)}>Yes</Button>
                <Button onClick={() => answer(false)}>No</Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {verdict && (
        <div className={styles.verdict} style={hue(VERDICTS[verdict].hue)} aria-live="polite">
          <div className={styles.verdictTitle}><span className={styles.verdictTag}>verdict</span>{VERDICTS[verdict].title}</div>
          <div>{VERDICTS[verdict].body}</div>
        </div>
      )}
      <div className={styles.buttons}>
        <Button onClick={() => setAnswers(answers.slice(0, -1))} disabled={!answers.length}>Back</Button>
        <Button onClick={() => setAnswers([])} disabled={!answers.length}>Start again</Button>
      </div>
    </Demo>
  )
}
