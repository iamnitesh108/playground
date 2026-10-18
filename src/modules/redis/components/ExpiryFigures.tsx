import { hue } from '@/shared/figures'
import styles from './ExpiryFigures.module.css'

interface TtlFigureProps {
  keeps: readonly { command: string; note: string }[]
  drops: readonly { command: string; note: string }[]
}

/** Commands sorted by what they do to an existing TTL. */
export function ExpiryTtlFigure({ keeps, drops }: TtlFigureProps) {
  const column = (title: string, h: 6 | 8, items: TtlFigureProps['keeps']) => (
    <div className={styles.column} style={hue(h)}>
      <div className={styles.columnTitle}>{title}</div>
      {items.map((i) => (
        <div key={i.command} className={styles.chip}>
          <code>{i.command}</code>
          <span>{i.note}</span>
        </div>
      ))}
    </div>
  )
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>A key has a TTL. Which commands keep it?</figcaption>
      <div className={styles.columns}>
        {column('TTL kept', 6, keeps)}
        {column('TTL removed', 8, drops)}
      </div>
    </figure>
  )
}
