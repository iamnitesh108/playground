import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Button } from '@/shared/ui'
import { FrequencySketch } from '../simulation/evictionSketch'
import styles from './EvictionSketch.module.css'

const KEYS = [
  { name: 'product:7', id: 7 },
  { name: 'product:42', id: 42 },
  { name: 'user:3', id: 1003 },
  { name: 'cart:9', id: 2009 },
]

/**
 * A Count-Min sketch small enough to see: 4 rows of 16 four-bit counters (the model in simulation/evictionSketch).
 * Each request bumps one counter per row; a key’s estimate is the smallest of its four.
 */
export function EvictionSketch() {
  // the sketch is mutated in click handlers; `redraw` re-renders after each change
  const [s] = useState(() => new FrequencySketch(16))
  const [, redraw] = useState(0)
  const [selected, setSelected] = useState(KEYS[0])
  const [log, setLog] = useState<string[]>([])
  const bump = (fn: () => void, line: string) => {
    fn()
    setLog((l) => [line, ...l].slice(0, 4))
    redraw((n) => n + 1)
  }
  const cells = s.cellsOf(selected.id)
  const estimate = s.frequency(selected.id)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>A Count-Min sketch you can poke: 4 rows × 16 counters of 4 bits</figcaption>
      <div className={styles.controls}>
        {KEYS.map((k) => (
          <Button key={k.id} size="sm" variant={k.id === selected.id ? 'primary' : 'default'} onClick={() => { setSelected(k); bump(() => s.increment(k.id), `request ${k.name}`) }}>
            request {k.name}
          </Button>
        ))}
        <Button size="sm" onClick={() => bump(() => { for (let i = 0; i < 40; i++) s.increment(5000 + Math.floor(Math.random() * 400)) }, '40 requests for random other keys')}>
          +40 other keys
        </Button>
        <Button size="sm" onClick={() => bump(() => s.age(), 'aging: every counter halved')}>age (halve)</Button>
      </div>
      <div className={styles.grid} role="img" aria-label={`sketch counters; ${selected.name} maps to counters ${cells.map((c) => c.value).join(', ')}, estimate ${estimate}`}>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className={styles.row}>
            <span className={styles.rowLabel}>row {row + 1}</span>
            {s.row(row).map((v, col) => {
              const mine = cells[row].col === col
              const isMin = mine && v === estimate
              return (
                <span key={col} className={styles.cell} data-mine={mine || undefined} style={hue(mine ? 7 : 3)} title={`row ${row + 1}, counter ${col}: ${v}`}>
                  <span className={styles.fill} style={{ height: `${(v / 15) * 100}%` }} />
                  <span className={styles.value}>{v}</span>
                  {isMin && <span className={styles.min}>min</span>}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <div className={styles.readout}>
        <span>
          <strong>{selected.name}</strong> hashes to counters {cells.map((c) => c.value).join(' · ')} → estimated frequency{' '}
          <strong style={hue(7)} className={styles.estimate}>{estimate}</strong> (the smallest; collisions only ever add)
        </span>
        <span className={styles.muted}>
          {s.additions} increments since the last halving · halves automatically after {s.sampleSize} · halved {s.resets}×
        </span>
      </div>
      {log.length > 0 && <ol className={styles.log}>{log.map((l, i) => <li key={i}>{l}</li>)}</ol>}
    </figure>
  )
}
