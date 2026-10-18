import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { ConsumerInternals, Terminal } from '../components'
import { ORDERS_APP } from '../data/ordersApp'
import { PRACTICALS } from '../data/practicals'

const JAVA_LOOP = `Properties props = new Properties();
props.put("bootstrap.servers", "localhost:9092");
props.put("group.id", "billing");                       // which group this consumer joins
props.put("key.deserializer", StringDeserializer.class.getName());
props.put("value.deserializer", StringDeserializer.class.getName());
props.put("auto.offset.reset", "earliest");             // only used when the group has no committed offset
props.put("enable.auto.commit", "false");               // we commit ourselves, after processing

try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props)) {
    consumer.subscribe(List.of("orders"));               // join the group; partitions are assigned to us
    while (running) {
        ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
        for (ConsumerRecord<String, String> r : records) {
            process(r.key(), r.value());                 // your business logic
        }
        consumer.commitSync();                           // save the position: "everything before here is done"
    }
}`

const firstRead = PRACTICALS.p1.cli.find((s) => s.cmd.includes('--from-beginning') && s.cmd.includes('print.offset'))!
const live = PRACTICALS.p1.liveConsumer

export default function Consumers() {
  return (
    <>
      <LessonGoals
        goals={[
          'describe what happens inside poll(): fetching, the buffer, the batch you get',
          'tell position, committed offset, log-end offset and lag apart',
          'choose auto.offset.reset and a commit style knowing what each costs on a crash',
          'keep a consumer alive: heartbeats, session.timeout.ms and max.poll.interval.ms',
        ]}
        before="Lesson 6 — offsets"
      />

      <h2>A consumer is a loop in your program</h2>
      <p>
        A Kafka <strong>consumer</strong> is not a server and not a separate process: it is an object of the client library (<code>KafkaConsumer</code> in
        Java) living inside your application. Your code calls <code>poll()</code> again and again; each call returns the next records from the
        partitions this consumer is responsible for. Records are <strong>not removed</strong> by reading — the log stays as it is, and every reader
        just remembers how far it got.
      </p>
      <CodeBlock title="the plain Java consumer loop" language="java" code={JAVA_LOOP} />
      <p>Frameworks hide the loop. In Micronaut the same consumer is an annotated method — this is the real class the practicals ran:</p>
      <CodeBlock title="OrderListener.java (Micronaut, recorded in the practicals)" language="java" code={ORDERS_APP['OrderListener.java']} />
      <p>
        Micronaut creates a <code>KafkaConsumer</code> for the class, runs the poll loop on its own thread, and calls <code>receive()</code> once per
        record. The settings are the same; only who writes the loop changes.
      </p>

      <h2>subscribe or assign</h2>
      <Table
        head={['', 'subscribe(topics)', 'assign(partitions)']}
        rows={[
          ['Who picks the partitions', 'the group: Kafka shares them among the members', 'you, by name (e.g. orders-0)'],
          ['Needs group.id', 'yes', 'no (only to commit offsets)'],
          ['When a member comes or goes', 'rebalance: partitions move', 'nothing happens'],
          ['Typical use', 'services, workers — almost always', 'tools, replays, one consumer per known partition'],
        ]}
      />

      <h2>Inside poll(): fetch, buffer, batch, commit</h2>
      <p>
        <code>poll()</code> does not go to the broker for every call. The client <strong>fetches</strong> records in the background into a buffer
        and <code>poll()</code> hands you a batch from that buffer. Step through one consumer reading partition P0 — including a crash:
      </p>
      <ConsumerInternals />
      <Table
        head={['Setting', 'Default', 'What it does']}
        rows={[
          [<code key="1">fetch.min.bytes</code>, '1', 'The broker answers a fetch as soon as it has this much data…'],
          [<code key="2">fetch.max.wait.ms</code>, '500', '…or after this long, whichever comes first. Raise both to trade latency for fewer, bigger requests.'],
          [<code key="3">max.partition.fetch.bytes</code>, '1 MB', 'At most this much per partition per fetch (a single larger record is still returned).'],
          [<code key="4">fetch.max.bytes</code>, '50 MB', 'At most this much per fetch response, over all partitions.'],
          [<code key="5">max.poll.records</code>, '500', 'At most this many records returned by one poll(); the rest wait in the buffer.'],
        ]}
      />

      <h2>Four numbers per partition</h2>
      <TermList
        items={[
          { term: 'log-end offset', definition: 'The offset the next record written to the partition will get. Grows with every produce.' },
          { term: 'position', definition: 'The offset the next poll() will return to this consumer. Lives in memory; moves as poll() hands out records.' },
          { term: 'committed offset', definition: 'The progress saved in Kafka (topic __consumer_offsets) for the group and partition: “everything before this is done”. Survives crashes and rebalances.' },
          { term: 'lag', definition: 'log-end offset − committed offset: records written but not yet confirmed by the group.' },
        ]}
      />
      <p>
        The position runs ahead of the committed offset between commits. That gap is exactly what a crash can make you process twice — the
        animation’s last two steps.
      </p>

      <h2>Where does a new consumer start? auto.offset.reset</h2>
      <p>
        When a group has a committed offset for a partition, its consumer starts there. Only when there is <strong>none</strong> — a brand-new group,
        or offsets that expired — does <code>auto.offset.reset</code> decide:
      </p>
      <Table
        head={['Value', 'Starts at', 'Use it when']}
        rows={[
          [<code key="1">latest</code>, 'the end: only records written from now on (the default)', 'old records do not matter (notifications, live dashboards)'],
          [<code key="2">earliest</code>, 'the oldest record still kept', 'every record matters (orders, payments, projections)'],
          [<code key="3">none</code>, 'nowhere: poll() throws an error', 'you want to decide by hand and never start silently'],
          [<code key="4">by_duration:PT1H</code>, 'the first record written within that ISO-8601 duration (Kafka 4.0+)', 'a new consumer should catch up on recent history only'],
        ]}
      />
      <p>
        The console consumer’s <code>--from-beginning</code> is <code>earliest</code>. Recorded in practical 1: with it, all three messages; without
        it, the consumer started at the end and printed only the message sent while it was running.
      </p>
      <Terminal steps={[firstRead, { cmd: live.cmd, out: live.out.join('\n') }]} />
      <Predict
        question={<p>A service with <code>auto.offset.reset=latest</code> has been consuming for a week. It is stopped for an hour, then started again. Does it see the records written during that hour?</p>}
        options={['No — latest means it starts at the end', 'Yes — its group has a committed offset, so it continues from there', 'Only if it uses --from-beginning']}
        answer={1}
        explanation="auto.offset.reset applies only when the group has no committed offset for the partition. This group committed before stopping, so it resumes exactly where it left off and reads the hour’s records. (If the group was empty longer than offsets.retention.minutes — 7 days by default — its offsets expire and latest would skip ahead.)"
      />

      <h2>Committing: who saves the position, and when</h2>
      <Table
        head={['Style', 'How', 'On a crash']}
        rows={[
          ['auto commit', <><code>enable.auto.commit=true</code> (the default): a later <code>poll()</code> commits the position every <code>auto.commit.interval.ms</code> (5 s)</>, 'records processed since the last commit are read again'],
          ['commitSync()', 'you commit after processing; it blocks until the broker confirms', 'only the current batch can be read again'],
          ['commitAsync()', 'same, without waiting; failures arrive in a callback (not retried)', 'like commitSync, plus a small risk of a lost commit'],
          ['commit before processing', 'commit first, then process', 'a crash loses the batch: at-most-once'],
        ]}
      />
      <Callout tone="tip" title="The safe default">
        Commit <strong>after</strong> the work, and make the work safe to repeat (a unique key, “insert … if absent”, a status check). Then a crash costs a
        few duplicates, never lost records. Lesson 9 goes deeper.
      </Callout>

      <h2>Staying alive: heartbeats and the poll deadline</h2>
      <p>A consumer can be declared dead in two different ways:</p>
      <Table
        head={['Setting', 'Default', 'Protects against']}
        rows={[
          [<code key="1">heartbeat.interval.ms</code>, '3 s', 'How often a background thread tells the group coordinator “I am alive”.'],
          [<code key="2">session.timeout.ms</code>, '45 s', 'A process that died or lost the network: no heartbeat for this long → removed from the group.'],
          [<code key="3">max.poll.interval.ms</code>, '5 min', 'A process that is alive but stuck: no poll() call for this long → the consumer leaves the group itself.'],
        ]}
      />
      <p>
        The first two are settings of the classic group protocol (the client default). With <code>group.protocol=consumer</code> (KIP-848) the
        client may not set them; the broker decides instead, with <code>group.consumer.session.timeout.ms</code> (45 s) and{' '}
        <code>group.consumer.heartbeat.interval.ms</code> (5 s).
      </p>
      <p>
        Heartbeats run on their own thread, so slow processing does not stop them — but it does delay the next <code>poll()</code>. If one batch takes
        longer than <code>max.poll.interval.ms</code>, the consumer is thrown out, its partitions move, and its late commit fails. Fix it by processing
        faster, lowering <code>max.poll.records</code>, or (rarely) raising the interval.
      </p>
      <Predict
        question={<p>A consumer gets 500 records per poll and spends 1 s on each. What happens?</p>}
        options={['Nothing: heartbeats keep it in the group', 'After 300 s without a poll it leaves the group; its partitions move to others', 'The broker slows down the topic']}
        answer={1}
        explanation="500 × 1 s = 500 s, longer than max.poll.interval.ms (300 s). Heartbeats only prove the process is alive; the poll deadline proves it is making progress. The consumer is removed, another member takes its partitions from the last committed offset, and the slow one’s work is done twice."
      />

      <h2>Threads: one consumer per thread</h2>
      <p>
        <code>KafkaConsumer</code> is <strong>not thread-safe</strong>: only one thread may use it (calling <code>wakeup()</code> from another
        thread to stop it is the one exception). To read in parallel, run several consumers — several threads, processes or pods — in the same group.
        Each gets its own partitions.
      </p>
      <Callout tone="warn" title="Handing records to a worker pool">
        Passing records from one consumer to a pool of threads is possible but hard to get right: per-key order is lost unless one key always goes to the
        same worker, and you may only commit an offset once <em>every</em> record before it is finished. Prefer more partitions and more consumers.
      </Callout>

      <h2>Three ids</h2>
      <Table
        head={['Id', 'Set by', 'Decides']}
        rows={[
          [<code key="1">group.id</code>, 'you', 'which group the consumer joins — who shares partitions and whose committed offsets it uses'],
          [<code key="2">client.id</code>, 'you (or generated)', 'nothing about sharing: a name in logs, metrics, quotas and tool output'],
          ['member id', 'Kafka, at join time', 'one member of the group right now, new after every restart (classic protocol: client.id plus a random suffix)'],
        ]}
      />
      <p>
        A Kafka 4.x Java consumer that runs the classic protocol logs a banner — the console consumer prints it too: <em>“The consumer rebalance
        protocol (KIP-848) is production-ready! Set group.protocol=consumer to try it out.”</em> It is informational — the next lesson explains the
        two group protocols.
      </p>

      <Recap
        points={[
          'A consumer is a library object in your program; poll() returns batches that a background fetch put in a buffer.',
          'Position (in memory) runs ahead of the committed offset (in Kafka); a crash goes back to the committed offset.',
          'auto.offset.reset only applies when the group has no committed offset.',
          'Commit after processing and make processing idempotent; keep each batch well inside max.poll.interval.ms.',
          'One KafkaConsumer per thread; scale with more consumers in the group.',
        ]}
      />
    </>
  )
}
