import { useMemo, useState } from 'react'
import { Callout, CodeBlock, Demo, Segmented, Table, TermList } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { PartitionLog } from '../components'
import { applyRetention, compact, toSegments, type LogEntry } from '../simulation'
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
      <RetentionDemo />
      <Callout tone="note">
        Because only closed segments can be deleted, data may live somewhat longer than the retention setting. A small
        topic whose active segment never fills may keep old records surprisingly long — lower{' '}
        <code>segment.ms</code> if that matters.
      </Callout>

      <h2>Compact: the latest value per key</h2>
      <p>
        Some topics represent <em>state</em> rather than history: the current profile of each user, the current
        config of each connector. For these, only the newest record per key matters. A background cleaner thread
        rewrites old, closed segments, dropping records that have been superseded. The active segment is never compacted,
        so the latest few duplicates always remain until it rolls.
      </p>
      <CompactionDemo />
      <p>
        Kafka itself relies on compaction: <code>__consumer_offsets</code> keeps each group’s latest offset, and Kafka
        Connect keeps its configs, statuses and source offsets in compacted topics (next lesson).
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
