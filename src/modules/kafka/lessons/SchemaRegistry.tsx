import { ByteLayout, Flow, StatTiles, type ByteField } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { Terminal } from '../components/Terminal'
import { SchemaRegistryMatrix } from '../components/SchemaRegistryMatrix'
import { ECOSYSTEM, ECOSYSTEM_APPS } from '../data/ecosystem'

const S = ECOSYSTEM.schema
const FILES = ['order-v1.avsc', 'order-v2.avsc', 'OrdersAvro.java', 'build.gradle'] as const
const lang = (f: string) => (f.endsWith('.java') ? 'java' : f.endsWith('.gradle') ? 'groovy' : 'json')

/** The fields of the v2 schema, in order; a v1 record simply ends after `amount`. */
const FIELDS = [
  { name: 'id', type: 'string' },
  { name: 'customer', type: 'string' },
  { name: 'amount', type: 'double' },
  { name: 'currency', type: 'string' },
] as const

/** Splits one recorded `raw` line into the Confluent header and the Avro fields that follow it. */
function wireFields(line: string): ByteField[] {
  const hex = (line.split('| ')[1] ?? '').trim().split(' ')
  const bytes = hex.map((h) => parseInt(h, 16))
  const fields: ByteField[] = [
    { label: 'magic', bytes: 1, hue: 5, content: hex[0] },
    { label: `schema id ${new DataView(Uint8Array.from(bytes.slice(1, 5)).buffer).getInt32(0)}`, bytes: 4, hue: 5, content: hex.slice(1, 5).join(' ') },
  ]
  let i = 5
  for (const f of FIELDS) {
    if (i >= bytes.length) break
    if (f.type === 'string') {
      const len = bytes[i] >> 1 // zig-zag varint; one byte is enough for these short strings
      const text = String.fromCharCode(...bytes.slice(i + 1, i + 1 + len))
      fields.push({ label: `${f.name}: "${text}"`, bytes: 1 + len, hue: 3, content: `len ${len}` })
      i += 1 + len
    } else {
      const value = new DataView(Uint8Array.from(bytes.slice(i, i + 8)).buffer).getFloat64(0, true)
      fields.push({ label: `${f.name}: ${value}`, bytes: 8, hue: 3, content: 'double' })
      i += 8
    }
  }
  return fields
}

const rawLine = (offset: number) => S.raw.out.find((l) => l.startsWith(`offset=${offset} `)) ?? ''
const sizeOf = (offset: number) => Number(/bytes=(\d+)/.exec(rawLine(offset))?.[1] ?? 0)
const versions = (out: string) => JSON.parse(out) as number[]

export default function SchemaRegistry() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain why producers and consumers need a shared, versioned schema',
          'read the 5-byte header that ties every record to a schema id',
          'pick a compatibility mode and know which changes it accepts',
          'evolve a schema without breaking the consumers that are already running',
        ]}
        before="Producers and Consumers (serializers), Retention (records stay for days)"
      />

      <h2>Bytes need an agreement</h2>
      <p>A Kafka broker stores bytes; it never checks what is inside a record.</p>
      <p>
        The producer turns an order into bytes with a <strong>serializer</strong>, and every consumer turns the bytes back with a{' '}
        <strong>deserializer</strong>. That only works while both sides agree on the format. If one team renames a field on Monday, a consumer
        written last year breaks on Tuesday — and the bad records stay in the topic for the whole retention period.
      </p>
      <p>
        A <strong>schema</strong> writes that agreement down. A <strong>schema registry</strong> stores every version of it, gives each one an id,
        and refuses new versions that would break existing readers.
      </p>
      <TermList
        items={[
          { term: 'schema', definition: 'A description of a record: its fields, their types and defaults. Written in Avro, Protobuf or JSON Schema.' },
          { term: 'Schema Registry', definition: 'A small HTTP service (here Confluent Schema Registry) that stores schemas in a Kafka topic, _schemas, and serves them by id.' },
          { term: 'subject', definition: 'A named list of schema versions that must stay compatible with each other — by default one per topic key and one per topic value.' },
          { term: 'schema id', definition: 'A global number for one exact schema text. Every record carries it in its first bytes.' },
          { term: 'compatibility mode', definition: 'The rule the registry applies before it accepts a new version into a subject.' },
          { term: 'writer / reader schema', definition: 'The schema the producer used, and the one the consumer wants. Avro resolves one into the other.' },
        ]}
      />

      <h2>Three schema formats</h2>
      <p>The registry supports three formats; they differ in how much the bytes say about themselves.</p>
      <Table
        head={['Format', 'Schema written in', 'On the wire', 'Typical use']}
        rows={[
          ['Avro', 'JSON (.avsc)', 'compact binary, no field names or tags: unreadable without the writer schema', 'the most common choice with Kafka; schema resolution rules are well defined'],
          ['Protobuf', '.proto', 'binary with a numeric tag per field; the serializer adds message indexes after the schema id', 'teams that already use gRPC / .proto files'],
          ['JSON Schema', 'JSON', 'plain JSON text, field names included', 'readable records; largest on the wire; the weakest evolution rules'],
        ]}
      />
      <p>
        This lesson uses <strong>Avro</strong>: its bytes contain nothing but values, which makes the role of the schema easy to see.
      </p>

      <h2>The path of one record</h2>
      <p>The registry is never on the path of the record itself; producers and consumers only ask it for schemas, and cache the answers.</p>
      <Flow
        title="Producing and consuming an Avro record through the registry"
        cols={5}
        rows={3}
        rowHeight={92}
        nodes={[
          { id: 'p', label: 'Producer', sub: 'Avro serializer', col: 0, row: 1, hue: 7, shape: 'actor' },
          { id: 'r', label: 'Schema Registry', sub: 'subject → versions → ids', col: 2, row: 0, hue: 5, shape: 'store' },
          { id: 't', label: 'orders-avro', sub: 'id + bytes', col: 2, row: 2, hue: 3, shape: 'log' },
          { id: 'c', label: 'Consumer', sub: 'Avro deserializer', col: 4, row: 1, hue: 1, shape: 'actor' },
          { id: 's', label: '_schemas', sub: 'compacted', col: 4, row: 0, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'p', to: 'r', label: 'register / look up' },
          { from: 'p', to: 't', flow: true, hue: 7 },
          { from: 't', to: 'c', flow: true, hue: 1 },
          { from: 'c', to: 'r', label: 'GET schema by id', dashed: true },
          { from: 'r', to: 's', dashed: true },
        ]}
        steps={[
          { title: '1 · serialize', body: <>The serializer derives the subject (<code>orders-avro-value</code>) and registers the schema, or looks it up if it exists. It gets back an id and caches it: the next records do not call the registry.</>, active: ['p', 'r', 'p>r'] },
          { title: '2 · send', body: <>The record value is <code>0x00</code>, the 4-byte id, then the Avro bytes. The broker stores it like any other record.</>, active: ['p', 't', 'p>t'] },
          { title: '3 · deserialize', body: <>The consumer reads the id from the first bytes and fetches that schema once (<code>GET /schemas/ids/&#123;id&#125;</code>), then decodes every record with the same id from its cache.</>, active: ['t', 'c', 'r', 't>c', 'c>r'] },
          { title: '4 · storage', body: <>The registry itself is stateless: all schemas live in the compacted Kafka topic <code>_schemas</code>, so a registry restart loses nothing.</>, active: ['r', 's', 'r>s'] },
        ]}
        caption="Colours: producer c7, topic c3, consumer c1, registry (metadata) c5."
      />

      <h2>Recorded: producing with schema v1</h2>
      <p>We ran a real Kafka {ECOSYSTEM.version} broker, Schema Registry 8.0 and a small Java producer that writes Avro orders.</p>
      <Tabs items={FILES.map((f) => ({ label: f, content: <CodeBlock title={f} language={lang(f)} code={ECOSYSTEM_APPS.schema[f]} /> }))} />
      <p>
        The registry starts empty, with the default compatibility mode. The producer sends three orders with <code>order-v1.avsc</code>:
      </p>
      <Terminal steps={[{ label: 'the global default', ...S.config }, S.createTopic, { cmd: S.produceV1.cmd, out: S.produceV1.out.join('\n') }]} title="recorded: registry config and the v1 producer" />
      <p>
        Nobody registered anything by hand. The serializer did it on the first send (<code>auto.register.schemas=true</code> is the default),
        under a subject named after the topic:
      </p>
      <Terminal steps={[S.subjects, S.versionsAfterV1, S.schemaById1]} title="recorded: what the registry now holds" />

      <Callout tone="warn" title="Auto-registration in production">
        Letting every producer register schemas means any deploy can change the contract. Many teams set <code>auto.register.schemas=false</code>{' '}
        in producers and register schemas from the build pipeline instead, so an incompatible change fails the build, not the release.
      </Callout>

      <h2>Five bytes in front of every record</h2>
      <p>Each record value starts with a magic byte and the schema id; the Avro data follows.</p>
      <ByteLayout
        title="Recorded record values, byte by byte (decoded from the raw consumer output)"
        rows={[
          { label: `offset 0 · schema v1 · ${sizeOf(0)} bytes`, fields: wireFields(rawLine(0)) },
          { label: `offset 3 · schema v2 · ${sizeOf(3)} bytes`, fields: wireFields(rawLine(3)) },
        ]}
        caption="Header (c5): magic byte 0x00 + schema id as a 4-byte big-endian int. Avro data (c3): strings are a zig-zag varint length then UTF-8; a double is 8 bytes little-endian. No field names anywhere."
      />
      <Terminal steps={[{ cmd: S.raw.cmd, out: S.raw.out.join('\n') }]} title="recorded: the same records read as plain bytes" />
      <p>
        Without the schema, <code>0a 61 6c 69 63 65</code> is just six bytes. With it, the reader knows the second field is a string: length 5,
        “alice”. That is why the id must travel with every record.
      </p>

      <Predict
        question={<p>A consumer reads a million records that all carry schema id 1. How many HTTP calls does its deserializer make to the registry?</p>}
        options={['One per record', 'One — then the schema comes from a local cache', 'None — the schema is inside the record']}
        answer={1}
        explanation="Schema ids never change their meaning, so the client caches id → schema forever. The registry sees one request per new id per client, not per record."
      />

      <h2>Subjects and naming</h2>
      <p>A subject decides which schemas are compared with each other.</p>
      <Table
        head={['Strategy', 'Subject name', 'Use it when']}
        rows={[
          [<code key="t">TopicNameStrategy</code>, <code key="n">orders-avro-value</code>, 'default: one record type per topic, evolving over time'],
          [<code key="r">RecordNameStrategy</code>, <code key="n">demo.schema.Order</code>, 'one record type used in many topics'],
          [<code key="tr">TopicRecordNameStrategy</code>, <code key="n">orders-avro-demo.schema.Order</code>, 'several record types in one topic (events of one entity)'],
        ]}
      />
      <p>
        Set it on the serializer with <code>value.subject.name.strategy</code>. Keys have their own subject (<code>orders-avro-key</code>) when they
        are serialized with a schema too; here the key is a plain string.
      </p>

      <h2>Compatibility modes</h2>
      <p>Before it accepts a new version, the registry checks it against the old ones with the subject’s mode.</p>
      <Table
        head={['Mode', 'Guarantee', 'Upgrade first']}
        rows={[
          [<code key="b">BACKWARD</code>, 'new schema can read data written with the previous one (default)', 'consumers'],
          [<code key="f">FORWARD</code>, 'previous schema can read data written with the new one', 'producers'],
          [<code key="fu">FULL</code>, 'both directions', 'either side, in any order'],
          [<code key="n">NONE</code>, 'no check at all', 'everything at once — and hope'],
          [<code key="t">*_TRANSITIVE</code>, 'the same rule, checked against every earlier version, not only the latest', 'as above; needed when consumers may replay old data'],
        ]}
      />
      <SchemaRegistryMatrix
        title="Avro changes each mode accepts (against the latest version)"
        modes={[
          { name: 'BACKWARD', sub: 'new reads old' },
          { name: 'FORWARD', sub: 'old reads new' },
          { name: 'FULL', sub: 'both' },
          { name: 'NONE', sub: 'no check' },
        ]}
        rows={[
          { change: 'add a field with a default', allowed: [true, true, true, true], note: 'recorded below (v2 and v3 with default)' },
          { change: 'add a field without a default', allowed: [false, true, false, true], note: 'recorded below: 409 under BACKWARD' },
          { change: 'remove a field that has a default', allowed: [true, true, true, true] },
          { change: 'remove a field without a default', allowed: [true, false, false, true] },
          { change: 'widen a type (int → long)', allowed: [true, false, false, true] },
          { change: 'change a type (string → int)', allowed: [false, false, false, true] },
          { change: 'rename a field (no alias, no default)', allowed: [false, false, false, true], note: 'a rename is a remove plus an add' },
        ]}
        caption="Avro schema-resolution rules. Two rows were checked against the recorded registry; the others follow the Avro specification. Adding a default to every new field keeps you safe in all modes."
      />
      <p>
        Change the mode for one subject with <code>PUT /config/orders-avro-value</code> and a body like <code>{'{"compatibility":"FULL"}'}</code>{' '}
        (not recorded); <code>GET /config</code> shows the global default.
      </p>

      <h2>Recorded: evolving to v2</h2>
      <p>v2 adds <code>currency</code> with the default <code>"EUR"</code>, which BACKWARD accepts.</p>
      <Terminal steps={[{ cmd: S.produceV2.cmd, out: S.produceV2.out.join('\n') }, S.versionsAfterV2, S.latest]} title="recorded: the v2 producer registers version 2 (schema id 2)" />
      <StatTiles
        stats={[
          { label: 'versions in the subject', value: versions(S.versionsAfterV2.out).length, sub: 'orders-avro-value', hue: 5 },
          { label: 'v1 record (offset 0)', value: `${sizeOf(0)} B`, sub: 'header 5 B + Avro', hue: 3 },
          { label: 'v2 record (offset 3)', value: `${sizeOf(3)} B`, sub: '+ currency "USD"', hue: 3 },
        ]}
      />
      <p>One consumer then reads all six records. It meets two ids, fetches both schemas, and decodes each record with the schema it was written with:</p>
      <Terminal steps={[{ cmd: S.consume.cmd, out: S.consume.out.join('\n') }]} title="recorded: one consumer, records of both versions" />
      <p>
        These are <code>GenericRecord</code>s, so each one keeps its writer schema: old orders have no <code>currency</code>. A consumer compiled
        against v2 (a <em>specific</em> reader schema, <code>specific.avro.reader=true</code>) would instead see <code>currency: "EUR"</code> on the
        old ones — Avro fills in the default during schema resolution (not recorded).
      </p>

      <h2>Recorded: a change the registry refuses</h2>
      <p>A v3 that adds <code>channel</code> without a default would leave new readers unable to read the six records already in the topic.</p>
      <p>
        Ask first with the compatibility endpoint, then try to register it anyway; the registry answers <strong>409</strong> and keeps the subject
        at the versions it had:
      </p>
      <Terminal
        steps={[
          { label: 'check v3 (channel, no default) against the latest version', ...S.checkBad },
          { label: 'register it anyway', ...S.registerBad },
          { label: 'the same field with "default": "web"', ...S.checkGood },
          S.versionsAtEnd,
        ]}
        title="recorded: compatibility check and a rejected registration"
      />
      <Callout tone="tip" title="Make the check part of the build">
        The same <code>POST /compatibility/subjects/…/versions/latest</code> call works from a CI job (or the Maven / Gradle registry plugins).
        A failing check then blocks the merge — long before a producer meets the 409 at runtime.
      </Callout>

      <h2>Design rules</h2>
      <p>A few habits keep schemas evolvable for years.</p>
      <ul>
        <li>Give every new field a default; never remove a field that has none.</li>
        <li>Never reuse a field name (Avro) or a tag number (Protobuf) with a different meaning.</li>
        <li>Keep BACKWARD (or BACKWARD_TRANSITIVE if consumers replay the topic from the start) and deploy consumers before producers.</li>
        <li>Register schemas from the pipeline, check compatibility before merge, and turn off auto-registration in production producers.</li>
        <li>Breaking change you really need? Write a new topic (e.g. <code>orders-v2</code>) and migrate consumers, instead of switching the mode to NONE.</li>
      </ul>

      <Recap
        points={[
          'The broker stores bytes; a schema written down in a registry is the contract between producers and consumers.',
          'Each record value starts with 0x00 and a 4-byte schema id; clients fetch a schema by id once and cache it.',
          'Subjects (by default <topic>-value) hold versions; the compatibility mode decides which new versions are accepted.',
          'BACKWARD (default): new fields need defaults, upgrade consumers first. An incompatible version is refused with HTTP 409.',
        ]}
      />
    </>
  )
}
