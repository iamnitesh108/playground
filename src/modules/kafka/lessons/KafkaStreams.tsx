import { Flow, StatTiles, Timeline, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { AppLog, Terminal } from '../components'
import { ECOSYSTEM, ECOSYSTEM_APPS } from '../data/ecosystem'

const K = ECOSYSTEM.streams
const SOURCE = ECOSYSTEM_APPS.streams['OrderStats.java']

/** The part of the real source between two marker lines (both included / excluded as noted). */
function excerpt(from: string, to: string) {
  const lines = SOURCE.split('\n')
  const start = lines.findIndex((l) => l.includes(from))
  const end = lines.findIndex((l, i) => i > start && l.includes(to))
  return lines.slice(start, end).join('\n').replace(/^ {4}/gm, '').trimEnd()
}

/** "sent key=alice value=20 at 10:00:13" → { customer, amount, second } in the order the producer sent them. */
const SENT = K.produce.out.map((l) => {
  const m = /key=(\w+) value=(\d+) at 10:00:(\d\d)/.exec(l)
  return { customer: m?.[1] ?? '', amount: Number(m?.[2]), second: Number(m?.[3]) }
})
/** The skipped record's event time in seconds after 10:00:00 (= its window start, the first window), read from the recorded warning. */
const lateMatch = /timestamp=\[(\d+)\] window=\[(\d+)/.exec(K.lateWarning[0] ?? '')
const lateSecond = lateMatch ? (Number(lateMatch[1]) - Number(lateMatch[2])) / 1000 : -1
const CUSTOMERS = ['alice', 'bob', 'carol'] as const

/** Output records as [key, value] pairs, in the order the console consumer printed them. */
const records = (topic: keyof typeof K.outputs) => K.outputs[topic].out.split('\n').map((l) => l.split('\t').slice(1) as [string, string])
const PER_CUSTOMER = records('orders-per-customer-out')
const WINDOWED = records('orders-per-customer-10s-out')
const QUERY = Object.fromEntries(K.query.out.map((l) => /: (\w+) = (\d+)/.exec(l)?.slice(1, 3) ?? []))
const internalTopics = K.topics.out.split('\n').filter((t) => t.startsWith('order-stats-'))
const taskLines = (lines: readonly string[]) => lines.filter((l) => l.startsWith('active tasks'))

const windowEvents: TimelineEvent[] = SENT.map((o) => ({
  lane: o.customer,
  at: o.second,
  label: o.second === lateSecond ? `${o.second}s late` : `${o.second}s`,
  hue: o.second === lateSecond ? 8 : 7,
}))
const windowSegments: TimelineSegment[] = [0, 10, 20].map((start) => ({
  lane: 'windows',
  from: start,
  to: start + 10,
  label: `[${start}s, ${start + 10}s)`,
  hue: 3,
}))

/** Schematic: alice's on-time orders under three window types. */
const ALICE = SENT.filter((o) => o.customer === 'alice' && o.second !== lateSecond).map((o) => o.second)

export default function KafkaStreams() {
  return (
    <>
      <LessonGoals
        goals={[
          'describe a stream-processing app as a topology of sources, processors and sinks',
          'tell KStream, KTable and GlobalKTable apart',
          'see where state lives: local stores backed by changelog topics',
          'reason about windows, event time and late records',
          'scale an app by adding instances, and know the limit',
        ]}
        before="Consumer groups, Offsets, Retention and compaction"
      />

      <h2>A library, not a cluster</h2>
      <p>Kafka Streams is a Java library you add to your own application; there is no separate processing cluster.</p>
      <p>
        Your app reads input topics, transforms the records, and writes output topics. Under the hood it is a consumer group plus a producer, with
        local state on disk. To run it on more machines you start more copies of the same app.
      </p>
      <Flow
        title="Two instances of one Streams app, sharing the work through Kafka"
        cols={5}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'in', label: 'orders', sub: 'input topic', col: 0, row: 0, rowSpan: 2, hue: 3, shape: 'log' },
          { id: 'a', label: 'instance 1', sub: 'app + Streams', col: 2, row: 0, hue: 1, shape: 'actor' },
          { id: 'b', label: 'instance 2', sub: 'same app id', col: 2, row: 1, hue: 1, shape: 'actor' },
          { id: 'out', label: 'output topics', sub: 'counts, big orders', col: 4, row: 0, hue: 3, shape: 'log' },
          { id: 'int', label: 'internal topics', sub: 'Streams-managed', col: 4, row: 1, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'in', to: 'a', flow: true },
          { from: 'in', to: 'b', flow: true },
          { from: 'a', to: 'out', flow: true },
          { from: 'b', to: 'out' },
          { from: 'a', to: 'int', dashed: true },
          { from: 'b', to: 'int', dashed: true },
        ]}
        caption="The application.id (here order-stats) is the consumer group id and the prefix of every internal topic. Instances are one consumer group (c1)."
      />
      <TermList
        items={[
          { term: 'topology', definition: 'The graph of your processing: source topics → processors → sink topics.' },
          { term: 'KStream', definition: 'An unbounded sequence of events. Every record is a new fact (“alice ordered 20”).' },
          { term: 'KTable', definition: 'A changelog seen as a table: the latest value per key (“alice has 4 orders”). Partitioned like its topic.' },
          { term: 'GlobalKTable', definition: 'A table copied in full to every instance, for small lookup data (e.g. currencies); joins need no co-partitioning.' },
          { term: 'state store', definition: 'A local key-value or window store (RocksDB on disk by default) that a stateful operation reads and updates.' },
          { term: 'changelog topic', definition: 'A compacted topic holding every update of a store, so the store can be rebuilt anywhere.' },
          { term: 'task', definition: 'The unit of work and parallelism: one per input partition per sub-topology.' },
        ]}
      />

      <h2>The recorded app</h2>
      <p>The app counts orders; the key is the customer and the value the amount.</p>
      <CodeBlock title="OrderStats.java — the topology (excerpt of the source that ran)" language="java" code={excerpt('static Topology topology()', 'static void run(')} />
      <p>
        It ran against Kafka {ECOSYSTEM.version} with two partitions per topic. <code>topology.describe()</code> printed what Streams built from those
        builder calls — names like <code>KSTREAM-AGGREGATE-0000000003</code> are generated:
      </p>
      <Terminal steps={[{ label: 'printed by the app at start-up', cmd: 'streams-app run', out: K.describe }]} title="recorded: topology.describe()" />

      <Flow
        title="The same topology as a picture (from the recorded describe)"
        cols={5}
        rows={4}
        rowHeight={80}
        nodes={[
          { id: 'src', label: 'orders', sub: 'source', col: 0, row: 1, rowSpan: 2, hue: 3, shape: 'log' },
          { id: 'flt', label: 'filter ≥ 50', sub: 'stateless', col: 1, row: 0 },
          { id: 'cnt', label: 'count', sub: 'key-value store', col: 1, row: 1, hue: 6, shape: 'store' },
          { id: 'win', label: 'count per 10 s', sub: 'window store', col: 1, row: 2, hue: 6, shape: 'store' },
          { id: 'key', label: 'selectKey', sub: 'big / small', col: 1, row: 3 },
          { id: 'rep', label: 'repartition', sub: 'internal topic', col: 2, row: 3, hue: 3, shape: 'log' },
          { id: 'cnt2', label: 'count', sub: 'key-value store', col: 3, row: 3, hue: 6, shape: 'store' },
          { id: 'o1', label: 'big-orders', sub: 'output', col: 4, row: 0, hue: 3, shape: 'log' },
          { id: 'o2', label: 'per-customer', sub: 'output', col: 4, row: 1, hue: 3, shape: 'log' },
          { id: 'o3', label: 'per-10s', sub: 'output', col: 4, row: 2, hue: 3, shape: 'log' },
          { id: 'o4', label: 'per-size', sub: 'output', col: 4, row: 3, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'src', to: 'flt', flow: true },
          { from: 'src', to: 'cnt', flow: true },
          { from: 'src', to: 'win', flow: true },
          { from: 'src', to: 'key', flow: true },
          { from: 'flt', to: 'o1' },
          { from: 'cnt', to: 'o2' },
          { from: 'win', to: 'o3' },
          { from: 'key', to: 'rep' },
          { from: 'rep', to: 'cnt2', flow: true },
          { from: 'cnt2', to: 'o4' },
        ]}
        steps={[
          { title: 'sub-topology 0', body: <>Everything that can run on the partition the record arrived on: filter, both counts by customer (the key is already the customer), and the key change.</>, active: ['src', 'flt', 'cnt', 'win', 'key', 'rep', 'o1', 'o2', 'o3', 'src>flt', 'src>cnt', 'src>win', 'src>key', 'flt>o1', 'cnt>o2', 'win>o3', 'key>rep'] },
          { title: 'sub-topology 1', body: <>After <code>selectKey</code> the records are keyed “big” / “small”, but they still sit on partitions chosen by customer. Streams writes them to a repartition topic, keyed anew, and a second sub-topology counts them there.</>, active: ['rep', 'cnt2', 'o4', 'rep>cnt2', 'cnt2>o4'] },
        ]}
        caption="Output topics are orders-per-customer-out, orders-per-customer-10s-out and orders-per-size-out, shortened here. Topics c3, state stores c6 (local RocksDB). The changelog topics of the three stores are not drawn; see the next section."
      />

      <h2>Stateless and stateful operations</h2>
      <p>Stateless operations look at one record at a time; stateful ones remember something between records.</p>
      <Table
        head={['Kind', 'Operations', 'Needs']}
        rows={[
          ['stateless', <code key="s">filter, map, mapValues, flatMap, branch / split, peek, to</code>, 'nothing — any instance can process any record'],
          ['stateful', <code key="f">groupByKey + count / reduce / aggregate, joins, windowedBy</code>, 'a state store, and all records of a key on the same task'],
          ['key-changing', <code key="k">selectKey, map, groupBy(newKey)</code>, 'a repartition topic before the next stateful step'],
        ]}
      />
      <p>Seven orders were sent (the last one with an old event time, on purpose):</p>
      <Terminal steps={[{ cmd: K.produce.cmd, out: K.produce.out.join('\n') }]} title="recorded: the input" />
      <Terminal
        steps={[
          { label: 'stateless: only amounts ≥ 50', ...K.outputs['big-orders'] },
          { label: 'stateful: one update per order, per customer', ...K.outputs['orders-per-customer-out'] },
          { label: 'after the repartition: counted by size', ...K.outputs['orders-per-size-out'] },
        ]}
        title="recorded: the output topics"
      />
      <p>
        Note the partitions: the customer counts land on the same partition as their input (same key), while every “big”/“small” count comes out
        of one partition — the repartition topic put all records with one new key together.
      </p>

      <h2>KStream and KTable: two views of the same data</h2>
      <p>The count output is a stream of updates; reading only the latest value per key turns it into a table.</p>
      <Table
        head={['Customer', 'KStream: every update in orders-per-customer-out', 'KTable: latest value', 'Store queried live']}
        rows={CUSTOMERS.map((c) => [
          c,
          PER_CUSTOMER.filter(([k]) => k === c).map(([, v]) => v).join(' → '),
          PER_CUSTOMER.filter(([k]) => k === c).at(-1)?.[1] ?? '',
          QUERY[c] ?? '(not queried)',
        ])}
      />
      <Predict
        question={<p>alice’s fourth order arrived after bob’s order at 10:00:25, but carries the event time 10:00:08. Is it in alice’s total count?</p>}
        options={['No — it is late, so it is dropped everywhere', 'Yes — a plain count has no windows, so nothing is late for it', 'Only after a restart']}
        answer={1}
        explanation={<>The total count reached {PER_CUSTOMER.filter(([k]) => k === 'alice').at(-1)?.[1]}. Lateness only exists for windowed operations: below, the same order is dropped from the 10-second window it belongs to.</>}
      />

      <h2>State stores and changelog topics</h2>
      <p>A store is a local database inside the instance; Kafka holds the backup.</p>
      <Flow
        title="Where the count lives, and how it survives a crash"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'task', label: 'task 0_1', sub: 'count processor', col: 0, row: 0, hue: 1 },
          { id: 'db', label: 'RocksDB', sub: 'local disk, state.dir', col: 1, row: 0, hue: 6, shape: 'store' },
          { id: 'cl', label: 'changelog', sub: 'compacted topic', col: 3, row: 0, hue: 3, shape: 'log' },
          { id: 'new', label: 'task 0_1 elsewhere', sub: 'after a failover', col: 1, row: 1, hue: 1 },
        ]}
        edges={[
          { from: 'task', to: 'db', label: 'get / put' },
          { from: 'db', to: 'cl', label: 'every update', flow: true },
          { from: 'cl', to: 'new', label: 'restore', dashed: true, flow: true },
        ]}
        steps={[
          { title: 'update', body: 'The count processor reads the current value from its local store, adds one, and writes it back — no network call.', active: ['task', 'db', 'task>db'] },
          { title: 'back up', body: 'Each write to the store is also sent to the changelog topic, in the same transaction as the output and the offsets (exactly-once).', active: ['db', 'cl', 'db>cl'] },
          { title: 'restore', body: <>If the instance dies, the task moves. The new owner replays the changelog into a fresh store before it processes new records. Compaction keeps only the latest value per key, so the replay stays short. Standby replicas (<code>num.standby.replicas</code>) keep a warm copy to skip most of it.</>, active: ['cl', 'new', 'cl>new'] },
        ]}
      />
      <p>The internal topics Streams created on its own, named <code>&lt;application.id&gt;-&lt;store or operation&gt;-…</code>:</p>
      <Terminal steps={[K.topics, K.changelogConfig, K.repartitionConfig]} title="recorded: internal topics and their configuration" />
      <StatTiles
        stats={[
          { label: 'internal topics', value: internalTopics.length, sub: 'all prefixed order-stats-', hue: 3 },
          { label: 'changelogs', value: internalTopics.filter((t) => t.endsWith('-changelog')).length, sub: 'cleanup.policy=compact', hue: 3 },
          { label: 'repartition topics', value: internalTopics.filter((t) => t.endsWith('-repartition')).length, sub: 'retention -1, purged by Streams', hue: 3 },
        ]}
      />
      <Callout tone="note" title="Repartition topics are a cost">
        Every key change before a stateful step means one more write and read through Kafka. Keep the key you will group by from the start when you
        can, and prefer <code>groupByKey</code> over <code>groupBy</code>.
      </Callout>

      <h2>Windows and event time</h2>
      <p>A windowed aggregation counts per key per time slice, using the time inside each record, not the time it was processed.</p>
      <TermList
        items={[
          { term: 'event time', definition: 'The record timestamp, set by the producer (here explicitly, to fixed times).' },
          { term: 'stream time', definition: 'The highest event time a task has seen so far. It only moves forward.' },
          { term: 'grace period', definition: 'How long after a window ends late records are still accepted. ofSizeWithNoGrace = zero.' },
        ]}
      />
      <Timeline
        title="Recorded: orders per customer in 10-second tumbling windows (seconds after 10:00:00)"
        lanes={[{ id: 'windows', label: 'windows' }, ...CUSTOMERS.map((c) => ({ id: c, label: c }))]}
        segments={windowSegments}
        events={windowEvents}
        start={0}
        end={30}
        unit="s"
      />
      <Terminal steps={[K.outputs['orders-per-customer-10s-out']]} title="recorded: windowed counts (key@window start)" />
      <p>
        alice has {WINDOWED.filter(([k]) => k.startsWith('alice@') && k.endsWith('10:00:00Z')).at(-1)?.[1]} orders in the first window, not 3. Her
        order at {lateSecond}s arrived after stream time had reached 13s; its window [0s, 10s) had closed with no grace, so Streams skipped it and
        logged:
      </p>
      <Terminal steps={[{ cmd: '(application log)', out: K.lateWarning.join('\n') }]} title="recorded: the late record" />
      <Timeline
        title="Schematic: alice’s on-time orders under each window type"
        lanes={[
          { id: 'tumbling', label: 'tumbling 10 s' },
          { id: 'hopping', label: 'hopping 10 s / 5 s' },
          { id: 'session', label: 'session, gap 5 s' },
        ]}
        segments={[
          { lane: 'tumbling', from: 0, to: 10, label: '2', hue: 3 },
          { lane: 'tumbling', from: 10, to: 20, label: '1', hue: 3, striped: true },
          { lane: 'hopping', from: 0, to: 10, label: '[0,10) 2', hue: 3 },
          { lane: 'hopping', from: 5, to: 15, label: '[5,15) 1', hue: 3, striped: true },
          { lane: 'hopping', from: 10, to: 20, label: '[10,20) 1', hue: 3 },
          { lane: 'session', from: ALICE[0] ?? 0, to: ALICE[1] ?? 4, label: '2', hue: 3 },
          { lane: 'session', from: ALICE[2] ?? 13, to: (ALICE[2] ?? 13) + 0.6, label: '1', hue: 3 },
        ]}
        events={ALICE.flatMap((s) => [
          { lane: 'tumbling', at: s, label: `${s}s`, hue: 7 as const },
          { lane: 'session', at: s, label: `${s}s`, hue: 7 as const },
        ])}
        start={0}
        end={20}
        unit="s"
      />
      <Table
        head={['Window', 'Code', 'A record belongs to']}
        rows={[
          ['tumbling', <code key="t">TimeWindows.ofSizeWithNoGrace(10s)</code>, 'exactly one fixed window'],
          ['hopping', <code key="h">TimeWindows.ofSizeAndGrace(10s, g).advanceBy(5s)</code>, 'size ÷ advance overlapping windows (here 2; the [-5s,5s) window is not drawn)'],
          ['session', <code key="s">SessionWindows.ofInactivityGapWithNoGrace(5s)</code>, 'a window per burst of activity; it grows while records keep coming'],
          ['sliding', <code key="sl">SlidingWindows.ofTimeDifferenceWithNoGrace(10s)</code>, 'windows defined by pairs of records at most 10 s apart'],
        ]}
      />

      <h2>Scaling: tasks follow partitions</h2>
      <p>Streams splits the work into tasks, and the consumer group spreads the tasks over the running instances.</p>
      <p>
        Each sub-topology gets one task per input partition. Two partitions × two sub-topologies = four tasks, named{' '}
        <code>&lt;sub-topology&gt;_&lt;partition&gt;</code>. We started a second instance with the same <code>application.id</code>:
      </p>
      <AppLog
        title="recorded: tasks per instance, before and after instance 2 joined"
        panels={[
          { name: 'instance 1', lines: K.scale.first },
          { name: 'instance 2', lines: K.scale.second },
        ]}
      />
      <StatTiles
        stats={[
          { label: 'tasks', value: 4, sub: '2 partitions × 2 sub-topologies', hue: 1 },
          { label: 'instance 1 at the end', value: taskLines(K.scale.first).at(-1)?.replace('active tasks ', '') ?? '', hue: 1 },
          { label: 'instance 2 at the end', value: taskLines(K.scale.second).at(-1)?.replace('active tasks ', '') ?? '', hue: 1 },
        ]}
      />
      <p>
        More instances (or <code>num.stream.threads</code>) than tasks do not help: the extra ones stay idle. To scale further, create the input topic
        with more partitions from the start — adding partitions later changes which partition a key goes to and breaks the existing state.
      </p>

      <h2>Exactly-once and interactive queries</h2>
      <p>Two settings in the app are worth knowing.</p>
      <CodeBlock title="OrderStats.java — configuration (excerpt of the source that ran)" language="java" code={excerpt('static void run(', 'Topology topology = topology();')} />
      <p>
        <code>processing.guarantee=exactly_once_v2</code> commits, in one Kafka transaction, the output records, the changelog updates and the input
        offsets. After a crash either all three are visible or none; consumers of the output must use <code>isolation.level=read_committed</code>{' '}
        (as the recorded console consumer did). It needs brokers 2.5 or newer, and lowers the default commit interval to 100 ms.
      </p>
      <p>
        <strong>Interactive queries</strong> read a store directly from the app, e.g. to serve “how many orders has alice?” over HTTP without another
        database. Each instance only holds the keys of its own tasks; <code>streams.queryMetadataForKey(…)</code> tells you which instance to ask.
      </p>
      <Terminal steps={[{ label: 'typed into the running app (stdin)', cmd: K.query.typed.join('; '), out: K.query.out.join('\n') }]} title="recorded: querying the local store" />

      <h2>Checklist</h2>
      <p>Before you deploy a Streams app:</p>
      <ul>
        <li>Choose a stable <code>application.id</code>: changing it starts from scratch, with new internal topics and no state.</li>
        <li>Size input partitions for the maximum parallelism you will ever need.</li>
        <li>Put <code>state.dir</code> on a persistent disk (not <code>/tmp</code>) and consider standby replicas for fast failover.</li>
        <li>Use <code>exactly_once_v2</code> when outputs feed money or counts; read outputs with <code>read_committed</code>.</li>
        <li>Pick a grace period that matches how late your producers really are, and alert on skipped-record metrics.</li>
        <li>Avoid needless key changes: each one adds a repartition topic.</li>
      </ul>

      <Recap
        points={[
          'Kafka Streams is a library: your app is a consumer group with local state, scaled by starting more copies.',
          'A topology runs as tasks, one per input partition per sub-topology; that is the parallelism limit.',
          'Stateful steps keep RocksDB stores backed by compacted changelog topics; key changes add repartition topics.',
          'Windows use event time; records later than the window end plus grace are skipped.',
          'exactly_once_v2 commits outputs, state and offsets together.',
        ]}
      />
    </>
  )
}
