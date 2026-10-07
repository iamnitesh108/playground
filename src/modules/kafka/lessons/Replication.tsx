import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Callout, CodeBlock, Demo, Segmented, Table, TermList } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { PartitionLog } from '../components'
import { ReplicatedPartition, type Acks } from '../simulation'
import styles from './lesson.module.css'
import own from './Replication.module.css'

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
          One replica is the <strong>leader</strong>. Producers write to it and consumers read from it.
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
