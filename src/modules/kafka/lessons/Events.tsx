import { useMemo, useState } from 'react'
import { Callout, CodeBlock, Demo, Table, TermList, TextField } from '@/shared/ui'
import { partitionForKey } from '../simulation'
import styles from './lesson.module.css'
import own from './Events.module.css'

const encoder = new TextEncoder()

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
      content: partition === null ? 'any (no key)' : String(partition),
      note: 'murmur2(key) % 3 partitions',
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
      <p>A record is surprisingly simple. Four parts come from the producer, and the broker adds the rest:</p>
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
        <strong>tombstone</strong> (lesson 10).
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
