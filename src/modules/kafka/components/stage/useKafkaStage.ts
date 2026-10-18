import { useCallback, useEffect, useRef, useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { KafkaCluster, RangeAssignor, type OffsetReset } from '../../simulation'
import { layoutOf, type Point } from './layout'

/*
 * Drives the animated stage: a KafkaCluster model plus "flights" — records
 * travelling from the producer into a partition, and from a partition to the
 * consumer of every group that reads it. Actions are plain data, so a scenario
 * can be replayed instantly (stepping back) or animated (stepping forward).
 */

export type StageAction =
  | { type: 'produce'; key: string | null; value: string }
  | { type: 'consume' }
  | { type: 'drain' }
  | { type: 'addGroup'; group: string; offsetReset?: OffsetReset }
  | { type: 'addConsumer'; group: string }
  | { type: 'removeConsumer'; group: string; member?: string }
  | { type: 'crashConsumer'; group: string; member?: string }
  | { type: 'resetGroup'; group: string }

export interface Flight {
  id: number
  from: Point
  to: Point
  start: number
  duration: number
  label: string
  kind: 'produce' | 'consume'
  /** Palette slot: the key's colour when produced, the group's colour when consumed. */
  hue: number
}

export interface StageOptions {
  topic: string
  partitions: number
  groups?: { id: string; consumers: number; offsetReset?: OffsetReset }[]
}

const FLIGHT_MS = 650

/** Keys take palette slots 3–8, groups slots 1–2, so a colour never means both. */
/** Records are partition-log entries (c3); keys get c3–c7 so they never look like a group (c1, c2) or a failure (c8). */
export function keyHue(key: string | null): number {
  if (!key) return 3
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return 3 + (Math.abs(h) % 5)
}

export const groupHue = (index: number): number => (index % 2) + 1
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function build(o: StageOptions): KafkaCluster {
  const c = new KafkaCluster({ topic: o.topic, partitions: o.partitions })
  for (const g of o.groups ?? []) {
    c.addGroup(g.id, g.offsetReset ?? 'earliest', new RangeAssignor())
    for (let i = 0; i < g.consumers; i++) c.addConsumer(g.id)
  }
  return c
}

export function useKafkaStage(options: StageOptions) {
  const cluster = useObservable(() => build(options))
  const [flights, setFlights] = useState<Flight[]>([])
  const [now, setNow] = useState(0)
  const seq = useRef(0)
  const frame = useRef<number | null>(null)

  // animation clock: runs only while something is flying
  useEffect(() => {
    if (flights.length === 0) return
    const tick = (t: number) => {
      setNow(t)
      setFlights((fs) => fs.filter((f) => t < f.start + f.duration))
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }
  }, [flights.length])

  const fly = useCallback((items: Omit<Flight, 'id' | 'start' | 'duration'>[]) => {
    if (prefersReducedMotion() || items.length === 0) return
    const start = performance.now()
    setNow(start)
    setFlights((fs) => [...fs, ...items.map((f) => ({ ...f, id: ++seq.current, start, duration: FLIGHT_MS }))])
  }, [])

  /** One round: every consumer of every group reads at most one record. */
  const consumeRound = useCallback((animate: boolean): boolean => {
    const layout = layoutOf(cluster)
    const items: Omit<Flight, 'id' | 'start' | 'duration'>[] = []
    let progressed = false
    cluster.groups.forEach((g, gi) => {
      for (const m of g.members) {
        const r = cluster.consume(g.id, m.id)
        if (!r) continue
        progressed = true
        const to = layout.consumer(m.id)
        if (animate && to) items.push({ from: { x: layout.cellX(r.partition, r.offset) + layout.cellWidth / 2, y: layout.partitionY(r.partition) }, to, label: r.key?.[0] ?? '·', kind: 'consume', hue: groupHue(gi) })
      }
    })
    if (animate) fly(items)
    return progressed
  }, [cluster, fly])

  const apply = useCallback((action: StageAction, animate = true) => {
    switch (action.type) {
      case 'produce': {
        const r = cluster.produce(action.key, action.value)
        if (animate) {
          const layout = layoutOf(cluster)
          fly([{ from: { x: layout.producer.x + layout.producer.w, y: layout.producer.y + layout.producer.h / 2 }, to: { x: layout.cellX(r.partition, r.offset) + layout.cellWidth / 2, y: layout.partitionY(r.partition) }, label: action.key?.[0] ?? '·', kind: 'produce', hue: keyHue(action.key) }])
        }
        break
      }
      case 'consume':
        consumeRound(animate)
        break
      case 'drain':
        for (let i = 0; i < 200 && consumeRound(false); i++) { /* until nothing is left */ }
        break
      case 'addGroup':
        if (!cluster.group(action.group)) cluster.addGroup(action.group, action.offsetReset ?? 'earliest', new RangeAssignor())
        break
      case 'addConsumer':
        cluster.addConsumer(action.group)
        break
      case 'removeConsumer': {
        const g = cluster.group(action.group)
        const m = action.member ?? g?.members.at(-1)?.id
        if (g && m) cluster.removeConsumer(action.group, m)
        break
      }
      case 'resetGroup':
        cluster.group(action.group)?.resetToEarliest()
        break
      case 'crashConsumer': {
        const g = cluster.group(action.group)
        const m = action.member ?? g?.members.at(-1)?.id
        if (g && m) cluster.crashConsumer(action.group, m)
        break
      }
    }
  }, [cluster, consumeRound, fly])

  const reset = useCallback(() => {
    const fresh = build(options)
    cluster.reset(options.partitions)
    for (const g of fresh.groups) {
      cluster.addGroup(g.id, g.offsetReset, new RangeAssignor())
      for (let i = 0; i < g.members.length; i++) cluster.addConsumer(g.id)
    }
    setFlights([])
  }, [cluster, options])

  return { cluster, flights, now, apply, reset }
}
