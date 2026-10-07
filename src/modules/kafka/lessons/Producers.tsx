import { useMemo, useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Box, Button, Callout, CodeBlock, Column, Connector, Demo, Row, Segmented, Table, TermList, TextField, Walkthrough } from '@/shared/ui'
import { PartitionLog } from '../components'
import { DefaultPartitioner, KafkaCluster, murmur2, RoundRobinPartitioner, toPositive } from '../simulation'
import styles from './lesson.module.css'

const PIPELINE = ['send()', 'Serializer', 'Partitioner', 'Accumulator', 'Sender', 'Leader broker']

const SEND_STEPS = [
  { title: 'Your code calls send()', body: <p>You hand the producer a topic, a key and a value. The call returns immediately; the work happens in the background.</p> },
  { title: 'Serialize', body: <p>The key and value serializers turn your objects into bytes.</p> },
  { title: 'Pick a partition', body: <p>The partitioner hashes the key (murmur2) and takes it modulo the partition count. No key? Records are spread out instead.</p> },
  { title: 'Wait in a batch', body: <p>The record joins a <strong>batch</strong> for that partition in the record accumulator. Batches fill until <code>batch.size</code> bytes or until <code>linger.ms</code> passes.</p> },
  { title: 'Ship the batch', body: <p>A background sender thread groups ready batches by leader broker and sends them in one request, optionally compressed.</p> },
  { title: 'Leader stores and acknowledges', body: <p>The leader appends the batch to the partition log, assigns offsets, and replies once the <code>acks</code> condition is met. Your callback or future completes with the offset.</p> },
]

function SendPipeline() {
  return (
    <Walkthrough title="The life of producer.send()" steps={SEND_STEPS}>
      {(step) => (
        <Row>
          {PIPELINE.map((stage, i) => (
            <Row key={stage}>
              {i > 0 && (
                <div style={{ width: 34, display: 'flex' }}>
                  <Connector active={i === step} />
                </div>
              )}
              <Box title={stage} active={i === step} dimmed={i > step} />
            </Row>
          ))}
        </Row>
      )}
    </Walkthrough>
  )
}

function PartitionerMath() {
  const [key, setKey] = useState('order-42')
  const [count, setCount] = useState(6)
  const hash = useMemo(() => murmur2(new TextEncoder().encode(key)), [key])
  const positive = toPositive(hash)

  return (
    <Demo
      title="The partitioner, step by step"
      hint="This is the real algorithm the Java client uses. Try the same key twice; try similar keys."
      controls={
        <>
          <TextField label="key" value={key} onChange={(e) => setKey(e.target.value)} />
          <Segmented label="partitions" value={count} onChange={setCount} options={[3, 6, 12].map((n) => ({ value: n, label: String(n) }))} />
        </>
      }
    >
      {key ? (
        <div className={styles.grid2}>
          <div className={styles.stat}>
            <div className={styles.statLabel}>murmur2(bytes)</div>
            <div className={styles.statValue}>{hash}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>make positive (&amp; 0x7fffffff)</div>
            <div className={styles.statValue}>{positive}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statLabel}>% {count}</div>
            <div className={styles.statValue}>partition {positive % count}</div>
          </div>
        </div>
      ) : (
        <p className={styles.demoNote}>No key: the producer uses the “sticky” strategy — it fills a batch for one partition, then switches to another, spreading load evenly.</p>
      )}
    </Demo>
  )
}

function PartitionerCompare() {
  const cluster = useObservable(() => new KafkaCluster({ topic: 'orders', partitions: 3 }))
  const [strategy, setStrategy] = useState<'default' | 'round-robin'>('default')
  const [seq, setSeq] = useState(1)

  const choose = (value: 'default' | 'round-robin') => {
    setStrategy(value)
    cluster.reset()
    cluster.setPartitioner(value === 'default' ? new DefaultPartitioner() : new RoundRobinPartitioner())
  }

  const send = (key: string | null) => {
    cluster.produce(key, `e${seq}`)
    setSeq(seq + 1)
  }

  return (
    <Demo
      title="Key hashing vs round robin"
      hint="Send several events for the same key with each strategy. Which one keeps a customer’s events together?"
      controls={
        <>
          <Segmented
            value={strategy}
            onChange={choose}
            options={[
              { value: 'default', label: 'Default (hash key)' },
              { value: 'round-robin', label: 'Round robin' },
            ]}
          />
          {['alice', 'bob'].map((key) => (
            <Button key={key} size="sm" onClick={() => send(key)}>
              {key}
            </Button>
          ))}
          <Button size="sm" onClick={() => send(null)}>
            no key
          </Button>
        </>
      }
    >
      {cluster.topic.partitionIds.map((p) => (
        <PartitionLog key={p} label={`P${p}`} cells={cluster.topic.records(p)} showValues />
      ))}
    </Demo>
  )
}

const RETRY_STEPS = [
  { title: 'Send', body: <p>The producer sends record <code>m1</code>. With idempotence on, it is tagged with a producer ID and sequence number 0.</p> },
  { title: 'Stored, but the ack is lost', body: <p>The leader writes <code>m1</code> at offset 0 and replies. The reply is lost on the network (timeout, broker restart…).</p> },
  { title: 'Retry', body: <p>The producer never saw an ack, so it sends <code>m1</code> again. It cannot know the first attempt succeeded.</p> },
  { title: 'Outcome', body: <p>Without idempotence the log now has <code>m1</code> twice. With idempotence the broker sees “producer P, sequence 0 — already have it”, discards the copy and simply acknowledges.</p> },
]

function RetryDuplicates() {
  return (
    <Walkthrough title="Why retries can duplicate, and how idempotence fixes it" steps={RETRY_STEPS}>
      {(step) => (
        <Column gap={12}>
          <Row align="center">
            <Box title="Producer" caption="pid=7" active={step === 0 || step === 2} />
            <div style={{ width: 160, display: 'flex' }}>
              <Connector active={step === 0 || step === 2 || step === 1} direction={step === 1 ? 'left' : 'right'} dashed={step === 1} label={step === 1 ? 'ack ✕ lost' : step === 2 ? 'm1 seq=0 (retry)' : 'm1 seq=0'} />
            </div>
            <Box title="Leader" active={step === 1 || step === 3} />
          </Row>
          <div className={styles.grid2}>
            <div>
              <div className={styles.label}>idempotence off</div>
              <PartitionLog label="P0" cells={step === 0 ? [] : step < 3 ? [{ offset: 0, key: 'm1' }] : [{ offset: 0, key: 'm1' }, { offset: 1, key: 'm1' }]} highlight={step === 3 ? 1 : undefined} />
            </div>
            <div>
              <div className={styles.label}>idempotence on</div>
              <PartitionLog label="P0" cells={step === 0 ? [] : [{ offset: 0, key: 'm1' }]} />
            </div>
          </div>
        </Column>
      )}
    </Walkthrough>
  )
}

export default function Producers() {
  return (
    <>
      <p>
        A <strong>producer</strong> is the client library your application uses to write records. You rarely think
        about its internals until something goes wrong — then knowing them is everything.
      </p>

      <SendPipeline />

      <h2>How a partition is chosen</h2>
      <p>The default partitioner follows three rules:</p>
      <ol>
        <li>If you set a partition explicitly, use it.</li>
        <li>
          If the record has a key: <code>partition = toPositive(murmur2(keyBytes)) % numPartitions</code>. Same key →
          same partition, every time.
        </li>
        <li>No key: stick to one partition until a batch is full, then move on (“sticky” partitioning).</li>
      </ol>
      <PartitionerMath />
      <PartitionerCompare />

      <h2>Batching and compression</h2>
      <p>
        Sending every record in its own network request would be slow. The producer groups records into batches per
        partition. Two settings trade latency for throughput:
      </p>
      <ul>
        <li>
          <code>linger.ms</code> — how long to wait for more records before sending a batch that is not full.
        </li>
        <li>
          <code>batch.size</code> — the maximum batch size in bytes.
        </li>
        <li>
          <code>compression.type</code> — <code>lz4</code>, <code>zstd</code>, <code>snappy</code> or{' '}
          <code>gzip</code>. Whole batches are compressed, so bigger batches compress better.
        </li>
      </ul>

      <h2>Acknowledgements: how sure do you need to be?</h2>
      <p>
        The <code>acks</code> setting says when the leader may tell the producer “got it”. It is a trade-off between
        speed and safety, explored hands-on in the replication lesson.
      </p>
      <Table
        head={['acks', 'Producer waits for', 'Risk']}
        rows={[
          ['0', 'nothing', 'Records can vanish silently. Metrics, at best.'],
          ['1', 'the leader to write it', 'Lost if the leader dies before followers copy it.'],
          ['all (-1)', 'every in-sync replica', 'Safest. The default since Kafka 3.0.'],
        ]}
      />

      <h2>Retries and idempotence</h2>
      <p>
        Networks fail, so the producer retries automatically. But a retry can duplicate a record that was actually
        stored. The <strong>idempotent producer</strong> prevents that by numbering every batch.
      </p>
      <RetryDuplicates />
      <Callout tone="tip">
        Idempotence is on by default in modern clients (<code>enable.idempotence=true</code>, which also implies{' '}
        <code>acks=all</code>). It protects against duplicates caused by the producer’s own retries — not against your
        application calling <code>send()</code> twice.
      </Callout>
      <p>
        For writing to several partitions atomically, producers also support <strong>transactions</strong>{' '}
        (<code>transactional.id</code>): either all records in the transaction become visible to{' '}
        <code>read_committed</code> consumers, or none do. This is the basis of exactly-once stream processing.
      </p>

      <CodeBlock
        title="a sensible producer configuration"
        code={`
bootstrap.servers=broker1:9092,broker2:9092,broker3:9092
key.serializer=org.apache.kafka.common.serialization.StringSerializer
value.serializer=org.apache.kafka.common.serialization.StringSerializer
acks=all
enable.idempotence=true
linger.ms=10
batch.size=65536
compression.type=lz4
delivery.timeout.ms=120000
`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Partitioner', definition: 'Producer component that maps a record to a partition.' },
          { term: 'murmur2', definition: 'The hash function the default partitioner applies to key bytes.' },
          { term: 'Sticky partitioning', definition: 'For key-less records: fill one partition’s batch, then switch.' },
          { term: 'Batch', definition: 'A group of records for the same partition sent together.' },
          { term: 'linger.ms', definition: 'Max wait to fill a batch before sending it.' },
          { term: 'acks', definition: 'How many replicas must store a record before the producer is told it succeeded.' },
          { term: 'Idempotent producer', definition: 'Producer that tags batches with an ID and sequence so retries never duplicate.' },
          { term: 'Transaction', definition: 'Atomic write across partitions, visible all-or-nothing to read_committed consumers.' },
        ]}
      />
    </>
  )
}
