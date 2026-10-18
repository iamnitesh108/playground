import { useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { fixedWindow, slidingLog, tokenBucket } from '../simulation/rateLimit'
import styles from './play.module.css'

const PATTERNS = {
  boundary: { label: 'burst at a window edge', times: [100, 200, 300, 400, 500, 800, 850, 900, 950, 990, 1010, 1050, 1100, 1150, 1200, 1300] },
  steady: { label: 'steady, 1 every 150 ms', times: Array.from({ length: 16 }, (_, i) => i * 150) },
  burst: { label: 'one burst', times: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 1500, 1510, 1520, 1530] },
} as const

/** Limit: 5 requests per 1000 ms. Three algorithms, the same requests. */
export function RateLimitPlayground() {
  const [p, setP] = useState<keyof typeof PATTERNS>('boundary')
  const times = PATTERNS[p].times
  const algos = [
    { name: 'fixed window (INCR + EXPIRE)', d: fixedWindow(times, 1000, 5) },
    { name: 'sliding log (sorted set)', d: slidingLog(times, 1000, 5) },
    { name: 'token bucket (5, refill 5/s)', d: tokenBucket(times, 5, 5) },
  ]
  // the most requests any algorithm let through in any 1000 ms span
  const worstWindow = (d: ReturnType<typeof fixedWindow>) => Math.max(...d.map((x) => d.filter((y) => y.allowed && y.at >= x.at && y.at < x.at + 1000).length))
  return (
    <Demo
      title="Three rate limiters, 5 requests per second"
      hint="Each square is a request; filled = allowed. The fixed window resets at 1000 ms, so a burst on both sides of the edge gets twice the limit through."
      controls={<Segmented label="traffic" value={p} options={Object.entries(PATTERNS).map(([value, v]) => ({ value: value as keyof typeof PATTERNS, label: v.label }))} onChange={setP} />}
    >
      {algos.map((a) => (
        <div key={a.name}>
          <div className={styles.label}>{a.name} — at most {worstWindow(a.d)} in any 1 s</div>
          <div className={styles.cells}>
            {a.d.map((x) => (
              <span key={x.at} className={cx(styles.cell, x.allowed ? styles.cellOn : styles.cellBad)} title={`${x.at} ms: ${x.allowed ? 'allowed' : 'rejected'}`}>
                {x.at}
              </span>
            ))}
          </div>
        </div>
      ))}
    </Demo>
  )
}
