import { useMemo, useState } from 'react'
import { Callout, CodeBlock, Demo, Segmented, Table, TermList } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { Flow, type Hue } from '@/shared/figures'
import { ReplicationLogRows, type LogCell } from '../components/ReplicationLogRows'
import { PartitionLog } from '../components/PartitionLog'
import { applyRetention, compact, toSegments, type LogEntry } from '../simulation/logCleanup'
import own from './Retention.module.css'

const TIME_LOG: LogEntry[] = Array.from({ length: 12 }, (_, i) => ({
  offset: 100 + i,
  key: `e${i}`,
  value: 'click',
  ageHours: (11 - i) * 9,
}))

function RetentionDemo() {
  const [hours, setHours] = useState(48)
  const segments = useMemo(() => toSegments(TIME_LOG, 3), [])
  const kept = useMemo(() => new Set(applyRetention(segments, hours).map((s) => s.index)), [segments, hours])

  return (
    <Demo
      title="Time-based retention deletes whole segments"
      hint="Each box is a segment file of 3 records. A segment goes only when its newest record is older than the limit."
      controls={
        <Segmented
          label="log.retention.hours"
          value={hours}
          onChange={setHours}
          options={[12, 24, 48, 168].map((h) => ({ value: h, label: String(h) }))}
        />
      }
    >
      <div className={own.segments}>
        {segments.map((segment) => {
          const deleted = !kept.has(segment.index)
          return (
            <div key={segment.index} className={cx(own.segment, deleted && own.deleted, segment.active && own.active)}>
              <div className={own.segmentTitle}>
                {segment.active ? 'active segment' : `segment ${segment.index}`}
                <span>{deleted ? 'deleted' : 'kept'}</span>
              </div>
              <div className={own.entries}>
                {segment.entries.map((entry) => (
                  <div key={entry.offset} className={own.entry}>
                    <span className={own.offset}>{entry.offset}</span>
                    <span>{entry.ageHours}h old</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Demo>
  )
}

const KEYED_LOG: LogEntry[] = [
  { offset: 0, key: 'user-1', value: 'Ann', ageHours: 0 },
  { offset: 1, key: 'user-2', value: 'Ben', ageHours: 0 },
  { offset: 2, key: 'user-1', value: 'Anna', ageHours: 0 },
  { offset: 3, key: 'user-3', value: 'Cat', ageHours: 0 },
  { offset: 4, key: 'user-2', value: null, ageHours: 0 },
  { offset: 5, key: 'user-1', value: 'Annie', ageHours: 0 },
  { offset: 6, key: 'user-3', value: 'Cate', ageHours: 0 },
]

type Stage = 'raw' | 'compacted' | 'tombstones'

/** One row per retention setting: which segments of TIME_LOG survive (computed with the same applyRetention as the demo). */
const SEGMENTS = toSegments(TIME_LOG, 3)
const retentionRow = (hours: number): { label: string; cells: LogCell[] } => {
  const kept = new Set(applyRetention(SEGMENTS, hours).map((s) => s.index))
  return {
    label: `log.retention.hours = ${hours}`,
    cells: SEGMENTS.map((seg) => {
      const newest = Math.min(...seg.entries.map((e) => e.ageHours))
      const oldest = Math.max(...seg.entries.map((e) => e.ageHours))
      return {
        label: kept.has(seg.index) ? (seg.active ? 'active · kept' : 'kept') : 'deleted',
        content: `${oldest}–${newest} h old`,
        weight: seg.entries.length,
        hue: (kept.has(seg.index) ? 3 : 8) as Hue,
      }
    }),
  }
}

/** Keys of the compaction example get fixed colours, so a key looks the same in every row. */
const KEY_HUE: Record<string, Hue> = { 'user-1': 3, 'user-2': 4, 'user-3': 7 }
const compactRow = (label: string, entries: readonly LogEntry[]): { label: string; cells: LogCell[] } => ({
  label,
  cells: entries.map((e) => ({ label: `offset ${e.offset}`, content: `${e.key}=${e.value ?? 'null'}`, hue: KEY_HUE[e.key] })),
})

function CompactionDemo() {
  const [stage, setStage] = useState<Stage>('raw')
  const entries = stage === 'raw' ? KEYED_LOG : compact(KEYED_LOG, stage === 'tombstones')

  return (
    <Demo
      title="Log compaction keeps the latest value per key"
      hint="A topic of user profile updates. user-2 was deleted with a tombstone (null value) at offset 4."
      controls={
        <Segmented
          value={stage}
          onChange={setStage}
          options={[
            { value: 'raw', label: 'Before' },
            { value: 'compacted', label: 'After compaction' },
            { value: 'tombstones', label: 'After delete.retention.ms' },
          ]}
        />
      }
    >
      <PartitionLog key={stage} label="users-0" cells={entries} showValues showNext={false} />
      <p className={own.note}>
        {stage === 'raw' && 'Every change is still here, including old names.'}
        {stage === 'compacted' && 'Only the newest record per key survives. Offsets keep their numbers — gaps are normal. The tombstone stays for now so consumers learn that user-2 was deleted.'}
        {stage === 'tombstones' && 'After delete.retention.ms the tombstone itself is removed. What remains is a snapshot: the current state of every key.'}
      </p>
    </Demo>
  )
}

export default function Retention() {
  return (
    <>
      <p>
        Kafka does not delete a record when it is consumed. So when <em>does</em> data go away? Each topic has a{' '}
        <code>cleanup.policy</code>: <strong>delete</strong> (the default) removes old data by age or size, and{' '}
        <strong>compact</strong> keeps only the latest record for each key.
      </p>

      <h2>Delete: retention by time or size</h2>
      <p>With the delete policy, the broker removes old data once it is older or bigger than a limit. Three settings control it:</p>
      <ul>
        <li>
          <code>retention.ms</code> / broker-wide <code>log.retention.hours</code> — keep data this long (default 7
          days).
        </li>
        <li>
          <code>retention.bytes</code> — cap the size per partition (default unlimited).
        </li>
        <li>
          <code>segment.bytes</code> / <code>log.segment.bytes</code> — size at which the active segment is closed and a
          new one starts (default 1 GB).
        </li>
      </ul>
      <Flow
        title="Where records go after they are written"
        cols={4}
        rows={2}
        nodes={[
          { id: 'producer', label: 'producer', sub: 'appends', col: 0, row: 0, hue: 7, shape: 'actor' },
          { id: 'active', label: 'active segment', sub: 'being written', col: 1, row: 0, hue: 3, shape: 'log' },
          { id: 'closed', label: 'closed segments', sub: 'read-only', col: 2, row: 0, hue: 3, shape: 'queue' },
          { id: 'consumers', label: 'consumers', sub: 'read any segment', col: 3, row: 0, hue: 1 },
          { id: 'delete', label: 'delete', sub: 'by age or size', col: 2, row: 1, hue: 8 },
          { id: 'compact', label: 'compact', sub: 'latest per key', col: 3, row: 1, hue: 3 },
        ]}
        edges={[
          { from: 'producer', to: 'active', flow: true, hue: 7 },
          { from: 'active', to: 'closed', label: 'roll', hue: 3 },
          { from: 'closed', to: 'consumers', flow: true, hue: 1 },
          { from: 'closed', to: 'delete', label: 'retention', hue: 8, dashed: true },
          { from: 'closed', to: 'compact', label: 'cleaner', hue: 3, dashed: true },
        ]}
        caption="The active segment rolls into a closed one at segment.bytes (1 GiB) or segment.ms, on the next write. Retention deletes whole segments, oldest first; compaction only rewrites closed ones. cleanup.policy decides which."
      />
      <ReplicationLogRows
        title="The same 12 records in 4 segments, under three retention settings (computed like the demo below)"
        rows={[24, 48, 168].map(retentionRow)}
        caption="A whole segment goes only when its newest record is older than the limit. The active segment stays here because its newest record is 0 h old; it would go only if every record had expired."
      />
      <RetentionDemo />
      <Callout tone="note">
        Because a segment goes only when its <em>newest</em> record has expired, data may live somewhat longer than the
        retention setting. A small topic whose active segment never fills keeps adding fresh records to it, so its old
        records stay surprisingly long — lower <code>segment.ms</code> if that matters. When every record has expired,
        Kafka rolls a new, empty segment and deletes the old active one too; offsets carry on. Recorded on a real broker in{' '}
        <a href="#/kafka/segments">Segments: the log on disk</a>.
      </Callout>

      <h2>Compact: the latest value per key</h2>
      <p>
        Some topics represent <em>state</em> rather than history: the current profile of each user, the current
        config of each connector. For these, only the newest record per key matters. A background cleaner thread
        rewrites old, closed segments, dropping records that have been superseded. The active segment is never compacted,
        so the latest few duplicates always remain until it rolls.
      </p>
      <ReplicationLogRows
        title="Compaction, record by record (computed with the same compact() as the demo below)"
        rows={[
          compactRow('before', KEYED_LOG),
          compactRow('after compaction', compact(KEYED_LOG, false)),
          compactRow('after delete.retention.ms', compact(KEYED_LOG, true)),
        ]}
        caption="Each key keeps only its latest record; offsets keep their numbers. user-2’s tombstone (null) stays for delete.retention.ms so consumers see the delete, then it goes too."
      />
      <CompactionDemo />
      <p>
        Kafka itself relies on compaction: <code>__consumer_offsets</code> keeps each group’s latest offset, and Kafka
        Connect keeps its configs, statuses and source offsets in compacted topics (next lesson). How the cleaner actually does it — dirty ratio, offset
        map, recopying, tombstone horizons — is recorded step by step in <a href="#/kafka/compaction">Log compaction internals</a>.
      </p>

      <Table
        head={['', 'delete', 'compact']}
        rows={[
          ['Keeps', 'Everything newer than the limit', 'Latest record per key, forever'],
          ['Good for', 'Event history, logs, metrics', 'Current state, changelogs, lookup tables'],
          ['Deletes a key by', 'Ageing out', 'Writing a tombstone (null value)'],
          ['Needs keys?', 'No', 'Yes — records without a key are rejected'],
        ]}
      />

      <CodeBlock
        title="per-topic overrides"
        code={`kafka-configs.sh --bootstrap-server localhost:9092 --alter \\
  --entity-type topics --entity-name user-profiles \\
  --add-config cleanup.policy=compact,delete.retention.ms=86400000

# both policies at once (a list value needs [brackets]): compact, and also drop anything older than 30 days
--add-config cleanup.policy=[compact,delete],retention.ms=2592000000`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Retention', definition: 'How long or how much data a topic keeps before deleting it.' },
          { term: 'cleanup.policy', definition: 'delete, compact, or both.' },
          { term: 'Segment', definition: 'A file of contiguous records; the unit of deletion.' },
          { term: 'Log compaction', definition: 'Removing records superseded by a newer record with the same key.' },
          { term: 'Tombstone', definition: 'A record with a null value that marks its key as deleted.' },
          { term: 'delete.retention.ms', definition: 'How long tombstones are kept after compaction.' },
          { term: 'Log cleaner', definition: 'Background broker thread that performs compaction.' },
        ]}
      />
    </>
  )
}
