import { useState } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './CliSession.module.css'
import { Highlighted } from '@/shared/code'

export interface CliStep {
  readonly who?: string
  readonly cmd?: string
  readonly out?: string
  readonly note?: string
  readonly shell?: boolean
}

interface CliSessionProps {
  steps: readonly CliStep[]
  title?: string
  /** Shown before commands without a `who`. */
  prompt?: string
  /** Prompt per connection label, e.g. { A: 'A>' }; defaults to "<who>>". */
  prompts?: Readonly<Record<string, string>>
}

const isError = (out: string) => out.startsWith('(error)') || /^\d+\) \(error\)/.test(out)

/** A recorded redis-cli session: one or several connections, replies exactly as redis-cli printed them. */
export function CliSession({ steps, title = 'recorded redis-cli session', prompt = '127.0.0.1:6379>', prompts }: CliSessionProps) {
  const [copied, setCopied] = useState(false)
  const people = [...new Set(steps.map((s) => s.who).filter(Boolean))] as string[]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(steps.filter((s) => s.cmd && !s.cmd.startsWith('(')).map((s) => s.cmd).join('\n'))
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
        {people.length > 1 && (
          <span className={styles.people}>
            {people.map((p) => (
              <span key={p} className={styles.who} data-index={people.indexOf(p) % 4}>
                {p}
              </span>
            ))}
          </span>
        )}
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy commands'}
        </button>
      </figcaption>
      <div className={styles.body}>
        {steps.map((s, i) => {
          if (s.note) return <div key={i} className={styles.note}>{s.note}</div>
          const lead = s.shell ? '$' : s.who ? (prompts?.[s.who] ?? `${s.who}>`) : prompt
          const event = s.cmd?.startsWith('(')
          return (
            <div key={i} className={cx(styles.step, people.length > 1 && styles.lane)} data-index={s.who ? people.indexOf(s.who) % 4 : undefined}>
              <div className={cx(styles.cmd, event && styles.event)}>
                <span className={styles.prompt}>{lead}</span> {event ? s.cmd : <Highlighted code={s.cmd ?? ''} language={s.shell ? 'bash' : 'redis'} />}
              </div>
              {s.out !== undefined && s.out !== '' && <pre className={cx(styles.out, isError(s.out) && styles.error, s.out.startsWith('(blocked') && styles.blocked)}><Highlighted language="output" code={s.out} /></pre>}
            </div>
          )
        })}
      </div>
    </figure>
  )
}
