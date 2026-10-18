import { useMemo, useState } from 'react'
import { Callout, CodeBlock, Demo, Table, TermList, TextField } from '@/shared/ui'
import { ByteLayout, Flow } from '@/shared/figures'
import { partitionForKey } from '../simulation'
import styles from './lesson.module.css'
import own from './Events.module.css'

const encoder = new TextEncoder()
const EXAMPLE_VALUE = JSON.stringify({ orderId: 42, status: 'PAID', amount: 120.5 })
const bytes = (text: string) => encoder.encode(text).length

function RecordBuilder() {
  const [key, setKey] = useState('order-42')
  const [status, setStatus] = useState('PAID')
  const [traceId, setTraceId] = useState('a1b2c3')

  const value = useMemo(() => JSON.stringify({ orderId: 42, status, amount: 120.5 }), [status])
  const keyBytes = encoder.encode(key).length
  const valueBytes = encoder.encode(value).length
  const partition = key ? partitionForKey(key, 3) : null

  const fields = [
    { name: 'key', content: key || 'null', note: `${keyBytes} bytes · decides the partition`, by: 'producer' },
    { name: 'value', content: value, note: `${valueBytes} bytes · the payload`, by: 'producer' },
    { name: 'headers', content: traceId ? `trace-id: ${traceId}` : '(none)', note: 'optional metadata', by: 'producer' },
    { name: 'timestamp', content: '1727000000000', note: 'ms since epoch', by: 'producer or broker' },
    { name: 'topic', content: 'orders', note: 'where it is written', by: 'producer' },
    {
      name: 'partition',
      content: partition === null ? 'chosen by the sticky partitioner (no key)' : String(partition),
      note: 'toPositive(murmur2(key)) % 3 partitions',
      by: 'partitioner',
    },
    { name: 'offset', content: 'assigned on write', note: 'position in the partition', by: 'broker' },
  ]

  return (
    <Demo
      title="Build a record"
      hint="Change the fields and watch what the record contains. The partition shown is exactly what real Kafka would pick for a 3-partition topic."
      controls={
        <>
          <TextField label="key" value={key} onChange={(e) => setKey(e.target.value)} />
          <TextField label="status" value={status} onChange={(e) => setStatus(e.target.value)} />
          <TextField label="trace-id header" value={traceId} onChange={(e) => setTraceId(e.target.value)} />
        </>
      }
    >
      <div className={own.record}>
        {fields.map((field) => (
          <div key={field.name} className={own.field}>
            <div className={own.name}>{field.name}</div>
            <div className={own.content}>{field.content}</div>
            <div className={own.note}>
              {field.note} · <span className={own.by}>set by {field.by}</span>
            </div>
          </div>
        ))}
      </div>
    </Demo>
  )
}

export default function Events() {
  return (
    <>
      <p>
        Everything in Kafka is an <strong>event</strong> — a small, immutable fact about something that happened.
        “Order 42 was paid.” “User 7 changed their email.” Kafka calls the stored form of an event a{' '}
        <strong>record</strong> (you will also hear <em>message</em>; the words are used interchangeably).
      </p>

      <h2>Anatomy of a record</h2>
      <p>
        A record is surprisingly simple. Your code supplies four parts; the producer then picks the partition and the
        broker assigns the offset:
      </p>
      <ul>
        <li>
          <strong>Key</strong> — optional. Usually the ID of the thing the event is about (<code>order-42</code>). It
          decides which partition the record lands in, so all events for the same key stay in order.
        </li>
        <li>
          <strong>Value</strong> — the payload: what happened. Often JSON, Avro or Protobuf.
        </li>
        <li>
          <strong>Headers</strong> — optional key/value metadata, like HTTP headers: trace IDs, content type, tenant.
        </li>
        <li>
          <strong>Timestamp</strong> — when the event was created (or when the broker received it).
        </li>
      </ul>

      <ByteLayout
        title="One record, drawn to scale: what you send and what Kafka adds"
        rows={[
          {
            label: 'set by your code (violet) and by the broker (aqua)',
            fields: [
              { label: 'key', bytes: bytes('order-42'), content: 'order-42', hue: 7 },
              { label: 'value (JSON)', bytes: bytes(EXAMPLE_VALUE), content: EXAMPLE_VALUE, hue: 7 },
              { label: 'header trace-id', bytes: bytes('trace-id') + bytes('a1b2c3'), content: 'trace-id: a1b2c3', hue: 7 },
              { label: 'timestamp', bytes: 8, content: '1727000000000', hue: 7 },
              { label: 'offset', bytes: 8, content: 'on write', hue: 3 },
            ],
          },
        ]}
        caption="The key, value and header sizes are this example’s raw byte counts (on disk each also gets a short varint length prefix). Timestamp and offset are logically 64-bit numbers; on disk Kafka stores them as small deltas from the values of the record batch the record belongs to. The partition is not stored in the record at all: it is the log the record was written to."
      />

      <RecordBuilder />

      <Callout tone="tip" title="Rule of thumb">
        Pick the key by asking: <em>“Which events must be processed in order relative to each other?”</em> For orders
        that is the order ID; for bank accounts, the account ID. Records with no key are spread evenly but have no
        ordering guarantee.
      </Callout>

      <h2>Kafka only sees bytes</h2>
      <p>
        The broker does not understand JSON or objects. It stores the key and value as raw <strong>bytes</strong>. The
        producer uses a <strong>serializer</strong> to turn objects into bytes, and the consumer uses a matching{' '}
        <strong>deserializer</strong> to turn them back. If the two disagree, the consumer cannot read the data — a
        very common beginner bug.
      </p>
      <Flow
        title="Objects in, bytes on the broker, objects out — only if both sides agree"
        cols={5}
        rows={1}
        rowHeight={96}
        nodes={[
          { id: 'obj', label: 'Order object', sub: 'in the producer', col: 0, row: 0, hue: 7, shape: 'actor' },
          { id: 'ser', label: 'serializer', sub: 'object → bytes', col: 1, row: 0, hue: 7 },
          { id: 'broker', label: 'broker log', sub: 'stores bytes only', col: 2, row: 0, hue: 3, shape: 'log' },
          { id: 'de', label: 'deserializer', sub: 'bytes → object', col: 3, row: 0, hue: 1 },
          { id: 'out', label: 'Order object', sub: 'in the consumer', col: 4, row: 0, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'obj', to: 'ser', flow: true, hue: 7 },
          { from: 'ser', to: 'broker', flow: true, hue: 7 },
          { from: 'broker', to: 'de', flow: true, hue: 1 },
          { from: 'de', to: 'out', flow: true, hue: 1 },
        ]}
        steps={[
          { title: 'Serialize', body: <p>The producer’s key and value serializers turn your objects into byte arrays — e.g. a String key and a JSON value. Only those bytes travel to the broker.</p>, active: ['obj', 'ser', 'obj>ser', 'ser>broker'] },
          { title: 'The broker sees only bytes', body: <p>The broker appends the bytes to the partition log. It never parses them, so it cannot validate the format for you.</p>, active: ['broker', 'ser>broker', 'broker>de'] },
          { title: 'Deserialize', body: <p>The consumer’s deserializers turn the bytes back into objects. They must match what the producer used.</p>, active: ['de', 'out', 'broker>de', 'de>out'] },
          { title: 'When the two disagree', body: <p>A producer writing Avro and a consumer expecting JSON: the bytes arrive fine, but deserializing fails with a SerializationException for every record. Agree on the format (or use a Schema Registry — see <a href="#/kafka/schema-registry">its lesson</a>).</p>, active: ['ser', 'de'] },
        ]}
      />
      <Table
        head={['Format', 'Serializer', 'Good for']}
        rows={[
          ['String', 'StringSerializer', 'Keys such as IDs'],
          ['byte[]', 'ByteArraySerializer', 'Passing payloads through untouched; parse later'],
          ['JSON', 'JSON serializer of your framework', 'Readable, flexible, no schema enforcement'],
          ['Avro / Protobuf', 'with a Schema Registry', 'Compact, typed, safe schema evolution'],
        ]}
      />
      <p>
        A popular, simple setup is <strong>string keys and JSON values</strong>. The consumer reads the value as raw
        bytes and parses the JSON itself, which keeps it tolerant of fields it does not know about:
      </p>
      <CodeBlock
        title="consumer configuration (Java client properties)"
        code={`
key.deserializer=org.apache.kafka.common.serialization.StringDeserializer
value.deserializer=org.apache.kafka.common.serialization.ByteArrayDeserializer
`}
      />

      <Callout tone="warn">
        Records are immutable. You never “update” an event in Kafka; you publish a new event that describes the
        change. To “delete” a key in a compacted topic you write a record with a <code>null</code> value, called a{' '}
        <strong>tombstone</strong> (see <a href="#/kafka/retention">Retention and compaction</a>).
      </Callout>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Record / message', definition: 'One stored event: key, value, headers, timestamp, plus its offset.' },
          { term: 'Key', definition: 'Optional identifier; equal keys go to the same partition and keep their order.' },
          { term: 'Value', definition: 'The payload bytes — what actually happened.' },
          { term: 'Header', definition: 'Optional metadata attached to a record, not part of the payload.' },
          { term: 'Serializer', definition: 'Converts objects to bytes on the producer side.' },
          { term: 'Deserializer', definition: 'Converts bytes back to objects on the consumer side.' },
          { term: 'Schema Registry', definition: 'A service that stores Avro/Protobuf/JSON schemas so producers and consumers agree on the format.' },
        ]}
      />
      <p className={styles.demoNote}>Next: where records physically live.</p>
    </>
  )
}
