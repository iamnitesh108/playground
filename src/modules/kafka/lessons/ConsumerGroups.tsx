import { Box, Callout, Column, Connector, LessonGoals, Predict, Recap, Row, Table, TermList, Walkthrough } from '@/shared/ui'
import { ScenarioPlayer, StagePlayground, type ScenarioStep } from '../components/stage'
import { Terminal } from '../components/Terminal'
import { PRACTICALS } from '../data/practicals'
import { Flow, Timeline } from '@/shared/figures'
import { GroupsAssignment, type AssignmentRow } from '../components/GroupsAssignment'

const P2 = PRACTICALS.p2

/** Members and their partitions from a recorded `--describe --members --verbose` (client id, assignment column). */
const membersOf = (out: string): AssignmentRow['members'] =>
  out
    .split('\n')
    .filter((l) => l.startsWith('billing '))
    .map((l) => {
      const f = l.trim().split(/\s+/)
      const parts = f[6] === '-' ? [] : f[6].split(':')[1].split(',').map((p) => `P${p}`)
      return { name: f[3], partitions: parts }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
const KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank']

const SCENARIO: ScenarioStep[] = [
  {
    title: 'Six orders are written',
    body: <p>The topic has three partitions; the key picks the partition, so each customer’s orders stay together and in order.</p>,
    actions: KEYS.map((k, i) => ({ type: 'produce' as const, key: k, value: `order-${1001 + i}` })),
  },
  {
    title: 'One consumer joins group billing',
    body: <p>It is the only member, so the group gives it all three partitions. It reads everything, and the group’s committed offsets (the little markers) move to the end.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }, { type: 'drain' }],
    command: 'kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning',
  },
  {
    title: 'Two more consumers join the same group',
    body: <p>Each join triggers a rebalance (watch “gen” count up). With three members and three partitions, each gets one. New orders now go to three consumers in parallel.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }, { type: 'addConsumer', group: 'billing' }, ...KEYS.map((k, i) => ({ type: 'produce' as const, key: k, value: `order-${1007 + i}` })), { type: 'consume' }, { type: 'consume' }],
  },
  {
    title: 'A fourth consumer: one too many',
    body: <p>Three partitions can have at most three owners in one group. The fourth member gets nothing and waits, <em>idle</em> — a hot standby, not extra throughput.</p>,
    actions: [{ type: 'addConsumer', group: 'billing' }],
  },
  {
    title: 'A consumer stops',
    body: <p>It leaves the group and another rebalance runs. With the eager range assignor the partitions are dealt out again over the sorted members: c3 takes c2’s partition 1 and the idle c4 gets partition 2. Each new owner starts from the group’s committed offset, so nothing is skipped.</p>,
    actions: [{ type: 'removeConsumer', group: 'billing', member: 'billing-c2' }],
  },
  {
    title: 'A second group reads the same topic',
    body: <p>Group <code>analytics</code> has its own committed offsets, starting with none. Its single consumer reads all twelve orders — billing is not affected at all.</p>,
    actions: [{ type: 'addGroup', group: 'analytics' }, { type: 'addConsumer', group: 'analytics' }, { type: 'drain' }],
  },
]

const REBALANCE_STEPS = [
  { title: 'A consumer starts', body: <p>Consumer c3 starts with <code>group.id=billing</code> and contacts the group’s <strong>coordinator</strong> — the broker leading the <code>__consumer_offsets</code> partition that <code>billing</code> hashes to.</p> },
  { title: 'Everyone re-joins', body: <p>The coordinator starts a rebalance. All members send a <code>JoinGroup</code> request. In the classic “eager” protocol they first stop processing and give up all their partitions.</p> },
  { title: 'The leader assigns', body: <p>The first member to join becomes the <strong>group leader</strong>. It runs the assignor (here range: 3 partitions over 3 members, one each) and sends the plan back in <code>SyncGroup</code>.</p> },
  { title: 'Work resumes', body: <p>Each member receives its partitions and resumes from the group’s committed offsets. The <strong>generation</strong> number increases, so a member still holding an old generation is fenced off: its commits are rejected.</p> },
  { title: 'Heartbeats keep it alive', body: <p>Members heartbeat to the coordinator. Miss them for <code>session.timeout.ms</code>, or go longer than <code>max.poll.interval.ms</code> between polls, and the member is removed — another rebalance.</p> },
]

function RebalanceFlow() {
  return (
    <Walkthrough title="What happens in a classic rebalance" steps={REBALANCE_STEPS}>
      {(step) => (
        <Row align="center">
          <Column gap={10}>
            {['c1', 'c2', 'c3'].map((c) => (
              <Box
                key={c}
                title={c}
                caption={step === 3 ? ({ c1: 'P0, P1', c2: 'P2', c3: 'P3' } as Record<string, string>)[c] : step === 1 ? 'paused, no partitions' : c === 'c3' && step === 0 ? 'new' : step === 2 && c === 'c1' ? 'group leader' : 'member'}
                active={(step === 0 && c === 'c3') || (step === 2 && c === 'c1') || step === 3}
                dimmed={step === 1}
              />
            ))}
          </Column>
          <div style={{ width: 150, display: 'flex' }}>
            <Connector active direction={step === 2 || step === 3 ? 'left' : 'right'} label={['c3: JoinGroup', 'JoinGroup ×3', 'SyncGroup', 'assignment', 'heartbeats'][step]} />
          </div>
          <Box title="Group coordinator" caption="a broker" active={step !== 3} />
        </Row>
      )}
    </Walkthrough>
  )
}

/** One recorded describe, as the reader would type it. */
/**
 * Re-pads a recorded table so its columns line up again: the recording shortens the random consumer ids, which
 * leaves the original padding too short. Only whitespace changes; every value is the recorded one.
 */
const aligned = (out: string) => {
  const rows = out.trim().split('\n').map((l) => l.trim().split(/\s+/))
  const widths = rows.reduce<number[]>((w, r) => r.map((cell, i) => Math.max(w[i] ?? 0, cell.length)), [])
  return rows.map((r) => r.map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i] + 2) : cell)).join('')).join('\n')
}
const describe = (i: number) => ({ label: P2.stages[i].label, cmd: P2.stages[i].describe.cmd, out: aligned(P2.stages[i].describe.out) })

export default function ConsumerGroups() {
  return (
    <>
      <LessonGoals
        goals={[
          'predict which consumer reads which partition, for any number of consumers',
          'explain what a rebalance does, who decides the assignment, and what it costs',
          'use groups both as a work queue and as publish/subscribe',
          'read the output of kafka-consumer-groups.sh',
        ]}
        before="How a consumer works"
      />

      <h2>Why groups exist</h2>
      <p>
        One consumer may not keep up with a busy topic. Start several consumers with the same <code>group.id</code> and they form a{' '}
        <strong>consumer group</strong>: Kafka splits the topic’s partitions among them, so they work in parallel without reading the same record twice.
      </p>

      <h2>The two rules of groups</h2>
      <ol>
        <li>
          <strong>Inside a group, each partition is read by exactly one consumer.</strong> That is how ordering per partition survives parallel
          processing. One consumer may own several partitions.
        </li>
        <li>
          <strong>Different groups are completely independent.</strong> Each group gets every record and keeps its own committed offsets.
        </li>
      </ol>
      <p>
        So a group behaves like a <em>work queue</em> (records shared among its members), while several groups behave like <em>publish/subscribe</em>{' '}
        (each group sees everything). Kafka gives you both with one mechanism.
      </p>
      <Table
        head={['You want', 'Do this', 'Result']}
        rows={[
          ['more throughput for one job', 'more consumers, same group.id', 'partitions are shared; each record processed once by the job'],
          ['a second, different job on the same events', 'a new group.id', 'the new group gets its own copy of every record'],
          ['a copy for every instance (e.g. local caches)', 'a unique group.id per instance', 'every instance reads everything'],
        ]}
      />

      <ScenarioPlayer title="A group from one to four consumers, then a second group" setup={{ topic: 'orders', partitions: 3, groups: [{ id: 'billing', consumers: 0 }] }} steps={SCENARIO} />

      <h2>What the real cluster said</h2>
      <p>
        The same steps, recorded on Kafka {PRACTICALS.version} with console consumers named c1–c4 (practical 2 does this end to end). Read the{' '}
        <code>CURRENT-ASSIGNMENT</code> column:
      </p>
      <GroupsAssignment
        title={`Recorded on Kafka ${PRACTICALS.version}: who owned which partition of orders`}
        rows={[
          ...P2.stages.map((s, i) => ({ label: `${i + 1} consumer${i ? 's' : ''}`, sub: s.label, members: membersOf(s.describe.out) })),
          { label: 'c2 stopped', sub: 'everything dealt out again', members: membersOf(P2.afterStop.describe.out) },
        ]}
        caption="Drawn from the CURRENT-ASSIGNMENT column of the recorded describe output below. Dashed = a member with no partition."
      />
      <Terminal steps={[0, 1, 2, 3].map(describe)} title="recorded: kafka-consumer-groups.sh --describe --members --verbose" />
      <p>
        After c2 stopped, the partitions were dealt out again — not just c2’s: range sorts the members and hands out blocks, so c3 took c2’s
        partition 1 and the idle c4 got partition 2 (compare with the snapshot above). The group’s committed offsets show every partition caught up
        (<code>LAG 0</code>):
      </p>
      <Terminal steps={[{ label: P2.afterStop.label, cmd: P2.afterStop.describe.cmd, out: aligned(P2.afterStop.describe.out) }, { label: 'offsets and lag of the group', cmd: P2.offsets.cmd, out: aligned(P2.offsets.out) }]} />
      <Callout tone="warn" title="More consumers than partitions">
        With 3 partitions, a 4th consumer in the same group sits <strong>idle</strong>. The partition count is the ceiling on a group’s parallelism —
        choose it with your peak consumer count in mind. Partitions can be added later, but that moves keys to different partitions (per-key order breaks
        across the change); they can never be removed.
      </Callout>

      <StagePlayground />

      <h2>The group coordinator</h2>
      <p>
        Every group is managed by one broker, its <strong>coordinator</strong>. Kafka hashes the <code>group.id</code> onto one of the partitions of the
        internal topic <code>__consumer_offsets</code> (50 by default); the broker leading that partition is the coordinator. It tracks the members,
        runs rebalances and stores the group’s commits in that partition — so the group’s state is as durable as any topic.
      </p>
      <Flow
        title="The classic group protocol, request by request"
        cols={4}
        rows={2}
        nodes={[
          { id: 'c1', label: 'c1', sub: 'leader, runs assignor', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'c2', label: 'c2', sub: 'member', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'coord', label: 'coordinator', sub: 'a broker', col: 2, row: 0, rowSpan: 2, hue: 5 },
          { id: 'log', label: '__consumer_offsets', sub: 'hash(group.id) % 50', col: 3, row: 0, rowSpan: 2, hue: 3, shape: 'log' },
        ]}
        edges={[
          { from: 'c1', to: 'coord', label: 'Join / Sync', hue: 1, flow: true, both: true },
          { from: 'c2', to: 'coord', label: 'Join / Sync', hue: 1, flow: true, both: true },
          { from: 'coord', to: 'log', hue: 5 },
        ]}
        steps={[
          { title: 'FindCoordinator', body: <p>Each consumer asks any broker which broker coordinates its group: the leader of the <code>__consumer_offsets</code> partition that the <code>group.id</code> hashes to.</p>, active: ['c1', 'c2', 'coord', 'log'] },
          { title: 'JoinGroup', body: <p>Every member sends JoinGroup with the assignors it supports. The coordinator waits for all of them, picks one member as leader (c1) and sends it the member list.</p>, active: ['c1', 'c2', 'coord', 'c1>coord', 'c2>coord'] },
          { title: 'The leader assigns', body: <p>The leader runs the assignor (range by default) over the members and the topic’s partitions. The brokers never see the logic — it runs in the client.</p>, active: ['c1'] },
          { title: 'SyncGroup', body: <p>The leader sends the plan in its SyncGroup; every member’s SyncGroup answer carries its own partitions. A new generation starts.</p>, active: ['c1', 'c2', 'coord', 'c1>coord', 'c2>coord'] },
          { title: 'Heartbeats and commits', body: <p>From now on members heartbeat to the coordinator and commit offsets to it; it stores both group state and commits in its <code>__consumer_offsets</code> partition.</p>, active: ['c1', 'c2', 'coord', 'log', 'coord>log'] },
        ]}
      />

      <h2>Rebalancing</h2>
      <p>
        Whenever membership changes — a consumer joins, leaves, crashes, or the topic gains partitions — the group <strong>rebalances</strong>:
        partitions are reassigned among the current members.
      </p>
      <RebalanceFlow />
      <Table
        head={['', 'Classic protocol (default)', 'Consumer protocol (KIP-848)']}
        rows={[
          ['Enable with', <code key="1">group.protocol=classic</code>, <code key="2">group.protocol=consumer</code>],
          ['Who computes the assignment', 'a member: the group leader, using partition.assignment.strategy', 'the coordinator broker (server-side assignors)'],
          ['How a change spreads', 'every member re-joins (JoinGroup/SyncGroup)', 'each member’s heartbeat carries its new target assignment'],
          ['Stop-the-world', 'with eager assignors, everyone pauses', 'no: unaffected members keep their partitions'],
          ['Available', 'since the beginning', 'generally available since Kafka 4.0'],
        ]}
      />
      <p>
        That is the banner the Kafka 4.x Java consumer logs whenever it runs the classic protocol — so the console consumer prints it, and so
        will any 4.x Java application: <em>“The consumer rebalance protocol (KIP-848) is production-ready!”</em> The recordings in this module use
        the classic protocol, which is still the default for clients.
      </p>

      <h3>Eager vs cooperative</h3>
      <p>
        In an <strong>eager</strong> rebalance every member revokes all its partitions first, then receives a new set — nobody processes in between. In
        a <strong>cooperative</strong> (incremental) rebalance, members keep the partitions that do not move and only hand over the ones that do,
        possibly over two short rounds. The recorded Micronaut instances in practical 2 show the eager pattern: “Revoke previously assigned
        partitions …” followed by “Adding newly assigned partitions …” on every join.
      </p>
      <Timeline
        title="c3 joins a group where c1 owns P0, P1 and c2 owns P2 — eager (schematic)"
        lanes={[
          { id: 'c1', label: 'c1' },
          { id: 'c2', label: 'c2' },
          { id: 'c3', label: 'c3' },
        ]}
        segments={[
          { lane: 'c1', from: 0, to: 40, label: 'P0 P1', hue: 1 },
          { lane: 'c1', from: 40, to: 70, label: 'nothing', hue: 8, striped: true },
          { lane: 'c1', from: 70, to: 120, label: 'P0', hue: 1 },
          { lane: 'c2', from: 0, to: 40, label: 'P2', hue: 1 },
          { lane: 'c2', from: 40, to: 70, label: 'nothing', hue: 8, striped: true },
          { lane: 'c2', from: 70, to: 120, label: 'P1', hue: 1 },
          { lane: 'c3', from: 40, to: 70, label: 'joining', hue: 5, striped: true },
          { lane: 'c3', from: 70, to: 120, label: 'P2', hue: 1 },
        ]}
        events={[{ lane: 'c3', at: 40, label: 'JoinGroup', hue: 5 }, { lane: 'c1', at: 70, label: 'SyncGroup', hue: 5 }]}
        end={120}
        unit="ms"
        playable
      />
      <Timeline
        title="The same join — cooperative-sticky (schematic)"
        lanes={[
          { id: 'c1', label: 'c1' },
          { id: 'c2', label: 'c2' },
          { id: 'c3', label: 'c3' },
        ]}
        segments={[
          { lane: 'c1', from: 0, to: 55, label: 'P0 P1', hue: 1 },
          { lane: 'c1', from: 55, to: 120, label: 'P0 — kept throughout', hue: 1 },
          { lane: 'c2', from: 0, to: 120, label: 'P2 — never stops', hue: 1 },
          { lane: 'c3', from: 40, to: 85, label: 'joining', hue: 5, striped: true },
          { lane: 'c3', from: 85, to: 120, label: 'P1', hue: 1 },
        ]}
        events={[{ lane: 'c1', at: 55, label: 'revokes only P1', hue: 1 }, { lane: 'c3', at: 85, label: 'second round', hue: 5 }]}
        end={120}
        unit="ms"
        playable
      />
      <p>
        In the eager run nobody processes anything during the rebalance, and two of the three partitions change owner. In the cooperative run only
        P1 moves; c2 never notices.
      </p>

      <h3>Assignment strategies, worked out</h3>
      <p>Three partitions, two consumers c1 and c2 (members are sorted by id):</p>
      <Table
        head={['Assignor', 'How it splits', 'c1', 'c2', 'Notes']}
        rows={[
          ['range', 'contiguous blocks per topic; the first members get the extra', 'P0, P1', 'P2', 'the default (first in the default list); uneven when one group reads many topics'],
          ['roundrobin', 'deals partitions out like cards', 'P0, P2', 'P1', 'even, but moves many partitions on change'],
          ['sticky', 'even, keeps previous owners where possible', 'balanced', 'balanced', 'fewer partitions move on change'],
          ['cooperative-sticky', 'sticky, done incrementally', 'balanced', 'balanced', 'members keep unaffected partitions during a rebalance'],
        ]}
      />
      <GroupsAssignment
        title="Three partitions, two consumers — then c3 joins"
        rows={[
          { label: 'range', sub: 'blocks, first members get the extra', members: [{ name: 'c1', partitions: ['P0', 'P1'] }, { name: 'c2', partitions: ['P2'] }] },
          { label: 'roundrobin', sub: 'dealt like cards', members: [{ name: 'c1', partitions: ['P0', 'P2'] }, { name: 'c2', partitions: ['P1'] }] },
          { label: 'range, c3 joins', sub: 'P1 and P2 both change owner', members: [{ name: 'c1', partitions: ['P0'] }, { name: 'c2', partitions: ['P1'] }, { name: 'c3', partitions: ['P2'] }] },
          { label: 'sticky, c3 joins', sub: 'only P1 moves', members: [{ name: 'c1', partitions: ['P0'] }, { name: 'c2', partitions: ['P2'] }, { name: 'c3', partitions: ['P1'] }] },
        ]}
        caption="Sticky starts from the current owners (here range’s result) and moves the fewest partitions that keep the split even."
      />
      <p>
        The default <code>partition.assignment.strategy</code> is <code>[RangeAssignor, CooperativeStickyAssignor]</code>: the group uses range, and the
        list lets you move to cooperative-sticky with rolling restarts. The recording matches range: with two consumers, c1 got <code>orders:0,1</code>{' '}
        and c2 <code>orders:2</code>.
      </p>
      <Predict
        question={<p>A group with the range assignor reads one topic with 6 partitions. It has 4 consumers. How are the partitions split?</p>}
        options={['2, 2, 1, 1', '2, 2, 2, 0', 'Each consumer gets 1.5', '6, 0, 0, 0']}
        answer={0}
        explanation="Range gives each member 6 ÷ 4 = 1 partition, and the remainder (2) one extra each to the first members: P0–P1, P2–P3, P4, P5."
      />

      <Callout tone="tip" title="Rebalance hygiene">
        <ul>
          <li>Keep per-batch work fast, or lower <code>max.poll.records</code>, so you stay inside <code>max.poll.interval.ms</code>.</li>
          <li>
            For containers that restart often, set <code>group.instance.id</code> (<strong>static membership</strong>): a member that restarts and
            rejoins within <code>session.timeout.ms</code> gets its old partitions back without a rebalance.
          </li>
          <li>Commit before giving up partitions (or in a rebalance listener), or expect some records to be processed twice.</li>
          <li>Prefer cooperative-sticky or the consumer protocol when rebalances are frequent.</li>
        </ul>
      </Callout>

      <h2>How many partitions?</h2>
      <p>
        Pick the partition count from the most consumers one group will ever need in parallel (measure what one consumer handles per second, divide
        your peak rate by it), with headroom. More partitions also mean more files and more work for the cluster, so do not go to thousands “just in
        case”. If records with the same key must be processed in order, that order exists only inside one partition — another reason to choose the
        count up front.
      </p>
      <Predict
        question={<p>Group <code>billing</code> has caught up. You start a new group <code>audit</code> with <code>auto.offset.reset=earliest</code>. What does it read?</p>}
        options={['Nothing: billing already read everything', 'Every record still kept in the topic, from the beginning', 'Only records written after audit started']}
        answer={1}
        explanation="Groups are independent. audit has no committed offsets, so earliest starts it at the oldest record still retained, regardless of what billing did. (With latest it would start at the end.)"
      />

      <Callout tone="note" title="Share groups">
        Everything here describes classic consumer groups. Kafka 4.2 also made <strong>share groups</strong> (KIP-932, “queues for Kafka”)
        production-ready: several consumers read the <em>same</em> partition, each record is acknowledged individually, and failed records are
        redelivered. Parallelism is no longer capped by the partition count, but per-key ordering is given up. Use them for independent jobs, not
        ordered streams.
      </Callout>

      <p>
        Hands-on: practical 1 (lesson 10) runs one producer and one consumer, practical 2 (lesson 11) shares three partitions among one to four
        consumers, practical 3 (lesson 12) runs two groups on one topic — each with the CLI and with a Micronaut app.
      </p>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Consumer group', definition: 'Consumers sharing a group.id that split a topic’s partitions between them.' },
          { term: 'group.id', definition: 'The name that makes consumers members of the same group.' },
          { term: 'Assignment', definition: 'Which partitions each member currently owns.' },
          { term: 'Rebalance', definition: 'Redistribution of partitions when group membership changes.' },
          { term: 'Group coordinator', definition: 'The broker managing a group’s membership and commits (leader of its __consumer_offsets partition).' },
          { term: 'Group leader', definition: 'The member that computes the assignment (classic protocol).' },
          { term: 'Generation', definition: 'Counter that increases with each rebalance; fences stale members.' },
          { term: 'Eager / cooperative', definition: 'Revoke everything then reassign, versus move only the partitions that change.' },
          { term: 'Idle consumer', definition: 'A member with no partition because the group has more members than partitions.' },
          { term: 'Static membership', definition: 'Stable group.instance.id so a restart within session.timeout.ms does not trigger a rebalance.' },
        ]}
      />

      <Recap
        points={[
          'Same group.id = share the work (each partition to one member); different group.id = each group gets everything.',
          'A group’s parallelism is capped by the partition count; extra members are idle.',
          'Every membership change rebalances; the classic eager protocol pauses everyone, cooperative and KIP-848 do not.',
          'Partitions move with the group’s committed offsets, so a new owner continues where the old one committed.',
        ]}
      />
    </>
  )
}
