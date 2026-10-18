import { useMemo, useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Box, Button, Callout, CodeBlock, Column, Connector, Demo, Row, Segmented, Table, TermList, TextField, Walkthrough } from '@/shared/ui'
import { Flow, Timeline } from '@/shared/figures'
import { PartitionLog } from '../components/PartitionLog'
import { DefaultPartitioner, RoundRobinPartitioner } from '../simulation/partitioner'
import { KafkaCluster } from '../simulation/KafkaCluster'
import { murmur2, toPositive } from '../simulation/murmur2'
import styles from './lesson.module.css'

const SEND_STEPS = [
  { title: 'Your code calls send()', body: <p>You hand the producer a topic, a key and a value. The call normally returns at once (it only blocks, up to <code>max.block.ms</code>, while fetching metadata or when the send buffer is full); the work happens in the background.</p> },
  { title: 'Serialize', body: <p>The key and value serializers turn your objects into bytes.</p> },
  { title: 'Pick a partition', body: <p>The partitioner hashes the key (murmur2) and takes it modulo the partition count. No key? A “sticky” partition is used instead.</p> },
  { title: 'Wait in a batch', body: <p>The record joins a <strong>batch</strong> for that partition in the record accumulator. Batches fill until <code>batch.size</code> bytes or until <code>linger.ms</code> passes.</p> },
  { title: 'Ship the batch', body: <p>A background sender thread groups ready batches by leader broker and sends them in one request, optionally compressed.</p> },
  { title: 'Leader stores and acknowledges', body: <p>The leader appends the batch to the partition log, assigns offsets, and replies once the <code>acks</code> condition is met. Your callback or future completes with the offset.</p> },
]

function SendPipeline() {
  return (
    <Flow
      title="The life of producer.send()"
      cols={5}
      rows={2}
      rowHeight={104}
      caption="The sender thread sends one ProduceRequest per leader broker, carrying the ready batches of all partitions that broker leads."
      nodes={[
        { id: 'app', label: 'send()', sub: 'your code', col: 0, row: 0, hue: 7, shape: 'actor' },
        { id: 'ser', label: 'serializers', sub: 'to bytes', col: 1, row: 0, hue: 7 },
        { id: 'part', label: 'partitioner', sub: 'picks partition', col: 2, row: 0, hue: 7 },
        { id: 'acc', label: 'accumulator', sub: 'batch per partition', col: 3, row: 0, hue: 7, shape: 'queue' },
        { id: 'sender', label: 'sender thread', sub: 'background I/O', col: 4, row: 0, hue: 7 },
        { id: 'leader', label: 'leader broker', sub: 'appends batch', col: 4, row: 1, hue: 3, shape: 'log' },
        { id: 'cb', label: 'callback', sub: 'offset or error', col: 0, row: 1, hue: 7 },
      ]}
      edges={[
        { from: 'app', to: 'ser', flow: true, hue: 7 },
        { from: 'ser', to: 'part', flow: true, hue: 7 },
        { from: 'part', to: 'acc', flow: true, hue: 7 },
        { from: 'acc', to: 'sender', flow: true, hue: 7 },
        { from: 'sender', to: 'leader', flow: true, hue: 3 },
        { from: 'leader', to: 'cb', label: 'ack: partition + offset', flow: true, hue: 3 },
      ]}
      steps={SEND_STEPS.map((step, i) => ({
        ...step,
        active: [
          ['app', 'app>ser'],
          ['ser', 'app>ser', 'ser>part'],
          ['part', 'ser>part', 'part>acc'],
          ['acc', 'part>acc'],
          ['acc', 'sender', 'acc>sender', 'sender>leader'],
          ['leader', 'cb', 'sender>leader', 'leader>cb'],
        ][i],
      }))}
    />
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
        <Flow
          cols={4}
          rows={1}
          rowHeight={92}
          nodes={[
            { id: 'k', label: 'key bytes', sub: `"${key}"`.slice(0, 18), col: 0, row: 0, hue: 7 },
            { id: 'h', label: 'murmur2', sub: String(hash), col: 1, row: 0, hue: 7 },
            { id: 'p', label: '& 0x7fffffff', sub: String(positive), col: 2, row: 0, hue: 7 },
            { id: 'r', label: `% ${count}`, sub: `partition ${positive % count}`, col: 3, row: 0, hue: 3, shape: 'log' },
          ]}
          edges={[
            { from: 'k', to: 'h', flow: true, hue: 7 },
            { from: 'h', to: 'p', flow: true, hue: 7 },
            { from: 'p', to: 'r', flow: true, hue: 3 },
          ]}
        />
      ) : (
        <p className={styles.demoNote}>No key: the hash is skipped. The producer uses the “sticky” strategy — it fills a batch for one partition, then switches to another, spreading load evenly over time.</p>
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
        <li>
          No key: stick to one partition until about a batch’s worth of data (<code>batch.size</code>) has been
          sent to it, then switch (“sticky” partitioning, the default since Kafka 3.3; older clients switched when a
          batch was sent).
        </li>
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
          <code>linger.ms</code> — how long to wait for more records before sending a batch that is not full. The
          default was 0 until Kafka 4.0, which changed it to 5 ms.
        </li>
        <li>
          <code>batch.size</code> — the maximum batch size in bytes per partition (default 16 KB).
        </li>
        <li>
          <code>compression.type</code> — <code>lz4</code>, <code>zstd</code>, <code>snappy</code> or{' '}
          <code>gzip</code>. Whole batches are compressed, so bigger batches compress better.
        </li>
      </ul>

      <Timeline
        title="Two batches for one partition: batch 1 leaves when linger.ms runs out, batch 2 when it reaches batch.size (schematic, linger.ms=5)"
        lanes={[
          { id: 'arrive', label: 'send() calls' },
          { id: 'batch', label: 'batch for P0' },
          { id: 'net', label: 'network' },
        ]}
        segments={[
          { lane: 'batch', from: 0, to: 5, label: 'batch 1: 3 records', hue: 7 },
          { lane: 'batch', from: 6, to: 9, label: 'batch 2', hue: 7 },
          { lane: 'net', from: 5, to: 6.2, label: 'send', hue: 3 },
          { lane: 'net', from: 9, to: 10.2, label: 'send', hue: 3 },
        ]}
        events={[
          { lane: 'arrive', at: 0, label: 'r1', hue: 7 },
          { lane: 'arrive', at: 1.5, label: 'r2', hue: 7 },
          { lane: 'arrive', at: 3, label: 'r3', hue: 7 },
          { lane: 'arrive', at: 6, label: 'r4…', hue: 7 },
          { lane: 'batch', at: 5, label: 'linger.ms up', hue: 7 },
          { lane: 'batch', at: 9, label: 'full', hue: 7 },
        ]}
        end={12}
        playable
      />

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
      <Timeline
        title="When does the producer hear “OK”? acks=0 never waits, acks=1 waits for the leader, acks=all for every in-sync replica (schematic time)"
        lanes={[
          { id: 'a0', label: 'acks=0' },
          { id: 'a1', label: 'acks=1' },
          { id: 'aall', label: 'acks=all' },
        ]}
        segments={[
          { lane: 'a0', from: 0, to: 1, label: 'send', hue: 7 },
          { lane: 'a1', from: 0, to: 1, label: 'send', hue: 7 },
          { lane: 'a1', from: 1, to: 3, label: 'leader writes', hue: 3 },
          { lane: 'aall', from: 0, to: 1, label: 'send', hue: 7 },
          { lane: 'aall', from: 1, to: 3, label: 'leader writes', hue: 3 },
          { lane: 'aall', from: 3, to: 6.5, label: 'followers fetch', hue: 3 },
        ]}
        events={[
          { lane: 'a0', at: 1, label: 'done, unconfirmed', hue: 8 },
          { lane: 'a1', at: 3, label: 'ack: 1 copy', hue: 6 },
          { lane: 'aall', at: 6.5, label: 'ack: all ISR', hue: 6 },
        ]}
        end={9}
        unit="steps"
        playable
      />

      <h2>Retries and idempotence</h2>
      <p>
        Networks fail, so the producer retries automatically. But a retry can duplicate a record that was actually
        stored. The <strong>idempotent producer</strong> prevents that by numbering every batch.
      </p>
      <RetryDuplicates />
      <Callout tone="tip">
        Idempotence is on by default since Kafka 3.0 (<code>enable.idempotence=true</code>; it requires{' '}
        <code>acks=all</code>, which is also the default). It protects against duplicates caused by the producer’s own
        retries within one producer session — not against your application calling <code>send()</code> twice, and not
        across a producer restart (the new instance gets a new producer ID).
      </Callout>
      <Flow
        title="How the leader recognises a retry"
        cols={3}
        rows={1}
        rowHeight={100}
        nodes={[
          { id: 'prod', label: 'producer', sub: 'producer id 7, seq 0, 1, 2…', col: 0, row: 0, hue: 7, shape: 'actor' },
          { id: 'leader', label: 'leader of P0', sub: 'last 5 batch seqs per producer', col: 1, row: 0, hue: 3 },
          { id: 'log', label: 'P0 log', sub: 'each batch stored once', col: 2, row: 0, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'prod', to: 'leader', flow: true, hue: 7 },
          { from: 'leader', to: 'log', flow: true, hue: 3 },
        ]}
        steps={[
          { title: 'Every batch is numbered', body: <p>The producer gets a producer id (and epoch) when it starts and numbers its batches per partition: 0, 1, 2…</p>, active: ['prod', 'prod>leader'] },
          { title: 'The leader remembers recent numbers', body: <p>For each producer and partition the leader keeps the sequence numbers of the last 5 batches. That is why idempotence allows at most 5 requests in flight per connection.</p>, active: ['leader'] },
          { title: 'A retry is recognised', body: <p>A batch whose sequence is already among the recent ones is a retry: the leader does not append it again and just acknowledges it.</p>, active: ['prod', 'leader', 'prod>leader'] },
          { title: 'Only new batches reach the log', body: <p>The next number (seq + 1) is appended. A gap (say 3 when 2 is expected) is an error, so batches cannot silently go missing or swap order.</p>, active: ['leader', 'log', 'leader>log'] },
        ]}
      />
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
          { term: 'Sticky partitioning', definition: 'For key-less records: send to one partition until about batch.size bytes have gone to it, then switch.' },
          { term: 'Batch', definition: 'A group of records for the same partition sent together.' },
          { term: 'linger.ms', definition: 'Max wait to fill a batch before sending it.' },
          { term: 'acks', definition: 'How many replicas must store a record before the producer is told it succeeded.' },
          { term: 'Idempotent producer', definition: 'Producer that tags batches with a producer ID and sequence number so its own retries never duplicate.' },
          { term: 'Transaction', definition: 'Atomic write across partitions, visible all-or-nothing to read_committed consumers.' },
        ]}
      />
    </>
  )
}
