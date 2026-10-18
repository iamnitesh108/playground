import { useState } from 'react'
import { ByteLayout, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Segmented, Table, TermList } from '@/shared/ui'
import { Terminal } from '../components'
import { SegmentsDir } from '../components/SegmentsDir'
import { SegmentsLogDemo } from '../components/SegmentsLogDemo'
import { SegmentsLookup } from '../components/SegmentsLookup'
import { formatBytes, offsetOf, parseSegmentDir } from '../components/SegmentsParse'
import { SEGMENTS as REC } from '../data/segments'

// ------------------------------------------------------------------ recorded data, parsed for the figures

const SEGMENT_BYTES = 1048576
const FULL = parseSegmentDir(REC.dir.full.out)
const FIRST = FULL[0]
const EMPTY = parseSegmentDir(REC.dir.empty.out)[0]
const LOG_END = offsetOf(REC.dir.offsets[1].out)
const MORE_END = offsetOf(REC.retention.end.out)
const NEW_START = offsetOf(REC.retention.start.out)
/** The segment retention kept although it held expired records, and the last offset it holds. */
const BEFORE = parseSegmentDir(REC.retention.before.out)
const MIXED_LAST = BEFORE[BEFORE.findIndex((s) => s.base === NEW_START) + 1].base - 1

/** "baseOffset: 0 lastOffset: 15 count: 16 position: 0 CreateTime: … size: 16205" → the first batch of the recorded dump. */
const firstBatch = /count: (\d+) position: \d+ CreateTime: \d+ size: (\d+)/.exec(REC.files.log.out)
const PER_BATCH = Number(firstBatch?.[1])
const BATCH_BYTES = Number(firstBatch?.[2])
const LOOKUP_SHAPE = { records: LOG_END, perBatch: PER_BATCH, batchBytes: BATCH_BYTES, segmentBytes: SEGMENT_BYTES }

type Moment = 'created' | 'written' | 'more' | 'expired' | 'all'
const MOMENTS: Record<Moment, { label: string; step: { label?: string; cmd: string; out: string }; logEnd: number; note: string }> = {
  created: { label: 'created', step: REC.dir.empty, logEnd: 0, note: 'One empty segment. Its .log is 0 bytes, but both index files are already 10 MB: Kafka preallocates them so they can be memory-mapped.' },
  written: { label: `${LOG_END} records`, step: REC.dir.full, logEnd: LOG_END, note: `${FULL.length} segments. Each closed one holds ${FULL[1].base} records and stopped just under 1 MiB; its index files shrank to what they use. Only the last one is written to.` },
  more: { label: `+${MORE_END - LOG_END} records`, step: REC.retention.before, logEnd: MORE_END, note: `The new records filled the third segment and rolled a fourth. The third now holds old and new records.` },
  expired: { label: 'retention 10 s', step: REC.retention.after, logEnd: MORE_END, note: `The two segments with only old records were renamed to .deleted. The third stays — its newest record is young — so the log now starts at ${NEW_START}.` },
  all: { label: 'all expired', step: REC.retention.allExpired, logEnd: MORE_END, note: `Every record expired. Kafka rolled a new, empty segment at ${MORE_END} so it could delete the old active one too. Nothing is left to read, but the offsets carry on from ${MORE_END}.` },
}

/** The recorded partition directory at five moments, drawn from each `ls -l`. */
function DirectoryExplorer() {
  const [moment, setMoment] = useState<Moment>('written')
  const m = MOMENTS[moment]
  return (
    <>
      <Segmented
        label="moment"
        value={moment}
        onChange={setMoment}
        options={(Object.keys(MOMENTS) as Moment[]).map((k) => ({ value: k, label: MOMENTS[k].label }))}
      />
      <p>{m.note}</p>
      <SegmentsDir segments={parseSegmentDir(m.step.out)} segmentBytes={SEGMENT_BYTES} logEnd={m.logEnd} />
      <Terminal title={`recorded: Kafka ${REC.version}, ${REC.dir.full.cmd.split(' ').at(-1)}`} steps={[m.step]} />
    </>
  )
}

export default function Segments() {
  return (
    <>
      <LessonGoals
        goals={[
          'say what a segment is and why a partition is many files, not one',
          'read a partition directory: base offsets in file names, .log, .index, .timeindex',
          'predict when the active segment rolls (by size, by time) and when it does not',
          'follow how the broker finds one offset in a sparse index without reading the whole log',
          'explain why retention deletes whole segments and why data can outlive retention.ms',
        ]}
        before={
          <>
            <a href="#/kafka/topics-partitions">Topics and partitions</a> (a partition is an append-only log) and{' '}
            <a href="#/kafka/offsets">Offsets</a> (every record has a number).
          </>
        }
      />

      <h2>One partition, many files</h2>
      <p>A partition is one endless, ordered log — but on disk the broker stores it as a series of files called segments.</p>
      <Callout tone="analogy">
        Think of a ship’s log kept in notebooks. You only ever write in the newest notebook; when it is full you start a new one, and you label each notebook
        with the number of its first entry. To find entry 1 500 you grab the notebook labelled 1 024, not the one labelled 2 048. And when old entries are no
        longer needed, you throw away a whole notebook — you never tear pages out of the middle.
      </Callout>
      <TermList
        items={[
          { term: 'Segment', definition: 'One chunk of a partition’s log: a .log file with a contiguous range of records, plus its index files.' },
          { term: 'Base offset', definition: 'The first offset a segment holds. It is the file name, zero-padded to 20 digits.' },
          { term: 'Active segment', definition: 'The newest segment, the only one that receives writes. All others are closed and read-only.' },
          { term: 'Roll', definition: 'Closing the active segment and starting a new one at the log end offset.' },
          { term: 'Offset index (.index)', definition: 'A sparse map from offset to byte position in the .log, so a read can jump close to an offset.' },
          { term: 'Time index (.timeindex)', definition: 'A sparse map from timestamp to offset, for “read from 09:00” lookups.' },
          { term: 'Log start offset', definition: 'The oldest offset still stored; it moves forward when retention deletes segments.' },
        ]}
      />
      <Flow
        title="Why split the log at all"
        cols={4}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'prod', label: 'producer', sub: 'appends', col: 0, row: 0, hue: 7, shape: 'actor' },
          { id: 'active', label: 'active segment', sub: 'the only one written', col: 1, row: 0, span: 2, hue: 3, shape: 'log' },
          { id: 'closed', label: 'closed segments', sub: 'read-only files', col: 1, row: 1, span: 2, hue: 3, shape: 'queue' },
          { id: 'cons', label: 'consumer', sub: 'reads any offset', col: 3, row: 1, hue: 1 },
          { id: 'gone', label: 'oldest segment', sub: 'deleted as one file', col: 1, row: 2, span: 2, hue: 8, shape: 'store' },
        ]}
        edges={[
          { from: 'prod', to: 'active', flow: true, hue: 7 },
          { from: 'active', to: 'closed', label: 'roll' },
          { from: 'closed', to: 'cons', flow: true, hue: 1 },
          { from: 'closed', to: 'gone', label: 'retention', hue: 8, dashed: true },
        ]}
        caption="Schematic. Writes only touch the end of one file; deleting old data is removing a file, not rewriting one; and a read can go straight to the file that holds its offset."
      />

      <h2>What a partition directory looks like</h2>
      <p>This section shows a real partition directory from a recording, at five moments of its life.</p>
      <p>
        The recording creates a topic <code>payments</code> with one partition and <code>segment.bytes</code> set to 1 MiB (the default is 1 GiB), writes{' '}
        {LOG_END} records of 1 000 bytes, and lists <code>/tmp/kafka-logs/payments-0/</code> — the directory of partition 0 — after each step. Kafka refuses
        anything smaller than 1 MiB:
      </p>
      <Terminal title={`recorded: Kafka ${REC.version}`} steps={[REC.dir.create, REC.dir.tooSmall, REC.dir.write, ...REC.dir.offsets]} />
      <DirectoryExplorer />
      <StatTiles
        title="Recorded numbers for one closed segment"
        stats={[
          { label: 'records per segment', value: FULL[1].base, sub: `${PER_BATCH}-record batches of ${formatBytes(BATCH_BYTES)}`, hue: 3 },
          { label: '.log when it rolled', value: formatBytes(FIRST.log), sub: 'of 1 MiB segment.bytes', hue: 3, bar: { value: FIRST.log, max: SEGMENT_BYTES } },
          { label: '.index', value: formatBytes(FIRST.index ?? 0), sub: `${REC.files.counts.entries} entries × 8 B`, hue: 3 },
          { label: 'index of a new segment', value: formatBytes(EMPTY.index ?? 0), sub: 'preallocated, trimmed on roll', hue: 3 },
        ]}
      />

      <h2>What is inside each file</h2>
      <p>This section opens the files of the first segment with <code>kafka-dump-log.sh</code>, the tool that ships with Kafka.</p>
      <Table
        head={['file', 'holds', 'why']}
        rows={[
          [<code key="k140">…0000.log</code>, 'the record batches, exactly as producers sent them', 'the data itself; consumers get these bytes'],
          [<code key="k141">…0000.index</code>, 'offset → byte position, one entry per ~4 KB', 'jump close to an offset without scanning'],
          [<code key="k142">…0000.timeindex</code>, 'timestamp → offset, one entry per ~4 KB', 'find the first offset at or after a time'],
          [<code key="k143">…1024.snapshot</code>, 'producer ids and sequence numbers at that offset', 'idempotent producers survive a restart'],
          [<code key="k144">leader-epoch-checkpoint</code>, 'which leader epoch started at which offset', 'replicas truncate correctly after a failover'],
          [<code key="k145">partition.metadata</code>, 'the topic id', 'a re-created topic with the same name is not mistaken for the old one'],
        ]}
      />
      <Terminal title="recorded: the first segment of payments-0" steps={[REC.files.log, REC.files.index, REC.files.timeindex]} />
      <p>
        The <code>.log</code> holds batches, not single records: each line is one batch of {PER_BATCH} records with its <code>position</code> — the byte where
        it starts in the file. The index has an entry for most batches, because each batch ({formatBytes(BATCH_BYTES)}) is bigger than{' '}
        <code>index.interval.bytes</code> (4 KB). With small records you would see one entry per ~4 KB of batches instead: the index is{' '}
        <strong>sparse</strong>, so a 1 GiB segment needs about 2 MB of index, not one entry per record.
      </p>
      <ByteLayout
        title="One index entry each — offsets are stored relative to the base offset, so 4 bytes are enough"
        rows={[
          { label: '.index', fields: [{ label: 'offset − base', bytes: 4, hue: 3, content: '4 B' }, { label: 'position in .log', bytes: 4, hue: 3, content: '4 B' }] },
          { label: '.timeindex', fields: [{ label: 'timestamp (ms)', bytes: 8, hue: 3, content: '8 B' }, { label: 'offset − base', bytes: 4, hue: 3, content: '4 B' }] },
        ]}
        caption={`Recorded: ${REC.files.counts.entries} entries make the ${formatBytes(FIRST.index ?? 0)} .index of the first segment (8 bytes each). kafka-dump-log prints the absolute offset; the file stores offset − base offset.`}
      />

      <h2>When the active segment rolls</h2>
      <p>A new segment starts only when a write arrives and one of these is true; otherwise the active segment keeps growing.</p>
      <Table
        head={['rule', 'topic setting (broker default)', 'default']}
        rows={[
          ['the next batch would push the .log past the size limit', <><code>segment.bytes</code> (<code>log.segment.bytes</code>)</>, '1 GiB'],
          ['the new batch’s timestamp is more than the time limit after the segment’s first batch', <><code>segment.ms</code> (<code>log.roll.ms</code> / <code>log.roll.hours</code>)</>, '7 days'],
          ['the .index or .timeindex is full', <><code>segment.index.bytes</code> (<code>log.index.size.max.bytes</code>)</>, '10 MiB'],
        ]}
      />
      <SegmentsLogDemo />
      <p>The time rule surprises people: it is checked when a batch is written, comparing its timestamp with the segment’s first batch — no clock closes a segment. The recording proves it with a 10-second limit:</p>
      <Timeline
        title="Recorded steps on topic clicks with segment.ms=10000"
        unit="s"
        end={15}
        lanes={[
          { id: 'prod', label: 'producer' },
          { id: 's0', label: '…0000.log' },
          { id: 's3', label: '…0003.log' },
        ]}
        segments={[
          { lane: 's0', from: 0, to: 13, label: 'active', hue: 3 },
          { lane: 's0', from: 13, to: 15, label: 'closed', hue: 3, striped: true },
          { lane: 's3', from: 13, to: 15, label: 'active', hue: 3 },
        ]}
        events={[
          { lane: 'prod', at: 0, label: 'offsets 0–2', hue: 7 },
          { lane: 's0', at: 10, label: 'limit passed, no roll', hue: 3 },
          { lane: 'prod', at: 13, label: 'offsets 3–4 roll', hue: 7 },
        ]}
      />
      <Predict
        question={
          <>
            A topic has <code>segment.ms=10000</code>. A producer writes three records, then nothing for 13 seconds. How many <code>.log</code> files does the
            partition have before the next write?
          </>
        }
        options={['one — nothing rolls without a write', 'two — the old segment closed after 10 seconds', 'zero — the records expired']}
        answer={0}
        explanation={
          <>
            Recorded below: 13 seconds later there is still one <code>.log</code>. The roll happens on the next append — the write of offsets 3 and 4 closed the
            first segment and started <code>…0003.log</code>. A quiet topic can keep one active segment open for a long time.
          </>
        }
      />
      <Terminal
        title={`recorded: Kafka ${REC.version}, topic clicks`}
        steps={[REC.timeRoll.create, REC.timeRoll.first, REC.timeRoll.ls1, REC.timeRoll.ls2, REC.timeRoll.second, REC.timeRoll.ls3]}
      />

      <h2>Finding one offset</h2>
      <p>This section follows a consumer that asks for offset {REC.lookup.target}, and shows how three small lookups replace reading gigabytes.</p>
      <SegmentsLookup shape={LOOKUP_SHAPE} initial={REC.lookup.target} />
      <p>
        The figure is computed by the lesson’s model of the log, rebuilt with the recorded batch sizes; the recording checks that the model produces the same
        index and rolls at the same offsets as the broker. Here is what the broker’s files and a real consumer said for offset {REC.lookup.target}:
      </p>
      <Terminal title={`recorded: Kafka ${REC.version}, payments-0`} steps={[REC.lookup.index, REC.lookup.log, REC.lookup.read]} />
      <Callout tone="tip" title="Why this is fast">
        Segment choice is a lookup in an in-memory map; the index binary search touches a few pages of a memory-mapped file; the scan reads only batch headers.
        Consumers that keep up read the newest bytes of the active segment, which are still in the operating system’s page cache, so they rarely touch the disk.
      </Callout>

      <h2>Retention deletes whole segments</h2>
      <p>This section shows how <code>retention.ms</code> removes old data: whole closed segments at a time, never single records.</p>
      <p>
        A segment can go only when its <strong>newest</strong> record is older than <code>retention.ms</code>. The recording adds {MORE_END - LOG_END} fresh
        records — they fill the third segment and roll a fourth — then sets <code>retention.ms=10000</code> while the first {LOG_END} records are already
        older than that. Use the “moment” switch above to see the same directory drawn.
      </p>
      <Predict
        question={
          <>
            Segment <code>…{NEW_START}.log</code> holds offsets {NEW_START}–{LOG_END - 1}, written more than 10 seconds ago, and offsets {LOG_END}–{MIXED_LAST},
            written just now. Retention is set to 10 seconds. What happens to it?
          </>
        }
        options={['it is deleted — most of its records expired', 'Kafka cuts out the old records and keeps the new ones', 'it stays, old records included, until its newest record expires']}
        answer={2}
        explanation={
          <>
            Recorded: the segments before it became <code>.deleted</code>, <code>…{NEW_START}.log</code> stayed, and the log start offset moved to {NEW_START} — so records
            {NEW_START}–{LOG_END - 1} are still readable although they are older than <code>retention.ms</code>. Retention is a lower bound on how long data lives, not an exact
            one.
          </>
        }
      />
      <Terminal
        title={`recorded: Kafka ${REC.version}, payments-0 (retention checked every second instead of every 5 minutes)`}
        steps={[REC.retention.more, REC.retention.alter, REC.retention.after, REC.retention.start, REC.retention.end, REC.retention.read, REC.retention.allExpired, REC.retention.allStart]}
      />
      <ul>
        <li>
          Deleted segments are first renamed to <code>.deleted</code> and removed after <code>file.delete.delay.ms</code> (1 minute), so a read already in
          progress can finish.
        </li>
        <li>
          Offsets never restart. After everything expired the log start and end offsets are both {MORE_END}; the next record gets offset {MORE_END}. A consumer
          whose committed offset is now below the log start offset falls back to <code>auto.offset.reset</code>.
        </li>
        <li>
          <code>retention.bytes</code> works the same way per partition: oldest whole segments go until the partition is under the limit. Compaction (
          <code>cleanup.policy=compact</code>) also works on closed segments only — see <a href="#/kafka/retention">Retention and compaction</a>.
        </li>
      </ul>

      <h2>Settings that shape segments</h2>
      <p>These are the topic settings (and their broker-wide defaults) that this lesson used.</p>
      <Table
        head={['setting', 'default', 'what it does']}
        rows={[
          [<code key="k278">segment.bytes</code>, '1 GiB', 'size at which the active segment rolls (minimum 1 MiB)'],
          [<code key="k279">segment.ms</code>, '7 days', 'age at which the active segment rolls, on the next write'],
          [<code key="k280">segment.index.bytes</code>, '10 MiB', 'preallocated size of each index file; a full index also rolls'],
          [<code key="k281">index.interval.bytes</code>, '4 KB', 'bytes between two index entries: smaller = bigger index, shorter scans'],
          [<code key="k282">retention.ms</code>, '7 days', 'delete a closed segment once its newest record is older than this'],
          [<code key="k283">retention.bytes</code>, 'unlimited', 'delete oldest segments while the partition is bigger than this'],
          [<code key="k284">file.delete.delay.ms</code>, '1 minute', 'how long .deleted files wait before they are removed'],
          [<><code>log.retention.check.interval.ms</code> (broker)</>, '5 minutes', 'how often the broker looks for segments to delete'],
          [<><code>log.dirs</code> / <code>log.dir</code> (broker)</>, <code key="k-dir">/tmp/kafka-logs</code>, 'where the partition directories live; set it to a real disk in production'],
        ]}
      />

      <h2>Design rules</h2>
      <ul>
        <li>Leave <code>segment.bytes</code> at 1 GiB unless you have a reason; many tiny segments cost file handles, memory maps and slower restarts.</li>
        <li>
          On low-traffic topics with short retention, lower <code>segment.ms</code> (e.g. to one day) — otherwise the active segment, and every record in it,
          lives far longer than <code>retention.ms</code> suggests.
        </li>
        <li>Treat retention as “at least this long”: a record is deleted with its segment, and the segment goes only after its newest record expires.</li>
        <li>Never edit or delete files in a partition directory by hand; use topic settings or <code>kafka-delete-records.sh</code>.</li>
      </ul>

      <Recap
        points={[
          'A partition is stored as segments: a .log of record batches plus a sparse .index and .timeindex, named by base offset.',
          'Only the active segment is written; it rolls when the next batch would exceed segment.bytes, or on the first write after segment.ms.',
          'Reading an offset: pick the segment by base offset, binary-search the sparse index, scan a few batch headers, send whole batches.',
          'Retention deletes whole closed segments once their newest record is old enough — data can live longer than retention.ms.',
          'When every record has expired Kafka rolls an empty segment first; offsets continue, they never restart.',
        ]}
      />
    </>
  )
}
