import { useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Callout, CodeBlock, Demo, Segmented, TermList } from '@/shared/ui'
import { PartitionLog } from '../components'
import { KafkaCluster } from '../simulation'
import styles from './lesson.module.css'

const CUSTOMERS = ['alice', 'bob', 'carol', 'dave', 'erin']

function PartitionPlayground() {
  const cluster = useObservable(() => new KafkaCluster({ topic: 'orders', partitions: 3 }))
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [sequence, setSequence] = useState<string[]>([])

  const produce = (customer: string) => {
    const n = (counts[customer] ?? 0) + 1
    setCounts({ ...counts, [customer]: n })
    setSequence((s) => [...s, `${customer}#${n}`])
    cluster.produce(customer, `${customer}#${n}`)
  }

  const resize = (partitions: number) => {
    cluster.reset(partitions)
    setCounts({})
    setSequence([])
  }

  return (
    <Demo
      title="Write events into a partitioned topic"
      hint="Each button writes an event keyed by that customer. Watch where each one lands, then change the partition count."
      controls={
        <>
          <Segmented
            label="partitions"
            value={cluster.topic.partitionCount}
            onChange={resize}
            options={[1, 2, 3, 4].map((n) => ({ value: n, label: String(n) }))}
          />
          {CUSTOMERS.map((customer) => (
            <Button key={customer} size="sm" onClick={() => produce(customer)}>
              {customer}
            </Button>
          ))}
        </>
      }
    >
      {cluster.topic.partitionIds.map((p) => (
        <PartitionLog key={p} label={`P${p}`} cells={cluster.topic.records(p)} showValues />
      ))}
      <div className={styles.result}>
        <div className={styles.label}>Order you produced in</div>
        <span className={styles.mono}>{sequence.length ? sequence.join('  →  ') : 'nothing yet'}</span>
      </div>
      <p className={styles.demoNote}>
        Inside each partition the events of one customer are always in the order they were written. Across partitions
        there is no single order — a consumer of P0 and a consumer of P1 may see them interleaved differently.
      </p>
    </Demo>
  )
}

export default function TopicsPartitions() {
  return (
    <>
      <p>
        A <strong>topic</strong> is a named stream of related events — like a table name in a database or a folder for
        files. You might have <code>orders</code>, <code>payments</code> and <code>user-signups</code>. Producers write
        to a topic by name, consumers subscribe by name.
      </p>

      <h2>Why split a topic?</h2>
      <p>
        If a topic were one single log on one machine, it could only go as fast as that machine’s disk, and only one
        consumer could usefully read it in order. So Kafka splits every topic into <strong>partitions</strong>. Each
        partition is its own independent, ordered, append-only log with its own offsets starting at 0.
      </p>
      <ul>
        <li>
          <strong>Scale:</strong> partitions are spread over brokers, so writes and storage are spread too.
        </li>
        <li>
          <strong>Parallelism:</strong> different consumers can read different partitions at the same time.
        </li>
        <li>
          <strong>Ordering:</strong> guaranteed <em>within</em> a partition, never across partitions.
        </li>
      </ul>

      <PartitionPlayground />

      <Callout tone="analogy">
        A topic is a supermarket; partitions are its checkout lanes. More lanes serve more customers at once. Each lane
        is first-come-first-served, but there is no promise about who leaves the shop first across different lanes.
        The key is like a loyalty card that always sends a customer to the same lane.
      </Callout>

      <h2>Choosing a partition count</h2>
      <ul>
        <li>
          The number of partitions is the <strong>maximum number of consumers in a group</strong> that can work in
          parallel (lesson 7). Plan for your peak throughput.
        </li>
        <li>
          You can <strong>add</strong> partitions later but never remove them. Adding changes{' '}
          <code>hash(key) % partitions</code>, so existing keys may move to a different partition — breaking per-key
          ordering for a moment. Pick a sensible number up front.
        </li>
        <li>
          Very high counts cost memory, file handles and longer failovers. Tens to low hundreds per topic is common.
        </li>
      </ul>

      <Callout tone="warn" title="Auto-created topics">
        With <code>auto.create.topics.enable=true</code>, writing to or reading from an unknown topic silently creates
        it with the broker default <code>num.partitions</code> (often 1). Convenient locally, dangerous in production:
        a typo creates a new, empty topic. Create topics explicitly:
      </Callout>
      <CodeBlock
        title="create a topic"
        code={`kafka-topics.sh --bootstrap-server localhost:9092 \\
  --create --topic orders --partitions 6 --replication-factor 3`}
      />

      <h2>What a partition looks like on disk</h2>
      <p>
        Each partition is a directory on the broker, e.g. <code>orders-0/</code>. Inside are{' '}
        <strong>segment</strong> files: the log is chopped into chunks (by default 1 GB) so old data can be deleted a
        whole file at a time. Each segment has a <code>.log</code> file with the records and small{' '}
        <code>.index</code>/<code>.timeindex</code> files to find an offset or timestamp quickly.
      </p>
      <CodeBlock
        title="/var/lib/kafka/orders-0/"
        code={`00000000000000000000.log        # records with offsets 0 … 41 230
00000000000000000000.index
00000000000000000000.timeindex
00000000000000041231.log        # active segment: new writes go here
00000000000000041231.index
00000000000000041231.timeindex`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Topic', definition: 'A named stream of events, split into partitions.' },
          { term: 'Partition', definition: 'One ordered, append-only log; the unit of storage, ordering and parallelism.' },
          { term: 'Topic-partition', definition: 'A specific partition of a topic, written like orders-0.' },
          { term: 'Segment', definition: 'A file holding a contiguous range of a partition’s records.' },
          { term: 'Active segment', definition: 'The newest segment, the only one that receives writes.' },
          { term: 'num.partitions', definition: 'Broker default partition count for auto-created topics.' },
        ]}
      />
    </>
  )
}
