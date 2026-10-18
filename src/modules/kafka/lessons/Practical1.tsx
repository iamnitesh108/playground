import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { AppLog } from '../components/AppLog'
import { ScenarioPlayer, type ScenarioStep } from '../components/stage'
import { Terminal } from '../components/Terminal'
import { PracticalTopology } from '../components/PracticalFigures'
import { parseOffsets } from '../components/PracticalParse'
import { ORDERS_APP, RUN_APP } from '../data/ordersApp'
import { PRACTICALS } from '../data/practicals'

const P = PRACTICALS.p1
const [create, describe, produce, readAll, readAgain, list] = P.cli
const generated = list.out.split('\n').filter(Boolean)
/** Offsets printed by the first read and the live consumer, and how many lines the second read printed. */
const firstRead = [...readAll.out.matchAll(/Offset:(\d+)\t(.*)/g)].map((m) => ({ offset: Number(m[1]), value: m[2] }))
const secondReadCount = readAgain.out.split('\n').filter(Boolean).length
const live = P.liveConsumer.out.map((l) => l.match(/Offset:(\d+)\t(.*)/)).filter((m) => m !== null).map((m) => ({ offset: Number(m![1]), value: m![2] }))
const LOG = [...firstRead, ...live]
const appGroup = parseOffsets(P.app.describe.out)[0]

const STEPS: ScenarioStep[] = [
  {
    title: 'Create a topic with one partition',
    body: <p>A topic is a named log. With one partition every record goes into the same ordered log, offsets 0, 1, 2…</p>,
    actions: [],
    command: create.cmd,
  },
  {
    title: 'The producer sends three messages',
    body: <p>No key is given, so the key is <code>null</code>. Each record is appended at the end of P0 and gets the next offset.</p>,
    actions: ['hello', 'from', 'kafka'].map((value) => ({ type: 'produce' as const, key: null, value })),
    command: produce.cmd,
  },
  {
    title: 'A consumer reads from the beginning',
    body: <p><code>--from-beginning</code> makes a consumer with no saved progress start at offset 0. It reads the three records in order. Without <code>--group</code> the console consumer joins a group with a generated name — a new one every time, which commits nothing.</p>,
    actions: [{ type: 'addGroup', group: generated[0] ?? 'console-consumer-1' }, { type: 'addConsumer', group: generated[0] ?? 'console-consumer-1' }, { type: 'consume' }, { type: 'consume' }, { type: 'consume' }],
    command: readAll.cmd,
  },
  {
    title: 'Read again: the same three records',
    body: <p>The first consumer has stopped. A new one (another generated group) reads from the beginning again and gets <em>the same</em> records: reading never removes anything from the log.</p>,
    actions: [
      { type: 'removeConsumer', group: generated[0] ?? 'console-consumer-1' },
      { type: 'addGroup', group: generated[1] ?? 'console-consumer-2' },
      { type: 'addConsumer', group: generated[1] ?? 'console-consumer-2' },
      { type: 'consume' },
      { type: 'consume' },
      { type: 'consume' },
    ],
    command: readAgain.cmd,
  },
  {
    title: 'A live consumer waits; a new message arrives',
    body: <p>A consumer started <em>without</em> <code>--from-beginning</code> has no saved progress and starts at the end (the default <code>auto.offset.reset=latest</code>). It sees nothing old, waits, and receives the next message as soon as it is produced.</p>,
    actions: [
      { type: 'removeConsumer', group: generated[1] ?? 'console-consumer-2' },
      { type: 'addGroup', group: generated[2] ?? 'console-consumer-3', offsetReset: 'latest' },
      { type: 'addConsumer', group: generated[2] ?? 'console-consumer-3' },
      { type: 'produce', key: null, value: P.liveProducer.typed[0] },
      { type: 'consume' },
    ],
    command: `${P.liveConsumer.cmd}\n${P.liveProducer.cmd}`,
  },
]

const FILES = ['settings.gradle', 'build.gradle', 'application.yml', 'OrderProducer.java', 'SendOrders.java', 'OrderListener.java', 'Application.java', 'logback.xml'] as const
const lang = (f: string) => (f.endsWith('.java') ? 'java' : f.endsWith('.yml') ? 'yaml' : f.endsWith('.xml') ? 'xml' : 'groovy')

export default function Practical1() {
  return (
    <>
      <LessonGoals
        goals={[
          'run a real Kafka broker on your machine in one command',
          'create a topic, produce and consume with the command-line tools of Kafka 4',
          'see that reading does not delete, and where a new consumer starts',
          'do the same from a Java application with Micronaut',
        ]}
        before="Lessons 4–7 — topics, producers, offsets and how a consumer works"
      />

      <h2>What you will build</h2>
      <p>
        The smallest possible Kafka setup: <strong>one producer</strong> writes messages to a topic with <strong>one partition</strong>, and{' '}
        <strong>one consumer</strong> reads them. Everything below was recorded against a real Kafka {PRACTICALS.version} broker — first with
        the command-line tools that ship with Kafka, then with a small Micronaut application. Play the animation first, then run it yourself.
      </p>
      <ScenarioPlayer title="Practical 1: one producer, one partition, one consumer at a time" setup={{ topic: 'greetings', partitions: 1, groups: [] }} steps={STEPS} />
      <p>
        Watch the small triangle under the partition: it marks where that group reads next. Each console consumer started without{' '}
        <code>--group</code> is a new, generated group that commits nothing — every run starts from its own rule (<code>--from-beginning</code> or the
        end), never from an earlier run’s progress.
      </p>

      <h2>Start Kafka</h2>
      <p>The official image runs a complete single-node Kafka (broker and controller in one process) listening on <code>localhost:9092</code>:</p>
      <CodeBlock
        title="start a broker (podman works the same: replace docker with podman; podman may need the full image name docker.io/apache/kafka)"
        language="bash"
        code={`docker run -d --name kafka -p 9092:9092 docker.io/apache/kafka:${PRACTICALS.version}

# the command-line tools are inside the container, in /opt/kafka/bin
docker exec -it kafka /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list`}
      />
      <p>
        In the commands below, <code>kafka-topics.sh …</code> is short for <code>docker exec -it kafka /opt/kafka/bin/kafka-topics.sh …</code>. The
        recording used the same image ({PRACTICALS.image}) with the same single-node setup written out explicitly (see{' '}
        <code>tools/kafka-capture</code>).
      </p>
      <PracticalTopology topics="greetings (console tools) and orders-p1 (app)" partitions={1} groups={[{ name: 'generated', who: 'console' }, { name: 'billing', who: 'Micronaut app' }]} />
      <Callout tone="note" title="No ZooKeeper">
        Kafka 4 runs without ZooKeeper: the brokers keep their own metadata with the KRaft protocol. Many older tutorials (and videos) start a
        ZooKeeper process first — with Kafka 4 there is nothing to start besides the broker.
      </Callout>

      <h2>Part A — the command-line tools</h2>
      <h3>1. Create the topic</h3>
      <Terminal steps={[create, describe]} title="recorded: create and describe" />
      <Table
        head={['Flag / column', 'Meaning']}
        rows={[
          [<code key="a">--bootstrap-server</code>, 'Any broker to start from; the client learns about the rest of the cluster from it.'],
          [<code key="b">--partitions 1</code>, 'One ordered log. Practical 2 uses three.'],
          [<code key="c">--replication-factor 1</code>, 'One copy — fine on one broker, never in production (lesson 13).'],
          ['Leader / Replicas / Isr', 'Broker 1 leads partition 0 and is its only replica, in sync. Elr is for the newer eligible-leader-replicas feature; empty here.'],
        ]}
      />

      <h3>2. Produce three messages</h3>
      <p>The console producer reads lines from the keyboard and sends each line as one record. Press Ctrl-D (end of input) to finish:</p>
      <Terminal steps={[produce]} title="recorded: console producer (the lines after > were typed)" />

      <h3>3. Consume them — twice</h3>
      <Terminal steps={[readAll, readAgain]} title="recorded: console consumer" />
      <Table
        head={['Flag', 'Meaning']}
        rows={[
          [<code key="a">--from-beginning</code>, 'If the consumer has no saved progress, start at the oldest record instead of the end.'],
          [<code key="b">--timeout-ms 5000</code>, 'Stop after 5 s without a new record (without it the consumer waits forever; stop it with Ctrl-C). Stopping this way also prints an “ERROR Error processing message, terminating consumer process … TimeoutException” line and “Processed a total of 3 messages” on standard error — harmless, and left out of the recording.'],
          [<code key="c">--formatter-property print.offset=true</code>, 'Also print the partition, offset, key… of each record (the formatter decides what is printed).'],
        ]}
      />
      <p>
        The second read printed the same three messages. A Kafka topic is a log, not a queue: consuming a record does <strong>not</strong>{' '}
        remove it. Records stay until the topic’s retention removes old segments (lesson 14), and any number of consumers can read them, as often
        as they like.
      </p>
      <Callout tone="tip" title="Kafka 4.2 renamed the --property flags">
        Since Kafka 4.2 (KIP-1147) the console producer’s settings go in <code>--reader-property</code>, the consumer’s output format in{' '}
        <code>--formatter-property</code>, and client settings in <code>--command-property</code>. On Kafka 4.0 and 4.1 these names do not exist yet,
        so use <code>--property</code> there. On 4.2+ the old <code>--property</code> and <code>--consumer-property</code> still work but warn — the
        consumer with “Option --property is deprecated and will be removed in a future version. Use --formatter-property instead.”, the producer with
        “Warning: --property is deprecated … Use --reader-property instead.” — and are to be removed in Kafka 5.0. The console consumer (any Kafka 4.x
        Java consumer on the classic protocol) also logs a one-line note that the new consumer rebalance protocol (KIP-848) is production-ready; it is
        left out of the recordings.
      </Callout>

      <Timeline
        title="One log, three readers: which offsets each one read (recorded)"
        lanes={[
          { id: 'log', label: 'partition 0' },
          { id: 'r1', label: 'read 1 (from start)' },
          { id: 'r2', label: 'read 2 (from start)' },
          { id: 'r3', label: 'live (latest)' },
        ]}
        segments={[
          ...LOG.map((r) => ({ lane: 'log', from: r.offset, to: r.offset + 1, label: r.value, hue: 3 as const })),
          { lane: 'r1', from: 0, to: firstRead.length, label: `${firstRead.length} records`, hue: 1 },
          { lane: 'r2', from: 0, to: secondReadCount, label: `${secondReadCount} records`, hue: 1 },
          ...live.map((r) => ({ lane: 'r3', from: r.offset, to: r.offset + 1, label: `offset ${r.offset}`, hue: 1 as const })),
        ]}
        events={[{ lane: 'r3', at: live[0]?.offset ?? 0, label: 'starts at the end', hue: 1 }]}
        end={LOG.length}
        unit=""
      />
      <h3>4. A live consumer</h3>
      <p>
        Now start a consumer <em>without</em> <code>--from-beginning</code> and leave it running. In a second terminal, produce one more line.
        The consumer printed nothing for the three old messages, then this, a moment after the producer sent it:
      </p>
      <Terminal steps={[{ cmd: P.liveConsumer.cmd, out: P.liveConsumer.out.join('\n') }]} title="recorded: terminal 1 — the waiting consumer" />
      <Terminal steps={[{ cmd: P.liveProducer.cmd, out: P.liveProducer.typed.map((t) => `> ${t}`).join('\n') }]} title="recorded: terminal 2 — the producer" />
      <p>
        Offset 3: the new record went to the end of the same log, after hello, from and kafka (0, 1, 2). A consumer with no saved progress and no{' '}
        <code>--from-beginning</code> starts at the end — <code>auto.offset.reset=latest</code>.
      </p>

      <h3>5. Every consumer was in a group</h3>
      <Terminal steps={[list]} title="recorded: the groups the broker knows" />
      <StatTiles
        stats={[
          { label: 'records in the log', value: LOG.length, sub: 'nothing was deleted by reading', hue: 3 },
          { label: 'console consumers run', value: generated.length, sub: 'each one a generated group', hue: 1 },
          { label: 'offsets they committed', value: 0, sub: 'no --group: nothing saved', hue: 8 },
        ]}
      />
      <p>
        Three console consumers, three groups. Without <code>--group</code>, the console consumer makes up a group name, so every run is a new,
        independent reader. Practical 2 gives consumers the <em>same</em> group on purpose.
      </p>

      <Predict
        question={<p>You run the console consumer with <code>--from-beginning</code> a third time, again without <code>--group</code>. What does it print?</p>}
        options={['Nothing: the messages were already consumed', 'hello, from, kafka and a new message — everything in the log', 'Only a new message']}
        answer={1}
        explanation="A new generated group has no saved progress, and --from-beginning starts it at offset 0. Nothing was deleted by the earlier reads, so it prints all four records (offsets 0–3)."
      />

      <h2>Part B — the same with Java and Micronaut</h2>
      <p>
        A Micronaut application can be a producer, a consumer, or both. The recording used one small app, <code>orders-app</code>, started in
        producer mode or consumer mode by an environment variable. These are its real files:
      </p>
      <Flow
        title="The app's two modes, and where the progress is saved"
        caption="SendOrders calls send(key, order) on the generated @KafkaClient (acks=all); the call returns RecordMetadata once the broker has stored the record. OrderListener (@KafkaListener) polls and auto-commits its offsets every 5 s."
        cols={5}
        rows={2}
        nodes={[
          { id: 'send', label: 'SendOrders', sub: 'producer mode', col: 0, row: 0, hue: 7, shape: 'actor' },
          { id: 'client', label: 'OrderProducer', sub: '@KafkaClient', col: 1, row: 0, hue: 7 },
          { id: 'topic', label: 'orders-p1', sub: '1 partition', col: 2, row: 0, hue: 3, shape: 'log' },
          { id: 'listener', label: 'OrderListener', sub: 'group billing', col: 3, row: 0, hue: 1 },
          { id: 'offsets', label: '__consumer_offsets', sub: 'commit every 5 s', col: 3, row: 1, span: 2, hue: 5, shape: 'store' },
          { id: 'log', label: 'your log', sub: 'one line per order', col: 4, row: 0, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'send', to: 'client', flow: true, hue: 7 },
          { from: 'client', to: 'topic', flow: true, hue: 7, both: true },
          { from: 'topic', to: 'listener', label: 'poll', flow: true, hue: 1 },
          { from: 'listener', to: 'offsets', label: 'auto-commit', hue: 5, dashed: true },
          { from: 'listener', to: 'log', flow: true, hue: 1 },
        ]}
      />
      <Tabs items={FILES.map((f) => ({ label: f, content: <CodeBlock title={f} language={lang(f)} code={ORDERS_APP[f]} /> }))} />
      <TermList
        items={[
          { term: '@KafkaClient', definition: 'On an interface: Micronaut generates the implementation, a KafkaProducer with the settings given (here acks=all).' },
          { term: '@KafkaKey', definition: 'Marks the parameter used as the record key. The key decides the partition.' },
          { term: '@Topic("${app.topic}")', definition: 'The topic to send to or read from, here taken from configuration (application.yml or the APP_TOPIC variable).' },
          { term: 'RecordMetadata', definition: 'As a return type it makes the send synchronous: the method returns once the broker acknowledged, with the partition and offset.' },
          { term: '@KafkaListener', definition: 'Turns a class into a consumer: groupId is the consumer group, offsetReset where a group with no saved progress starts.' },
          { term: 'ConsumerRecord', definition: 'The whole record as a parameter: topic, partition, offset, key, value, headers.' },
        ]}
      />
      <CodeBlock
        title="build and run (Java 17, Gradle 8.x; the first build downloads the dependencies)"
        language="bash"
        code={`gradle installDist

# send three orders to a topic with one partition, then exit
kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders-p1 --partitions 1 --replication-factor 1
${RUN_APP.producer.replace('APP_TOPIC=orders', 'APP_TOPIC=orders-p1').replace('APP_COUNT=6', 'APP_COUNT=3')}

# read them in group billing (keeps running until Ctrl-C)
${RUN_APP.consumer('app-1', 'billing', 'orders-p1')}`}
      />
      <p>
        One version detail: Micronaut 4.5 pulls in the Java client <code>kafka-clients</code> 3.7.0, so this app is a 3.x client talking to the
        4.3 broker. That is fully supported — newer brokers serve older clients — and it uses the classic group protocol.
      </p>
      <AppLog
        title="recorded: producer mode, then consumer mode"
        panels={[
          { name: 'producer mode', lines: P.app.producer },
          { name: 'consumer mode (app-1, group billing)', lines: P.app.consumer },
        ]}
      />
      <p>
        The producer printed where each order landed — every one in partition 0, offsets 0–2, because the topic has one partition. The consumer
        first logged its assignment (<code>orders-p1-0</code>: topic orders-p1, partition 0), then received the three orders in order.
      </p>
      <Terminal steps={[P.app.describe]} title="recorded: the group’s progress, as Kafka sees it" />
      <StatTiles
        stats={[
          { label: 'CURRENT-OFFSET (committed)', value: appGroup?.current ?? '-', sub: 'next offset the group will read', hue: 2 },
          { label: 'LOG-END-OFFSET', value: appGroup?.end ?? '-', sub: 'next offset a new record gets', hue: 3 },
          { label: 'LAG', value: appGroup?.lag ?? '-', sub: 'records waiting for the group', hue: (appGroup?.lag ?? 0) > 0 ? 8 : 2 },
        ]}
      />
      <p>
        <code>CURRENT-OFFSET 3</code> is the group’s committed offset — “everything before offset 3 is done” — and <code>LAG 0</code> means nothing
        is waiting. Micronaut’s default (<code>OffsetStrategy.AUTO</code>) uses Kafka’s automatic commit, which saves the position every 5 s
        (<code>auto.commit.interval.ms</code>); the recording waited until the commit showed up before describing the group.
      </p>
      <Callout tone="note" title="Why the app sets offsetReset = EARLIEST">
        The group <code>billing</code> is new, so it has no committed offset. With Kafka’s default (<code>latest</code>) it would start at the end and
        miss the three orders sent before it started. <code>OffsetReset.EARLIEST</code> plays the role of <code>--from-beginning</code>. Once the group
        has committed offsets, this setting no longer matters: the group continues from its commits.
      </Callout>

      <h2>Try it yourself</h2>
      <ol>
        <li>Produce with keys: add <code>--reader-property parse.key=true --reader-property key.separator=:</code> and type <code>alice:hello</code>; print keys with <code>--formatter-property print.key=true</code>.</li>
        <li>Run the console consumer twice with the same <code>--group demo --from-beginning</code>. Why does the second run print nothing?</li>
        <li>Stop the Micronaut consumer, run the producer again, start the consumer again: it receives only the new orders — the group remembered where it was.</li>
        <li>Run <code>kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing</code> while the app is stopped: the committed offset stays.</li>
      </ol>

      <Recap
        points={[
          'docker run apache/kafka gives a complete single-node Kafka 4 (KRaft, no ZooKeeper) on localhost:9092.',
          'A topic is a log: consuming does not delete, every reader keeps its own position.',
          'A consumer without saved progress starts at the end (latest) unless told to start at the beginning (--from-beginning, OffsetReset.EARLIEST).',
          'Every consumer belongs to a group; the group’s committed offset is where it continues.',
          'In Micronaut, @KafkaClient produces and @KafkaListener consumes; the defaults auto-commit every 5 s.',
        ]}
      />
    </>
  )
}
