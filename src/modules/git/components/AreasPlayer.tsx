import { useStepper } from '@/shared/hooks/useStepper'
import { Button } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { Transcript, type Step } from './Transcript'
import styles from './AreasPlayer.module.css'

export interface FileChip {
  name: string
  note: string
}

export interface AreaFrame {
  label: string
  caption: string
  working: FileChip[]
  staged: FileChip[]
  committed: FileChip[]
  steps: readonly Step[]
}

const AREAS = [
  { key: 'working', title: 'Working tree', sub: 'files on disk you edit' },
  { key: 'staged', title: 'Staging area (index)', sub: 'what the next commit will contain' },
  { key: 'committed', title: 'Repository', sub: 'commits in .git' },
] as const

/** Steps through recorded commands and shows where each change is. */
export function AreasPlayer({ frames }: { frames: readonly AreaFrame[] }) {
  const stepper = useStepper(frames.length, 3200)
  const frame = frames[stepper.index]
  return (
    <section className={styles.player}>
      <div className={styles.areas}>
        {AREAS.map((a, i) => (
          <div key={a.key} className={styles.area}>
            <div className={styles.areaHead}>
              {a.title}
              <span className={styles.sub}>{a.sub}</span>
            </div>
            {frame[a.key].length === 0 && <span className={styles.empty}>no changes</span>}
            {frame[a.key].map((f) => (
              <span key={`${f.name}-${f.note}`} className={cx(styles.chip, styles[a.key])}>
                {f.name}
                <span className={styles.note}>{f.note}</span>
              </span>
            ))}
            {i < 2 && <span className={styles.arrow} aria-hidden="true">{i === 0 ? 'git add →' : 'git commit →'}</span>}
          </div>
        ))}
      </div>
      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>
          {stepper.index + 1}/{frames.length}
        </span>
        {frame.caption}
      </div>
      <Transcript steps={frame.steps} title={`recorded — ${frame.label}`} />
      <footer className={styles.controls}>
        <div className={styles.dots}>
          {frames.map((f, k) => (
            <button key={f.label} type="button" aria-label={`Go to ${f.label}`} className={cx(styles.dot, k === stepper.index && styles.dotOn, k < stepper.index && styles.dotDone)} onClick={() => stepper.goTo(k)} />
          ))}
        </div>
        <Button size="sm" onClick={stepper.previous} disabled={stepper.isFirst}>Back</Button>
        <Button size="sm" onClick={stepper.togglePlay}>{stepper.playing ? 'Pause' : 'Play'}</Button>
        <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>Next</Button>
      </footer>
    </section>
  )
}
