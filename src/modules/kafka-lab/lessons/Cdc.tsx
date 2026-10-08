import { Callout, CodeBlock, Table } from '@/shared/ui'
import { ORDER_CDC_CONSUMER_JAVA } from '../code'
import { CDC_CONSUMER_OUTPUT, UNWRAPPED_RECORDS } from '../transcripts'

export default function Cdc() {
  return (
    <>
      <p>
        In CDC there is no producer code at all: the “producing” is ordinary SQL, and Debezium publishes each change. Your
        code only consumes. A typical job: keep a copy of a table somewhere else — a search index, a cache, another
        service’s database. The example keeps it in memory.
      </p>

      <h2>A consumer for change events</h2>
      <CodeBlock title="OrderCdcConsumer.java" code={ORDER_CDC_CONSUMER_JAVA} />
      <ul>
        <li>A <code>null</code> value is a tombstone; skip it (or treat it as “delete key”).</li>
        <li>For deletes the row is in <code>before</code>; for everything else in <code>after</code>.</li>
        <li><code>r</code> events come from the initial snapshot and mean “this row exists” — handle them like inserts.</li>
      </ul>
      <CodeBlock title="gradle run -Pmain=com.example.shop.OrderCdcConsumer" code={CDC_CONSUMER_OUTPUT} />
      <p>
        Leave it running and change rows in <code>psql</code>: every statement shows up within a second.
      </p>

      <h2>Simpler records with unwrap</h2>
      <p>
        If consumers only need the new row, let Connect strip the envelope with Debezium’s{' '}
        <code>ExtractNewRecordState</code> transform. Add to the connector config:
      </p>
      <CodeBlock
        title="extra connector settings"
        code={`"transforms": "unwrap",
"transforms.unwrap.type": "io.debezium.transforms.ExtractNewRecordState",
"transforms.unwrap.add.fields": "op,source.ts_ms"`}
      />
      <CodeBlock title="records with unwrap (a second connector, prefix shopflat)" code={UNWRAPPED_RECORDS} />
      <Table
        head={['', 'Envelope (default)', 'Unwrapped']}
        rows={[
          ['Value', '{before, after, source, op, ts_ms}', 'just the row, plus any add.fields as __op, __source_ts_ms'],
          ['Delete', 'op=d event, then a tombstone', 'only a tombstone (delete.tombstone.handling.mode=tombstone)'],
          ['Good for', 'Auditing, knowing what changed', 'Mirroring tables, sink connectors'],
        ]}
      />
      <Callout tone="warn" title="Two connectors, two slots">
        A second connector on the same database needs its own <code>slot.name</code> and <code>topic.prefix</code>; it can
        share the publication. Each slot keeps its own copy of unread WAL.
      </Callout>

      <h2>Make it correct</h2>
      <ul>
        <li>
          <strong>Idempotent writes.</strong> At-least-once delivery means an event can arrive twice. Upsert by primary key
          (<code>INSERT … ON CONFLICT (id) DO UPDATE</code>) instead of plain inserts, and deletes are naturally safe.
        </li>
        <li>
          <strong>Order per key.</strong> One partition (or the default key-based partitioning) keeps every change of a row
          in order. Do not process one key’s events in parallel.
        </li>
        <li>
          <strong>Schema changes.</strong> When a column is added, events simply gain a field; parse JSON tolerantly
          (Jackson ignores unknown fields when you read trees, as here).
        </li>
        <li>
          <strong>Publishing your own events from a database?</strong> Write them to an outbox table in the same
          transaction and capture that table — see “The outbox pattern” in the Apache Kafka module.
        </li>
      </ul>
    </>
  )
}
