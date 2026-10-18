import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { AppLog, ScenarioPlayer, StagePlayground, Terminal, type ScenarioStep, type StageAction } from '../components'
import { RUN_APP } from '../data/ordersApp'
import { PRACTICALS } from '../data/practicals'

const P = PRACTICALS.p2
const [create, describe, produce, where] = P.cli
const [one, two, three, four] = P.stages

const keyed = (typed: readonly string[]): StageAction[] =>
  typed.map((t) => {
    const [key, value] = t.split(':')
    return { type: 'produce', key, value }
  })
const rounds = (n: number): StageAction[] => Array.from({ length: n }, () => ({ type: 'consume' }))

const STEPS: ScenarioStep[] = [
  {
    title: 'Six keyed orders go to three partitions',
    body: <p>The key decides the partition: <code>hash(key) % 3</code>. alice and bob land in P0, dave and frank in P1, carol and erin in P2 — the same placement the real broker chose.</p>,
    actions: keyed(produce.typed),
    command: produce.cmd,
  },
  {
    title: 'c1 starts in group billing and owns all three partitions',
    body: <p>A group with one member: c1 is assigned P0, P1 and P2 and reads all six orders.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }, ...rounds(6)],
    command: one.cmd,
  },
  {
    title: 'c2 joins the same group: rebalance',
    body: <p>Same <code>group.id</code>, so the partitions are shared. The range assignor gives c1 P0 and P1, c2 P2. The generation number goes up.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }],
    command: two.cmd,
  },
  {
    title: 'c3 joins: one partition each',
    body: <p>Three consumers, three partitions: c1 P0, c2 P1, c3 P2. This is the most parallel the group can be.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }],
    command: three.cmd,
  },
  {
    title: 'New orders are split by partition',
    body: <p>Six more orders: each consumer receives exactly the records of its own partition — two each, always in partition order.</p>,
    actions: [...keyed(P.burst.typed), ...rounds(2)],
    command: P.burst.cmd,
  },
  {
    title: 'c4 joins: nothing left to give it',
    body: <p>Four consumers, three partitions. Inside a group a partition has exactly one owner, so c4 is idle — a standby.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }],
    command: four.cmd,
  },
  {
    title: 'c2 stops: the partitions are dealt out again',
    body: <p>Another rebalance: range deals the three partitions over the three remaining consumers again, so c3 takes c2’s partition 1 and the idle c4 gets partition 2. Each new owner continues from the group’s committed offset.</p>,
    actions: [{ type: 'removeConsumer', group: 'billing', member: 'billing-c2' }],
  },
]

/** The member rows of a --members --verbose description, as client id → partitions. */
const owners = (out: string) =>
  out
    .split('\n')
    .filter((l) => /^\S+\s+\S+…/.test(l) && !l.startsWith('GROUP'))
    .map((l) => {
      const f = l.trim().split(/\s+/)
      return `${f[3]}: ${f[6] === '-' ? 'idle' : f[6]}`
    })
    .join(' · ')

export default function Practical2() {
  return (
    <>
      <LessonGoals
        goals={[
          'see how keys spread records over partitions — and keep each key in order',
          'start one, two, three and four consumers in one group and read the assignment Kafka made',
          'watch a partition move to another consumer, without losing its progress',
          'do the same with several instances of a Micronaut application',
        ]}
        before="Practical 1, and lesson 8 — consumer groups"
      />

      <h2>What you will build</h2>
      <p>
        One topic with <strong>three partitions</strong>, one consumer group (<code>billing</code>) and a growing number of consumers in it. The point:
        a group splits the work by partition, so more consumers process more in parallel — up to the number of partitions. Every assignment below
        was read from a real Kafka {PRACTICALS.version} broker.
      </p>
      <ScenarioPlayer title="Practical 2: three partitions, one group, one to four consumers" setup={{ topic: 'orders', partitions: 3, groups: [{ id: 'billing', consumers: 0 }] }} steps={STEPS} />

      <h2>Part A — the command-line tools</h2>
      <h3>1. A topic with three partitions</h3>
      <Terminal steps={[create, describe]} title="recorded: create and describe" />
      <p>Three partitions, each its own log with its own offsets, each led by broker 1 (the only broker).</p>

      <h3>2. Keyed messages</h3>
      <p>With <code>parse.key=true</code> the producer splits each typed line at the separator into key and value:</p>
      <Terminal steps={[produce, where]} title="recorded: produce with keys, then read everything once" />
      <p>
        The producer hashes the key (murmur2) and takes it modulo the number of partitions. The same key always lands in the same partition, so
        all orders of one customer stay <strong>in order</strong> — Kafka only orders records inside a partition. A different number of partitions
        would place the keys differently, which is why adding partitions to a keyed topic later breaks this.
      </p>

      <h3>3. Consumers in one group, one by one</h3>
      <p>
        Each consumer runs in its own terminal with the same <code>--group billing</code>. <code>--command-property client.id=c1</code> only gives it a
        readable name. After each start, <code>kafka-consumer-groups.sh --describe --members --verbose</code> shows who owns what:
      </p>
      {[one, two, three, four].map((s, i) => (
        <Terminal key={s.label} title={`recorded: ${s.label}`} steps={[{ cmd: s.cmd, label: `terminal ${i + 1}` }, { ...s.describe, label: 'and in another terminal: who owns which partition?' }]} />
      ))}
      <Table
        head={['Column', 'Meaning']}
        rows={[
          ['CONSUMER-ID', 'The member id the coordinator gave this consumer: its client id plus a random part (shortened here).'],
          ['CLIENT-ID', 'The name the consumer chose (client.id): c1 … c4.'],
          ['#PARTITIONS / CURRENT-ASSIGNMENT', 'How many and which partitions this member owns right now (orders:0,1 = topic orders, partitions 0 and 1).'],
          ['CURRENT-EPOCH, TARGET-…', 'Used by the new consumer protocol (KIP-848). These console consumers use the classic protocol, so they show “-”.'],
        ]}
      />
      <Table
        head={['Consumers in billing', 'Assignment (recorded)']}
        rows={[one, two, three, four].map((s, i) => [String(i + 1), owners(s.describe.out)])}
      />
      <p>
        With two consumers the default range assignor gives the first member P0 and P1 and the second P2: three partitions do not divide by two,
        so the first members get one extra. The fourth consumer gets <strong>nothing</strong>: inside a group each partition has exactly one owner,
        so a group never has more busy consumers than the topic has partitions.
      </p>

      <h3>4. Who reads the new messages?</h3>
      <p>With three consumers running, six more orders were produced. Each consumer printed only its own partition:</p>
      <Terminal steps={[{ cmd: P.burst.cmd, out: P.burst.typed.map((t) => `> ${t}`).join('\n') }]} title="recorded: six more orders" />
      <AppLog title="recorded: what each consumer printed" panels={Object.entries(P.burst.outputs).map(([name, lines]) => ({ name, lines }))} />

      <h3>5. A consumer stops</h3>
      <p>
        c2 was stopped with Ctrl-C. It told the coordinator it was leaving and the group rebalanced; range dealt the partitions out again, so c3
        took c2’s partition 1 and the idle c4 got partition 2:
      </p>
      <Terminal steps={[{ ...P.afterStop.describe, label: P.afterStop.label }]} title="recorded: after c2 stopped" />
      <Terminal steps={[P.offsets]} title="recorded: the group’s progress" />
      <p>
        Nothing was lost and nothing was read twice: the group’s <strong>committed offset</strong> for each partition (CURRENT-OFFSET) belongs to the
        group, not to a consumer. Whoever owns a partition next continues from there. LAG 0 everywhere: every record has been processed.
      </p>
      <Callout tone="warn" title="A crash is different from a clean stop">
        Ctrl-C lets the consumer commit and leave the group at once. A process that is killed does neither: the coordinator notices only when its
        heartbeats stop for <code>session.timeout.ms</code> (45 s by default), and the next owner restarts from the last commit — records processed
        after that commit are processed again (lesson 7).
      </Callout>

      <Predict
        question={<p>The topic has 3 partitions and group billing runs 4 consumers. To process faster you start 2 more consumers in billing. What happens?</p>}
        options={['Each of the 6 consumers gets half a partition', 'Nothing gets faster: 3 consumers work, 3 are idle', 'Kafka creates 3 more partitions']}
        answer={1}
        explanation="A partition is never split inside a group. With 3 partitions at most 3 consumers of one group are busy; the others wait as standbys. To scale further, the topic needs more partitions."
      />

      <h2>Part B — the same with Micronaut</h2>
      <p>
        The same <code>orders-app</code> as in Practical 1, started three times in consumer mode with the same group. Every instance is one member
        of the group, exactly like the console consumers (the topic here is <code>orders-p2</code>, with three partitions):
      </p>
      <CodeBlock
        title="three terminals, then the producer"
        language="bash"
        code={`${RUN_APP.consumer('app-1', 'billing-app', 'orders-p2')}
${RUN_APP.consumer('app-2', 'billing-app', 'orders-p2')}
${RUN_APP.consumer('app-3', 'billing-app', 'orders-p2')}

${RUN_APP.producer.replace('APP_TOPIC=orders', 'APP_TOPIC=orders-p2')}`}
      />
      <AppLog
        title="recorded: each instance, from start-up — the assignments changing as the others joined"
        panels={Object.entries(P.app.logs).map(([name, l]) => ({ name, lines: l.startup }))}
      />
      <p>
        Read app-1 from the top: alone, it was assigned all three partitions; when app-2 joined it had to give up <em>everything</em> (“Revoke
        previously assigned partitions”) and got one back; again when app-3 joined. That is an <strong>eager</strong> rebalance: every member stops
        and gives up all its partitions, then the new assignment is handed out. The client’s default assignor list is{' '}
        <code>[RangeAssignor, CooperativeStickyAssignor]</code>; range is first, so range — and eager rebalancing — is used. Cooperative-sticky (or
        the new protocol, <code>group.protocol=consumer</code>) only moves the partitions that must move. The new protocol needs a 4.x client,
        though: this app runs <code>kafka-clients</code> 3.7.0 (from Micronaut 4.5), where it was still early access.
      </p>
      <Terminal steps={[P.app.assignments]} title="recorded: the group after three instances started" />
      <AppLog
        title="recorded: the producer, and what each instance received"
        panels={[{ name: 'producer mode', lines: P.app.producer }, ...Object.entries(P.app.logs).map(([name, l]) => ({ name, lines: l.received }))]}
      />
      <p>All three instances have the same client id (Micronaut builds it from the application and listener names); the member id tells them apart. A fourth instance joined and stayed idle:</p>
      <Terminal steps={[P.app.fourth]} title="recorded: four instances, three partitions" />
      <TermList
        items={[
          { term: 'Rebalance', definition: 'Redistribution of partitions among the members of a group, whenever a member joins or leaves.' },
          { term: 'Eager rebalance', definition: 'Classic behaviour of range and round-robin: every member revokes all its partitions first.' },
          { term: 'Cooperative rebalance', definition: 'Members keep the partitions that do not move; only moved ones are revoked.' },
          { term: 'Idle member', definition: 'A consumer in a group with no partition assigned, because there are fewer partitions than members.' },
        ]}
      />

      <h2>Try it yourself</h2>
      <StagePlayground />
      <ol>
        <li>Stop one of the three running console consumers with Ctrl-C and describe the group again within a second, then again a few seconds later.</li>
        <li>Produce only with the key <code>alice</code>: one consumer does all the work. A hot key cannot be spread over consumers.</li>
        <li>Start a consumer with <code>--command-property partition.assignment.strategy=org.apache.kafka.clients.consumer.RoundRobinAssignor</code> in a new group and compare the assignment.</li>
        <li>
          Restart the three Micronaut instances and compare who gets which partition. Start order does not decide it: range sorts members by member
          id, and all instances share one client id, so the random suffix decides — in the recording app-1 started first and still got partition 1.
        </li>
      </ol>

      <Recap
        points={[
          'The key decides the partition; one key always goes to one partition, so its records stay in order.',
          'Consumers with the same group.id share partitions: each partition is owned by exactly one member of the group.',
          'More consumers than partitions leaves the extra ones idle; partitions are the limit of parallelism.',
          'When a member joins or leaves, the group rebalances; progress is the group’s committed offset, so the next owner continues from it.',
          'Several instances of the same Micronaut app with the same groupId behave exactly like several console consumers.',
        ]}
      />
    </>
  )
}
