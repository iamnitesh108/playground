import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { AppLog, ScenarioPlayer, Terminal, type ScenarioStep, type StageAction } from '../components'
import { PRACTICALS } from '../data/practicals'
import { ORDERS_APP, RUN_APP } from '../data/ordersApp'

const P = PRACTICALS.p3
const lines = (out: readonly string[]) => out.join('\n')

const produce = (pairs: readonly string[]): StageAction[] =>
  pairs.map((kv) => {
    const [key, value] = kv.split(':')
    return { type: 'produce', key, value }
  })
const rounds = (n: number): StageAction[] => Array.from({ length: n }, () => ({ type: 'consume' }))

const FIRST = P.cli.find((c) => 'typed' in c)
const FIRST_TYPED: readonly string[] = FIRST && 'typed' in FIRST ? FIRST.typed : []

const STEPS: ScenarioStep[] = [
  {
    title: 'Three consumers, two groups, nothing produced yet',
    body: (
      <p>
        One consumer runs with <code>--group billing</code>, two with <code>--group analytics</code>. The range assignor gives billing’s only
        consumer all three partitions; analytics splits them 2 + 1.
      </p>
    ),
    actions: [],
    command: [P.groups.billing.cmd, P.groups['analytics-1'].cmd, P.groups['analytics-2'].cmd].join('\n'),
  },
  {
    title: 'Six payments are produced',
    body: <p>The key picks the partition, exactly as in practical 2: the same key always lands in the same partition.</p>,
    actions: produce(FIRST_TYPED),
    command: FIRST?.cmd,
  },
  {
    title: 'Each group reads every payment',
    body: (
      <p>
        billing’s single consumer reads all six. analytics reads all six <em>too</em> — but split between its two consumers. Twelve records are
        processed in total, from six stored once.
      </p>
    ),
    actions: rounds(6),
  },
  {
    title: 'analytics stops',
    body: <p>Both analytics consumers are stopped (Ctrl-C). The group still exists: its committed offsets stay in Kafka.</p>,
    actions: [
      { type: 'removeConsumer', group: 'analytics' },
      { type: 'removeConsumer', group: 'analytics' },
    ],
  },
  {
    title: 'Three more payments arrive',
    body: <p>billing reads them at once. analytics is not running, so its committed offsets stay where they were: it now has lag.</p>,
    actions: [...produce(P.whileAway.typed), ...rounds(3)],
    command: P.whileAway.cmd,
  },
  {
    title: 'analytics comes back and catches up',
    body: <p>A consumer joins analytics again and continues from the group’s committed offsets: it reads only the three it missed.</p>,
    actions: [{ type: 'addConsumer', group: 'analytics' }, ...rounds(3)],
    command: P.caughtUp.cmd,
  },
  {
    title: 'Reset analytics to the beginning and replay',
    body: <p>With analytics stopped, its committed offsets are moved back to the start of each partition. The next consumer reads all nine again; billing is untouched.</p>,
    actions: [{ type: 'removeConsumer', group: 'analytics' }, { type: 'resetGroup', group: 'analytics' }, { type: 'addConsumer', group: 'analytics' }, ...rounds(9)],
    command: [P.reset.execute.cmd, P.replay.cmd].join('\n'),
  },
]

export default function Practical3() {
  return (
    <>
      <LessonGoals
        goals={[
          'see that every consumer group gets its own copy of every message',
          'read and compare two groups’ committed offsets and lag',
          'make a group catch up, and replay a topic by resetting a group’s offsets',
          'run the same Micronaut code as two different subscribers',
        ]}
        before="Practical 2 — partitions shared inside one group"
      />

      <h2>Queue and publish/subscribe at once</h2>
      <p>
        Practical 2 showed consumers <em>inside</em> one group sharing the partitions: each message is processed once by that group, like a work
        queue. This practical adds a second group. Groups do not share anything with each other: each one reads the whole topic at its own pace,
        like subscribers of a publish/subscribe system. One topic, stored once, serves both patterns.
      </p>
      <TermList
        items={[
          { term: 'consumer group', definition: 'All consumers started with the same group.id. Together they read the topic once.' },
          { term: 'committed offset', definition: 'Per group and partition: the next offset the group will read. Kept in the internal topic __consumer_offsets.' },
          { term: 'lag', definition: 'LOG-END-OFFSET − CURRENT-OFFSET: records written but not yet committed by that group.' },
          { term: 'offset reset', definition: 'Moving a group’s committed offsets (kafka-consumer-groups.sh --reset-offsets), e.g. back to the beginning to replay.' },
        ]}
      />

      <ScenarioPlayer title="Two groups on one topic" setup={{ topic: 'payments', partitions: 3, groups: [{ id: 'billing', consumers: 1 }, { id: 'analytics', consumers: 2 }] }} steps={STEPS} />

      <Predict
        question={<p>The topic has 3 partitions. Group billing has 1 consumer, group analytics has 2. Six messages are produced. How many messages are processed in total, by all three consumers together?</p>}
        options={['6 — each message goes to one consumer', '12 — six per group', '18 — six per consumer']}
        answer={1}
        explanation="Each group receives every message once; inside a group the messages are split among its consumers. Two groups × six messages = twelve deliveries."
      />

      <h2>Part A — with the Kafka CLI</h2>
      <p>
        Start a broker as in practical 1, then open four terminals. Recorded with Kafka {PRACTICALS.version}. First the topic. This time all
        three consumers are started <strong>before</strong> anything is produced, so both groups are complete when the payments arrive:
      </p>
      <Terminal steps={[P.cli[0]]} title="terminal 1 — create the topic" />
      <Terminal
        title="terminals 2, 3, 4 — one consumer in billing, two in analytics (each keeps running)"
        steps={[
          { label: 'terminal 2', cmd: P.groups.billing.cmd },
          { label: 'terminal 3', cmd: P.groups['analytics-1'].cmd },
          { label: 'terminal 4', cmd: P.groups['analytics-2'].cmd },
        ]}
      />
      <p>Before producing, the two analytics consumers have already divided the partitions:</p>
      <Terminal steps={[P.assignedBefore]} title="terminal 1 — analytics members" />
      <Terminal steps={[{ cmd: FIRST!.cmd, out: FIRST!.out }]} title="terminal 1 — produce six payments (key:value, then Ctrl-D)" />

      <p>What each consumer printed, recorded:</p>
      <AppLog
        title="recorded output of the three consumers"
        panels={[
          { name: 'terminal 2 — group billing', lines: P.groups.billing.out },
          { name: 'terminal 3 — group analytics, consumer 1', lines: P.groups['analytics-1'].out },
          { name: 'terminal 4 — group analytics, consumer 2', lines: P.groups['analytics-2'].out },
        ]}
      />
      <p>
        billing printed all {P.groups.billing.out.length}. analytics printed all six too, but split: {P.groups['analytics-1'].out.length} from
        partitions 0 and 1 in terminal 3, {P.groups['analytics-2'].out.length} from partition 2 in terminal 4. Within each partition the order is kept
        (offset 0 before 1); across partitions there is no global order.
      </p>

      <h3>Two groups, two sets of offsets</h3>
      <Terminal steps={[P.list]} title="terminal 1 — the groups the broker knows" />
      <Callout tone="note" title="Groups appear by themselves">
        Nothing created these groups: a group exists as soon as a consumer joins with that <code>group.id</code>. Every console consumer started{' '}
        <em>without</em> <code>--group</code> also joins a generated group named <code>console-consumer-…</code>; every consumer in this practical
        used <code>--group</code>, so none appear above.
      </Callout>
      <Terminal steps={[P.describeBoth]} title="terminal 1 — describe both groups" />
      <Table
        head={['Column', 'Meaning']}
        rows={[
          ['CURRENT-OFFSET', 'this group’s committed offset for the partition: the next record it will read'],
          ['LOG-END-OFFSET', 'the offset the next new record will get — the same for every group'],
          ['LAG', 'LOG-END-OFFSET − CURRENT-OFFSET, per group'],
          ['CONSUMER-ID / CLIENT-ID', 'which running consumer owns the partition right now'],
        ]}
      />
      <p>
        The broker stores committed offsets per <strong>(group, topic, partition)</strong> in the internal topic <code>__consumer_offsets</code>.
        That key is the whole reason groups are independent: billing’s progress and analytics’ progress are different records.
      </p>

      <h3>One group falls behind</h3>
      <p>Stop both analytics consumers (Ctrl-C in terminals 3 and 4) and produce three more payments:</p>
      <Terminal steps={[{ cmd: P.whileAway.cmd, out: P.whileAway.typed.map((t) => '> ' + t).join('\n') }]} title="terminal 1 — three more payments" />
      <AppLog title="recorded: terminal 2 (billing) printed them at once" panels={[{ name: 'group billing', lines: P.whileAway.billingSaw }]} />
      <Terminal steps={[P.whileAway.describe]} title="terminal 1 — analytics, no consumer running" />
      <p>
        No CONSUMER-ID (nobody is running), and LAG where new records arrived: the committed offsets did not move. Start one analytics consumer
        again — without <code>--from-beginning</code> this time; the group has committed offsets, so it would be ignored anyway:
      </p>
      <Terminal steps={[{ cmd: P.caughtUp.cmd, out: lines(P.caughtUp.out) }, P.caughtUp.describe]} title="terminal 3 — analytics catches up" />
      <p>It printed only the three it missed, and the lag is back to 0. One consumer now owns all three partitions of analytics.</p>

      <Predict
        question={<p>analytics is stopped for an hour while payments keep coming. Then a consumer starts again with <code>--group analytics</code>. What does it read?</p>}
        options={['Everything since the topic was created', 'Only the payments it missed while stopped', 'Only payments produced after it started']}
        answer={1}
        explanation="The group has committed offsets, so the new consumer continues from them. auto.offset.reset (or --from-beginning) only matters for a group with no committed offset for that partition."
      />

      <h3>Replay: move a group’s offsets back</h3>
      <p>
        Suppose analytics had a bug and must process everything again. Stop its consumers, then reset its offsets. Always look first with{' '}
        <code>--dry-run</code>; <code>--execute</code> applies:
      </p>
      <Terminal steps={[P.reset.dryRun, P.reset.execute]} title="terminal 1 — reset analytics to the earliest offsets" />
      <Terminal steps={[{ cmd: P.replay.cmd, out: lines(P.replay.out) }]} title="terminal 3 — analytics reads everything again" />
      <p>All {P.replay.out.length} payments again. billing was not affected: its offsets are separate.</p>
      <Callout tone="warn" title="Resetting offsets">
        <ul>
          <li>
            The group must have <strong>no running members</strong>. With a consumer still running, Kafka 4.3 answers{' '}
            <code>Error: Assignments can only be reset if the group 'analytics' is inactive, but the current state is Stable.</code>
          </li>
          <li>
            Choose the scope: <code>--topic payments</code>, only some partitions with <code>--topic payments:0,2</code>, or <code>--all-topics</code>.
          </li>
          <li>
            Other targets: <code>--to-latest</code> (skip everything waiting), <code>--to-offset 42</code>, <code>--shift-by -10</code>,{' '}
            <code>--to-datetime 2026-01-01T00:00:00.000</code>, <code>--by-duration PT1H</code>.
          </li>
          <li>
            Without <code>--execute</code> nothing changes: the tool prints the plan and warns that from version 5.0 either <code>--dry-run</code> or{' '}
            <code>--execute</code> will be required — so write <code>--dry-run</code> explicitly in scripts.
          </li>
        </ul>
      </Callout>

      <h2>Part B — the same with the Micronaut app</h2>
      <p>
        The app from practicals 1 and 2 is unchanged. Its listener does not hard-code a group: the group name is read from configuration, so the
        same code becomes a different subscriber depending on how it is started.
      </p>
      <CodeBlock code={ORDERS_APP['OrderListener.java']} title="OrderListener.java (the source that was recorded)" language="java" />
      <p>
        <code>{'${app.group}'}</code> is filled from the environment variable <code>APP_GROUP</code>. Three instances were started — one in
        billing-app, two in analytics-app — before the producer sent six orders:
      </p>
      <Terminal
        title="how the instances were started (one terminal each)"
        steps={[
          { cmd: RUN_APP.consumer('billing-app-1', 'billing-app', 'payments-p3') },
          { cmd: RUN_APP.consumer('analytics-app-1', 'analytics-app', 'payments-p3') },
          { cmd: RUN_APP.consumer('analytics-app-2', 'analytics-app', 'payments-p3') },
          { cmd: RUN_APP.producer.replace('APP_TOPIC=orders', 'APP_TOPIC=payments-p3'), out: P.app.producer.join('\n') },
        ]}
      />
      <AppLog
        title="recorded: what each instance received"
        panels={Object.entries(P.app.logs).map(([name, lns]) => ({ name, lines: lns }))}
      />
      <Terminal steps={[P.app.describe]} title="both groups afterwards" />
      <p>
        The same picture as with the CLI: billing-app’s single instance received all six, analytics-app’s two instances split them by partition,
        and both groups end with lag 0. The client id is the same for every instance (<code>orders-app-order-listener</code>); the group decides who
        shares with whom, never the client id.
      </p>

      <h2>Designing with groups</h2>
      <Table
        head={['You want…', 'Do this', 'Because']}
        rows={[
          ['a new, independent use of the data (billing, analytics, search index, audit)', 'a new group.id', 'it gets every message and its own progress; it cannot slow the others down'],
          ['the same use to go faster', 'more consumers in the same group', 'partitions are shared; the partition count is the ceiling'],
          ['two copies of one service to split work', 'the same group.id in both', 'otherwise both process everything — duplicate work'],
          ['to re-process history for one use', 'stop that group, reset its offsets', 'other groups keep their place'],
        ]}
      />
      <Callout tone="tip" title="Rules that save trouble">
        <ul>
          <li>
            Name groups after the <strong>use</strong>, not the topic or a host: <code>billing</code>, <code>search-indexer</code>. A renamed group is a new
            group with no committed offsets.
          </li>
          <li>
            Decide where a <strong>new</strong> group starts: <code>auto.offset.reset=earliest</code> reads all retained history, <code>latest</code> only
            what arrives after it joins. The Java client’s default is <code>latest</code>; the listener above sets{' '}
            <code>offsetReset = OffsetReset.EARLIEST</code>.
          </li>
          <li>Monitor lag per group: a group with steadily growing lag is not keeping up, even if every other group is fine.</li>
          <li>Replays and redeliveries mean a group can see a message twice: make consumers idempotent before you reset offsets.</li>
          <li>Every group reads all the data: ten groups mean ten times the read traffic from the brokers. Groups are cheap, not free.</li>
        </ul>
      </Callout>

      <h2>Try it yourself</h2>
      <ol>
        <li>Start a third group, <code>--group audit</code>, with <code>--from-beginning</code>: it prints every payment so far, without affecting the others.</li>
        <li>Start a new group <em>without</em> <code>--from-beginning</code>: it prints nothing until you produce something new.</li>
        <li>Reset only partition 0 of analytics with <code>--topic payments:0 --to-earliest</code> and see which payments come back.</li>
        <li>Run <code>--reset-offsets --shift-by -1</code> on billing (stopped) and predict exactly which records it reads again.</li>
      </ol>

      <Recap
        points={[
          'Inside a group, consumers share the partitions (a queue); different groups each get every message (publish/subscribe).',
          'Committed offsets are stored per group, topic and partition in __consumer_offsets — that is what keeps groups independent.',
          'A stopped group keeps its offsets; when it returns it continues from them, and its lag shows how far behind it is.',
          'Resetting a stopped group’s offsets replays history for that group only; consumers must tolerate seeing a message twice.',
          'In Micronaut the group comes from configuration, so the same listener code can run as different subscribers.',
        ]}
      />
    </>
  )
}
