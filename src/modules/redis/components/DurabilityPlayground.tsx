import { useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { survivors, type Crash, type Setting } from '../simulation/durability'
import { Slider } from './Slider'
import styles from './play.module.css'

const SETTINGS: { value: Setting; label: string }[] = [
  { value: 'none', label: 'none' },
  { value: 'rdb', label: 'RDB snapshots' },
  { value: 'aof-no', label: 'AOF, fsync no' },
  { value: 'aof-everysec', label: 'AOF, everysec' },
  { value: 'aof-always', label: 'AOF, always' },
]

/** 1,000 writes per second; the server dies at some point. What comes back after a restart? */
export function DurabilityPlayground() {
  const [setting, setSetting] = useState<Setting>('aof-everysec')
  const [crash, setCrash] = useState<Crash>('process')
  const [at, setAt] = useState(127.4)
  const [every, setEvery] = useState(60)
  const r = survivors({ setting, crash, snapshotEvery: every, kernelFlushEvery: 30, writesPerSecond: 1000, crashAt: at })
  const lost = r.acknowledged - r.survived
  return (
    <Demo
      title="What a crash keeps"
      hint="A process crash (kill -9, out of memory) keeps what Redis already handed to the kernel — normally every acknowledged write (with everysec on a disk too slow to keep up, up to 2 s may still be waiting). A power loss or kernel panic keeps only what was fsync'd to disk."
      controls={
        <>
          <Segmented label="persistence" value={setting} options={SETTINGS} onChange={setSetting} />
          <Segmented label="crash" value={crash} options={[{ value: 'process', label: 'process (kill -9)' }, { value: 'power', label: 'power / kernel' }]} onChange={setCrash} />
          <Slider label="crash at" value={at} min={1} max={300} step={0.1} format={(v) => `${v.toFixed(1)} s`} onChange={setAt} />
          {setting === 'rdb' && <Slider label="snapshot every" value={every} min={10} max={300} step={10} format={(v) => `${v} s`} onChange={setEvery} />}
        </>
      }
    >
      <div className={styles.label}>Acknowledged writes, 0 → {at.toFixed(1)} s</div>
      <div className={styles.track}>
        <span className={styles.segment} style={{ left: 0, width: `${(r.safeUntil / at) * 100}%` }} title="survives" />
        {lost > 0 && <span className={styles.segmentSlow} style={{ left: `${(r.safeUntil / at) * 100}%`, width: `${(r.lostSeconds / at) * 100}%` }} title="lost" />}
      </div>
      <dl className={styles.stats}>
        <div><dt>acknowledged</dt><dd>{r.acknowledged.toLocaleString()}</dd></div>
        <div className={styles.good}><dt>back after restart</dt><dd>{r.survived.toLocaleString()}</dd></div>
        <div className={lost ? styles.bad : undefined}><dt>lost</dt><dd>{lost.toLocaleString()} ({r.lostSeconds.toFixed(1)} s)</dd></div>
      </dl>
    </Demo>
  )
}
