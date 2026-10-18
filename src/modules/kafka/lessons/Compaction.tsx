import { Fragment } from 'react'
import { ByteLayout, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Terminal } from '../components/Terminal'
import { CompactionLab } from '../components/CompactionLab'
import { CompactionPass, type RecordedScenario } from '../components/CompactionPass'
import { parseDumps, parseRead } from '../components/CompactionParse'
import { COMPACTION as REC } from '../data/compaction'
import { keysPerPass, OFFSET_MAP_ENTRY_BYTES } from '../simulation/logCompactor'

// ------------------------------------------------------------------ recorded data, parsed for the figures

const BEFORE = parseDumps(REC.before.dumps)
const FIRST = parseDumps(REC.first.dumps)
const AFTER_FIRST = parseRead(REC.first.read.out)
const AFTER_SECOND = parseRead(REC.second.read.out)
const TOMBSTONE = BEFORE.segments.flatMap((s) => s.records).find((r) => r.value === null)
const MARKED = FIRST.batches.find((b) => b.horizon !== null)
const LATER = REC.later.out.split('\n').map((l) => /^> ([^:]+):(.*)$/.exec(l)).filter((m) => m !== null).map((m) => ({ key: m[1], value: m[2] === 'NULL' ? null : m[2] }))
const USER1_AFTER_FIRST = AFTER_FIRST.filter((r) => r.key === 'user-1')

/** Seconds since the first write, for the recorded timeline. */
const T = REC.times
const sec = (ms: number) => Math.round((ms - T.round1) / 100) / 10

/** The cleaner's own summary of each cleaning, from its log. */
const CLEANER_SUMMARY = REC.cleanerLog
  .split('\n')
  .filter((l) => /Building offset map for log|cleaned log|log processed|Start size|End size|reduction/.test(l))
  .map((l) => l.trim().replace(/^INFO /, ''))
  .join('\n')

const SCENARIO: RecordedScenario = {
  before: BEFORE.segments,
  later: LATER,
  times: { clean1: T.clean1, round4: T.round4, clean2: T.clean2 },
  deleteRetentionMs: REC.deleteRetentionMs,
  evidence: [
    [
      <p key="s1">
        The copy is written to a <code>.cleaned</code> file, renamed <code>.swap</code>, put in the log in place of the old segments, and the old files are
        renamed <code>.deleted</code> and removed later — recorded below. Segments {BEFORE.segments.slice(0, -1).map((s) => s.base).join(' and ')} became one,
        because together they still fit in <code>segment.bytes</code>.
      </p>,
      <p key="c1">
        The cleaner checkpoint file now says <code>{REC.first.checkpoint.out.split('\n').at(-1)}</code>: offsets before 6 are clean. The next cleaning starts
        its map at 6.
      </p>,
    ],
    [
      <p key="s2">Again one .cleaned → .swap → swap: the clean segment and the newly dirty one are merged into one file, recorded below.</p>,
      <p key="c2">
        The checkpoint moves to <code>{REC.second.checkpoint.out.split('\n').at(-1)}</code>. Nothing is dirty now, so the cleaner leaves this log alone until the
        active segment rolls again.
      </p>,
    ],
  ],
}

const KEYS_PER_PASS = keysPerPass(128 * 1024 * 1024, 1, 0.9)

export default function Compaction() {
  return (
    <>
      <LessonGoals
        goals={[
          'state the four guarantees compaction gives, and the one it does not',
          'split a compacted log into its clean, dirty and uncleanable sections, and compute the dirty ratio',
          'follow one cleaning pass: offset map, recopy, swap, checkpoint — on a real recording',
          'explain why duplicates survive in the active segment and when a tombstone really disappears',
          'size the cleaner and pick min.cleanable.dirty.ratio, min/max.compaction.lag.ms and delete.retention.ms',
        ]}
        before={
          <>
            <a href="#/kafka/retention">Retention and compaction</a> (what compaction is for), <a href="#/kafka/segments">Segments: the log on disk</a> and{' '}
            <a href="#/kafka/keys">Record keys and partitioning</a>.
          </>
        }
      />

      <h2>What compaction promises</h2>
      <p>This section lists the guarantees from Kafka’s design documentation, because every internal detail below exists to keep them.</p>
      <Callout tone="analogy">
        Think of an address book kept as a diary: every move is a new line, never an edit. Now and then a clerk copies the old pages into a fresh notebook,
        leaving out every address that a later line replaced. Pages being written today are never copied, and a “moved away, no address” line is kept for a
        while so everyone who reads the book learns about it.
      </Callout>
      <Table
        head={['guarantee', 'what it means for a consumer']}
        rows={[
          ['A consumer that keeps up with the head of the log sees every record, with sequential offsets.', 'Compaction only touches older data; min.compaction.lag.ms sets how much older.'],
          ['Order is never changed.', 'Records are only removed, never moved.'],
          ['The offset of a record never changes.', 'Offsets get gaps, but a committed offset stays valid.'],
          ['Reading from the start gives at least the final value of every key, in write order.', 'A full re-read rebuilds the current state.'],
        ]}
      />
      <p>
        And the one it does not give: a <strong>tombstone</strong> (a record with a null value, meaning “delete this key”) is seen only by consumers that reach
        it within <code>delete.retention.ms</code> after it was first cleaned. Later it is removed too.
      </p>
      <TermList
        items={[
          { term: 'Log cleaner', definition: 'Background broker threads (log.cleaner.threads, default 1) that compact logs with cleanup.policy=compact.' },
          { term: 'Clean section', definition: 'The start of the log, up to the cleaner checkpoint: already compacted. The design docs call it the tail.' },
          { term: 'Dirty section', definition: 'From the checkpoint to the first uncleanable offset: written since the last cleaning. The design docs call it the head.' },
          { term: 'Uncleanable', definition: 'Never touched by a cleaning: the active segment, anything past the last stable offset, and segments younger than min.compaction.lag.ms.' },
          { term: 'Offset map', definition: 'Hash table of MD5(key) → last offset, built from the dirty section; 24 bytes per key.' },
          { term: 'Delete horizon', definition: 'Time written into a tombstone’s batch by the first cleaning that copies it (now + delete.retention.ms); after it, a cleaning may drop the tombstone.' },
          { term: 'Cleaner checkpoint', definition: 'The file cleaner-offset-checkpoint in each log directory: per partition, the offset cleaned up to.' },
        ]}
      />

      <h2>Which log gets cleaned</h2>
      <p>This section shows how a cleaner thread picks its next log: the dirtiest one, measured by bytes.</p>
      <Flow
        title="One partition, split by what the cleaner may do"
        cols={4}
        rows={2}
        rowHeight={84}
        nodes={[
          { id: 'clean', label: 'clean section', sub: 'cleaned before', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'dirty', label: 'dirty section', sub: 'cleanable', col: 1, row: 0, span: 2, hue: 5, shape: 'log' },
          { id: 'active', label: 'active segment', sub: 'uncleanable', col: 3, row: 0, hue: 7, shape: 'log' },
          { id: 'cleaner', label: 'cleaner thread', sub: 'dirtiest log first', col: 1, row: 1, span: 2, hue: 5, shape: 'actor' },
        ]}
        edges={[
          { from: 'clean', to: 'dirty' },
          { from: 'dirty', to: 'active' },
          { from: 'dirty', to: 'cleaner', label: 'map keys', hue: 5, flow: true },
          { from: 'cleaner', to: 'clean', label: 'recopy', hue: 5, dashed: true },
        ]}
        caption="Schematic. dirty ratio = dirty bytes ÷ (clean + dirty bytes); the active segment counts in neither. A log is a candidate when its ratio is above min.cleanable.dirty.ratio (default 0.5) — or when max.compaction.lag.ms says it has waited too long."
      />
      <ul>
        <li>
          Each thread takes the candidate with the <strong>highest</strong> dirty ratio, cleans it, and looks again; with nothing to do it sleeps{' '}
          <code>log.cleaner.backoff.ms</code> (15 s).
        </li>
        <li>
          The default 0.5 means at most about half of a compacted log is duplicates before it is cleaned. Lower it for tighter disk use and more cleaning work.
        </li>
        <li>
          <code>min.compaction.lag.ms</code> keeps segments with records younger than that out of the dirty section; <code>max.compaction.lag.ms</code> makes a
          log eligible even below the ratio once its dirty records are that old — a deadline, not a hard guarantee, since it still waits for a free thread.
        </li>
      </ul>

      <h2>One cleaning, step by step</h2>
      <p>This section replays two real cleanings of a topic, recorded on Kafka {REC.version}, one step at a time.</p>
      <p>
        The recording writes eight keyed records in three rounds, {REC.segmentMs / 1000} seconds apart, so each round lands in its own segment. Round 2 deletes{' '}
        <code>user-2</code> with a tombstone (<code>NULL</code> becomes a null value). The topic starts with the default <code>cleanup.policy=delete</code>, so
        nothing is cleaned until compaction is switched on:
      </p>
      <Terminal title={`recorded: Kafka ${REC.version}, topic profiles`} steps={[REC.create, ...REC.rounds, REC.before.read]} />
      <Terminal title="the three segments, dumped (fields shortened)" steps={REC.before.dumps} />
      <Terminal title="switch on compaction" steps={[REC.alter]} />
      <CompactionPass scenario={SCENARIO} />
      <Predict
        question={<>Right after the first cleaning, how many values of <code>user-1</code> does the partition still hold?</>}
        options={['one — compaction keeps the latest value per key', 'two — the newest one sits in the active segment', 'three — nothing was removed']}
        answer={1}
        explanation={
          <>
            Recorded: {USER1_AFTER_FIRST.map((r) => `${r.value} (offset ${r.offset})`).join(' and ')}. The map is built from the dirty section only, and the
            active segment is not in it, so the newer value there cannot supersede the older one yet. Compaction means “at least the latest value”, never
            “exactly one”.
          </>
        }
      />
      <Terminal title="recorded after the first cleaning" steps={[REC.first.checkpoint, REC.first.ls, ...REC.first.dumps, REC.first.read]} />
      <p>
        Look at the batch lines: the first batch still says <code>baseOffset: 0 lastOffset: 2</code> but <code>count: 1</code> — a batch keeps its offset range
        when records are removed, so offsets never shift. The tombstone’s batch now carries{' '}
        <code>deleteHorizonMs: OptionalLong[{MARKED?.horizon}]</code>: the first cleaning set it to that moment plus <code>delete.retention.ms</code>.
      </p>
      <Terminal title="recorded: one more write, then the second cleaning" steps={[REC.later, REC.second.checkpoint, REC.second.ls, ...REC.second.dumps, REC.second.read]} />
      <Terminal title="the cleaner’s own log (log-cleaner.log), its summary lines" steps={[{ cmd: 'cat /opt/kafka/logs/log-cleaner.log', out: CLEANER_SUMMARY }]} />

      <h2>Tombstones: kept, then dropped</h2>
      <p>This section follows the recorded tombstone for <code>user-2</code> from the write to its removal.</p>
      <Timeline
        title={`Recorded: tombstone at offset ${TOMBSTONE?.offset}, delete.retention.ms = ${REC.deleteRetentionMs / 1000} s`}
        unit="s"
        end={sec(T.clean2) + 2}
        lanes={[
          { id: 'prod', label: 'producer' },
          { id: 'cleaner', label: 'cleaner' },
          { id: 'tomb', label: `offset ${TOMBSTONE?.offset}` },
        ]}
        segments={[
          { lane: 'tomb', from: sec(T.round2), to: sec(T.clean1), label: 'no horizon yet', hue: 8 },
          { lane: 'tomb', from: sec(T.clean1), to: sec(T.clean1 + REC.deleteRetentionMs), label: 'kept', hue: 8 },
          { lane: 'tomb', from: sec(T.clean1 + REC.deleteRetentionMs), to: sec(T.clean2), label: 'past horizon, still stored', hue: 8, striped: true },
        ]}
        events={[
          { lane: 'prod', at: sec(T.round2), label: 'tombstone', hue: 7 },
          { lane: 'prod', at: sec(T.round4), label: 'new write', hue: 7 },
          { lane: 'cleaner', at: sec(T.clean1), label: 'cleaning 1: horizon set', hue: 5 },
          { lane: 'cleaner', at: sec(T.clean2), label: 'cleaning 2: dropped', hue: 5 },
        ]}
      />
      <ul>
        <li>
          The clock starts at the tombstone’s <strong>first cleaning</strong>, not when it was written — here {sec(T.clean1) - sec(T.round2)} s later, because
          compaction was switched on late.
        </li>
        <li>Passing the horizon removes nothing by itself: the tombstone goes in the next cleaning of that log, which needs new dirty data.</li>
        <li>Records the tombstone superseded go in the first cleaning that sees both, like <code>Ben</code> at offset 1 above.</li>
      </ul>
      <Predict
        question={
          <>
            <code>delete.retention.ms</code> is 24 hours and the cleaner keeps up. A consumer that rebuilds a cache by reading from the beginning has been
            stopped for two days. When it restarts, what does it read for a key that was deleted while it was down?
          </>
        }
        options={['the tombstone, so it deletes the key from its cache', 'possibly nothing at all for that key', 'the old value again']}
        answer={1}
        explanation={
          <>
            The old value and the tombstone may both be gone. A consumer that already holds the old value in its cache never learns about the delete — consumers
            of compacted topics must catch up within <code>delete.retention.ms</code>, or rebuild their state from scratch.
          </>
        }
      />

      <h2>Try it</h2>
      <p>This lab runs the same rules as the recorded cleanings (the capture checks that this model keeps exactly the offsets the broker kept).</p>
      <CompactionLab />

      <h2>Sizing the cleaner</h2>
      <p>This section shows the memory one cleaning pass needs, computed from the defaults in Kafka’s source.</p>
      <ByteLayout
        title="One offset map entry (SkimpyOffsetMap): the key itself is never stored"
        rows={[{ label: 'entry', fields: [{ label: 'MD5(key)', bytes: 16, hue: 5, content: '16 B' }, { label: 'offset', bytes: 8, hue: 5, content: '8 B' }] }]}
        caption="Two keys with the same MD5 would collide; with 16-byte hashes that is negligible. The map supports no deletes; it is rebuilt for every cleaning."
      />
      <StatTiles
        title="With the default broker settings"
        stats={[
          { label: 'log.cleaner.dedupe.buffer.size', value: '128 MiB', sub: 'shared by all cleaner threads', hue: 5 },
          { label: 'bytes per key', value: OFFSET_MAP_ENTRY_BYTES, sub: '16 B hash + 8 B offset', hue: 5 },
          { label: 'map filled up to', value: '90%', sub: 'log.cleaner.io.buffer.load.factor', hue: 5 },
          { label: 'distinct keys per pass', value: `${(KEYS_PER_PASS / 1e6).toFixed(1)} M`, sub: `${KEYS_PER_PASS.toLocaleString('en')} with 1 thread`, hue: 5 },
        ]}
      />
      <p>
        If the dirty section has more distinct keys than fit, the cleaner maps records until the map is 90% full (the last segment only partly), cleans up to
        the last mapped offset, writes that offset to the checkpoint and leaves the rest for the next pass — so compaction still progresses, just in steps. More threads split the same buffer, so each maps fewer keys.
      </p>

      <h2>Transactions and idempotent producers</h2>
      <p>This section lists the extra rules the cleaner follows for transactional and idempotent producers (from the Kafka source; not recorded here).</p>
      <ul>
        <li>It never cleans beyond the <strong>last stable offset</strong>, so every record it sees is already committed or aborted.</li>
        <li>Records of aborted transactions are removed right away, whatever their key.</li>
        <li>A transaction marker stays until every record of its transaction is gone and its delete horizon has passed, like a tombstone.</li>
        <li>The last batch of each active producer is kept even if all its records were removed, so sequence numbers stay continuous.</li>
      </ul>

      <h2>Settings</h2>
      <p>These are the settings that shape compaction, with the defaults of Kafka {REC.version}.</p>
      <Table
        head={['setting', 'default', 'what it does']}
        rows={[
          [<code key="a">cleanup.policy</code>, 'delete', 'compact, delete, or both (compact,delete: compact, and also drop old segments)'],
          [<code key="b">min.cleanable.dirty.ratio</code>, '0.5', 'clean a log once dirty ÷ (clean + dirty) is above this'],
          [<code key="c">min.compaction.lag.ms</code>, '0', 'records younger than this stay uncompacted'],
          [<code key="d">max.compaction.lag.ms</code>, 'no limit', 'make a log eligible once its dirty records are this old'],
          [<code key="e">delete.retention.ms</code>, '24 hours', 'how long a tombstone survives after its first cleaning'],
          [<Fragment key="f"><code>segment.ms</code> / <code>segment.bytes</code></Fragment>, '7 days / 1 GiB', 'the active segment is never cleaned, so this bounds how long duplicates stay'],
          [<><code>log.cleaner.threads</code> (broker)</>, '1', 'cleaner threads per broker'],
          [<><code>log.cleaner.dedupe.buffer.size</code> (broker)</>, '128 MiB', 'offset map memory, shared by all threads'],
          [<><code>log.cleaner.backoff.ms</code> (broker)</>, '15 s', 'sleep when no log needs cleaning'],
          [<><code>log.cleaner.io.max.bytes.per.second</code> (broker)</>, 'unlimited', 'throttle the cleaner’s disk I/O'],
        ]}
      />

      <h2>Design rules</h2>
      <ul>
        <li>Consumers must tolerate duplicates per key: compaction keeps at least the latest value, and the active segment keeps everything.</li>
        <li>Set <code>delete.retention.ms</code> longer than the worst downtime of any consumer that rebuilds state from the topic.</li>
        <li>On low-traffic compacted topics lower <code>segment.ms</code>, or set <code>max.compaction.lag.ms</code>, or duplicates wait for days.</li>
        <li>Watch the cleaner: if its thread dies, compacted topics (including <code>__consumer_offsets</code>) grow without limit — see <a href="#/kafka/monitoring">Monitoring</a>.</li>
      </ul>

      <Recap
        points={[
          'A compacted log has a clean section, a dirty section and an uncleanable part (the active segment, past the last stable offset, younger than min.compaction.lag.ms).',
          'A cleaner thread picks the log with the highest dirty ratio above min.cleanable.dirty.ratio, maps MD5(key) → last offset for the dirty section, and recopies the log from the start.',
          'Cleaned copies go .cleaned → .swap → in place; the old files become .deleted; the checkpoint records how far the log is clean.',
          'Offsets never change and batches keep their offset range; records are only removed.',
          'A tombstone gets its delete horizon in its first cleaning and is dropped by a later cleaning after that horizon.',
        ]}
      />
      <p>
        After the second cleaning a consumer reads offsets {AFTER_SECOND.map((r) => r.offset).join(', ')}: one value per key except <code>user-3</code>, whose
        newest value is still in the active segment.
      </p>
    </>
  )
}
