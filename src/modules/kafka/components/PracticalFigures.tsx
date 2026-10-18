import { Flow, hue, type Hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import type { ConsumedRecord } from './PracticalParse'
import { keyHue } from './stage/useKafkaStage'
import styles from './PracticalFigures.module.css'

/** Where everything runs in the practicals: one container with the broker, tools and the app around it. */
export interface TopologyGroup {
  name: string
  /** Who runs it, e.g. "console consumers" or "Micronaut app". */
  who: string
}

export function PracticalTopology({ topics, partitions, groups }: { topics: string; partitions: number; groups: readonly TopologyGroup[] }) {
  const consumerRows = Math.max(2, groups.length)
  return (
    <Flow
      title="Where everything runs"
      cols={4}
      rows={consumerRows}
      rowHeight={80}
      nodes={[
        { id: 'you', label: 'your terminal', sub: 'docker exec …', col: 0, row: 0, hue: 4, shape: 'actor' },
        { id: 'cli', label: 'CLI tools', sub: '/opt/kafka/bin', col: 1, row: 0, hue: 7 },
        { id: 'app', label: 'Micronaut app', sub: 'on your machine', col: 0, row: 1, hue: 7 },
        { id: 'port', label: 'port 9092', sub: '-p 9092:9092', col: 1, row: 1, hue: 4 },
        { id: 'broker', label: 'broker + controller', sub: `${partitions} partition${partitions > 1 ? 's' : ''} per topic`, col: 2, row: 0, rowSpan: consumerRows, hue: 3, shape: 'log' },
        ...groups.map((g, i) => ({ id: `g${i}`, label: g.name, sub: `group · ${g.who}`, col: 3, row: i, hue: ((i % 2) + 1) as Hue })),
      ]}
      edges={[
        { from: 'you', to: 'cli', label: 'exec', hue: 4 },
        { from: 'cli', to: 'broker', label: ':9092', flow: true, hue: 7 },
        { from: 'app', to: 'port', flow: true, hue: 7 },
        { from: 'port', to: 'broker', flow: true, hue: 4 },
        ...groups.map((_, i) => ({ from: 'broker', to: `g${i}`, flow: true, hue: ((i % 2) + 1) as Hue })),
      ]}
      caption={`Topics: ${topics}. The broker runs in a container; the command-line tools run inside it, the Micronaut app runs on your machine and reaches the broker through the published port.`}
    />
  )
}

/** Partitions drawn as logs, each recorded record as a cell coloured by its key. */
export function PracticalPartitions({ title, partitions, records }: { title: string; partitions: number; records: readonly ConsumedRecord[] }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      {Array.from({ length: partitions }, (_, p) => {
        const cells = records.filter((r) => r.partition === p).sort((a, b) => a.offset - b.offset)
        return (
          <div key={p} className={styles.log}>
            <span className={styles.partition}>P{p}</span>
            <span className={styles.cells}>
              {cells.length === 0 && <span className={styles.empty}>empty</span>}
              {cells.map((r) => (
                <span key={r.offset} className={styles.cell} style={hue(keyHue(r.key) as Hue)} title={`P${p} offset ${r.offset}: ${r.key} → ${r.value}`}>
                  <b>{r.key}</b>
                  <small>offset {r.offset}</small>
                </span>
              ))}
            </span>
          </div>
        )
      })}
      <div className={styles.note}>Same key, same colour, same partition — every time.</div>
    </figure>
  )
}

export interface AssignmentStage {
  label: string
  members: readonly { name: string; partitions: readonly number[] }[]
}

/** Small multiples: which consumer owned which partition at each recorded moment. */
export function PracticalAssignments({ title, partitions, stages, groupHue = 1 }: { title: string; partitions: number; stages: readonly AssignmentStage[]; groupHue?: Hue }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.stages}>
        {stages.map((s) => (
          <div key={s.label} className={styles.stage} style={hue(groupHue)}>
            <div className={styles.stageLabel}>{s.label}</div>
            {s.members.map((m) => (
              <div key={m.name} className={cx(styles.member, m.partitions.length === 0 && styles.idle)}>
                <span className={styles.memberName}>{m.name}</span>
                <span className={styles.owned}>
                  {m.partitions.length === 0 ? <span className={styles.idleText}>idle</span> : m.partitions.map((p) => <span key={p} className={styles.p} style={hue(3)}>P{p}</span>)}
                </span>
              </div>
            ))}
            <div className={styles.coverage}>{s.members.reduce((n, m) => n + m.partitions.length, 0)} of {partitions} partitions owned</div>
          </div>
        ))}
      </div>
    </figure>
  )
}
