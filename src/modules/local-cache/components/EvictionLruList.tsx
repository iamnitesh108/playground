import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Button } from '@/shared/ui'
import styles from './EvictionLruList.module.css'

export interface OrderStep {
  step: number
  key: string
  hit: boolean
  evicted: readonly string[]
  contents: readonly string[]
}

interface Props {
  requests: readonly string[]
  max: number
  /** Recorded steps; lru-cache lists its keys most recent first. */
  lruCache: readonly OrderStep[]
  caffeine: readonly OrderStep[]
  moka: readonly OrderStep[]
}

/**
 * The recorded run of a few requests: lru-cache's recency list drawn as the doubly linked list it is, and, for the
 * same request, what Caffeine and moka kept and threw out.
 */
export function EvictionLruList({ requests, max, lruCache, caffeine, moka }: Props) {
  const [i, setI] = useState(0)
  const lru = lruCache[i]
  // drawn least recent (head, next to be evicted) on the left, most recent (tail) on the right
  const list = [...lru.contents].reverse()
  const others = [
    { name: 'Caffeine', step: caffeine[i] },
    { name: 'moka', step: moka[i] },
  ]
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Recorded: the same {requests.length} requests into a cache of {max} entries</figcaption>
      <ol className={styles.requests} aria-label="requests">
        {requests.map((k, n) => (
          <li key={n} className={n === i ? styles.current : n < i ? styles.done : undefined}>
            <button type="button" onClick={() => setI(n)} aria-label={`request ${n + 1}: ${k}`}>{k}</button>
          </li>
        ))}
      </ol>
      <div className={styles.status}>
        Request {i + 1}: <code>get({lru.key})</code> in lru-cache →{' '}
        <strong style={hue(lru.hit ? 6 : 8)} className={styles.verdict}>{lru.hit ? 'hit, moved to the tail' : 'miss, loaded and set at the tail'}</strong>
        {lru.evicted.length > 0 && <> · evicted <strong style={hue(8)} className={styles.verdict}>{lru.evicted.join(', ')}</strong> from the head</>}
      </div>

      <div className={styles.lane}>
        <span className={styles.laneLabel}>Map</span>
        <div className={styles.map}>
          {list.map((k) => <span key={k} className={styles.mapEntry}>{k} → node</span>)}
        </div>
      </div>
      <div className={styles.lane}>
        <span className={styles.laneLabel}>List</span>
        <div className={styles.list}>
          <span className={styles.end}>head<br />LRU</span>
          {lru.evicted.map((k) => (
            <span key={`x${k}`} className={styles.node} style={hue(8)} data-gone>
              {k}<small>evicted</small>
            </span>
          ))}
          {list.map((k, n) => (
            <span key={k} className={styles.pair}>
              {n > 0 && <span className={styles.link} aria-hidden="true">⇄</span>}
              <span className={styles.node} style={k === lru.key ? hue(lru.hit ? 6 : 1) : undefined}>
                {k}
                <small>{k === lru.key ? (lru.hit ? 'hit' : 'new') : 'entry'}</small>
              </span>
            </span>
          ))}
          <span className={styles.end}>tail<br />MRU</span>
        </div>
      </div>

      <div className={styles.others}>
        {others.map((o) => (
          <div key={o.name} className={styles.other}>
            <span className={styles.otherName}>{o.name}</span>
            <span style={hue(o.step.hit ? 6 : 8)} className={styles.verdict}>{o.step.hit ? 'hit' : 'miss'}</span>
            <span className={styles.keeps}>
              keeps {o.step.contents.map((k) => <span key={k} className={styles.chip} style={hue(3)}>{k}</span>)}
            </span>
            {o.step.evicted.length > 0 && (
              <span className={styles.keeps}>
                {o.step.evicted.includes(o.step.key) ? 'rejected' : 'evicted'} {o.step.evicted.map((k) => <span key={k} className={styles.chip} style={hue(8)}>{k}</span>)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className={styles.buttons}>
        <Button size="sm" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>Back</Button>
        <Button size="sm" variant="primary" onClick={() => setI(Math.min(requests.length - 1, i + 1))} disabled={i === requests.length - 1}>Next</Button>
      </div>
    </figure>
  )
}
