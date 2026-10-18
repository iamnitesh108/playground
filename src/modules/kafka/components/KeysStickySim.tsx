import { useEffect, useState } from 'react'
import { BarChart } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { StickyPartitionerModel } from '../simulation/keysSticky'
import styles from './KeysFigures.module.css'

/* Key-less records through the built-in partitioner: one partition at a time, a batch fills, then a
   (weighted) random switch. A slow leader shows what adaptive partitioning is for. */

interface Settings {
  partitions: number
  batchRecords: number
  adaptive: boolean
  slow: boolean
}

const make = (s: Settings) => new StickyPartitionerModel({ partitions: s.partitions, batchRecords: s.batchRecords, adaptive: s.adaptive, slowPartition: s.slow ? 0 : null })

const HISTORY = 64

export function KeysStickySim() {
  const [settings, setSettings] = useState<Settings>({ partitions: 4, batchRecords: 4, adaptive: true, slow: false })
  const [model, setModel] = useState(() => make(settings))
  const [, setVersion] = useState(0)
  const [playing, setPlaying] = useState(false)

  const change = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    setModel(make(next))
    setVersion((v) => v + 1)
  }
  const send = (n: number) => {
    for (let i = 0; i < n; i++) model.send()
    setVersion((v) => v + 1)
  }

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      model.send()
      setVersion((v) => v + 1)
    }, 160)
    return () => window.clearInterval(id)
  }, [playing, model])

  const s = model.snapshot
  const history = s.history.slice(-HISTORY)
  const offset = s.history.length - history.length
  // the weights the next switch would use, from the queues as they are now (uniform when adaptive is off)
  const longest = Math.max(...s.queued) + 1
  const weights = s.queued.map((q) => (settings.adaptive ? longest - q : 1))
  const weightSum = weights.reduce((a, b) => a + b, 0)
  // alternate the shade at every partition switch so runs are visible
  let shade = 0
  const shades = history.map((p, i) => (i > 0 && p !== history[i - 1] ? ++shade : shade) % 2)

  return (
    <Demo
      title="Sticky partitioning, simulated"
      hint="Send key-less records. They stick to one partition until its batch is full, then the producer jumps to a random partition. Make P0's leader slow and compare adaptive on and off."
      controls={
        <>
          <Segmented label="partitions" value={settings.partitions} onChange={(v) => change({ partitions: v })} options={[3, 4, 6].map((n) => ({ value: n, label: String(n) }))} />
          <Segmented label="records per batch" value={settings.batchRecords} onChange={(v) => change({ batchRecords: v })} options={[4, 8].map((n) => ({ value: n, label: String(n) }))} />
          <Segmented label="adaptive" value={settings.adaptive ? 'on' : 'off'} onChange={(v) => change({ adaptive: v === 'on' })} options={[{ value: 'on', label: 'on (default)' }, { value: 'off', label: 'off' }]} />
          <Segmented label="P0 leader" value={settings.slow ? 'slow' : 'normal'} onChange={(v) => change({ slow: v === 'slow' })} options={[{ value: 'normal', label: 'normal' }, { value: 'slow', label: 'slow' }]} />
          <Button size="sm" onClick={() => send(1)}>send 1</Button>
          <Button size="sm" onClick={() => send(100)}>send 100</Button>
          <Button size="sm" onClick={() => setPlaying((p) => !p)}>{playing ? 'pause' : 'play'}</Button>
          <Button size="sm" onClick={() => change({})}>reset</Button>
        </>
      }
    >
      <div className={styles.partitions}>
        {s.open.map((open, p) => (
          <div key={p} className={styles.prow}>
            <span className={styles.pname}>
              P{p}
              {settings.slow && p === 0 && <span className={styles.tag}>slow leader</span>}
              {p === s.sticky && <span className={styles.stickyTag}>← sticky now</span>}
            </span>
            <span className={styles.lane}>
              <span className={styles.batch} title={`open batch: ${open} of ${settings.batchRecords} records`}>
                {Array.from({ length: settings.batchRecords }, (_, i) => (
                  <span key={i} className={cx(styles.slot, i < open && styles.slotFull)} />
                ))}
              </span>
              <span className={cx(styles.queue, settings.slow && p === 0 && styles.queueSlow)}>{s.queued[p]} queued</span>
              <span className={styles.tag}>next pick {Math.round((weights[p] / weightSum) * 100)}%</span>
            </span>
            <span className={styles.ptotal}>{s.total[p]} sent</span>
          </div>
        ))}
      </div>
      <div className={styles.label}>Partition of the last {history.length} records (record number on hover)</div>
      <div className={styles.history}>
        {history.length === 0 && <span className={styles.tag}>nothing sent yet</span>}
        {history.map((p, i) => (
          <span key={offset + i} className={cx(styles.cell, shades[i] === 1 && styles.cellAlt)} title={`record ${offset + i + 1} → P${p}`}>
            {p}
          </span>
        ))}
      </div>
      <BarChart title={`Records per partition after ${s.history.length} sends`} bars={s.total.map((t, p) => ({ label: `P${p}`, value: t, hue: settings.slow && p === 0 ? 8 : 3 }))} />
      <p className={styles.caption}>
        Model, not the real client: sizes are counted in records instead of bytes, and every tick each leader sends one queued batch (the slow one a
        sixth as often). The switch rule and the adaptive weights (longest queue + 1 − own queue) follow the 4.3 client’s BuiltInPartitioner.
      </p>
    </Demo>
  )
}
