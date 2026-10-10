import styles from './Timelines.module.css'

export interface PoolRun {
  pool: number
  tasks: readonly { task: number; doneMs: number }[]
}

/**
 * Recorded completion times of tasks on libuv's thread pool, drawn as lanes.
 * Start times are inferred: a task starts when a thread is free (all four are queued at 0 ms).
 */
export function ThreadPoolChart({ runs }: { runs: readonly PoolRun[] }) {
  const end = Math.max(...runs.flatMap((r) => r.tasks.map((t) => t.doneMs)))
  const scale = (ms: number) => `${(ms / end) * 100}%`
  return (
    <div className={styles.chart}>
      {runs.map((run) => {
        const free = Array.from({ length: run.pool }, () => 0)
        const lanes = [...run.tasks]
          .sort((a, b) => a.doneMs - b.doneMs)
          .map((t) => {
            const thread = free.indexOf(Math.min(...free))
            const start = free[thread]
            free[thread] = t.doneMs
            return { ...t, thread, start }
          })
        return (
          <div key={run.pool} className={styles.group}>
            <div className={styles.groupLabel}>UV_THREADPOOL_SIZE={run.pool}</div>
            {Array.from({ length: run.pool }, (_, thread) => (
              <div key={thread} className={styles.lane}>
                <span className={styles.laneLabel}>thread {thread + 1}</span>
                <div className={styles.track}>
                  {lanes.filter((l) => l.thread === thread).map((l) => (
                    <div key={l.task} className={styles.bar} style={{ left: scale(l.start), width: `calc(${scale(l.doneMs - l.start)} - 2px)` }} title={`task ${l.task}: done at ${l.doneMs} ms`}>
                      task {l.task}
                      <span className={styles.done}>{l.doneMs} ms</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      })}
      <div className={styles.axis}>
        <span>0 ms</span>
        <span>{end} ms</span>
      </div>
    </div>
  )
}

/** Recorded setInterval(100 ms) firings; a string entry marks a busy span "label start-end". */
export function TickTimeline({ title, ticks, until = 1900 }: { title: string; ticks: readonly (number | string)[]; until?: number }) {
  const pos = (ms: number) => `${(ms / until) * 100}%`
  const spans = ticks.filter((t): t is string => typeof t === 'string').map((t) => {
    const [label, range] = t.split(' ')
    const [from, to] = range.split('-').map(Number)
    return { label, from, to }
  })
  return (
    <div className={styles.ticks}>
      <div className={styles.groupLabel}>{title}</div>
      <div className={styles.tickTrack}>
        {spans.map((s) => (
          <div key={s.label} className={styles.span} data-kind={s.label} style={{ left: pos(s.from), width: pos(s.to - s.from) }}>
            {s.label === 'blocked' ? `main thread busy ${s.from}–${s.to} ms` : `worker thread busy ${s.from}–${s.to} ms`}
          </div>
        ))}
        {ticks.filter((t): t is number => typeof t === 'number').map((t) => (
          <span key={t} className={styles.tick} style={{ left: pos(t) }} title={`interval fired at ${t} ms`} />
        ))}
      </div>
      <div className={styles.axis}>
        <span>0</span>
        <span>{until} ms</span>
      </div>
    </div>
  )
}
