import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { BarChart, Flow, StatTiles, type FlowNode } from '@/shared/figures'
import { Terminal, type TerminalStep } from '../components/Terminal'
import { parseOffsets } from '../components/PracticalParse'
import { MORE } from '../data/more'
import { USING_APP } from '../data/usingApp'

const C = MORE.usingCli
const J = MORE.usingJava

/** The same task twice: the recorded CLI session and the Java program that did it. */
function Both({ cli, code, file, run }: { cli: readonly TerminalStep[]; code: string; file: string; run: readonly TerminalStep[] }) {
  return (
    <Tabs
      items={[
        { label: 'CLI', content: <Terminal steps={cli} /> },
        {
          label: 'Java',
          content: (
            <>
              <CodeBlock code={code} title={file} language="java" />
              <Terminal steps={run} title="recorded run" />
            </>
          ),
        },
      ]}
    />
  )
}

/* ------------------------------------------------------------ figures from the recording */

/** Where each keyed payment landed, read back with the console consumer. */
const landed = C.readAll.out.split('\n').map((l) => {
  const [p, o, header, key, value] = l.split('\t')
  return { partition: Number(p.split(':')[1]), offset: Number(o.split(':')[1]), header, key, value }
})
const partitionCount = C.offsets.out.split('\n').length
const PARTITIONS: FlowNode[] = Array.from({ length: partitionCount }, (_, p) => {
  const here = landed.filter((r) => r.partition === p)
  return {
    id: `p${p}`,
    label: `payments-${p}`,
    sub: here.length ? here.map((r) => `${r.offset}: ${r.key}`).join(' · ') : 'empty',
    col: 2,
    row: p,
    span: 2,
    hue: 3,
    shape: 'log',
  }
})

const lagTotal = (out: string) => parseOffsets(out).reduce((n, r) => n + (r.lag ?? 0), 0)
const LAG = [
  { label: 'after reading', value: lagTotal(C.groupDescribe.out) },
  { label: 'two more arrive', value: lagTotal(C.lag.out) },
  { label: 'after reset', value: lagTotal(C.afterReset.out) },
]

const CHEAT: [string, string, string][] = [
  ['list topics', 'kafka-topics.sh --list', 'admin.listTopics()'],
  ['create a topic', 'kafka-topics.sh --create --topic t --partitions 3', 'admin.createTopics(List.of(new NewTopic(…)))'],
  ['describe a topic', 'kafka-topics.sh --describe --topic t', 'admin.describeTopics(List.of("t"))'],
  ['add partitions', 'kafka-topics.sh --alter --topic t --partitions 6', 'admin.createPartitions(…increaseTo(6))'],
  ['delete a topic', 'kafka-topics.sh --delete --topic t', 'admin.deleteTopics(List.of("t"))'],
  ['send keyed records', 'kafka-console-producer.sh --reader-property parse.key=true', 'producer.send(new ProducerRecord(t, key, value))'],
  ['read everything', 'kafka-console-consumer.sh --from-beginning', 'auto.offset.reset=earliest'],
  ['read as a group', 'kafka-console-consumer.sh --group g', 'group.id=g, subscribe, commitSync()'],
  ['end offsets', 'kafka-get-offsets.sh --topic t', 'admin.listOffsets(… OffsetSpec.latest())'],
  ['list groups', 'kafka-consumer-groups.sh --list', 'admin.listGroups()'],
  ['lag of a group', 'kafka-consumer-groups.sh --describe --group g', 'listConsumerGroupOffsets + listOffsets'],
  ['reset a group', '--reset-offsets --to-earliest --execute', 'admin.alterConsumerGroupOffsets(…)'],
  ['change a topic config', 'kafka-configs.sh --alter --add-config retention.ms=…', 'admin.incrementalAlterConfigs(…)'],
  ['one record by offset', 'kafka-console-consumer.sh --partition 2 --offset 0 --max-messages 1', 'consumer.assign(…); consumer.seek(tp, offset)'],
]

export default function UsingKafka() {
  return (
    <>
      <LessonGoals
        goals={[
          'connect to a cluster and manage topics from the command line and from Java',
          'send keyed records with headers, read them back alone or as a group',
          'check lag, reset a group, change a topic setting and find one record by its offset',
        ]}
        before="Topics and partitions, Consumer groups and Offsets"
      />
      <p>
        This page is about <strong>using</strong> Kafka, not about how it works inside. Every task is shown twice: with the tools that ship
        with Kafka, and with a small Java program using the plain <code>kafka-clients</code> {MORE.version} library. All output was recorded
        on a real Kafka {MORE.version} broker.
      </p>

      <h2>Connecting: one address is enough</h2>
      <p>Every tool and every client starts from a <strong>bootstrap server</strong>: any one broker address of the cluster.</p>
      <TermList
        items={[
          { term: 'bootstrap server', definition: 'An address used only for the first connection. The client then learns every broker from the metadata.' },
          { term: 'topic', definition: 'A named stream of records, split into partitions.' },
          { term: 'key', definition: 'Optional. Records with the same key always go to the same partition, so they stay in order.' },
          { term: 'header', definition: 'Optional name/value pairs carried next to the key and value (a source, a trace id, a type).' },
          { term: 'consumer group', definition: 'Consumers sharing one name. They split the partitions and remember their position (committed offsets).' },
          { term: 'lag', definition: 'How many records a group has not read yet: end offset minus committed offset, per partition.' },
        ]}
      />
      <Flow
        title="What happens behind --bootstrap-server"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'app', label: 'your app or tool', sub: 'any client', col: 0, row: 0, rowSpan: 2, hue: 7, shape: 'actor' },
          { id: 'boot', label: 'localhost:9092', sub: 'any one broker', col: 1, row: 0, span: 2, hue: 3 },
          { id: 'meta', label: 'cluster metadata', sub: 'brokers, partitions, leaders', col: 3, row: 0, hue: 5, shape: 'store' },
          { id: 'lead', label: 'partition leaders', sub: 'where reads and writes go', col: 1, row: 1, span: 3, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'app', to: 'boot', label: 'connect' },
          { from: 'boot', to: 'meta', both: true },
          { from: 'app', to: 'lead', flow: true },
        ]}
        steps={[
          { title: '1. First connection', body: <p>The client connects to the address you gave it. Listing two or three brokers there only helps if the first one is down.</p>, active: ['app', 'boot', 'app>boot'] },
          { title: '2. Metadata', body: <p>The broker answers with the cluster’s metadata: every broker, and which one leads each partition.</p>, active: ['boot', 'meta', 'boot>meta'] },
          { title: '3. Real traffic', body: <p>From then on the client talks directly to the leader of each partition it uses — not through the bootstrap broker.</p>, active: ['app', 'lead', 'app>lead'] },
        ]}
      />
      <Both
        cli={C.connect}
        code={USING_APP['Config.java']}
        file="Config.java — every program reads the address from KAFKA_BOOTSTRAP"
        run={[{ label: 'run any program against a cluster', cmd: J.send.cmd }]}
      />
      <Callout tone="tip" title="The advertised address">
        The address a broker returns in the metadata is its <code>advertised.listeners</code> setting, not the one you typed. If you can
        connect but every request then times out, the broker is advertising an address your machine cannot reach (a container name, an
        internal IP).
      </Callout>

      <h2>Topics: create, list, describe, grow, delete</h2>
      <p>A topic is created once with a number of partitions; after that you mostly read its description.</p>
      <Both
        cli={C.topics}
        code={USING_APP['TopicAdmin.java']}
        file="TopicAdmin.java"
        run={[J.topicAdmin]}
      />
      <Callout tone="warn" title="Adding partitions moves keys">
        A key’s partition is <code>hash(key) % partitions</code>. With more partitions, new records of a key can land in a different
        partition than its old ones, so per-key order is only kept from that moment on. Partitions can never be removed: plan the count up
        front.
      </Callout>

      <h2>Producing: keys and headers</h2>
      <p>A producer sends records; the key decides the partition, the headers travel along untouched.</p>
      <Both
        cli={[C.produce, C.readAll, C.offsets]}
        code={USING_APP['SendPayments.java']}
        file="SendPayments.java"
        run={[J.setup, J.send]}
      />
      <Flow
        title="Where the recorded console payments landed (offset: key)"
        cols={4}
        rows={partitionCount}
        rowHeight={84}
        nodes={[{ id: 'prod', label: 'producer', sub: 'key → partition', col: 0, row: 0, rowSpan: partitionCount, hue: 7, shape: 'actor' }, ...PARTITIONS]}
        edges={PARTITIONS.filter((p) => p.sub !== 'empty').map((p) => ({ from: 'prod', to: p.id, flow: true, hue: 7 as const }))}
        caption={
          <>
            Both of alice’s payments are in the same partition, in the order they were sent. The topic had four partitions by then; two got
            none of these keys, because a partition only receives the keys that hash to it. The Java run used a 3-partition topic, so its
            keys landed elsewhere — the mapping depends on the partition count.
          </>
        }
      />
      <p>
        <code>.get()</code> after <code>send()</code> waits for the broker’s acknowledgement, which is clear for a demo but slow: a real
        producer sends without waiting and passes a callback, or checks the futures later. <code>acks=all</code> (the default since Kafka 3.0)
        waits until every in-sync replica has the record.
      </p>

      <h2>Consuming: from the beginning, or as a group</h2>
      <p>A consumer either reads on its own, or joins a group that remembers where it stopped.</p>
      <Predict
        question={
          <p>
            A console consumer with <code>--group payments-cli --from-beginning</code> reads the four payments and exits. You run{' '}
            <em>the same command</em> again. What does it print?
          </p>
        }
        options={['The same four payments', 'Nothing — the group already read them', 'Only the newest payment']}
        answer={1}
        explanation={
          <>
            <code>--from-beginning</code> only applies to a group <em>without</em> committed offsets. Once the group has committed, it
            continues from there — to read everything again you reset the group (below).
          </>
        }
      />
      <Both
        cli={[C.readGroup, C.groupsList]}
        code={USING_APP['ReadPayments.java']}
        file="ReadPayments.java"
        run={[J.read]}
      />
      <p>
        The list shows a second, generated group (<code>console-consumer-…</code>): that is the earlier consumer started without{' '}
        <code>--group</code>. It reads, but never commits, so it always starts over.
      </p>
      <Table
        head={['Setting', 'What it decides']}
        rows={[
          [<code key="k">group.id</code>, 'The group to join. Without it you must assign partitions yourself and cannot commit.'],
          [<code key="k">auto.offset.reset</code>, <span key="v"><code>earliest</code> or <code>latest</code> (default): where a group with no committed offset starts.</span>],
          [<code key="k">enable.auto.commit</code>, <span key="v">Default <code>true</code>: commits in the background every 5 s. Set <code>false</code> and call <code>commitSync()</code> after processing to never skip a record.</span>],
        ]}
      />

      <h2>Groups: lag and resetting</h2>
      <p>Lag tells you how far behind a group is; resetting moves it to another position, for example to replay everything.</p>
      <StatTiles
        title="Total lag of group payments-cli, from the recorded describes"
        stats={LAG.map((l, i) => ({ label: l.label, value: l.value, hue: 1, sub: i === 2 ? 'every record is unread again' : undefined }))}
      />
      <Both
        cli={[C.groupDescribe, C.produceMore, C.lag, C.resetDry, C.resetRun, C.afterReset]}
        code={USING_APP['GroupLag.java'] + '\n\n' + USING_APP['ResetOffsets.java']}
        file="GroupLag.java · ResetOffsets.java"
        run={[J.lagAfterRead, J.sendMore, J.lagAfterMore, J.reset, J.lagAfterReset]}
      />
      <BarChart
        title="Lag per partition after the reset (recorded, CLI)"
        unit=" records"
        bars={parseOffsets(C.afterReset.out).map((r) => ({ label: `payments-${r.partition}`, value: r.lag ?? 0, hue: 1 as const }))}
      />
      <Callout tone="warn" title="Reset only a stopped group">
        Offsets of a group with running members cannot be changed: the tool refuses, and <code>alterConsumerGroupOffsets</code> fails. Stop
        every instance, reset, start them again. Always look at <code>--dry-run</code> first. Other targets:{' '}
        <code>--to-latest</code>, <code>--to-offset N</code>, <code>--shift-by -10</code>, <code>--to-datetime 2026-01-01T00:00:00.000</code>.
      </Callout>

      <h2>Changing a topic setting</h2>
      <p>Most behaviour of a topic — how long it keeps data, how it compacts — is a setting you can change while it runs.</p>
      <Terminal steps={[C.configSet, C.configGet, C.configDel]} />
      <p>
        In Java the same change is one <code>incrementalAlterConfigs</code> call with <code>OpType.SET</code> (or <code>DELETE</code>); it is
        the last step of <code>TopicAdmin.java</code> above, whose run printed <code>retention.ms = 86400000</code>. Only the settings you
        override are listed by <code>--describe</code>; add <code>--all</code> to see every value with its source.
      </p>

      <h2>Finding one record by its offset</h2>
      <p>A partition and an offset name exactly one record, so you can fetch it without any group.</p>
      <Both
        cli={[C.byOffset]}
        code={USING_APP['ReadAtOffset.java']}
        file="ReadAtOffset.java"
        run={[J.atOffset]}
      />
      <p>
        <code>assign</code> instead of <code>subscribe</code> means: no group, no rebalancing, nothing committed. It is the tool for
        debugging (“what exactly is at offset 0 of partition {C.found.partition}?”), and the offset printed in an error log is all you need.
      </p>

      <h2>Cheat sheet</h2>
      <p>Every command above takes <code>--bootstrap-server localhost:9092</code>; it is left out here.</p>
      <Table head={['Task', 'CLI', 'Java (kafka-clients)']} rows={CHEAT.map(([task, cli, java]) => [task, <code key="cli">{cli}</code>, <code key="java">{java}</code>])} />
      <CodeBlock code={USING_APP['build.gradle']} title="build.gradle of the recorded programs" language="groovy" />

      <h2>Checklist</h2>
      <p>Before a new service talks to Kafka, check these.</p>
      <ul>
        <li>The bootstrap address comes from configuration, never from code.</li>
        <li>Topics are created on purpose (with partitions and retention chosen), not by the first producer that happens to write.</li>
        <li>Records that must stay in order share a key.</li>
        <li>A consumer commits after processing, and processing the same record twice is harmless.</li>
        <li>Lag is monitored per group: it is the first sign of a slow or stuck consumer.</li>
        <li>Resets are rehearsed with <code>--dry-run</code> and done with the group stopped.</li>
      </ul>

      <Recap
        points={[
          'One bootstrap address; the client finds the leaders through the metadata.',
          'kafka-topics, kafka-console-producer/consumer, kafka-consumer-groups and kafka-configs cover daily work; Admin, KafkaProducer and KafkaConsumer do the same from code.',
          'Keys decide partitions; adding partitions changes where new records of a key go.',
          'A group continues from its committed offsets; lag = end offset − committed offset; reset only when stopped.',
          'Partition + offset identifies one record: assign and seek to read it.',
        ]}
      />
    </>
  )
}
