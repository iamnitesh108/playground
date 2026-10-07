import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { useObservable } from '@/shared/hooks/useObservable'
import { Box, Button, Callout, CodeBlock, Column, Connector, Demo, Row, Segmented, Table, TermList, Walkthrough } from '@/shared/ui'
import { ActivityFeed, ClusterView } from '../components'
import { KafkaCluster, RangeAssignor, RoundRobinAssignor } from '../simulation'

const KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank']

function createGroupDemo() {
  const cluster = new KafkaCluster({ topic: 'orders', partitions: 4 })
  cluster.addGroup('billing')
  cluster.addConsumer('billing')
  return cluster
}

function GroupPlayground() {
  const cluster = useObservable(createGroupDemo)
  const [running, setRunning] = useState(false)
  const [seq, setSeq] = useState(1)
  const [assignor, setAssignor] = useState<'range' | 'roundrobin'>('range')
  const hasAnalytics = Boolean(cluster.group('analytics'))

  useInterval(() => cluster.tick(), running ? 900 : null)

  const produceBurst = () => {
    for (let i = 0; i < 6; i++) cluster.produce(KEYS[(seq + i) % KEYS.length], `e${seq + i}`)
    setSeq(seq + 6)
  }

  const changeAssignor = (value: 'range' | 'roundrobin') => {
    setAssignor(value)
    for (const group of cluster.groups) {
      cluster.setAssignor(group.id, value === 'range' ? new RangeAssignor() : new RoundRobinAssignor())
    }
  }

  return (
    <Demo
      title="Consumer group playground"
      hint="Produce some records, add consumers one by one (try 5 on 4 partitions), press Run, then add a second group."
      controls={
        <>
          <Button size="sm" onClick={produceBurst}>
            Produce 6
          </Button>
          <Button size="sm" variant={running ? 'default' : 'primary'} onClick={() => setRunning(!running)}>
            {running ? 'Pause' : 'Run consumers'}
          </Button>
          <Button size="sm" disabled={hasAnalytics} onClick={() => { cluster.addGroup('analytics'); cluster.addConsumer('analytics') }}>
            + Group “analytics”
          </Button>
          <Segmented
            label="assignor"
            value={assignor}
            onChange={changeAssignor}
            options={[
              { value: 'range', label: 'range' },
              { value: 'roundrobin', label: 'round robin' },
            ]}
          />
        </>
      }
    >
      <ClusterView cluster={cluster} />
      <ActivityFeed items={cluster.activity} />
    </Demo>
  )
}

const REBALANCE_STEPS = [
  { title: 'A consumer starts', body: <p>Consumer c3 starts with <code>group.id=billing</code> and contacts the group’s <strong>coordinator</strong> — a broker chosen by hashing the group ID.</p> },
  { title: 'Everyone re-joins', body: <p>The coordinator starts a rebalance. All members send a <code>JoinGroup</code> request. In the classic “eager” protocol they first stop processing and give up their partitions.</p> },
  { title: 'The leader assigns', body: <p>The first member to join becomes the <strong>group leader</strong>. It runs the assignor (range, round robin, sticky…) and sends the plan back in <code>SyncGroup</code>.</p> },
  { title: 'Work resumes', body: <p>Each member receives its partitions and resumes from the group’s committed offsets. The <strong>generation</strong> number increases, so stale members are fenced off.</p> },
  { title: 'Heartbeats keep it alive', body: <p>Members heartbeat to the coordinator. Miss them for <code>session.timeout.ms</code>, or go longer than <code>max.poll.interval.ms</code> between polls, and the member is kicked out — another rebalance.</p> },
]

function RebalanceFlow() {
  return (
    <Walkthrough title="What happens in a rebalance" steps={REBALANCE_STEPS}>
      {(step) => (
        <Row align="center">
          <Column gap={10}>
            {['c1', 'c2', 'c3'].map((c) => (
              <Box
                key={c}
                title={c}
                caption={step === 3 ? ({ c1: 'P0', c2: 'P1', c3: 'P2, P3' } as Record<string, string>)[c] : step === 1 ? 'paused' : c === 'c3' && step === 0 ? 'new' : step === 2 && c === 'c1' ? 'group leader' : 'member'}
                active={(step === 0 && c === 'c3') || (step === 2 && c === 'c1') || step === 3}
                dimmed={step === 1}
              />
            ))}
          </Column>
          <div style={{ width: 150, display: 'flex' }}>
            <Connector active direction={step === 2 || step === 3 ? 'left' : 'right'} label={['JoinGroup', 'JoinGroup ×3', 'SyncGroup', 'assignment', 'heartbeat'][step]} />
          </div>
          <Box title="Group coordinator" caption="a broker" active={step !== 3} />
        </Row>
      )}
    </Walkthrough>
  )
}

export default function ConsumerGroups() {
  return (
    <>
      <p>
        A <strong>consumer</strong> reads records by repeatedly calling <code>poll()</code> in a loop. One consumer
        alone may not keep up with a busy topic, so Kafka lets several consumers <em>share</em> the work by giving them
        the same <code>group.id</code>. Together they form a <strong>consumer group</strong>.
      </p>

      <CodeBlock
        title="the basic consumer loop (Java)"
        code={`
consumer.subscribe(List.of("orders"));
while (running) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    for (ConsumerRecord<String, String> r : records) {
        process(r.key(), r.value());          // your business logic
    }
    consumer.commitSync();                    // save progress (or let auto-commit do it)
}
`}
      />

      <h2>The two rules of groups</h2>
      <ol>
        <li>
          <strong>Inside a group, each partition is read by exactly one consumer.</strong> That is how ordering per
          partition survives parallel processing. One consumer may own several partitions.
        </li>
        <li>
          <strong>Different groups are completely independent.</strong> Each group gets every record and keeps its own
          committed offsets.
        </li>
      </ol>
      <p>
        So a group behaves like a <em>work queue</em> (records shared among members), while several groups behave like{' '}
        <em>publish/subscribe</em> (each group sees everything). Kafka gives you both with one mechanism.
      </p>

      <GroupPlayground />

      <Callout tone="warn" title="More consumers than partitions">
        With 4 partitions, a 5th consumer in the same group sits <strong>idle</strong>. The partition count is the
        ceiling on a group’s parallelism — choose it with your peak consumer count in mind.
      </Callout>

      <h2>Rebalancing</h2>
      <p>
        Whenever membership changes — a consumer joins, leaves, crashes, or the topic gains partitions — the group{' '}
        <strong>rebalances</strong>: partitions are reassigned among the current members.
      </p>
      <RebalanceFlow />

      <h3>Assignment strategies</h3>
      <Table
        head={['Assignor', 'How it splits', 'Notes']}
        rows={[
          ['range', 'Contiguous blocks per topic', 'Old default; can be uneven across many topics'],
          ['roundrobin', 'Deals partitions out like cards', 'Even, but moves many partitions on change'],
          ['sticky', 'Even, keeps previous owners where possible', 'Fewer moved partitions'],
          ['cooperative-sticky', 'Sticky, done in incremental steps', 'Members keep unaffected partitions during a rebalance — no stop-the-world'],
        ]}
      />
      <p>
        Newer clusters also offer the <strong>next-generation consumer protocol</strong> (<code>group.protocol=consumer</code>
        , KIP-848), where the broker computes assignments and rebalances become incremental by default.
      </p>

      <Callout tone="tip" title="Rebalance hygiene">
        <ul>
          <li>Keep per-record work fast, or lower <code>max.poll.records</code>, so you stay inside <code>max.poll.interval.ms</code>.</li>
          <li>
            For containers that restart often, set <code>group.instance.id</code> (<strong>static membership</strong>): a
            restarting member gets its old partitions back without a rebalance.
          </li>
          <li>Commit before giving up partitions, or expect some records to be processed twice.</li>
        </ul>
      </Callout>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Consumer group', definition: 'Consumers sharing a group.id that split a topic’s partitions between them.' },
          { term: 'group.id', definition: 'The name that makes consumers members of the same group.' },
          { term: 'Assignment', definition: 'Which partitions each member currently owns.' },
          { term: 'Rebalance', definition: 'Redistribution of partitions when group membership changes.' },
          { term: 'Group coordinator', definition: 'The broker managing a group’s membership and commits.' },
          { term: 'Group leader', definition: 'The member that computes the assignment (classic protocol).' },
          { term: 'Generation', definition: 'Counter that increases with each rebalance; fences stale members.' },
          { term: 'Heartbeat', definition: 'Periodic “I’m alive” signal from a member to the coordinator.' },
          { term: 'session.timeout.ms', definition: 'How long without heartbeats before a member is considered dead.' },
          { term: 'max.poll.interval.ms', definition: 'Max time between poll() calls before a member is considered stuck.' },
          { term: 'Static membership', definition: 'Stable group.instance.id so restarts do not trigger rebalances.' },
        ]}
      />
    </>
  )
}
