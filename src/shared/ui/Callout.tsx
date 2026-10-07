import type { ReactNode } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Callout.module.css'

type Tone = 'note' | 'tip' | 'warn' | 'analogy'

const LABELS: Record<Tone, string> = {
  note: 'Note',
  tip: 'Tip',
  warn: 'Watch out',
  analogy: 'Analogy',
}

interface CalloutProps {
  tone?: Tone
  title?: string
  children: ReactNode
}

export function Callout({ tone = 'note', title, children }: CalloutProps) {
  return (
    <aside className={cx(styles.callout, styles[tone])}>
      <div className={styles.label}>{title ?? LABELS[tone]}</div>
      <div className={styles.body}>{children}</div>
    </aside>
  )
}
