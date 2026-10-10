import { useStepper } from '@/shared/hooks/useStepper'
import { Button } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import styles from './EffectsTimeline.module.css'

type Lane = 'render' | 'layout' | 'effect'

const LANES: { id: Lane; title: string; note: string }[] = [
  { id: 'render', title: 'render', note: 'call components, compute JSX' },
  { id: 'layout', title: 'commit: DOM + layout effects', note: 'before the browser paints' },
  { id: 'effect', title: 'effects', note: 'after paint' },
]

const laneOf = (line: string): Lane => {
  const t = line.trim()
  if (t.startsWith('render')) return 'render'
  if (t.startsWith('layout')) return 'layout'
  return 'effect'
}

/** Steps through a recorded effect log, placing each line in its phase. */
export function EffectsTimeline({ title, lines }: { title: string; lines: readonly string[] }) {
  const stepper = useStepper(lines.length + 1, 900)
  const shown = lines.slice(0, stepper.index)
  return (
    <section className={styles.timeline}>
      <div className={styles.head}>
        <span className={styles.title}>{title}</span>
        <span className={styles.buttons}>
          <Button size="sm" variant="ghost" onClick={stepper.reset} disabled={stepper.isFirst}>Reset</Button>
          <Button size="sm" onClick={stepper.togglePlay}>{stepper.playing ? 'Pause' : 'Play'}</Button>
          <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>Next</Button>
        </span>
      </div>
      <div className={styles.lanes}>
        {LANES.map((lane) => (
          <div key={lane.id} className={styles.lane}>
            <div className={styles.laneHead}>
              {lane.title}
              <span className={styles.note}>{lane.note}</span>
            </div>
            {shown.map((line, i) =>
              laneOf(line) === lane.id ? (
                <div key={i} className={cx(styles.item, i === shown.length - 1 && styles.latest, line.includes('cleanup') && styles.cleanup)}>
                  <span className={styles.n}>{i + 1}</span>
                  {line.trim()}
                </div>
              ) : null,
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
