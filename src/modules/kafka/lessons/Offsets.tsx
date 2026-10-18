import { useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Callout, CodeBlock, Demo, Segmented, TermList } from '@/shared/ui'
import { PartitionLog } from '../components'
import { KafkaCluster, type OffsetReset } from '../simulation'
import styles from './lesson.module.css'
import { Flow } from '@/shared/figures'
import { OffsetsTape } from '../components/OffsetsTape'
import { PRACTICALS } from '../data/practicals'

/** Rows of a recorded kafka-consumer-groups --describe: partition, committed (CURRENT-OFFSET), log-end, lag. */
const describeRows = (out: string, group: string) =>
  out
    .split('\n')
    .filter((l) => l.startsWith(group + ' '))
    .map((l) => {
      const f = l.trim().split(/\s+/)
      return { partition: Number(f[2]), committed: Number(f[3]), end: Number(f[4]), lag: Number(f[5]) }
    })
    .sort((a, b) => a.partition - b.partition)

const P3 = PRACTICALS.p3
const AWAY = describeRows(P3.whileAway.describe.out, 'analytics')
const CAUGHT_UP = describeRows(P3.caughtUp.describe.out, 'analytics')

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
          <strong>High watermark</strong> — the first offset not yet copied to every in-sync replica. Records below it
          are safe, and consumers can only read up to here (see{' '}
          <a href="#/kafka/replication">Replication and failover</a>).
        </li>
        <li>
          <strong>Position</strong> — the next offset a particular consumer will fetch. Kept in the consumer’s memory.
        </li>
        <li>
          <strong>Committed offset</strong> — the position the consumer group has <em>saved</em> to Kafka. Where it
          resumes after a restart.
        </li>
        <li>
          <strong>Lag</strong> — end offset minus committed offset: how far behind the group is. The end offset here
          is the one consumers can see, the high watermark. Lag is the single most important consumer health metric.
        </li>
      </ul>

      <OffsetsTape
        title="One partition, every pointer at once (schematic)"
        rows={[
          {
            label: 'orders-0',
            end: 12,
            start: 2,
            span: { from: 6, to: 10, label: 'lag = 10 − 6 = 4', hue: 4 },
            markers: [
              { at: 2, label: 'log-start 2', hue: 8 },
              { at: 6, label: 'committed 6', hue: 1 },
              { at: 8, label: 'position 8', hue: 1 },
              { at: 10, label: 'high watermark 10', hue: 5, above: true },
              { at: 12, label: 'log-end 12', hue: 3, above: true },
            ],
          },
        ]}
        caption="Dashed cells 0–1 were deleted by retention. The consumer has fetched up to offset 7, so its position (in memory) is 8, but its committed offset (in Kafka) is 6: after a crash it would read 6 and 7 again. Records 10 and 11 are written but not yet on every in-sync replica, so no consumer can read them and they do not count as lag yet. The dashed box on the right is where the next record goes."
      />

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
      <Flow
        title="A commit, and a restart that finds it again"
        cols={5}
        rows={2}
        nodes={[
          { id: 'c', label: 'consumer', sub: 'group billing', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'coord', label: 'coordinator', sub: 'a broker', col: 2, row: 0, hue: 5 },
          { id: 'log', label: '__consumer_offsets', sub: 'billing\'s partition', col: 3, row: 0, span: 2, hue: 3, shape: 'log' },
          { id: 'c2', label: 'new consumer', sub: 'after a restart', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'out', label: 'resumes at 7', sub: 'orders-0', col: 2, row: 1, hue: 6 },
        ]}
        edges={[
          { from: 'c', to: 'coord', label: 'commit 7', flow: true, hue: 1 },
          { from: 'coord', to: 'log', label: 'append', flow: true, hue: 5 },
          { from: 'c2', to: 'coord', label: 'OffsetFetch', hue: 1, dashed: true },
          { from: 'coord', to: 'out', label: '7', hue: 6 },
        ]}
        steps={[
          { title: 'Commit', body: <p>Having processed offset 6 of <code>orders-0</code>, the consumer commits 7 to its group’s coordinator.</p>, active: ['c', 'coord', 'c>coord'] },
          { title: 'Stored like any record', body: <p>The coordinator appends a record keyed <code>(billing, orders, 0)</code> with value 7 to the group’s <code>__consumer_offsets</code> partition — replicated like any topic. Compaction keeps only the newest value per key.</p>, active: ['coord', 'log', 'coord>log'] },
          { title: 'Crash and restart elsewhere', body: <p>The process dies. A new consumer joins billing, gets <code>orders-0</code>, and asks the coordinator for the committed offset.</p>, active: ['c2', 'coord', 'c2>coord', 'log'] },
          { title: 'Resume from 7', body: <p>It starts reading at 7. Anything the old consumer processed after its last commit is read again — never anything before it.</p>, active: ['coord', 'out', 'coord>out', 'c2'] },
        ]}
      />
      <p>
        The recording of practical 3 shows those stored offsets doing their job. Group <code>analytics</code> was stopped while three more payments
        were written; its committed offsets stayed where they were, and the lag is exactly the records written meanwhile:
      </p>
      <OffsetsTape
        title={`Recorded: group analytics while it was stopped (Kafka ${PRACTICALS.version}, topic payments)`}
        rows={AWAY.map((r) => ({
          label: `payments-${r.partition}`,
          end: r.end,
          span: r.lag > 0 ? { from: r.committed, to: r.end, label: `lag ${r.lag}`, hue: 4 as const } : undefined,
          markers: [{ at: r.committed, label: `committed ${r.committed}`, hue: 1 as const }],
        }))}
        caption={`When analytics started again it read exactly those ${AWAY.reduce((n, r) => n + r.lag, 0)} records and its committed offsets moved to ${CAUGHT_UP.map((r) => r.committed).join(', ')}: lag 0.`}
      />

      <h2>A group with no history</h2>
      <ResetDemo />
      <p>
        There is also <code>none</code>, which throws an error instead of guessing — useful when silently skipping or
        replaying data would be a bug — and, since Kafka 4.0, <code>by_duration:&lt;ISO-8601 duration&gt;</code>{' '}
        (e.g. <code>by_duration:P1D</code>) to start from the records of the last day.
      </p>

      <Callout tone="warn" title="The reset applies until the first commit">
        <code>auto.offset.reset</code> is used whenever there is no committed offset — not just once. A{' '}
        <code>latest</code> consumer that restarts before it has committed anything resets to the end again, silently
        skipping whatever was produced in between. Commit early if that matters.
      </Callout>

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
      <OffsetsTape
        title="Recorded in practical 3: analytics reset to the earliest offset"
        rows={CAUGHT_UP.map((r) => ({
          label: `payments-${r.partition}`,
          end: r.end,
          span: r.end > 0 ? { from: 0, to: r.end, label: `read again: ${r.end}`, hue: 4 as const } : undefined,
          markers: [
            { at: r.committed, label: `before ${r.committed}`, hue: 1 as const },
            { at: 0, label: 'after reset 0', hue: 2 as const, above: true },
          ],
        }))}
        caption={`The reset moved only the committed offsets; the records never left the log. The replay printed all ${PRACTICALS.p3.replay.out.length} payments again.`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Offset', definition: 'Sequential position of a record within one partition.' },
          { term: 'Log-end offset', definition: 'The offset the next written record will receive.' },
          { term: 'Log-start offset', definition: 'The earliest offset still retained.' },
          { term: 'Position', definition: 'A consumer’s in-memory pointer to the next record to fetch.' },
          { term: 'Committed offset', definition: 'Saved progress of a group for a partition; survives restarts.' },
          { term: 'Lag', definition: 'End offset (high watermark) minus committed offset: records consumers could read that the group has not committed yet.' },
          { term: '__consumer_offsets', definition: 'Internal topic where committed offsets are stored.' },
          { term: 'auto.offset.reset', definition: 'Where to start when a group has no committed offset: earliest, latest, none, or (4.0+) by_duration.' },
        ]}
      />
    </>
  )
}
