import { BarChart, ByteLayout, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { PartitionLog, Terminal, type LogCell } from '../components'
import { KeysExplorer } from '../components/KeysExplorer'
import { KeysFigure } from '../components/KeysFigure'
import { KeysMoveList } from '../components/KeysMoveList'
import { KeysRuns } from '../components/KeysRuns'
import { parseRuns } from '../components/KeysRunsParse'
import { KeysStickySim } from '../components/KeysStickySim'
import { KEYS } from '../data/keys'
import { KEYS_APP } from '../data/keysApp'
import { partitionOf, remap } from '../simulation/keysDistribution'

// ------------------------------------------------------------------ recorded data, parsed for the figures

/** The part of a source file from the line containing `from` up to (not including) the line containing `to`. */
function excerpt(source: string, from: string, to: string) {
  const lines = source.split('\n')
  const start = lines.findIndex((l) => l.includes(from))
  const end = lines.findIndex((l, i) => i > start && l.includes(to))
  const body = lines.slice(start, end)
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length))
  return body.map((l) => l.slice(indent)).join('\n').trimEnd()
}

/** A source file from the line containing `from` to its end (package and imports left out). */
const fromLine = (source: string, from: string) => source.slice(source.indexOf(from)).trimEnd()

/** "partition 3: 60 records" lines → [partition, count]. */
const counts = (out: string) => [...out.matchAll(/partition (\d+): (\d+) records/g)].map((m) => [Number(m[1]), Number(m[2])] as const)
const perPartition = (out: string, partitions: number) => {
  const all = new Array<number>(partitions).fill(0)
  for (const [p, n] of counts(out)) all[p] = n
  return all
}

const SPREAD = KEYS.spread
const RUNS_DEFAULT = parseRuns(SPREAD.defaults.out)
const RUNS_SMALL = parseRuns(SPREAD.small.out)
const RR_COUNTS = perPartition(SPREAD.roundRobin.out, 6)

/** Long round-robin output: the first runs and the totals. */
const rrLines = SPREAD.roundRobin.out.split('\n')
const RR_SHORT = [...rrLines.filter((l) => l.startsWith('records')).slice(0, 8), `… ${rrLines.filter((l) => l.startsWith('records')).length - 8} more runs of one record`, ...rrLines.filter((l) => l.startsWith('partition'))].join('\n')

/** "payments-by-status:1:2850" → records per partition. */
const endOffsets = (out: string) => out.split('\n').map((l) => Number(l.split(':')[2]))
const BY_STATUS = endOffsets(KEYS.hot.offsetsStatus.out)
const BY_ORDER = endOffsets(KEYS.hot.offsetsOrder.out)

/** The trimmed kafka-consumer-groups table → { partition, lag, client } rows. */
const lagRows = (out: string) =>
  out
    .split('\n')
    .slice(1)
    .map((l) => l.trim().split(/\s+/))
    .map((c) => ({ partition: Number(c[2]), current: Number(c[3]), end: Number(c[4]), lag: Number(c[5]), client: c[6] }))
const LAG_STATUS = lagRows(KEYS.hot.lagStatus.out)
const LAG_ORDER = lagRows(KEYS.hot.lagOrder.out)
const statusHot = LAG_STATUS.reduce((a, b) => (b.lag > a.lag ? b : a))

/** Console consumer lines "Partition:1\tcustomer-3\tv1" → each customer's v1 and v2 partitions. */
const REMAP_LINES = [...KEYS.remap.readAll.out.matchAll(/Partition:(\d+)\t(\S+)\t(v\d)/g)].map((m) => ({ partition: Number(m[1]), key: m[2], version: m[3] }))
const REMAP_KEYS = [...new Set(REMAP_LINES.map((l) => l.key))]
const RECORDED_MOVES = REMAP_KEYS.map((key) => ({
  key,
  from: REMAP_LINES.find((l) => l.key === key && l.version === 'v1')?.partition ?? -1,
  to: REMAP_LINES.find((l) => l.key === key && l.version === 'v2')?.partition ?? -1,
}))
const MODEL_MOVES = remap(REMAP_KEYS, 3, 4)
const modelAgrees = MODEL_MOVES.every((m, i) => m.from === RECORDED_MOVES[i].from && m.to === RECORDED_MOVES[i].to)
const movedCount = RECORDED_MOVES.filter((m) => m.from !== m.to).length

/** "Offset:4\tuser-2\tnull" → log cells (the console consumer prints a null value as "null"). */
const cells = (out: string): LogCell[] =>
  [...out.matchAll(/Offset:(\d+)\t(\S+)\t(.*)/g)].map((m) => ({ offset: Number(m[1]), key: m[2], value: m[3] === 'null' ? null : m[3] }))
const BEFORE = cells(KEYS.compacted.before.out)
const AFTER = cells(KEYS.compacted.after.out)

/** The recorded dump: key sizes of the keyed, empty-key and key-less record. */
const DUMP = [...KEYS.stored.dump.out.matchAll(/offset: (\d+) keySize: (-?\d+) valueSize: (\d+)/g)].map((m) => ({ offset: Number(m[1]), keySize: Number(m[2]), valueSize: Number(m[3]) }))

/** KeyFormats lines → { format, hex, partition }. */
const FORMATS = KEYS.formats.send.out.split('\n').map((l) => {
  const m = /^(.*?)\s+bytes=(\S+)\s+-> partition (\d+)/.exec(l)
  return { format: m?.[1] ?? l, hex: m?.[2] ?? '', partition: Number(m?.[3]) }
})
const formatPartitions = new Set(FORMATS.map((f) => f.partition)).size

/** Where the tenants landed, checked against murmur2(tenant) % 6 computed here. */
const TENANT_ROWS = [...KEYS.tenants.send.out.matchAll(/key=(([^:]+):\d+) -> partition (\d+)/g)].map((m) => ({ key: m[1], tenant: m[2], partition: Number(m[3]) }))
const tenantsAgree = TENANT_ROWS.every((r) => partitionOf(r.tenant, 6) === r.partition)

/** SendKeyed: did every keyed record land where murmur2 says? */
const KEYED = [...KEYS.keyed.send.out.matchAll(/key=(\w+)\s+value=(\S+) -> partition (\d+)/g)].map((m) => ({ key: m[1], partition: Number(m[3]) }))
const keyedAgree = KEYED.every((r) => partitionOf(r.key, 3) === r.partition)

// ------------------------------------------------------------------ the producer's decision, as a stepped flow

const DECISION_STEPS = [
  { title: 'send() and serialize', body: <p>Your code hands over topic, key and value. <code>key.serializer</code> turns the key into bytes (or leaves it <code>null</code>); everything after this sees only bytes.</p>, active: ['send', 'ser', 'send>ser'] },
  { title: 'An explicit partition wins', body: <p><code>new ProducerRecord(topic, 2, key, value)</code> names partition 2. The producer uses it as is: no hashing, nothing else is consulted.</p>, active: ['given', 'given>use', 'use', 'ser>given'] },
  { title: 'Then a custom partitioner', body: <p>If <code>partitioner.class</code> is set, your <code>partition(…)</code> method decides, with the key, the value and the cluster metadata in hand. Adaptive partitioning is then off.</p>, active: ['custom', 'given>custom', 'custom>yours', 'yours'] },
  { title: 'Then the key', body: <p>If key bytes exist and <code>partitioner.ignore.keys</code> is false (the default): <code>toPositive(murmur2(keyBytes)) % partitions</code>. An empty key (0 bytes) counts as a key.</p>, active: ['key', 'custom>key', 'key>hash', 'hash'] },
  { title: 'Otherwise: sticky', body: <p>No key (or keys ignored): the partition is left open and the record accumulator puts it in the current “sticky” partition’s batch.</p>, active: ['none', 'key>none', 'none>sticky', 'sticky'] },
  { title: 'Into a batch', body: <p>Whatever decided, the record joins that partition’s batch in the accumulator and leaves with it (see <a href="#/kafka/producers">Producers</a>).</p>, active: ['acc', 'use>acc', 'yours>acc', 'hash>acc', 'sticky>acc'] },
]

function DecisionFlow() {
  return (
    <Flow
      title="How the 4.3 Java producer picks a partition (KafkaProducer.partition, then the accumulator)"
      cols={4}
      rows={4}
      rowHeight={78}
      nodes={[
        { id: 'send', label: 'send()', sub: 'topic, key, value', col: 0, row: 0, hue: 7, shape: 'actor' },
        { id: 'ser', label: 'key.serializer', sub: 'key → bytes', col: 0, row: 1, hue: 7 },
        { id: 'given', label: 'partition set?', sub: 'in the record', col: 1, row: 0, hue: 7 },
        { id: 'custom', label: 'partitioner.class?', sub: 'custom set', col: 1, row: 1, hue: 7 },
        { id: 'key', label: 'key bytes?', sub: 'not ignored', col: 1, row: 2, hue: 7 },
        { id: 'none', label: 'no key', sub: 'or keys ignored', col: 1, row: 3, hue: 7 },
        { id: 'use', label: 'that partition', sub: 'as given', col: 2, row: 0, hue: 3 },
        { id: 'yours', label: 'your partition()', sub: 'any rule', col: 2, row: 1, hue: 3 },
        { id: 'hash', label: 'murmur2 % N', sub: 'same key, same P', col: 2, row: 2, hue: 3 },
        { id: 'sticky', label: 'sticky partition', sub: 'switch per batch', col: 2, row: 3, hue: 3 },
        { id: 'acc', label: 'accumulator', sub: 'batch per partition', col: 3, row: 0, rowSpan: 4, hue: 7, shape: 'queue' },
      ]}
      edges={[
        { from: 'send', to: 'ser', flow: true, hue: 7 },
        { from: 'ser', to: 'given', hue: 7 },
        { from: 'given', to: 'use', label: 'yes', hue: 3 },
        { from: 'given', to: 'custom', label: 'no', hue: 7 },
        { from: 'custom', to: 'yours', label: 'yes', hue: 3 },
        { from: 'custom', to: 'key', label: 'no', hue: 7 },
        { from: 'key', to: 'hash', label: 'yes', hue: 3 },
        { from: 'key', to: 'none', label: 'no', hue: 7 },
        { from: 'none', to: 'sticky', hue: 3 },
        { from: 'use', to: 'acc', hue: 3 },
        { from: 'yours', to: 'acc', hue: 3 },
        { from: 'hash', to: 'acc', flow: true, hue: 3 },
        { from: 'sticky', to: 'acc', flow: true, hue: 3 },
      ]}
      steps={DECISION_STEPS}
    />
  )
}

const PARTITION_SOURCE = `private int partition(ProducerRecord<K, V> record, byte[] serializedKey, byte[] serializedValue, Cluster cluster) {
    if (record.partition() != null)
        return record.partition();

    if (partitionerPlugin.get() != null) {
        int customPartition = partitionerPlugin.get().partition(
            record.topic(), record.key(), serializedKey, record.value(), serializedValue, cluster);
        ...
        return customPartition;
    }

    if (serializedKey != null && !partitionerIgnoreKeys) {
        // hash the keyBytes to choose a partition
        return BuiltInPartitioner.partitionForKey(serializedKey, cluster.partitionsForTopic(record.topic()).size());
    } else {
        return RecordMetadata.UNKNOWN_PARTITION;
    }
}`

// ------------------------------------------------------------------ the lesson

export default function Keys() {
  return (
    <>
      <LessonGoals
        goals={[
          'say what a record key is, where it is stored, and how null, empty and set keys differ',
          'list what the key decides: partition, per-key order, which consumer, compaction, joins',
          'predict what the producer does with key-less records (sticky partitioning) and when that is the right choice',
          'choose a good key — or an explicit partition, or a custom partitioner — and justify it',
          'recognise hot keys, keys moved by new partitions, mismatched hashes and serializers before they hurt',
        ]}
        before={
          <>
            <a href="#/kafka/topics-partitions">Topics and partitions</a> and <a href="#/kafka/producers">Producers</a>
          </>
        }
      />

      <h2>What a key is</h2>
      <p>A key is an optional array of bytes stored next to the value of every record.</p>
      <p>
        Your code passes an object (a <code>String</code>, a <code>Long</code>, a struct); the producer’s <code>key.serializer</code> turns it into bytes.
        Kafka never looks inside those bytes. It only <strong>hashes</strong> them to pick a partition and <strong>compares</strong> them during compaction.
        A key is either <strong>null</strong> (no key at all), <strong>empty</strong> (zero bytes — still a key), or a byte string.
      </p>
      <ByteLayout
        title="One record inside a batch (record format v2): the key sits right before the value"
        rows={[
          {
            label: 'keyed',
            fields: [
              { label: 'length', bytes: 1 },
              { label: 'attributes', bytes: 1 },
              { label: 'ts delta', bytes: 1 },
              { label: 'offset delta', bytes: 1 },
              { label: 'key length', bytes: 1, hue: 7, content: String(DUMP[0]?.keySize) },
              { label: 'key', bytes: DUMP[0]?.keySize ?? 0, hue: 7, content: 'customer-1' },
              { label: 'value length', bytes: 1 },
              { label: 'value', bytes: DUMP[0]?.valueSize ?? 0, hue: 3, content: 'hello' },
              { label: 'headers', bytes: 1, content: '0' },
            ],
          },
          {
            label: 'empty key',
            fields: [
              { label: 'length', bytes: 1 },
              { label: 'attributes', bytes: 1 },
              { label: 'ts delta', bytes: 1 },
              { label: 'offset delta', bytes: 1 },
              { label: 'key length', bytes: 1, hue: 7, content: String(DUMP[1]?.keySize) },
              { label: 'value length', bytes: 1 },
              { label: 'value', bytes: DUMP[1]?.valueSize ?? 0, hue: 3, content: 'empty key' },
              { label: 'headers', bytes: 1, content: '0' },
            ],
          },
          {
            label: 'null key',
            fields: [
              { label: 'length', bytes: 1 },
              { label: 'attributes', bytes: 1 },
              { label: 'ts delta', bytes: 1 },
              { label: 'offset delta', bytes: 1 },
              { label: 'key length', bytes: 1, hue: 8, content: String(DUMP[2]?.keySize) },
              { label: 'value length', bytes: 1 },
              { label: 'value', bytes: DUMP[2]?.valueSize ?? 0, hue: 3, content: 'no key at all' },
              { label: 'headers', bytes: 1, content: '0' },
            ],
          },
        ]}
        caption="Key and value sizes are the recorded ones (kafka-dump-log.sh below): 10, 0 and -1 bytes of key. Lengths and deltas are varints, drawn as 1 byte each (schematic). A null key is stored as length -1 and no bytes; an empty key as length 0."
      />
      <Terminal
        title="recorded: three records, then the segment file"
        steps={[KEYS.stored.keyed, KEYS.stored.unkeyed, { label: 'what the broker stored (fields trimmed)', cmd: KEYS.stored.dump.cmd, out: KEYS.stored.dump.out }]}
      />
      <Table
        head={['', 'null key', 'empty key ("")', 'a key ("customer-1")']}
        rows={[
          ['stored as', 'key length -1', 'key length 0', 'length + bytes'],
          ['partition', 'sticky: spread over all partitions', <>hashed: <strong>every</strong> empty-key record on one partition</>, 'hashed: same key, same partition'],
          ['compacted topic', 'rejected by the broker', 'accepted (one key: "")', 'accepted'],
        ]}
      />
      <p>
        <strong>Keys vs headers.</strong> Headers (<a href="#/kafka/events">Events and records</a>) also carry metadata — a trace id, a content type, a tenant
        — but the producer’s partitioner and the log cleaner never read them. If something should decide placement, ordering or compaction, it belongs in the key; if
        it only describes the record, a header is the right place.
      </p>
      <TermList
        items={[
          { term: 'key.serializer', definition: 'Producer setting naming the class that turns your key object into bytes (StringSerializer, LongSerializer, an Avro serializer…).' },
          { term: 'null key', definition: 'No key at all: stored as length -1. The producer spreads such records with sticky partitioning; compacted topics reject them.' },
          { term: 'empty key', definition: 'A key of zero bytes. It is hashed like any other key, so all empty-key records share one partition.' },
        ]}
      />

      <h2>What the key decides</h2>
      <p>One value — the key bytes — quietly decides five things downstream.</p>
      <Flow
        title="What the key controls"
        cols={4}
        rows={3}
        rowHeight={84}
        nodes={[
          { id: 'key', label: 'key bytes', sub: 'from key.serializer', col: 0, row: 0, rowSpan: 3, hue: 7 },
          { id: 'part', label: 'partition', sub: 'murmur2 % N', col: 1, row: 0, rowSpan: 2, hue: 3, shape: 'log' },
          { id: 'cleaner', label: 'log cleaner', sub: 'compares keys', col: 1, row: 2, hue: 3 },
          { id: 'order', label: 'order per key', sub: 'one log, one order', col: 2, row: 0, hue: 3 },
          { id: 'owner', label: 'one consumer', sub: 'per key, per group', col: 2, row: 1, hue: 1 },
          { id: 'latest', label: 'latest per key', sub: 'compaction', col: 2, row: 2, hue: 3 },
          { id: 'dedupe', label: 'dedupe by key', sub: 'version per entity', col: 3, row: 0, hue: 1 },
          { id: 'joins', label: 'local state, joins', sub: 'co-partitioning', col: 3, row: 1, hue: 1 },
          { id: 'table', label: 'table snapshot', sub: 'rebuild state', col: 3, row: 2, hue: 1 },
        ]}
        edges={[
          { from: 'key', to: 'part', flow: true, hue: 7 },
          { from: 'key', to: 'cleaner', hue: 7 },
          { from: 'part', to: 'order', hue: 3 },
          { from: 'part', to: 'owner', flow: true, hue: 1 },
          { from: 'cleaner', to: 'latest', hue: 3 },
          { from: 'order', to: 'dedupe', hue: 1 },
          { from: 'owner', to: 'joins', hue: 1 },
          { from: 'latest', to: 'table', hue: 1 },
        ]}
        caption="Left: what the producer sets. Middle: what the topic does with it. Right: what consumers and stream processors build on it."
      />
      <ul>
        <li>
          <strong>Partition.</strong> <code>toPositive(murmur2(keyBytes)) % partitions</code> — the same bytes always give the same partition, as long as the
          partition count does not change. Try it in <a href="#/kafka/producers">Producers</a>.
        </li>
        <li>
          <strong>Order per key.</strong> Kafka orders records only inside one partition. Same key → same partition → the order you sent them in.
        </li>
        <li>
          <strong>Which consumer.</strong> In a <a href="#/kafka/consumer-groups">consumer group</a> a partition has one owner, so one instance sees all of a
          key’s records (until a rebalance moves the partition). That makes per-key caches, counters and “last seen version” checks for{' '}
          <a href="#/kafka/delivery">idempotent consumers</a> safe without locks.
        </li>
        <li>
          <strong>Compaction.</strong> On a <code>cleanup.policy=compact</code> topic the cleaner keeps the newest record per key; a null value (a tombstone)
          deletes the key (<a href="#/kafka/retention">Retention and compaction</a>).
        </li>
        <li>
          <strong>Joins and state.</strong> Kafka Streams and ksqlDB keep state per partition, so two topics joined on a key must be{' '}
          <strong>co-partitioned</strong>: same key bytes, same partition count, same partitioner (<a href="#/kafka/kafka-streams">Kafka Streams</a>).
        </li>
      </ul>
      <p>The recorded program below sends keyed orders and computes the partition by hand with the client’s own murmur2, next to the partition the broker reported.</p>
      <CodeBlock title="SendKeyed.java (the code that ran)" language="java" code={fromLine(KEYS_APP['SendKeyed.java'], '/** Keyed records')} />
      <Terminal title={`recorded: Kafka ${KEYS.version}, topic orders with 3 partitions`} steps={[KEYS.keyed.setup, { cmd: KEYS.keyed.send.cmd, out: KEYS.keyed.send.out }]} />
      <StatTiles
        stats={[
          { label: 'alice’s orders on one partition', value: `${KEYED.filter((r) => r.key === 'alice').length} of ${KEYED.filter((r) => r.key === 'alice').length}`, sub: `all on P${KEYED.find((r) => r.key === 'alice')?.partition}`, hue: 3 },
          { label: 'hand-computed = broker', value: keyedAgree ? 'yes' : 'no', sub: 'murmur2 here and in Java', hue: keyedAgree ? 6 : 8 },
          { label: 'explicit partition 2', value: 'P2', sub: 'beats the hash (alice → P0)', hue: 7 },
        ]}
      />
      <Timeline
        title="Order per key (schematic): order 7 is created, paid, shipped. With key = order id all three share one partition; with no key they spread, and a faster consumer handles “paid” before “created”."
        lanes={[
          { id: 'kp', label: 'key: P0' },
          { id: 'kc', label: 'key: consumer' },
          { id: 'np0', label: 'no key: P0' },
          { id: 'np1', label: 'no key: P1' },
          { id: 'nc', label: 'no key: consumers' },
        ]}
        segments={[
          { lane: 'kc', from: 1.5, to: 2.5, label: 'created', hue: 1 },
          { lane: 'kc', from: 2.5, to: 3.5, label: 'paid', hue: 1 },
          { lane: 'kc', from: 3.5, to: 4.5, label: 'shipped', hue: 1 },
          { lane: 'nc', from: 2.2, to: 3.2, label: 'paid (B)', hue: 8 },
          { lane: 'nc', from: 4, to: 5, label: 'created (A)', hue: 8 },
          { lane: 'nc', from: 5, to: 6, label: 'shipped (A)', hue: 1 },
        ]}
        events={[
          { lane: 'kp', at: 1, label: 'created', hue: 3 },
          { lane: 'kp', at: 2, label: 'paid', hue: 3 },
          { lane: 'kp', at: 3, label: 'shipped', hue: 3 },
          { lane: 'np0', at: 1, label: 'created', hue: 3 },
          { lane: 'np1', at: 2, label: 'paid', hue: 3 },
          { lane: 'np0', at: 3, label: 'shipped', hue: 3 },
        ]}
        end={7}
        unit="steps"
        playable
      />

      <h2>How the producer picks a partition</h2>
      <p>The producer asks three questions in a fixed order; the first “yes” decides.</p>
      <DecisionFlow />
      <CodeBlock title="KafkaProducer.partition() in kafka-clients 4.3.1 (library source, error check elided)" language="java" code={PARTITION_SOURCE} />

      <h2>No key: let the producer spread records</h2>
      <p>With a null key there is nothing to hash, so the producer is free to pick any partition — and it picks for throughput.</p>
      <p>
        Since Kafka 3.3 (KIP-794) the Java producer has a <strong>built-in uniform sticky partitioner</strong>. It sends key-less records to one partition until
        at least <code>batch.size</code> bytes went there <em>and</em> the current batch is full (at most twice <code>batch.size</code>), then jumps to another
        partition chosen at random. Few large batches instead of many tiny ones: less overhead and better compression, and over time every partition gets its
        share.
      </p>
      <Predict
        question={
          <>
            A program sends 300 small key-less records (about 100 bytes each) to a topic with 6 partitions, with the default <code>batch.size</code> of 16 KB.
            Where do they go?
          </>
        }
        options={['about 50 to each partition', 'nearly all to one partition', 'one record to each partition in turn', 'nowhere: a key is required']}
        answer={1}
        explanation={
          <>
            Recorded: records 1–{RUNS_DEFAULT[0]?.to} went to partition {RUNS_DEFAULT[0]?.partition}, the rest to partition {RUNS_DEFAULT[1]?.partition}. 300 records
            are about two batches’ worth, so the producer stuck to one partition. “Even” only appears over many batches.
          </>
        }
      />
      <KeysRuns
        title={`Recorded: 300 key-less records, default batch.size (16384), 6 partitions`}
        runs={RUNS_DEFAULT}
        caption="Each block is a run of consecutive records on one partition."
      />
      <KeysRuns
        title="Recorded: 120 key-less records with batch.size=1024 and linger.ms=50"
        runs={RUNS_SMALL}
        caption="Smaller batches, more switches. The next partition is random, so it can repeat and some partitions are skipped in a short run; over thousands of batches it evens out."
      />
      <CodeBlock title="Spread.java — the sending loop (the code that ran)" language="java" code={excerpt(KEYS_APP['Spread.java'], 'Properties props = Config.producer();', '// print consecutive records')} />
      <Terminal
        title="recorded: the same program, four ways of not using a key"
        steps={[
          { label: 'null key, small batches', cmd: SPREAD.small.cmd, out: SPREAD.small.out },
          { label: 'empty key "" — hashed, so one partition for all', cmd: SPREAD.empty.cmd, out: SPREAD.empty.out },
          { label: 'keys set but partitioner.ignore.keys=true — treated like null keys', cmd: SPREAD.ignore.cmd, out: SPREAD.ignore.out },
          { label: 'RoundRobinPartitioner — one record per partition in turn (output shortened)', cmd: SPREAD.roundRobin.cmd, out: RR_SHORT },
        ]}
      />
      <BarChart
        title="Recorded: 60 records each way — where they landed (6 partitions)"
        bars={[
          ...perPartition(SPREAD.empty.out, 6).map((n, p) => ({ label: `empty key P${p}`, value: n, hue: (n ? 8 : 3) as 8 | 3 })),
          ...RR_COUNTS.map((n, p) => ({ label: `round robin P${p}`, value: n, hue: 3 as const })),
        ]}
      />
      <p>Two settings tune the built-in partitioner; both are ignored when you set a custom <code>partitioner.class</code>.</p>
      <Table
        head={['setting (4.3 default)', 'what it does']}
        rows={[
          [<code key="a">partitioner.adaptive.partitioning.enable=true</code>, 'When switching, prefer partitions whose leaders have fewer queued batches, so a slow broker gets less new data. Off: uniform random.'],
          [<code key="b">partitioner.availability.timeout.ms=0</code>, 'If a leader cannot take produce requests for this long, skip its partitions when switching. 0 disables the check.'],
          [<code key="c">partitioner.ignore.keys=false</code>, 'true: never hash keys; keyed records are spread like key-less ones (the key is still stored, e.g. for compaction).'],
        ]}
      />
      <KeysStickySim />
      <Table
        head={['client version', 'key-less records go…']}
        rows={[
          ['before 2.4', 'round robin, one record per partition in turn (DefaultPartitioner) — many small batches'],
          ['2.4 – 3.2', 'sticky: switch when a new batch is created (KIP-480, DefaultPartitioner / UniformStickyPartitioner) — slow brokers ended up with more data'],
          ['3.3 and later', 'built-in uniform sticky: switch after batch.size bytes, adaptive to broker load (KIP-794); the old classes deprecated'],
          ['4.0 and later', 'DefaultPartitioner and UniformStickyPartitioner removed; leave partitioner.class unset for the built-in behaviour. RoundRobinPartitioner remains.'],
        ]}
      />
      <Callout tone="tip" title="When null is the right key">
        Independent events with no ordering need between them — clicks, page views, log lines, metrics, sensor readings where only aggregates matter. You get the
        best batching and an even spread, and no hot partitions. Not for compacted topics (rejected), not when a consumer keeps per-entity state, and not when
        “created” must be handled before “paid”.
      </Callout>

      <h2>Setting a key</h2>
      <p>Set a key when records about the same thing must stay together.</p>
      <Table
        head={['you need', 'because', 'key']}
        rows={[
          ['events of one entity in order', 'order exists only within a partition', 'the entity / aggregate id (order id, account id)'],
          ['the latest state per entity', 'compaction keeps the newest record per key', 'the id of the thing whose state it is'],
          ['per-entity state in a consumer', 'one consumer owns all of a key’s records', 'the id the state is kept by'],
          ['joins in Kafka Streams / ksqlDB', 'joined records must meet in the same task', 'the join field, identically serialized on both topics'],
          ['locality for a tenant', 'one tenant’s data in one place, in order', 'tenant id — beware of big tenants (see hot keys)'],
        ]}
      />
      <p>
        <strong>A good key is</strong> stable (never changes for the entity), immutable once written, has <strong>many distinct values</strong> (high cardinality)
        and spreads traffic evenly — an order id, an account id, a device id. <strong>Composite keys</strong> such as <code>tenant-a:order-2001</code> order per
        order while keeping the tenant visible.
      </p>
      <p>
        <strong>Poor keys:</strong> a status (<code>PAID</code>, <code>FAILED</code>), a boolean, a country, a weekday — a handful of values for many partitions; a
        timestamp — unique, so it orders nothing and compacts nothing; anything that changes over an entity’s life (an e-mail address). And no personal data or
        secrets: keys are printed by tools, kept forever in compacted topics, and copied into state stores and changelog topics.
      </p>
      <KeysExplorer />
      <h3>Key, explicit partition or custom partitioner?</h3>
      <Table
        head={['approach', 'use when', 'you get', 'you give up']}
        rows={[
          ['leave the key null', 'events are independent', 'big batches, even spread, no hot partitions', 'order, compaction, per-key consumers'],
          ['set a key', 'per-entity order, compaction, joins (most cases)', 'stable placement every client understands', 'evenness when keys are few or skewed'],
          [<>explicit partition: <code key="p">ProducerRecord(topic, 2, key, value)</code></>, 'you manage placement yourself — e.g. replaying one partition into the same partition of a copy', 'exact control', 'it breaks when the partition count changes; other producers must agree; easy to get wrong'],
          [<>custom <code key="c">partitioner.class</code></>, 'placement must follow part of the key, or a rule hashing cannot express', 'any rule, in one place', 'adaptive partitioning; every producer (and Streams, Connect) must use the same class'],
          [<code key="i">partitioner.ignore.keys=true</code>, 'the key is only for compaction or consumers, not placement', 'spread like null keys, key still stored', 'per-key order'],
        ]}
      />
      <p>
        The recorded custom partitioner below keeps a <strong>composite key</strong> <code>tenant:order</code> but places records by the tenant part only: one
        tenant’s orders stay in order with each other, while the full key still identifies each order for compaction.
      </p>
      <CodeBlock title="TenantPartitioner.java (the code that ran)" language="java" code={fromLine(KEYS_APP['TenantPartitioner.java'], '/**')} />
      <CodeBlock title="SendTenants.java — registering it" language="java" code={excerpt(KEYS_APP['SendTenants.java'], 'Properties props', 'String[] keys')} />
      <Terminal title="recorded: tenant-orders, 6 partitions" steps={[{ cmd: KEYS.tenants.send.cmd, out: KEYS.tenants.send.out }]} />
      <StatTiles
        stats={[...new Set(TENANT_ROWS.map((r) => r.tenant))].map((tenant) => ({
          label: tenant,
          value: `P${TENANT_ROWS.find((r) => r.tenant === tenant)?.partition}`,
          sub: `${TENANT_ROWS.filter((r) => r.tenant === tenant).length} orders${tenantsAgree ? ' · = murmur2(tenant) % 6' : ''}`,
          hue: 3,
        }))}
      />
      <Callout tone="warn">
        A custom partitioner lives only in your producer. The console producer, Kafka Connect, Kafka Streams or another team’s service still hash the
        whole key — their records for <code>tenant-a:1001</code> land elsewhere. Streams joins assume the default partitioner, so a topic written this way
        is not co-partitioned with anything. Prefer “key = tenant” plus an order id in the value when tenant order is what you need.
      </Callout>

      <h2>What goes wrong</h2>
      <p>Every problem with keys is one of five, and all of them were recorded on a real broker or are easy to check.</p>

      <h3>1. Hot keys and low-cardinality keys</h3>
      <p>
        The same 3,000 payment events, keyed two ways: by <strong>status</strong> (80% <code>PAID</code>, 15% <code>PENDING</code>, 5% <code>FAILED</code>) and by{' '}
        <strong>order id</strong>.
      </p>
      <CodeBlock title="SendStatuses.java — the key choice (the code that ran)" language="java" code={excerpt(KEYS_APP['SendStatuses.java'], 'String status =', '}')} />
      <BarChart
        title="Recorded: records per partition, keyed by status (6 partitions)"
        bars={BY_STATUS.map((n, p) => ({ label: `P${p}`, value: n, hue: n > 1000 ? 8 : 3, display: `${n.toLocaleString()}${n > 1000 ? ' · PAID + PENDING' : n === 0 ? ' · idle' : ' · FAILED'}` }))}
        max={3000}
      />
      <BarChart title="Recorded: records per partition, keyed by order id" bars={BY_ORDER.map((n, p) => ({ label: `P${p}`, value: n, hue: 3 }))} max={3000} />
      <p>
        Three statuses can use at most three partitions — and <code>PAID</code> and <code>PENDING</code> even hash to the same one, so four of six partitions
        stayed empty. Three identical consumers (5 ms per record) then read each topic for 14 seconds:
      </p>
      <BarChart
        title="Recorded: consumer lag per partition 10 s after the consumers started"
        bars={[
          ...LAG_STATUS.map((r) => ({ label: `status P${r.partition}`, value: r.lag, hue: (r.lag > 0 ? 8 : 1) as 8 | 1, display: `${r.lag.toLocaleString()} · ${r.client}` })),
          ...LAG_ORDER.map((r) => ({ label: `order id P${r.partition}`, value: r.lag, hue: 1 as const, display: `${r.lag} · ${r.client}` })),
        ]}
      />
      <Terminal title="recorded: the two groups" steps={[KEYS.hot.lagStatus, KEYS.hot.lagOrder, { cmd: KEYS.hot.workerCmd + '   # and worker-2, worker-3', out: KEYS.hot.statusWorkers.join('\n') }]} />
      <p>
        One worker did all the work of the status-keyed topic and was {statusHot.lag.toLocaleString()} records behind; the other two idled. Adding consumers would
        not help: a partition has one owner. Keyed by order id, every worker finished its share. Fixes: key by a high-cardinality id; if one real entity is
        genuinely hot, split it (<code>account-7#0…#3</code>, “salting”) and accept that its order now only holds within each sub-key — or merge the pieces
        downstream.
      </p>

      <h3>2. Adding partitions moves keys</h3>
      <Predict
        question={
          <>
            Eight customers each have one record in a topic with 3 partitions. You add a fourth partition and send one more record per customer. How many
            customers’ new record lands on a <em>different</em> partition than their first?
          </>
        }
        options={['none — Kafka keeps keys where they were', 'about 2 of 8', 'about 6 of 8']}
        answer={2}
        explanation={
          <>
            Recorded: {movedCount} of {RECORDED_MOVES.length}. <code>hash % 3</code> and <code>hash % 4</code> agree only by chance (about one key in four). Kafka
            does not move old records, so a moved customer now has history in one partition and new events in another — a consumer can process them out of order.
          </>
        }
      />
      <Terminal title="recorded: console producer with keys, console consumer printing partition and key" steps={[KEYS.remap.setup, KEYS.remap.first, KEYS.remap.readFirst, KEYS.remap.alter, KEYS.remap.second, KEYS.remap.readAll]} />
      <KeysFigure
        title={`Recorded: each customer’s partition with 3 partitions (v1) → with 4 partitions (v2): ${movedCount} of ${RECORDED_MOVES.length} moved`}
        caption={<>The pure TypeScript partitioner of this site predicts {modelAgrees ? 'exactly the same placement for every customer' : 'a different placement — check the recording'}.</>}
      >
        <KeysMoveList moves={RECORDED_MOVES} />
      </KeysFigure>
      <p>
        Plan partitions for the future up front (they are cheap; pick a number with many divisors such as 12 or 24). If you must grow a keyed topic: create a new
        topic with more partitions, stop producers, let consumers drain the old topic, then switch — or accept the short window of disorder where it is harmless.
        Kafka Streams state also follows the old partitioning; adding input partitions breaks it.
      </p>

      <h3>3. Same id, different bytes</h3>
      <p>The partitioner hashes bytes, not meaning. The same customer 42 serialised four ways:</p>
      <CodeBlock title="KeyFormats.java (excerpt of the code that ran)" language="java" code={excerpt(KEYS_APP['KeyFormats.java'], 'Map<String, byte[]> keys', 'Properties props')} />
      <Terminal title="recorded: topic customers, 6 partitions" steps={[{ cmd: KEYS.formats.send.cmd, out: KEYS.formats.send.out }]} />
      <ByteLayout
        title={`The key bytes of “42”, recorded — ${formatPartitions} different partitions for one customer`}
        rows={FORMATS.map((f) => ({
          label: `${f.format.replace(/\s+/g, ' ')} → P${f.partition}`,
          fields: (f.hex.match(/../g) ?? []).map((b, i) => ({ label: `${i}`, bytes: 1, hue: 7 as const, content: b })),
        }))}
        caption="Each cell is one key byte in hex. A space inside JSON, a switch from int to long or from String to Avro — all new bytes, so a new partition, and on a compacted topic a new key that never replaces the old one."
      />
      <p>
        Fix the key format once per topic and treat it as part of the contract (<a href="#/kafka/schema-registry">Schema Registry</a> covers values; keys
        deserve the same care). Avoid JSON keys unless their serialisation is canonical; with Avro or Protobuf keys, the schema id inside the bytes changes
        when the key schema changes — another way to move keys.
      </p>

      <h3>4. Different clients, different hash</h3>
      <p>
        Clients built on librdkafka (C/C++, Python <code>confluent-kafka</code>, Go <code>confluent-kafka-go</code>, .NET) default to{' '}
        <code>partitioner=consistent_random</code>: a <strong>CRC-32</strong> of the key, and a random partition for null or empty keys. The Java client uses
        murmur2. A Python service and a Java service writing the same key to the same topic disagree on the partition — per-key order is gone.
        Fix: set <code>partitioner=murmur2_random</code> in the librdkafka clients (Java-compatible murmur2, random for null keys). Switch the explorer above to
        “CRC-32” to see how differently the same keys land.
      </p>
      <Callout tone="note">Not recorded here (no librdkafka client in the lab); based on librdkafka’s configuration reference. The CRC-32 in the explorer is the standard one, computed in your browser.</Callout>

      <h3>5. Compacted topics need keys</h3>
      <Terminal title="recorded: a key-less record on a compacted topic" steps={[KEYS.compacted.setup, KEYS.compacted.noKey]} />
      <p>
        The broker validates every batch for a compacted topic and rejects records without a key (<code>InvalidRecordException</code>); the producer logs the error
        and the record is lost unless your callback handles it. With keys, compaction does what it promises — recorded on the same broker, with a tiny{' '}
        <code>segment.ms</code> so the cleaner runs within seconds:
      </p>
      <Terminal title="recorded: keyed updates and a tombstone" steps={[KEYS.compacted.produce, KEYS.compacted.roll]} />
      <KeysFigure
        title="Recorded: user-profiles before and after compaction"
        caption={
          <>
          Read with the console consumer before and after the log cleaner ran. Only the newest record per key survives; offsets keep their numbers. user-2’s
          tombstone (null) stays for <code>delete.retention.ms</code> (1 day by default) so consumers learn about the delete. user-4 sits in the active segment, which is never compacted.
          </>
        }
      >
        <PartitionLog label="before" cells={BEFORE} showValues showNext={false} />
        <PartitionLog label="after" cells={AFTER} showValues showNext={false} />
      </KeysFigure>

      <h2>Keys set for you: CDC, outbox, Streams</h2>
      <p>Several tools choose the key for you — know what they choose.</p>
      <Table
        head={['tool', 'key it sets', 'why it matters']}
        rows={[
          [<a key="d" href="#/kafka/debezium">Debezium</a>, 'the row’s primary key, e.g. {"id":7} (null for tables without one, unless message.key.columns says otherwise)', 'all changes of a row in order; delete → tombstone for that key; converter settings change the key bytes'],
          [<a key="o" href="#/kafka/outbox">Outbox</a>, 'the aggregate id from the outbox row', 'all events of one order or account in order, whatever their type'],
          [<a key="s" href="#/kafka/kafka-streams">Kafka Streams</a>, 'whatever selectKey / groupBy / map produce', 'a key change before a stateful step writes through a repartition topic'],
          ['Kafka Connect sinks', 'read the key, e.g. JDBC sink pk.mode=record_key', 'the key becomes the row id for upserts and deletes'],
        ]}
      />
      <Flow
        title="Co-partitioning: a join in Kafka Streams (schematic)"
        cols={4}
        rows={2}
        rowHeight={86}
        nodes={[
          { id: 'o', label: 'orders', sub: 'key customer, 6 P', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'c', label: 'customers', sub: 'key customer, 6 P', col: 0, row: 1, hue: 3, shape: 'log' },
          { id: 't3', label: 'task 3', sub: 'orders-3 + customers-3', col: 1, row: 0, rowSpan: 2, hue: 1 },
          { id: 'store', label: 'state store', sub: 'customer table, P3 only', col: 2, row: 1, hue: 1, shape: 'store' },
          { id: 'out', label: 'enriched orders', sub: 'joined per key', col: 3, row: 0, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'o', to: 't3', flow: true, hue: 3 },
          { from: 'c', to: 't3', flow: true, hue: 3 },
          { from: 't3', to: 'store', both: true, hue: 1 },
          { from: 't3', to: 'out', flow: true, hue: 1 },
        ]}
        caption="Task 3 reads partition 3 of both topics. It can only join if customer 42 is in partition 3 on both sides: same key bytes, same partition count, same partitioner. Streams checks the counts at startup; a GlobalKTable avoids the requirement by copying the whole table to every instance."
      />

      <Predict
        question={<>A Java service keys records with <code>IntegerSerializer</code>. A new service writes the same customer ids with <code>StringSerializer</code>. Do their records for customer 42 share a partition?</>}
        options={['yes — it is the same customer', 'not necessarily — the bytes differ, so the hash differs']}
        answer={1}
        explanation={<>Recorded above: <code>0000002a</code> and <code>3432</code> went to partitions {FORMATS[1]?.partition} and {FORMATS[0]?.partition}. Kafka never sees “42”, only bytes.</>}
      />

      <h2>Checklist</h2>
      <ul>
        <li>Ask “which records must stay in order relative to each other?” — that entity’s id is the key. Nothing? Leave it null.</li>
        <li>Compacted topic, per-entity consumer state, or a join: a key is mandatory.</li>
        <li>Key: stable, immutable, high-cardinality, evenly spread; no statuses, booleans, timestamps, personal data or secrets.</li>
        <li>One key format per topic, written down; the same serializer (and canonical encoding) in every producer.</li>
        <li>All producers of a topic use the same partitioner: murmur2 in Java, <code>partitioner=murmur2_random</code> in librdkafka clients.</li>
        <li>Choose the partition count for future peak load; adding partitions later moves most keys.</li>
        <li>Watch per-partition lag and bytes-in: one busy partition means a hot key.</li>
        <li>Explicit partitions and custom partitioners only with a reason that hashing cannot meet, applied in every producer.</li>
      </ul>

      <Recap
        points={[
          'The key is optional bytes next to the value: null (length -1), empty (0 bytes, still hashed) or a value from key.serializer.',
          'Same key bytes + same partition count = same partition = order per key, one consumer per key, compaction per key, co-partitioned joins.',
          'Null key: the built-in sticky partitioner fills a batch on one partition, then switches at random (adaptive to slow brokers) — great spread, no order.',
          'Explicit partition > custom partitioner > key hash > sticky: the first that applies decides.',
          'Hot or low-cardinality keys idle partitions and consumers; adding partitions, changing serializers or mixing client hashes moves keys.',
        ]}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Built-in partitioner', definition: 'The Java producer’s default since 3.3: murmur2 for keys, uniform sticky with adaptive switching for key-less records.' },
          { term: 'Sticky partitioning', definition: 'Sending key-less records to one partition until about batch.size bytes went there and the batch is full, then switching.' },
          { term: 'Adaptive partitioning', definition: 'partitioner.adaptive.partitioning.enable: when switching, prefer partitions whose leaders have shorter queues of unsent batches.' },
          { term: 'partitioner.ignore.keys', definition: 'Producer setting: true spreads keyed records like key-less ones; the key is still stored.' },
          { term: 'Custom partitioner', definition: 'Your implementation of org.apache.kafka.clients.producer.Partitioner, set with partitioner.class.' },
          { term: 'Hot key', definition: 'A key that carries a large share of the traffic, overloading one partition and the one consumer that owns it.' },
          { term: 'Composite key', definition: 'A key built from several fields, e.g. tenant:order.' },
          { term: 'Co-partitioning', definition: 'Two topics with the same key bytes, partition count and partitioner, so equal keys sit in equal partition numbers — required for joins.' },
        ]}
      />
    </>
  )
}
