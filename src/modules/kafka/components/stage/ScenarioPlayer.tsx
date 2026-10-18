import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/shared/ui'
import { KafkaStage } from './KafkaStage'
import { useKafkaStage, type StageAction, type StageOptions } from './useKafkaStage'
import styles from './ScenarioPlayer.module.css'
import { Highlighted } from '@/shared/code'

export interface ScenarioStep {
  title: string
  body: ReactNode
  /** What happens in this step; played one after another, a little apart. */
  actions: readonly StageAction[]
  /** Text of the command(s) that do the same against a real cluster. */
  command?: string
}

interface ScenarioPlayerProps {
  title: string
  setup: StageOptions
  steps: readonly ScenarioStep[]
  producer?: string
}

const GAP_MS = 420

/**
 * A narrated, animated scenario. Next plays the step's actions with animation; Back rebuilds the
 * state instantly by replaying every earlier step without animation.
 */
export function ScenarioPlayer({ title, setup, steps, producer }: ScenarioPlayerProps) {
  const stage = useKafkaStage(setup)
  const [index, setIndex] = useState(-1)
  const [busy, setBusy] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const play = (i: number) => {
    const actions = steps[i].actions
    setBusy(true)
    actions.forEach((a, n) => {
      timers.current.push(window.setTimeout(() => {
        stage.apply(a, true)
        if (n === actions.length - 1) timers.current.push(window.setTimeout(() => setBusy(false), 700))
      }, n * GAP_MS))
    })
    if (actions.length === 0) setBusy(false)
    setIndex(i)
  }

  const jump = (i: number) => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
    stage.reset()
    for (let s = 0; s <= i; s++) for (const a of steps[s].actions) stage.apply(a, false)
    setBusy(false)
    setIndex(i)
  }

  const step = index >= 0 ? steps[index] : null
  return (
    <section className={styles.player}>
      <header className={styles.head}>
        <div>
          <div className={styles.eyebrow}>Animated walkthrough</div>
          <h4 className={styles.title}>{title}</h4>
        </div>
        <div className={styles.buttons}>
          <Button size="sm" variant="ghost" disabled={index < 0} onClick={() => jump(-1)}>Restart</Button>
          <Button size="sm" disabled={index < 0} onClick={() => jump(index - 1)}>Back</Button>
          <Button size="sm" variant="primary" disabled={busy || index >= steps.length - 1} onClick={() => play(index + 1)}>
            {index < 0 ? 'Start' : 'Next'}
          </Button>
        </div>
      </header>
      <ol className={styles.dots} aria-label="steps">
        {steps.map((s, i) => (
          <li key={s.title}>
            <button type="button" className={i === index ? styles.dotOn : i < index ? styles.dotDone : styles.dot} onClick={() => jump(i)} title={s.title} aria-label={`step ${i + 1}: ${s.title}`} />
          </li>
        ))}
      </ol>
      <KafkaStage cluster={stage.cluster} flights={stage.flights} now={stage.now} producer={producer} />
      <div className={styles.narration} aria-live="polite">
        {step ? (
          <>
            <div className={styles.stepTitle}>{index + 1}. {step.title}</div>
            <div className={styles.stepBody}>{step.body}</div>
            {step.command && <pre className={styles.command}><Highlighted language="bash" code={step.command} /></pre>}
          </>
        ) : (
          <div className={styles.stepBody}>Press <strong>Start</strong> to play the scenario step by step.</div>
        )}
      </div>
    </section>
  )
}
