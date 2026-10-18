import { useEffect, useState } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { Button } from '../ui/Button'
import { hue, type Hue } from './palette'
import styles from './Timeline.module.css'

export interface TimelineLane {
  id: string
  label: string
}

export interface TimelineSegment {
  lane: string
  from: number
  to: number
  label?: string
  hue?: Hue
  /** Striped: something unwanted (a pause, an outage). */
  striped?: boolean
}

export interface TimelineEvent {
  lane: string
  at: number
  label: string
  hue?: Hue
}

interface TimelineProps {
  title: string
  lanes: readonly TimelineLane[]
  segments?: readonly TimelineSegment[]
  events?: readonly TimelineEvent[]
  start?: number
  end: number
  unit?: string
  /** Show a playhead that sweeps from start to end. */
  playable?: boolean
}

/** Lanes over time: who does what, when — with an optional playhead. */
export function Timeline({ title, lanes, segments = [], events = [], start = 0, end, unit = 'ms', playable = false }: TimelineProps) {
  const reduced = useReducedMotion()
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    if (t === null || reduced) return
    if (t >= end) return
    const id = window.setTimeout(() => setT(Math.min(end, t + (end - start) / 60)), 50)
    return () => window.clearTimeout(id)
  }, [t, end, start, reduced])
  const pos = (v: number) => ((v - start) / (end - start)) * 100
  const visible = (at: number) => t === null || at <= t
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{title}</span>
        {playable && <Button size="sm" onClick={() => setT(reduced ? end : start)}>{t === null ? 'Play' : 'Replay'}</Button>}
      </figcaption>
      <div className={styles.grid}>
        {lanes.map((l) => (
          <div key={l.id} className={styles.lane}>
            <span className={styles.laneLabel}>{l.label}</span>
            <span className={styles.track}>
              {segments.filter((s) => s.lane === l.id).map((s, i) => (
                <span
                  key={i}
                  className={s.striped ? styles.striped : styles.segment}
                  style={{ ...hue(s.hue ?? 1), left: `${pos(s.from)}%`, width: `${Math.max(0.5, pos(t === null ? s.to : Math.min(s.to, Math.max(s.from, t))) - pos(s.from))}%` }}
                  title={s.label}
                >
                  {s.label && <span className={styles.segLabel}>{s.label}</span>}
                </span>
              ))}
              {events.filter((e) => e.lane === l.id && visible(e.at)).map((e, i) => (
                <span key={i} className={styles.event} style={{ ...hue(e.hue ?? 2), left: `${pos(e.at)}%` }}>
                  <span className={styles.dot} />
                  <span className={styles.eventLabel}>{e.label}</span>
                </span>
              ))}
              {t !== null && <span className={styles.playhead} style={{ left: `${pos(t)}%` }} />}
            </span>
          </div>
        ))}
        <div className={styles.axis}>
          <span>{start.toLocaleString()} {unit}</span>
          <span>{Math.round((start + end) / 2).toLocaleString()} {unit}</span>
          <span>{end.toLocaleString()} {unit}</span>
        </div>
      </div>
    </figure>
  )
}
