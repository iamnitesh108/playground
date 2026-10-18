import { cx } from '@/shared/utils/cx'
import type { KafkaCluster } from '../../simulation'
import { hue, type Hue } from '@/shared/figures'
import { groupHue, keyHue, type Flight } from './useKafkaStage'
import { layoutOf, STAGE_WIDTH, VISIBLE_CELLS } from './layout'
import styles from './KafkaStage.module.css'

interface KafkaStageProps {
  cluster: KafkaCluster
  flights: readonly Flight[]
  now: number
  /** Name of the producer shown on the left. */
  producer?: string
}

const short = (memberId: string) => memberId.split('-').pop()!
/** Groups are told apart by line pattern and label, never by colour alone. */
const DASH = ['', '6 4', '2 4']
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

/** An animated picture of one topic: a producer, partitions as logs, and every consumer group reading them. */
export function KafkaStage({ cluster, flights, now, producer = 'producer' }: KafkaStageProps) {
  const L = layoutOf(cluster)
  const { topic, groups } = cluster

  return (
    <div className={styles.scroll}>
    <svg viewBox={`0 0 ${STAGE_WIDTH} ${L.height}`} className={styles.stage} role="img" aria-label={`Topic ${topic.name} with ${topic.partitionCount} partitions and ${groups.length} consumer groups`}>
      <defs>
        <marker id="kstage-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L8,4 L0,8 z" className={styles.arrowHead} />
        </marker>
      </defs>

      {/* producer */}
      <g>
        <rect x={L.producer.x} y={L.producer.y} width={L.producer.w} height={L.producer.h} rx={8} className={styles.producer} style={hue(7)} />
        <text x={L.producer.x + L.producer.w / 2} y={L.producer.y + 19} className={styles.boxTitle}>{producer}</text>
        <text x={L.producer.x + L.producer.w / 2} y={L.producer.y + 34} className={styles.boxCaption}>sends records</text>
        <line x1={L.producer.x + L.producer.w} y1={L.producer.y + L.producer.h / 2} x2={L.topic.x - 4} y2={L.producer.y + L.producer.h / 2} className={styles.feed} markerEnd="url(#kstage-arrow)" />
      </g>

      {/* topic and partitions */}
      <rect x={L.topic.x} y={L.topic.y} width={L.topic.w} height={L.topic.h} rx={10} className={styles.topic} style={hue(3)} />
      <text x={L.topic.x + 12} y={L.topic.y + 19} className={styles.topicName}>topic: {topic.name}</text>
      <text x={L.topic.x + L.topic.w - 10} y={L.topic.y + 19} className={styles.topicMeta}>{topic.partitionCount} partition{topic.partitionCount > 1 ? 's' : ''}</text>
      {topic.partitionIds.map((p) => {
        const y = L.partitionY(p)
        const from = L.windowStart(p)
        const records = topic.records(p).slice(from, from + VISIBLE_CELLS)
        return (
          <g key={p}>
            <text x={L.topic.x + 12} y={y + 4} className={styles.partitionLabel}>P{p}</text>
            {from > 0 && <text x={L.cellX(p, from) - 6} y={y + 4} className={styles.more}>…</text>}
            {records.map((r) => (
              <g key={r.offset} className={styles.cell} style={hue(keyHue(r.key) as Hue)}>
                <rect x={L.cellX(p, r.offset)} y={y - 12} width={L.cellWidth} height={24} rx={4} className={styles.cellBox} />
                <text x={L.cellX(p, r.offset) + L.cellWidth / 2} y={y - 0.5} className={styles.cellKey}>{r.key?.[0] ?? '·'}</text>
                <text x={L.cellX(p, r.offset) + L.cellWidth / 2} y={y + 8.5} className={styles.cellOffset}>{r.offset}</text>
                <title>{`P${p} offset ${r.offset}: key=${r.key ?? 'null'} value=${r.value}`}</title>
              </g>
            ))}
            {/* each group's committed offset: the next record it will read */}
            {groups.slice(0, 2).map((g, gi) => {
              const committed = g.committedOffset(p) ?? (g.members.length ? g.positionOf(p) : undefined)
              if (committed === undefined || committed < from) return null
              // points at the next record the group will read
              const x = L.cellX(p, committed) + L.cellWidth / 2
              const below = gi === 0
              return (
                <g key={g.id} className={styles.caret} style={{ ...hue(groupHue(gi) as Hue), transform: `translateX(${x}px)` }}>
                  <path d={below ? 'M0,15 L-4,22 L4,22 z' : 'M0,-15 L-4,-22 L4,-22 z'} transform={`translate(0 ${y})`} className={styles.caretMark} />
                  <text x={0} y={below ? y + 31 : y - 25} className={styles.caretLabel}>{g.id}</text>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* assignment lines: partition → the consumer that owns it, per group */}
      {groups.map((g, gi) =>
        topic.partitionIds.map((p) => {
          const owner = g.ownerOf(p)
          const to = owner ? L.consumer(owner) : undefined
          if (!to) return null
          const y = L.partitionY(p)
          const d = `M${L.tapeEnd},${y} C${L.tapeEnd + 34},${y} ${to.x - 40},${to.y} ${to.x - 2},${to.y}`
          return <path key={`${g.id}:${p}:${owner}:${g.generation}`} d={d} className={styles.assign} style={{ ...hue(groupHue(gi) as Hue), strokeDasharray: DASH[gi % DASH.length] || undefined }} />
        }),
      )}

      {/* groups and consumers */}
      {L.groups.map((box, gi) => {
        const g = groups[gi]
        return (
          <g key={box.id} style={hue(groupHue(gi) as Hue)}>
            <rect x={box.x} y={box.y} width={box.w} height={box.h} rx={10} className={styles.group} style={{ strokeDasharray: DASH[gi % DASH.length] || undefined }} />
            <text x={box.x + 12} y={box.y + 17} className={styles.groupName}>
              <title>{g.id}</title>
              group: {g.id.length > 16 ? `${g.id.slice(0, 8)}…${g.id.slice(-6)}` : g.id}
            </text>
            <text x={box.x + box.w - 10} y={box.y + 17} className={styles.topicMeta}>gen {g.generation}</text>
            {g.members.length === 0 && <text x={box.x + 12} y={box.y + 44} className={styles.boxCaption} style={{ textAnchor: 'start' }}>no consumers running</text>}
            {box.consumers.map((c) => {
              const owned = g.partitionsOf(c.id)
              const member = g.members.find((m) => m.id === c.id)!
              return (
                <g key={c.id} className={cx(styles.consumer, owned.length === 0 && styles.idle)}>
                  <rect x={c.x} y={c.y - 12} width={box.w - 24} height={24} rx={6} className={styles.consumerBox} />
                  <text x={c.x + 10} y={c.y + 4} className={styles.consumerName}>{short(c.id)}</text>
                  <text x={c.x + 40} y={c.y + 4} className={styles.consumerInfo}>{owned.length ? owned.map((p) => `P${p}`).join(' ') : 'idle'}</text>
                  <text x={c.x + box.w - 34} y={c.y + 4} className={styles.consumerCount}>{member.processed} read</text>
                </g>
              )
            })}
          </g>
        )
      })}

      {/* records in flight */}
      {flights.map((f) => {
        const t = ease(Math.min(1, Math.max(0, (now - f.start) / f.duration)))
        const cx1 = (f.from.x + f.to.x) / 2
        const cy1 = Math.min(f.from.y, f.to.y) - 40
        const x = (1 - t) * (1 - t) * f.from.x + 2 * (1 - t) * t * cx1 + t * t * f.to.x
        const y = (1 - t) * (1 - t) * f.from.y + 2 * (1 - t) * t * cy1 + t * t * f.to.y
        return (
          <g key={f.id} transform={`translate(${x} ${y})`} style={hue(f.hue as Hue)}>
            <circle r={9} className={f.kind === 'produce' ? styles.flightProduce : styles.flightConsume} />
            <text y={3.5} className={styles.flightLabel}>{f.label}</text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}
