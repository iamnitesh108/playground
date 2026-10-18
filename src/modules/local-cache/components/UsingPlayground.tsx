import { useRef, useState } from 'react'
import { hue, StatTiles } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { apply, BoundedCache, CHECK_SCRIPT, type Op, type Removal } from '../simulation/usingCache'
import { CAUSE_HUE } from './UsingCauses'
import styles from './UsingFigures.module.css'

const KEYS = ['a', 'b', 'c', 'd', 'e', 'f'] as const
const TTL = 60_000
const SIZES = [
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
] as const

type LogLine = { text: string; removals: Removal[] }

/** Operations on a small simulated bounded cache: entries in recency order, removals with their causes. */
export function UsingPlayground({ checked }: { checked: boolean }) {
  const [max, setMax] = useState<2 | 3 | 4>(3)
  const [key, setKey] = useState<(typeof KEYS)[number]>('a')
  const [log, setLog] = useState<LogLine[]>([])
  const versions = useRef(new Map<string, number>())
  const [cache, setCache] = useState(() => new BoundedCache({ maximumSize: 3, ttl: TTL }))
  const [, setTick] = useState(0)

  const run = (steps: readonly Op[], target = cache) => {
    const lines: LogLine[] = []
    for (const step of steps) {
      const removals: Removal[] = []
      const stop = target.onRemoval((r) => removals.push(r))
      const text = apply(target, step, (k) => `db-${k}`)
      stop()
      lines.push({ text, removals })
    }
    setLog((old) => [...lines.reverse(), ...old].slice(0, 40))
    setTick((t) => t + 1)
  }
  const put = () => {
    const v = (versions.current.get(key) ?? 0) + 1
    versions.current.set(key, v)
    run([{ op: 'put', key, value: `v${v}` }])
  }
  const reset = (size: 2 | 3 | 4) => {
    const fresh = new BoundedCache({ maximumSize: size, ttl: TTL })
    versions.current.clear()
    setLog([])
    setMax(size)
    setCache(fresh)
    return fresh
  }

  const entries = cache.snapshot()
  const stats = cache.stats()
  const reads = stats.hits + stats.misses
  return (
    <Demo
      title="Operate a bounded cache"
      hint={`A simulated cache with maximum size ${max}, a ${TTL / 1000} s time to live and a fake clock. Eviction is least recently used, as in lru-cache; Caffeine and moka may choose another victim.`}
      controls={
        <>
          <Segmented label="maximum size" value={max} options={SIZES} onChange={(v) => reset(v)} />
          <Segmented label="key" value={key} options={KEYS.map((k) => ({ value: k, label: k }))} onChange={setKey} />
        </>
      }
    >
      <div className={styles.actions}>
        <Button onClick={() => run([{ op: 'get', key }])}>get({key})</Button>
        <Button onClick={put}>put({key})</Button>
        <Button onClick={() => run([{ op: 'load', key }])}>get({key}, loader)</Button>
        <Button onClick={() => run([{ op: 'invalidate', key }])}>invalidate({key})</Button>
        <Button onClick={() => run([{ op: 'invalidateAll' }])}>invalidateAll()</Button>
        <Button onClick={() => run([{ op: 'advance', ms: 30_000 }])}>clock +30 s</Button>
        <Button onClick={() => run([{ op: 'cleanUp' }])}>cleanUp()</Button>
        <Button onClick={() => reset(max)} variant="ghost">reset</Button>
      </div>

      <div className={styles.label}>entries, most recently used first <span className={styles.clock}>clock: {cache.now / 1000} s</span></div>
      <div className={styles.lane} aria-live="polite">
        {entries.map((e) => {
          const left = Math.max(0, e.expiresAt - cache.now)
          return (
            <div key={e.key} className={styles.entry}>
              <span className={styles.entryKey}>{e.key}</span>
              <span>{e.value}</span>
              <span className={styles.ttl} title={`expires in ${left / 1000} s`}><span style={{ width: `${(left / TTL) * 100}%` }} /></span>
              <span>{left > 0 ? `${left / 1000} s left` : 'expired (still held)'}</span>
            </div>
          )
        })}
        {Array.from({ length: max - entries.length }, (_, i) => <div key={`free${i}`} className={styles.slot}>free</div>)}
      </div>
      <div className={styles.ends}><span>← most recent</span><span>next to evict →</span></div>

      <StatTiles
        stats={[
          { label: 'hits', value: stats.hits, hue: 6 },
          { label: 'misses', value: stats.misses, hue: 8 },
          { label: 'loads', value: stats.loads, hue: 5 },
          { label: 'evictions (SIZE)', value: stats.evictions, hue: 8 },
          { label: 'hit ratio', value: reads ? `${Math.round((stats.hits / reads) * 100)} %` : '–', hue: 1, bar: { value: stats.hits, max: reads || 1 } },
        ]}
      />

      <div className={styles.label}>log, newest first</div>
      {log.length === 0 ? (
        <p className={styles.empty}>
          Pick a key and press a button, or{' '}
          <Button size="sm" onClick={() => run(CHECK_SCRIPT, reset(3))}>replay the checked script</Button>
          {checked ? ' — the same 16 steps run against lru-cache gave identical removals and order.' : ''}
        </p>
      ) : (
        <ul className={styles.log}>
          {log.map((line, i) => (
            <li key={log.length - i}>
              {line.text}
              {line.removals.map((r, j) => (
                <span key={j} className={styles.chip} style={{ ...hue(CAUSE_HUE[r.cause]), marginLeft: 6 }}>
                  <span className={styles.chipKey}>{r.key}={r.value}</span>
                  <span className={styles.chipCause}>{r.cause}</span>
                </span>
              ))}
            </li>
          ))}
        </ul>
      )}
    </Demo>
  )
}
