import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, StatTiles, Timeline, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { AppLog, Terminal } from '../components'
import { Practical4LogCells, type LogCellSpec } from '../components/Practical4LogCells'
import { MORE } from '../data/more'
import { USING_APP } from '../data/usingApp'

const S = MORE.share

/* ------------------------------------------------------------ CLI: three consumers, one partition */

const cliGot = S.consumers.map((c) => ({
  name: c.name,
  got: Object.fromEntries(c.out.map((l) => l.split('\t')).map(([o, , v]) => [Number(o.split(':')[1]), v] as const)),
}))
const CLI_CELLS: LogCellSpec[] = S.produced.typed.map((job, offset) => ({
  offset,
  text: job,
  note: cliGot.find((c) => offset in c.got)?.name ?? '—',
  hue: 3,
}))

/** The recorded group defaults (kafka-configs --describe --all). */
const defaults = Object.fromEntries(
  S.defaults.out.split('\n').map((l) => l.trim().match(/^share\.([\w.]+)=(\S+)$/)).filter((m) => m !== null).map((m) => [m[1], m[2]]),
)

/* ------------------------------------------------------------ Java: two workers, explicit acknowledgement */

interface Delivery { at: number; worker: string; offset: number; delivery: number; job: string; ack: string }
const deliveries: Delivery[] = []
const acks: { at: number; worker: string; text: string }[] = []
for (const w of S.workers) {
  for (const { at, line } of w.lines) {
    const d = line.match(/^(\S+) partition \d+ offset (\d+) delivery (\d+): (\S+) -> (\w+)$/)
    if (d) deliveries.push({ at, worker: d[1], offset: Number(d[2]), delivery: Number(d[3]), job: d[4], ack: d[5] })
    else acks.push({ at, worker: w.name, text: line.replace(/^\S+\s+/, '') })
  }
}
const limit = Number(S.javaConfig.cmd.match(/share\.delivery\.count\.limit=(\d+)/)?.[1])
const lockSeconds = Number(S.javaConfig.cmd.match(/share\.record\.lock\.duration\.ms=(\d+)/)?.[1]) / 1000
const offsets = [...new Set(deliveries.map((d) => d.offset))].sort((a, b) => a - b)
const finalState = (offset: number) => {
  const last = deliveries.filter((d) => d.offset === offset).sort((a, b) => b.delivery - a.delivery)[0]
  if (last.ack === 'accept') return { text: 'acknowledged', archived: false }
  if (last.ack === 'reject') return { text: 'archived: rejected', archived: true }
  return { text: last.delivery >= limit ? `archived: limit ${limit}` : 'available again', archived: last.delivery >= limit }
}
const JAVA_CELLS: LogCellSpec[] = offsets.map((offset) => {
  const f = finalState(offset)
  return { offset, text: deliveries.find((d) => d.offset === offset)!.job, note: f.text, hue: f.archived ? 8 : 3, striped: f.archived }
})
const javaGot = (worker: string) =>
  Object.fromEntries(
    offsets
      .map((o) => [o, deliveries.filter((d) => d.offset === o && d.worker === worker).map((d) => `#${d.delivery} ${d.ack}`).join(' · ')] as const)
      .filter(([, s]) => s),
  )

/* the slow job: who took it first, when its lock ran out, the late acknowledgement */
const slow1 = deliveries.find((d) => d.job.startsWith('slow') && d.delivery === 1)!
const slow2 = deliveries.find((d) => d.job.startsWith('slow') && d.delivery === 2)!
const lateAck = acks.find((a) => a.worker === slow1.worker && a.at > slow1.at + 1)!
const others = deliveries.filter((d) => !d.job.startsWith('slow'))
const end = Math.ceil(lateAck.at + 3)
const SEGMENTS: TimelineSegment[] = [
  { lane: slow1.worker, from: slow1.at, to: lateAck.at, label: `${slow1.job}: stuck`, hue: 8, striped: true },
  { lane: 'lock', from: slow1.at, to: slow2.at, label: `locked by ${slow1.worker}`, hue: 5 },
]
const EVENTS: TimelineEvent[] = [
  { lane: others[0].worker, at: others[0].at, label: `${others.length} other deliveries`, hue: 1 },
  { lane: 'lock', at: slow2.at, label: `expired → ${slow2.worker}`, hue: 5 },
  { lane: slow2.worker, at: slow2.at, label: `${slow2.job} #2 accept`, hue: 1 },
  { lane: slow1.worker, at: lateAck.at, label: `late ${lateAck.text}`, hue: 8 },
]

export default function Practical5() {
  return (
    <>
      <LessonGoals
        goals={[
          'run several consumers on ONE partition with a share group, each getting different records',
          'acknowledge records one by one: accept, release, reject — and see redelivery and the delivery limit',
          'see a record lock expire and the record go to another consumer',
        ]}
        before="Consumer groups, and Practicals 2 and 3"
      />

      <h2>A queue on top of a log</h2>
      <p>
        In a consumer group, a partition belongs to exactly one member, so you can never have more busy consumers than partitions. A{' '}
        <strong>share group</strong> (KIP-932, “queues for Kafka”) lets any number of consumers read the same partition: the broker hands each
        record to one of them and tracks it <em>per record</em>, like a job queue.
      </p>
      <TermList
        items={[
          { term: 'share group', definition: 'A group of share consumers that split the records — not the partitions — between them.' },
          { term: 'acquired', definition: 'A record handed to one consumer. Nobody else gets it while the lock lasts.' },
          { term: 'record lock', definition: `How long a consumer may hold a record before it is offered again (share.record.lock.duration.ms, default ${Number(defaults['record.lock.duration.ms']) / 1000} s).` },
          { term: 'acknowledgement', definition: 'The consumer’s verdict per record: ACCEPT (done), RELEASE (give it back), REJECT (never again), RENEW (keep the lock longer).' },
          { term: 'delivery count', definition: `How often a record was handed out. At share.delivery.count.limit (default ${defaults['delivery.count.limit']}) it is archived instead.` },
          { term: 'archived', definition: 'Final state: never delivered again — accepted, rejected, or out of attempts.' },
        ]}
      />
      <Flow
        title="One partition, three consumers: consumer group (left) vs share group (right)"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'p1', label: 'jobs-0', sub: 'one partition', col: 0, row: 0, rowSpan: 3, hue: 3, shape: 'log' },
          { id: 'g1', label: 'member 1', sub: 'all records', col: 1, row: 0, hue: 1 },
          { id: 'g2', label: 'member 2', sub: 'idle', col: 1, row: 1, hue: 8 },
          { id: 'g3', label: 'member 3', sub: 'idle', col: 1, row: 2, hue: 8 },
          { id: 'p2', label: 'jobs-0', sub: 'one partition', col: 2, row: 0, rowSpan: 3, hue: 3, shape: 'log' },
          { id: 's1', label: 'worker-a', sub: 'some records', col: 3, row: 0, hue: 1 },
          { id: 's2', label: 'worker-b', sub: 'some records', col: 3, row: 1, hue: 1 },
          { id: 's3', label: 'worker-c', sub: 'some records', col: 3, row: 2, hue: 1 },
        ]}
        edges={[
          { from: 'p1', to: 'g1', flow: true, hue: 1 },
          { from: 'p2', to: 's1', flow: true, hue: 1 },
          { from: 'p2', to: 's2', flow: true, hue: 1 },
          { from: 'p2', to: 's3', flow: true, hue: 1 },
        ]}
        caption="Left, a consumer group: the only partition belongs to one member; the other two are idle. Right, a share group: every member receives records from the same partition."
      />
      <Callout tone="note" title="Already switched on">
        On a new Kafka 4.3 cluster share groups need no setting: the feature <code>share.version</code> is finalized at level 1. They were
        early access in 4.0 and became production-ready in 4.2. On a single test broker, lower{' '}
        <code>share.coordinator.state.topic.replication.factor</code> and <code>…min.isr</code> to 1, as for the other internal topics.
      </Callout>
      <Terminal steps={[{ ...S.features, label: 'the feature level of this cluster' }]} />

      <h2>Setting up the group</h2>
      <p>Share-group settings live on the group itself and are changed with <code>kafka-configs.sh --entity-type groups</code>.</p>
      <StatTiles
        title="Recorded defaults of a share group"
        stats={[
          { label: 'record lock', value: `${Number(defaults['record.lock.duration.ms']) / 1000} s`, hue: 5, sub: 'record.lock.duration.ms' },
          { label: 'delivery limit', value: defaults['delivery.count.limit'], hue: 8, sub: 'delivery.count.limit' },
          { label: 'new group starts at', value: defaults['auto.offset.reset'], hue: 3, sub: 'auto.offset.reset' },
          { label: 'in-flight records per partition', value: Number(defaults['partition.max.record.locks']), hue: 5, sub: 'partition.max.record.locks' },
        ]}
      />
      <Terminal steps={[S.setup, S.defaults, S.reset]} />
      <Callout tone="warn" title="latest by default">
        A new share group starts at the <em>end</em> of the topic. Records produced before its first consumer fetched are never delivered —
        set <code>share.auto.offset.reset=earliest</code> on the group (not on the consumer) if it must start from the beginning.
      </Callout>

      <h2>Three consumers on one partition</h2>
      <p>Three console share consumers join group cli-workers; then nine jobs are produced one by one.</p>
      <Predict
        question={<p>Three share consumers, one partition, nine jobs. What does each consumer print?</p>}
        options={['All nine jobs each', 'One consumer gets all nine, two get nothing', 'Different jobs each — together exactly the nine']}
        answer={2}
        explanation="Each record is acquired by one consumer at a time. Here is how the recording split them:"
      />
      <Terminal steps={[{ ...S.members, label: 'every member is assigned the same partition, jobs:0' }, S.produced]} />
      <Practical4LogCells
        title="Who got which job (recorded)"
        partition="jobs-0"
        cells={CLI_CELLS}
        readers={cliGot.map((c) => ({ label: c.name, hue: 1 as const, got: c.got }))}
        caption="The split depends on timing — who was fetching when the record arrived — and changes between runs. There is no ordering between consumers: a later job can finish before an earlier one."
      />
      <Terminal steps={S.consumers.map((c) => ({ cmd: c.cmd, out: c.out.join('\n'), label: c.name }))} title="recorded output of each consumer" />
      <Terminal steps={[{ ...S.offsets, label: 'after the consumers stopped' }]} />
      <p>
        <strong>LAG 0</strong> means nothing is left to deliver. <code>START-OFFSET</code> is where the group’s tracked window starts: every
        record before it is done. In these recordings it stayed one behind the last acknowledged record even after the consumers stopped, so
        read LAG, not START-OFFSET, to know whether the group is finished.
      </p>

      <h2>Acknowledging: accept, release, reject</h2>
      <p>The console share consumer accepts every record by default; <code>--release</code> and <code>--reject</code> change that verdict.</p>
      <Flow
        title="The life of one record in a share group"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'av', label: 'Available', sub: 'waiting in the partition', col: 0, row: 0, rowSpan: 2, hue: 3, shape: 'log' },
          { id: 'acq', label: 'Acquired', sub: 'locked by one consumer, delivery n', col: 1, row: 0, rowSpan: 2, span: 2, hue: 1 },
          { id: 'ack', label: 'Acknowledged', sub: 'ACCEPT', col: 3, row: 0, hue: 3 },
          { id: 'arc', label: 'Archived', sub: 'REJECT, or limit reached', col: 3, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'av', to: 'acq', both: true, label: 'fetch ⇄ release' },
          { from: 'acq', to: 'ack' },
          { from: 'acq', to: 'arc', dashed: true },
        ]}
        steps={[
          { title: 'Fetch', body: <p>A consumer polls; the broker acquires available records for it and starts their lock. The delivery count goes up by one.</p>, active: ['av', 'acq', 'av>acq'] },
          { title: 'ACCEPT', body: <p>Processed: the record is done for this group.</p>, active: ['acq', 'ack', 'acq>ack'] },
          { title: 'RELEASE, or the lock expires', body: <p>The record becomes available again, for any consumer — unless its delivery count has reached the limit; then it is archived.</p>, active: ['av', 'acq', 'av>acq', 'arc'] },
          { title: 'REJECT', body: <p>The consumer says the record can never be processed (a poison message). It is archived at once and never delivered again.</p>, active: ['acq', 'arc', 'acq>arc'] },
        ]}
      />
      <Terminal steps={[S.limit, S.retriesIn, S.release, { ...S.releaseOffsets, label: 'both records are archived: nothing left' }]} />
      <Terminal steps={[S.rejectIn, S.reject, { ...S.rejectAgain, out: S.rejectAgain.out || '(nothing printed)' }]} />
      <Callout tone="tip" title="A dead-letter topic is your job here">
        A rejected or exhausted record is simply not delivered any more; nothing copies it anywhere. If failed jobs must be kept, have the
        consumer write them to a topic of its own before it rejects them.
      </Callout>

      <h2>In Java: explicit acknowledgement</h2>
      <p>
        <code>KafkaShareConsumer</code> (kafka-clients 4.x) looks like a normal consumer: subscribe, poll — plus <code>acknowledge(record, type)</code>{' '}
        for each record and <code>commitSync()</code> to send the verdicts.
      </p>
      <CodeBlock code={USING_APP['ShareWorker.java']} title="ShareWorker.java" language="java" />
      <Table
        head={['Mode', 'How records are acknowledged']}
        rows={[
          [<code key="m">implicit</code>, 'Default. Everything the last poll returned is accepted at the next poll or commit — simple, but one bad record cannot be released or rejected.'],
          [<code key="m">explicit</code>, 'Every record must be acknowledged with a type before the next poll; that is what the worker above does.'],
        ]}
      />
      <Terminal steps={[S.javaConfig, { ...S.javaMembers, label: 'two workers, both on jobs:0' }, { cmd: S.javaProduced.cmd, out: S.javaProduced.typed.map((j) => '> ' + j).join('\n') }]} />
      <Practical4LogCells
        title="What happened to each Java job (#n = delivery number)"
        partition="jobs-0"
        cells={JAVA_CELLS}
        readers={S.workers.map((w) => ({ label: w.name, hue: 1 as const, got: javaGot(w.name) }))}
        caption={`The retry job was released ${limit} times and then archived; the poison job was archived at once; the slow job was delivered twice — see below.`}
      />

      <h2>The lock runs out</h2>
      <p>
        If a consumer holds a record longer than the lock ({lockSeconds} s here), the broker takes it back and gives it to someone else — the
        first consumer is not told.
      </p>
      <Timeline
        title={`${slow1.job}: first attempt stuck for ${(lateAck.at - slow1.at).toFixed(0)} s, lock ${lockSeconds} s (recorded, seconds after the jobs were produced)`}
        lanes={[
          { id: 'lock', label: `lock on offset ${slow1.offset}` },
          ...S.workers.map((w) => ({ id: w.name, label: w.name })),
        ]}
        segments={SEGMENTS}
        events={EVENTS}
        end={end}
        unit="s"
        playable
      />
      <AppLog panels={S.workers.map((w) => ({ name: w.name, command: w.cmd, lines: w.lines.map((l) => `[${l.at.toFixed(1)} s] ${l.line}`) }))} />
      <Callout tone="warn" title="The job ran twice, and the late acknowledgement said “ok”">
        {slow2.worker} processed {slow2.job} at {slow2.at.toFixed(1)} s while {slow1.worker} was still working on it. When {slow1.worker}{' '}
        finally acknowledged at {lateAck.at.toFixed(1)} s, <code>commitSync()</code> reported <strong>{lateAck.text}</strong> — the record had
        already been accepted, so there was nothing to refuse. You cannot rely on the acknowledgement result to detect a duplicate: share
        groups deliver <em>at least once</em>, so processing must be idempotent. For long jobs, set a longer lock (up to 60 s by default) or
        acknowledge with <code>RENEW</code> to extend it while still working.
      </Callout>

      <h2>Tools for share groups</h2>
      <p>Share groups have their own CLI, and appear in the general group listing with their type.</p>
      <Terminal steps={[S.list, S.allGroups, S.resetDry]} />
      <Table
        head={['Task', 'Command']}
        rows={[
          ['members and their assignment', <code key="c">kafka-share-groups.sh --describe --group g --members</code>],
          ['start offset and lag', <code key="c">kafka-share-groups.sh --describe --group g --offsets</code>],
          ['state and coordinator', <code key="c">kafka-share-groups.sh --describe --group g --state</code>],
          ['replay from the start', <code key="c">kafka-share-groups.sh --reset-offsets --to-earliest --group g --topic t --execute</code>],
          ['change the lock or limit', <code key="c">kafka-configs.sh --alter --entity-type groups --entity-name g --add-config …</code>],
          ['remove a group', <code key="c">kafka-share-groups.sh --delete --group g</code>],
        ]}
      />

      <h2>Checklist: share group or consumer group?</h2>
      <p>Pick by what matters more: order, or spreading work.</p>
      <Table
        head={['Need', 'Use']}
        rows={[
          ['Records of a key processed in order', 'consumer group'],
          ['More workers than partitions, independent jobs', 'share group'],
          ['Retry one failed record without stopping the partition', 'share group (RELEASE, delivery limit)'],
          ['Exactly-once with transactions (read-process-write)', 'consumer group'],
          ['Replay by resetting the position', 'both'],
        ]}
      />
      <ul>
        <li>Set <code>share.auto.offset.reset</code> on the group before its first consumer starts.</li>
        <li>Choose the lock to cover the slowest normal job; use RENEW for the rare longer one.</li>
        <li>Make processing idempotent — redelivery after a lock timeout is normal behaviour.</li>
        <li>Keep failed jobs yourself (a topic) before REJECT if you need them later.</li>
      </ul>

      <Recap
        points={[
          'A share group spreads the records of one partition over any number of consumers; there is no ordering between them.',
          'Each delivery acquires a record under a lock; the consumer ACCEPTs, RELEASEs, REJECTs or RENEWs it.',
          'Released or timed-out records are delivered again until share.delivery.count.limit, then archived.',
          'A lock that expires hands the record to another consumer: delivery is at least once.',
          'kafka-share-groups.sh and kafka-configs.sh --entity-type groups manage them.',
        ]}
      />
    </>
  )
}
