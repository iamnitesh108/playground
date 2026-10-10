import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { BackpressureSimulator, IGNORE, RESPECT, type ProducerStrategy } from '../simulation/backpressure'
import styles from './BackpressurePlayground.module.css'

const KB = 1024
const STRATEGIES: Record<ProducerStrategy['id'], ProducerStrategy> = { ignore: IGNORE, respect: RESPECT }
const kb = (bytes: number) => `${Math.round(bytes / KB)} KiB`

/** A fast producer, a slow consumer, and the buffer between them. */
export function BackpressurePlayground() {
  const sim = useObservable(() => new BackpressureSimulator({ highWaterMark: 16 * KB, produceRate: 4 * KB, consumeRate: 1 * KB, strategy: IGNORE }))
  const [playing, setPlaying] = useState(true)
  useInterval(() => sim.step(), playing ? 120 : null)
  const { highWaterMark, strategy } = sim.options

  const max = Math.max(highWaterMark * 2, ...sim.history)
  const W = 600
  const H = 120
  const x = (i: number) => (i / 119) * W
  const y = (v: number) => H - (v / max) * H
  const points = sim.history.map((v, i) => `${x(i)},${y(v)}`).join(' ')

  return (
    <Demo
      title="Backpressure, live"
      hint="The producer writes 4 KiB per tick; the consumer takes 1 KiB per tick. Compare ignoring write()'s return value with waiting for 'drain'."
      controls={
        <>
          <Segmented label="producer" value={strategy.id} options={[{ value: 'ignore', label: 'ignore false' }, { value: 'respect', label: 'wait for drain' }]} onChange={(id) => sim.configure({ strategy: STRATEGIES[id] })} />
          <Segmented label="highWaterMark" value={highWaterMark} options={[16, 64].map((n) => ({ value: n * KB, label: `${n} KiB` }))} onChange={(v) => sim.configure({ highWaterMark: v })} />
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>{playing ? 'Pause' : 'Play'}</Button>
          <Button size="sm" variant="ghost" onClick={() => sim.reset()}>Reset</Button>
        </>
      }
    >
      <div className={styles.flow}>
        <div className={cx(styles.node, sim.waitingForDrain && strategy.id === 'respect' && styles.paused)}>
          <strong>producer</strong>
          <span>{strategy.id === 'respect' && sim.waitingForDrain ? 'paused, waiting for drain' : 'writing 4 KiB / tick'}</span>
        </div>
        <div className={styles.buffer}>
          <div className={styles.fill} style={{ width: `${Math.min(100, (sim.buffered / (highWaterMark * 2)) * 100)}%` }} data-over={sim.buffered >= highWaterMark} />
          <div className={styles.hwm} style={{ left: '50%' }}>highWaterMark</div>
          <span className={styles.bufferText}>{kb(sim.buffered)} buffered{sim.buffered > highWaterMark * 2 ? ' (off the scale)' : ''}</span>
        </div>
        <div className={styles.node}>
          <strong>consumer</strong>
          <span>takes 1 KiB / tick</span>
        </div>
      </div>

      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="buffered bytes over time">
        <line x1="0" x2={W} y1={y(highWaterMark)} y2={y(highWaterMark)} className={styles.hwmLine} />
        <polyline points={points} className={styles.line} />
      </svg>
      <div className={styles.axis}>
        <span>buffered bytes, last 120 ticks · dashed = highWaterMark</span>
        <span>scale 0 – {kb(max)}</span>
      </div>

      <dl className={styles.stats}>
        <div><dt>tick</dt><dd>{sim.tick}</dd></div>
        <div><dt>written</dt><dd>{kb(sim.written)}</dd></div>
        <div><dt>consumed</dt><dd>{kb(sim.consumed)}</dd></div>
        <div><dt>in memory now</dt><dd>{kb(sim.buffered)}</dd></div>
        <div><dt>write() returned false</dt><dd>{sim.falseReturns}×</dd></div>
        <div><dt>'drain' events</dt><dd>{sim.drains}</dd></div>
      </dl>
    </Demo>
  )
}
