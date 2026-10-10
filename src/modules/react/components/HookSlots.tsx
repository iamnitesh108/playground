import { cx } from '@/shared/utils/cx'
import styles from './HookSlots.module.css'

export interface HookSlot {
  previous: string | null
  next: string | null
  /** ok: same hook; silent: same hook type but different meaning; detected: React sees a different type. */
  verdict: 'ok' | 'silent' | 'detected'
  note?: string
}

/** Two renders' hook calls side by side, matched by position, as React matches them. */
export function HookSlots({ slots }: { slots: readonly HookSlot[] }) {
  return (
    <div className={styles.slots}>
      <div className={styles.head}>slot</div>
      <div className={styles.head}>previous render</div>
      <div className={styles.head}>next render</div>
      {slots.map((s, i) => [
        <div key={`n${i}`} className={styles.index}>{i + 1}</div>,
        <div key={`p${i}`} className={styles.cell}>{s.previous ?? '—'}</div>,
        <div key={`x${i}`} className={cx(styles.cell, s.verdict !== 'ok' && styles[s.verdict])} style={{ animationDelay: `${i * 0.35}s` }}>
          {s.next ?? '—'}
          {s.note && <span className={styles.flag}>{s.note}</span>}
        </div>,
      ])}
    </div>
  )
}
