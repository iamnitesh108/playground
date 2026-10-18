import { hue, type Hue } from '@/shared/figures'
import { Highlighted } from '@/shared/code'
import styles from './TieredTrace.module.css'

export interface TraceStep {
  readonly at: number
  readonly cmd: string | null
  readonly note: string
  readonly event: {
    readonly ev: string
    readonly inst: string
    readonly served?: string
    readonly ms?: number
    readonly price?: number
    readonly version?: number
  }
}

/** Colours follow the module legend: the app's own memory, the Redis server, the database (disk), stale (error). */
const LEVEL: Record<string, { label: string; hue: Hue }> = {
  L1: { label: 'L1 hit', hue: 1 },
  L2: { label: 'Redis hit', hue: 2 },
  PG: { label: 'Postgres', hue: 4 },
}
const INSTANCE_HUE: Record<string, Hue> = { A: 1, B: 5 }
const price = (cents: number) => `$${(cents / 100).toFixed(2)}`

/** For each step, whether it read a version older than the newest write before it. */
function staleFlags(steps: readonly TraceStep[]): boolean[] {
  const latest = steps.map((_, i) => Math.max(0, ...steps.slice(0, i + 1).filter((s) => s.event.ev === 'update').map((s) => s.event.version ?? 0)))
  return steps.map((s, i) => s.event.ev === 'get' && (s.event.version ?? 0) < latest[i])
}

/** A recorded run of two app instances: every read with the level that answered it, writes and invalidations. */
export function TieredTrace({ title, steps }: { title: string; steps: readonly TraceStep[] }) {
  const stale = staleFlags(steps)
  return (
    <figure className={styles.trace}>
      <figcaption className={styles.head}>{title}</figcaption>
      <div className={styles.rows}>
        {steps.map((s, i) => {
          const e = s.event
          const level = e.served ? LEVEL[e.served] : undefined
          return (
            <div key={i} className={s.cmd ? styles.row : `${styles.row} ${styles.event}`}>
              <span className={styles.time}>{s.at} ms</span>
              <span className={styles.inst} style={hue(INSTANCE_HUE[e.inst] ?? 1)}>{e.inst}</span>
              <span className={styles.cmd}>{s.cmd ? <Highlighted language="cli" code={s.cmd.slice(3)} /> : '← invalidation'}</span>
              {e.ev === 'get' && level ? (
                <span className={styles.chip} style={hue(stale[i] ? 8 : level.hue)}>{stale[i] ? `${level.label} · stale` : level.label}</span>
              ) : e.ev === 'evict' ? (
                <span className={styles.chip} style={hue(7)}>L1 dropped</span>
              ) : e.ev === 'update' ? (
                <span className={styles.chip} style={hue(4)}>{e.version ? `write v${e.version}` : 'write'}</span>
              ) : (
                <span />
              )}
              <span className={styles.ms}>{e.ms !== undefined ? `${e.ms.toFixed(e.ms < 1 ? 3 : 1)} ms` : ''}</span>
              <span className={styles.note}>
                {e.price !== undefined && <span className={styles.value}>{price(e.price)} v{e.version} · </span>}
                {s.note}
              </span>
            </div>
          )
        })}
      </div>
    </figure>
  )
}
