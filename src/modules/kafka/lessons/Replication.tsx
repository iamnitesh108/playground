import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Callout, CodeBlock, Demo, Segmented, Table, TermList } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { ReplicationLogRows, type LogCell } from '../components/ReplicationLogRows'
import { PartitionLog } from '../components'
import { ReplicatedPartition, type Acks } from '../simulation'
import styles from './lesson.module.css'
import own from './Replication.module.css'

/** Schematic replica logs: the leader has offsets 0–6, one follower 0–5, the other 0–3 (it fell behind). */
const replicaRow = (label: string, upTo: number, hw: number, total = 7): { label: string; cells: LogCell[] } => ({
  label,
  cells: Array.from({ length: total }, (_, o) => ({
    label: o < upTo ? (o < hw ? 'on all ISR' : 'not on all yet') : 'not fetched yet',
    content: o < upTo ? `offset ${o}` : '·',
    hue: o >= upTo ? 7 : o < hw ? 3 : 8,
  })),
})

function ReplicationDemo() {
  const partition = useObservable(() => new ReplicatedPartition(3))
  const hw = partition.highWatermark

  return (
    <Demo
      title="Kill brokers and see what survives"
      hint="Try: acks=1, produce, kill the leader before replicating. Then: acks=all with min ISR 2, kill two brokers, produce."
      controls={
        <>
          <Segmented
            label="acks"
            value={partition.acks}
            onChange={(v: Acks) => partition.setAcks(v)}
            options={[
              { value: '0', label: '0' },
              { value: '1', label: '1' },
              { value: 'all', label: 'all' },
            ]}
          />
          <Segmented
            label="min.insync.replicas"
            value={partition.minInsyncReplicas}
            onChange={(v) => partition.setMinInsyncReplicas(v)}
            options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))}
          />
          <Button size="sm" variant="primary" onClick={() => partition.produce()}>
            Produce
          </Button>
          <Button size="sm" onClick={() => partition.replicate()}>
            Followers fetch
          </Button>
          <Button size="sm" variant="ghost" onClick={() => partition.reset()}>
            Reset
          </Button>
        </>
      }
    >
      <div className={own.brokers}>
        {partition.brokers.map((broker) => {
          const isLeader = broker.id === partition.leaderId
          const inSync = partition.isr.has(broker.id)
          return (
            <div key={broker.id} className={cx(own.broker, !broker.alive && own.dead, isLeader && own.leader)}>
              <div className={own.header}>
                <span className={own.name}>Broker {broker.id}</span>
                <span className={own.role}>{!broker.alive ? 'down' : isLeader ? 'leader' : 'follower'}</span>
                <span className={cx(own.isr, inSync && own.inSync)}>{inSync ? 'in ISR' : 'out of ISR'}</span>
                <Button size="sm" variant={broker.alive ? 'danger' : 'default'} onClick={() => (broker.alive ? partition.kill(broker.id) : partition.revive(broker.id))}>
                  {broker.alive ? 'Kill' : 'Revive'}
                </Button>
              </div>
              <PartitionLog
                label="orders-0"
                cells={broker.log.map((value, offset) => ({ offset, key: value }))}
                markers={isLeader ? [{ offset: hw, label: 'high watermark', tone: 2 }] : []}
                showNext={isLeader}
              />
            </div>
          )
        })}
      </div>
      <div className={styles.grid2} style={{ marginTop: 12 }}>
        <div className={styles.stat}>
          <div className={styles.statLabel}>leader</div>
          <div className={styles.statValue}>{partition.leaderId ? `broker ${partition.leaderId}` : 'none (offline)'}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>ISR</div>
          <div className={styles.statValue}>{`{${[...partition.isr].sort().join(', ')}}`}</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statLabel}>readable by consumers</div>
          <div className={styles.statValue}>offsets &lt; {hw}</div>
        </div>
      </div>
      {partition.lastResult && (
        <div className={cx(styles.result, partition.lastResult.ok ? styles.resultOk : styles.resultBad)}>{partition.lastResult.message}</div>
      )}
    </Demo>
  )
}

export default function Replication() {
  return (
    <>
      <p>
        Disks fail and machines reboot. Kafka survives this by keeping several copies — <strong>replicas</strong> — of
        every partition on different brokers. The number of copies is the topic’s <strong>replication factor</strong>{' '}
        (RF). RF=3 is the usual production choice.
      </p>

      <h2>Leader, followers and the ISR</h2>
      <ul>
        <li>
          One replica is the <strong>leader</strong>. Producers write to it and, by default, consumers read from it
          (since Kafka 2.4 consumers can be configured to fetch from a nearby follower instead).
        </li>
        <li>
          The others are <strong>followers</strong>. They constantly fetch new records from the leader, exactly like a
          consumer would.
        </li>
        <li>
          Followers that are fully caught up form the <strong>in-sync replica set (ISR)</strong>. A follower that falls
          behind for longer than <code>replica.lag.time.max.ms</code> (30 s) is dropped from the ISR until it catches up.
        </li>
        <li>
          The <strong>high watermark</strong> is the last offset every ISR member has. Consumers only see records below
          it, so they never read something that could disappear in a failover.
        </li>
      </ul>

      <Flow
        title="One partition, three replicas"
        cols={4}
        rows={3}
        rowHeight={76}
        nodes={[
          { id: 'producer', label: 'producer', sub: 'acks=all', col: 0, row: 1, hue: 7, shape: 'actor' },
          { id: 'leader', label: 'broker 1 · leader', col: 1, row: 1, hue: 3, shape: 'log' },
          { id: 'f2', label: 'broker 2 · follower', col: 2, row: 0, hue: 3, shape: 'log' },
          { id: 'f3', label: 'broker 3 · follower', col: 2, row: 2, hue: 3, shape: 'log' },
          { id: 'consumer', label: 'consumers', sub: 'read below the HW', col: 3, row: 1, hue: 1 },
        ]}
        edges={[
          { from: 'producer', to: 'leader', label: 'write', flow: true, hue: 7 },
          { from: 'leader', to: 'f2', label: 'fetched', flow: true, hue: 3, dashed: true },
          { from: 'leader', to: 'f3', label: 'fetched', flow: true, hue: 3, dashed: true },
          { from: 'leader', to: 'consumer', label: 'below HW', flow: true, hue: 1 },
        ]}
        steps={[
          { title: 'The producer writes to the leader', body: <p>Every write for orders-0 goes to its leader, broker 1, which appends it to its log.</p>, active: ['producer', 'leader', 'producer>leader'] },
          { title: 'Followers fetch, like consumers', body: <p>Brokers 2 and 3 continuously fetch new records from the leader and append them to their own copy of the log.</p>, active: ['leader', 'f2', 'f3', 'leader>f2', 'leader>f3'] },
          { title: 'The high watermark moves', body: <p>Once every member of the ISR has a record, the leader moves the high watermark past it, and (with acks=all) answers the producer.</p>, active: ['leader', 'f2', 'f3', 'producer', 'producer>leader'] },
          { title: 'Consumers read below the high watermark', body: <p>Consumers only get records below the high watermark — records that every in-sync replica has, so a failover cannot take them away.</p>, active: ['leader', 'consumer', 'leader>consumer'] },
        ]}
      />
      <ReplicationLogRows
        title="The high watermark, schematic: what each replica has"
        rows={[replicaRow('broker 1 · leader', 7, 4), replicaRow('broker 2 · follower', 6, 4), replicaRow('broker 3 · follower (falling behind)', 4, 4)]}
        caption="Offsets 0–3 are on every ISR member: below the high watermark (4), readable and safe. 4–6 are not on all ISR members yet, so consumers cannot see them. If broker 3 stays behind longer than replica.lag.time.max.ms (30 s), it leaves the ISR and the high watermark can move on without it."
      />
      <ReplicationDemo />

      <h2>What you just saw</h2>
      <Table
        head={['Setting', 'Effect']}
        rows={[
          ['acks=1 + leader dies before followers fetch', 'The new leader never had the record. It is gone — even though the producer was told “success”.'],
          ['acks=all', 'The producer only hears “success” once every ISR member has the record. Any of them can take over without loss.'],
          ['min.insync.replicas=2', 'With acks=all, writes are refused if fewer than 2 replicas are in sync. You trade availability for durability.'],
          ['All ISR members dead', 'The partition is offline until one returns. Kafka will not elect an out-of-sync replica unless you allow it.'],
        ]}
      />

      <BarChart
        title="Copies that exist before the producer hears “OK” (RF=3, all replicas in sync)"
        max={3}
        bars={[
          { label: 'acks=0', value: 0, hue: 8, display: 'none — not even the leader is waited for', note: 'Fire and forget: the producer does not wait for any answer.' },
          { label: 'acks=1', value: 1, hue: 4, display: '1 — the leader', note: 'If the leader dies before a follower fetched the record, the record is lost.' },
          { label: 'acks=all', value: 3, hue: 6, display: 'every ISR member (3)', note: 'With min.insync.replicas=2 the write is refused when fewer than 2 replicas are in sync.' },
        ]}
      />
      <Timeline
        title="A leader fails, schematic (RF=3, acks=all)"
        lanes={[
          { id: 'b1', label: 'broker 1' },
          { id: 'b2', label: 'broker 2' },
          { id: 'b3', label: 'broker 3' },
          { id: 'producer', label: 'producer' },
        ]}
        segments={[
          { lane: 'b1', from: 0, to: 4, label: 'leader', hue: 3 },
          { lane: 'b1', from: 4, to: 7, label: 'down', hue: 8, striped: true },
          { lane: 'b1', from: 7, to: 8, label: 'catching up', hue: 4 },
          { lane: 'b1', from: 8, to: 10, label: 'follower, in ISR', hue: 3 },
          { lane: 'b2', from: 0, to: 4.6, label: 'follower', hue: 3 },
          { lane: 'b2', from: 4.6, to: 10, label: 'leader', hue: 3 },
          { lane: 'b3', from: 0, to: 10, label: 'follower', hue: 3 },
          { lane: 'producer', from: 0, to: 4, label: 'writes', hue: 7 },
          { lane: 'producer', from: 4, to: 4.6, label: 'retry', hue: 8, striped: true },
          { lane: 'producer', from: 4.6, to: 10, label: 'writes to broker 2', hue: 7 },
        ]}
        events={[
          { lane: 'b1', at: 4, label: 'crash', hue: 8 },
          { lane: 'b2', at: 4.6, label: 'elected from the ISR', hue: 5 },
          { lane: 'b1', at: 8, label: 'back in ISR', hue: 6 },
        ]}
        end={10}
        unit="s"
        playable
      />
      <StatTiles
        title="The durable default"
        stats={[
          { label: 'replication.factor', value: 3, sub: 'three copies of every partition', hue: 3 },
          { label: 'min.insync.replicas', value: 2, sub: 'writes need two in-sync copies', hue: 5 },
          { label: 'producer acks', value: 'all', sub: 'OK only after every ISR member has it', hue: 7 },
          { label: 'brokers you can lose', value: 1, sub: 'with no data loss and no downtime', hue: 6 },
        ]}
      />
      <Callout tone="tip" title="The durable default">
        <code>replication.factor=3</code>, <code>min.insync.replicas=2</code>, producer <code>acks=all</code>. You can
        lose any one broker with no data loss and no downtime.
      </Callout>

      <Callout tone="warn" title="unclean.leader.election.enable">
        Setting this to <code>true</code> lets an out-of-sync replica become leader when no ISR member is left. The
        partition comes back sooner, but records it never copied are lost. Keep it <code>false</code> for anything that
        matters.
      </Callout>

      <h2>Single-broker setups</h2>
      <p>
        On a laptop with one broker you cannot have RF above 1. Kafka’s internal topics default to RF=3 and would fail
        to be created, so local configs lower them:
      </p>
      <CodeBlock
        title="server.properties — single broker"
        code={`
offsets.topic.replication.factor=1
transaction.state.log.replication.factor=1
transaction.state.log.min.isr=1
default.replication.factor=1
`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Replica', definition: 'A copy of a partition stored on one broker.' },
          { term: 'Replication factor', definition: 'How many replicas each partition of a topic has.' },
          { term: 'ISR', definition: 'In-sync replicas: the leader plus followers that are caught up.' },
          { term: 'High watermark', definition: 'Highest offset replicated to all ISR members; consumers read below it.' },
          { term: 'min.insync.replicas', definition: 'Minimum ISR size for acks=all writes to be accepted.' },
          { term: 'Leader election', definition: 'Choosing a new leader from the ISR when the current one fails.' },
          { term: 'Unclean election', definition: 'Electing an out-of-sync replica; restores availability at the cost of data.' },
          { term: 'Under-replicated partition', definition: 'A partition whose ISR is smaller than its replica count. A key alert.' },
        ]}
      />
    </>
  )
}
