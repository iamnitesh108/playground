import { useMemo, useState } from 'react'
import { useStepper } from '@/shared/hooks/useStepper'
import { Button, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { CAPTURE } from '../data/captures'
import { simulate, type ModuleKind, type Phase, type QueueName } from '../simulation/eventLoop'
import { PROGRAMS, type Program } from '../simulation/programs'
import styles from './EventLoopPlayer.module.css'

const PHASES: { id: Phase; label: string }[] = [
  { id: 'main', label: 'main script' },
  { id: 'ticks', label: 'nextTick + microtasks' },
  { id: 'timers', label: 'timers' },
  { id: 'poll', label: 'poll (I/O)' },
  { id: 'check', label: 'check' },
]

const QUEUES: { id: QueueName; label: string; note: string }[] = [
  { id: 'nextTick', label: 'nextTick queue', note: 'process.nextTick' },
  { id: 'microtask', label: 'microtask queue', note: 'promises, queueMicrotask' },
  { id: 'timers', label: 'timers', note: 'setTimeout (✓ = expired)' },
  { id: 'poll', label: 'poll', note: 'I/O callbacks' },
  { id: 'check', label: 'check', note: 'setImmediate' },
]

function Replay({ program, kind, timerDueAtStart }: { program: Program; kind: ModuleKind; timerDueAtStart: boolean }) {
  const frames = useMemo(() => simulate(program.ops, { kind, timerDueAtStart }), [program, kind, timerDueAtStart])
  const stepper = useStepper(frames.length, 900)
  const frame = frames[stepper.index]
  const recorded = CAPTURE.order[kind][program.id]
  const final = frames[frames.length - 1].output
  const matches = final.join('\n') === recorded.join('\n')

  return (
    <>
      <div className={styles.top}>
        <pre className={styles.source}>{program.source}</pre>
        <div className={styles.console}>
          <div className={styles.label}>console</div>
          {frame.output.map((line, i) => (
            <div key={i} className={cx(styles.line, i === frame.printed && styles.printed)}>
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.phases}>
        {PHASES.map((p) => (
          <span key={p.id} className={cx(styles.phase, frame.phase === p.id && styles.phaseOn)}>
            {p.label}
          </span>
        ))}
        <span className={styles.iteration}>{frame.iteration ? `loop iteration ${frame.iteration}` : 'before the loop'}</span>
      </div>

      <div className={styles.running}>
        <span className={styles.label}>call stack</span>
        <span className={cx(styles.stack, frame.running && styles.stackOn)}>{frame.running ?? 'empty'}</span>
      </div>

      <div className={styles.queues}>
        {QUEUES.map((q) => (
          <div key={q.id} className={styles.queue}>
            <div className={styles.queueHead}>
              {q.label}
              <span className={styles.note}>{q.note}</span>
            </div>
            <div className={styles.items}>
              {frame.queues[q.id].map((item, i) => (
                <span key={`${item}-${i}`} className={styles.item}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>
          {stepper.index}/{frames.length - 1}
        </span>
        {frame.action}
      </div>

      <footer className={styles.controls}>
        <div className={styles.progress}>
          <div className={styles.bar} style={{ width: `${(stepper.index / (frames.length - 1)) * 100}%` }} />
        </div>
        <div className={styles.buttons}>
          <Button size="sm" variant="ghost" onClick={stepper.reset} disabled={stepper.isFirst}>Reset</Button>
          <Button size="sm" onClick={stepper.previous} disabled={stepper.isFirst}>Back</Button>
          <Button size="sm" onClick={stepper.togglePlay}>{stepper.playing ? 'Pause' : 'Play'}</Button>
          <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>Next</Button>
        </div>
      </footer>

      {stepper.isLast && (
        <div className={cx(styles.verdict, !matches && styles.other)}>
          {matches ? (
            <>Same order as real Node.js {CAPTURE.node} printed for this program.</>
          ) : (
            <>
              In the recording, the timer race went the other way: real Node.js {CAPTURE.node} printed <code>{recorded.join(' → ')}</code>. Flip
              the “1 ms timer” switch to replay that order.
            </>
          )}
        </div>
      )}
    </>
  )
}

/** Steps through a program in the event loop: queues, phases and console output. */
export function EventLoopPlayer({ initial = 'basics' }: { initial?: Program['id'] }) {
  const [id, setId] = useState<Program['id']>(initial)
  const [kind, setKind] = useState<ModuleKind>('cjs')
  const [due, setDue] = useState(false)
  const program = PROGRAMS.find((p) => p.id === id)!

  return (
    <section className={styles.player}>
      <header className={styles.header}>
        <div className={styles.eyebrow}>Event loop · checked against Node.js {CAPTURE.node}</div>
        <h4 className={styles.title}>{program.title}</h4>
        <div className={styles.options}>
          <Segmented label="program" value={id} options={PROGRAMS.map((p) => ({ value: p.id, label: p.id }))} onChange={setId} />
          <Segmented label="file" value={kind} options={[{ value: 'cjs', label: 'CommonJS' }, { value: 'esm', label: 'ES module' }]} onChange={setKind} />
          {program.racy && (
            <Segmented label="1 ms timer at loop start" value={due ? 'due' : 'not'} options={[{ value: 'not', label: 'not expired' }, { value: 'due', label: 'expired' }]} onChange={(v) => setDue(v === 'due')} />
          )}
        </div>
      </header>
      <Replay key={`${id}-${kind}-${due}`} program={program} kind={kind} timerDueAtStart={program.racy && due} />
    </section>
  )
}
