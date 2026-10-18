import { useEffect, useState } from 'react'
import { hue, StatTiles } from '@/shared/figures'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { access, createPool, MAX_USAGE, type Pool } from '../simulation/architectureClock'
import styles from './ArchitectureBufferCache.module.css'

const SIZE = 8
const PAGES = Array.from({ length: 14 }, (_, i) => `p${i + 1}`)
const WORKLOADS: { label: string; pages: string[] }[] = [
  { label: 'hot pages p1–p3, five times', pages: Array.from({ length: 5 }, () => ['p1', 'p2', 'p3']).flat() },
  { label: 'one-off scan p4–p14', pages: PAGES.slice(3) },
  { label: 'hot pages again', pages: ['p1', 'p2', 'p3'] },
]

/** Eight shared buffers, a clock hand and usage counts: click pages to read them. */
export function ArchitectureBufferCache() {
  const reduced = useReducedMotion()
  const [pool, setPool] = useState<Pool>(() => createPool(SIZE))
  const [queue, setQueue] = useState<string[]>([])

  useEffect(() => {
    if (!queue.length) return
    const id = window.setTimeout(() => {
      setPool((p) => access(p, queue[0]))
      setQueue((q) => q.slice(1))
    }, 450)
    return () => window.clearTimeout(id)
  }, [queue])
  // with reduced motion a workload is applied at once instead of page by page
  const enqueue = (pages: readonly string[]) => (reduced ? setPool((p) => pages.reduce(access, p)) : setQueue((q) => [...q, ...pages]))

  const last = pool.last
  const total = pool.hits + pool.reads
  return (
    <Demo
      title="Shared buffers with a clock sweep"
      hint="Eight buffers (a real server has 16,384 of them at the default 128 MB). Read pages one by one or run a workload. A hit raises the buffer's usage count; a miss sends the clock hand round, lowering counts until it finds a 0 to evict."
      controls={
        <>
          {WORKLOADS.map((w) => (
            <Button key={w.label} size="sm" onClick={() => enqueue(w.pages)} disabled={queue.length > 0}>
              {w.label}
            </Button>
          ))}
          <Button size="sm" onClick={() => { setQueue([]); setPool(createPool(SIZE)) }}>Reset</Button>
        </>
      }
    >
      <div className={styles.pages} role="group" aria-label="read a page">
        {PAGES.map((p) => (
          <button key={p} type="button" className={styles.page} onClick={() => setPool((s) => access(s, p))} disabled={queue.length > 0}>
            {p}
          </button>
        ))}
      </div>
      <ol className={styles.buffers}>
        {pool.buffers.map((b, i) => {
          const isLast = last?.slot === i
          return (
            <li
              key={i}
              className={cx(styles.buffer, isLast && styles.touched, last?.swept.includes(i) && styles.swept)}
              style={hue(b.page ? (isLast ? (last.hit ? 6 : 4) : 3) : undefined)}
            >
              <span className={styles.slot}>buffer {i}</span>
              <span className={styles.content}>{b.page ?? 'empty'}</span>
              <span className={styles.usage} aria-label={`usage count ${b.usage}`}>
                {Array.from({ length: MAX_USAGE }, (_, k) => (
                  <span key={k} className={cx(styles.pip, k < b.usage && styles.on)} />
                ))}
                <span className={styles.count}>usage {b.usage}</span>
              </span>
              {pool.hand === i && <span className={styles.hand}>▲ clock hand</span>}
            </li>
          )
        })}
      </ol>
      <p className={styles.log} aria-live="polite">
        {!last && 'All buffers are empty. Read a page.'}
        {last?.hit && <>Read <strong>{last.page}</strong>: <strong>hit</strong> in buffer {last.slot}, its usage count goes up (at most {MAX_USAGE}).</>}
        {last && !last.hit && !last.evicted && <>Read <strong>{last.page}</strong>: <strong>miss</strong>. A free buffer ({last.slot}) is filled from disk.</>}
        {last && !last.hit && last.evicted && (
          <>
            Read <strong>{last.page}</strong>: <strong>miss</strong>.{' '}
            {last.swept.length ? `The hand lowered buffers ${last.swept.join(', ')} on its way, then ` : 'The hand '}
            found buffer {last.slot} at usage 0 and evicted <strong>{last.evicted}</strong>.
          </>
        )}
      </p>
      <StatTiles
        stats={[
          { label: 'hits (from memory)', value: pool.hits, hue: 6, bar: { value: pool.hits, max: Math.max(1, total) } },
          { label: 'reads (from disk)', value: pool.reads, hue: 4, bar: { value: pool.reads, max: Math.max(1, total) } },
          { label: 'hit ratio', value: total ? `${Math.round((pool.hits / total) * 100)} %` : '–', sub: `${pool.evictions} evictions`, hue: 3 },
        ]}
      />
    </Demo>
  )
}
