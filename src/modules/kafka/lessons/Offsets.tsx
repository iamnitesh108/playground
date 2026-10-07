import { useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Callout, CodeBlock, Demo, Segmented, TermList } from '@/shared/ui'
import { PartitionLog } from '../components'
import { KafkaCluster, type OffsetReset } from '../simulation'
import styles from './lesson.module.css'

const GROUP = 'billing'

function createOffsetDemo() {
  const cluster = new KafkaCluster({ topic: 'orders', partitions: 1 })
  for (let i = 1; i <= 4; i++) cluster.produce(`order-${i}`, 'placed')
  cluster.addGroup(GROUP)
  cluster.addConsumer(GROUP)
  return cluster
}

function OffsetDemo() {
  const cluster = useObservable(createOffsetDemo)
  const [next, setNext] = useState(5)
  const [note, setNote] = useState('Poll a few records, commit, poll some more, then crash the consumer.')
  const group = cluster.group(GROUP)!
  const member = group.members[0]
  const end = cluster.topic.endOffset(0)
  const position = group.positionOf(0)
  const committed = group.committedOffset(0)

  const poll = () => {
    const record = member && cluster.consume(GROUP, member.id, false)
    setNote(record ? `Read offset ${record.offset}. Position moved to ${record.offset + 1}; nothing saved yet.` : 'Caught up: position equals the log-end offset.')
  }
  const commit = () => {
    if (!member) return
    cluster.commit(GROUP, member.id)
    setNote(`Committed offset ${position}: “next time, start reading at ${position}”.`)
  }
  const crash = () => {
    if (!member) return
    const lost = position - (committed ?? 0)
    cluster.crashConsumer(GROUP, member.id)
    cluster.addConsumer(GROUP)
    setNote(
      lost > 0
        ? `The consumer restarted from committed offset ${committed ?? 0}. The ${lost} record(s) it had read but not committed will be read again.`
        : 'The consumer restarted exactly where it left off, because everything it read was committed.',
    )
  }

  return (
    <Demo
      title="Position, commit, crash"
      hint="The consumer’s position lives in memory. The committed offset is saved in Kafka. Only the second survives a crash."
      controls={
        <>
          <Button size="sm" onClick={() => { cluster.produce(`order-${next}`, 'placed'); setNext(next + 1) }}>
            Produce
          </Button>
          <Button size="sm" variant="primary" onClick={poll}>
            Poll
          </Button>
          <Button size="sm" onClick={commit}>
            Commit
          </Button>
          <Button size="sm" variant="danger" onClick={crash}>
            Crash &amp; restart
          </Button>
        </>
      }
    >
      <PartitionLog
        label="orders-0"
        cells={cluster.topic.records(0)}
        readBefore={position}
        markers={[
          ...(committed !== undefined ? [{ offset: committed, label: 'committed', tone: 2 }] : []),
          { offset: position, label: 'position', tone: 0 },
        ]}
      />
      <div className={styles.grid2} style={{ marginTop: 12 }}>
        <Stat label="log-end offset" value={end} />
        <Stat label="position" value={position} />
        <Stat label="committed" value={committed ?? '—'} />
        <Stat label="lag (end − committed)" value={end - (committed ?? 0)} />
      </div>
      <div className={styles.result}>{note}</div>
    </Demo>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
    </div>
  )
}

function ResetDemo() {
  const [reset, setReset] = useState<OffsetReset>('earliest')
  const cluster = useObservable(() => {
    const c = new KafkaCluster({ topic: 'orders', partitions: 1 })
    for (let i = 0; i < 5; i++) c.produce(`order-${i}`, 'old')
    return c
  })
  const [groups, setGroups] = useState(0)

  const join = () => {
    const id = `new-group-${groups + 1}`
    cluster.addGroup(id, reset)
    cluster.addConsumer(id)
    setGroups(groups + 1)
  }

  return (
    <Demo
      title="Where does a brand-new group start?"
      hint="A new group has no committed offsets. auto.offset.reset decides. Create groups with each setting."
      controls={
        <>
          <Segmented
            label="auto.offset.reset"
            value={reset}
            onChange={setReset}
            options={[
              { value: 'earliest', label: 'earliest' },
              { value: 'latest', label: 'latest' },
            ]}
          />
          <Button size="sm" variant="primary" onClick={join}>
            Start new group
          </Button>
          <Button size="sm" onClick={() => cluster.produce('order-new', 'new')}>
            Produce
          </Button>
        </>
      }
    >
      <PartitionLog
        label="orders-0"
        cells={cluster.topic.records(0)}
        markers={cluster.groups.map((g, i) => ({ offset: g.positionOf(0), label: `${g.id} (${g.offsetReset})`, tone: i }))}
      />
      <p className={styles.demoNote}>
        <code>earliest</code> groups begin at offset 0 and see history. <code>latest</code> groups begin at the end
        and only see records produced after they joined.
      </p>
    </Demo>
  )
}

export default function Offsets() {
  return (
    <>
      <p>
        Every record in a partition has an <strong>offset</strong>: 0 for the first, 1 for the next, and so on,
        forever increasing. Offsets are per partition, so a record is uniquely identified by{' '}
        <code>(topic, partition, offset)</code> — for example <code>orders-2@1534</code>.
      </p>

      <h2>The offsets you will hear about</h2>
      <ul>
        <li>
          <strong>Log-start offset</strong> — the oldest offset still stored. It moves forward as old data is deleted.
        </li>
        <li>
          <strong>Log-end offset (LEO)</strong> — the offset the <em>next</em> record will get.
        </li>
        <li>
          <strong>High watermark</strong> — the newest offset safely copied to all in-sync replicas. Consumers can only
          read up to here (lesson 9).
        </li>
        <li>
          <strong>Position</strong> — the next offset a particular consumer will fetch. Kept in the consumer’s memory.
        </li>
        <li>
          <strong>Committed offset</strong> — the position the consumer group has <em>saved</em> to Kafka. Where it
          resumes after a restart.
        </li>
        <li>
          <strong>Lag</strong> — log-end offset minus committed offset: how far behind the group is. The single most
          important consumer health metric.
        </li>
      </ul>

      <OffsetDemo />

      <Callout tone="note" title="Committed offset = next to read">
        By convention you commit the offset of the <em>next</em> record you want, not the last one you processed.
        Having processed offset 6, you commit 7.
      </Callout>

      <h2>Where commits are stored</h2>
      <p>
        Committed offsets are themselves stored in Kafka, in an internal compacted topic called{' '}
        <code>__consumer_offsets</code>, keyed by <code>(group, topic, partition)</code>. That is why a group can
        resume on a different machine: its progress lives in the cluster, not in the consumer.
      </p>

      <h2>A group with no history</h2>
      <ResetDemo />
      <p>
        There is a third value, <code>none</code>, which throws an error instead of guessing — useful when silently
        skipping or replaying data would be a bug.
      </p>

      <h2>Rewinding on purpose</h2>
      <p>
        Because records stay in the log, you can move a group’s committed offset to replay data (after fixing a bug)
        or skip a poisoned range. The group must be stopped first:
      </p>
      <CodeBlock
        title="reset a group to the beginning"
        code={`kafka-consumer-groups.sh --bootstrap-server localhost:9092 \\
  --group billing --topic orders \\
  --reset-offsets --to-earliest --execute

# other targets: --to-latest, --to-offset 42, --shift-by -100,
#                --to-datetime 2024-01-01T00:00:00.000`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Offset', definition: 'Sequential position of a record within one partition.' },
          { term: 'Log-end offset', definition: 'The offset the next written record will receive.' },
          { term: 'Log-start offset', definition: 'The earliest offset still retained.' },
          { term: 'Position', definition: 'A consumer’s in-memory pointer to the next record to fetch.' },
          { term: 'Committed offset', definition: 'Saved progress of a group for a partition; survives restarts.' },
          { term: 'Lag', definition: 'Records written but not yet committed by a group.' },
          { term: '__consumer_offsets', definition: 'Internal topic where committed offsets are stored.' },
          { term: 'auto.offset.reset', definition: 'Where to start when a group has no committed offset: earliest, latest or none.' },
        ]}
      />
    </>
  )
}
