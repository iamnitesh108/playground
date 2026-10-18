import { Walkthrough } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import styles from './ConsumerInternals.module.css'

/*
 * Inside one consumer reading partition P0: the background fetcher fills a buffer,
 * poll() hands your code a batch, the position moves on, and a commit saves it.
 * Records never leave the log; the consumer works on copies.
 */

type Where = 'none' | 'buffer' | 'batch' | 'done'

interface Frame {
  where: Where[]
  fetched: number
  position: number
  committed: number | null
  heartbeat: boolean
  crashed?: boolean
  redelivered?: number[]
}

const N = 10
const all = (w: Where, from: number, to: number, base: Where[] = Array(N).fill('none')): Where[] => base.map((x, i) => (i >= from && i < to ? w : x))

const FRAMES: Frame[] = [
  { where: all('none', 0, 0), fetched: 0, position: 0, committed: null, heartbeat: true },
  { where: all('buffer', 0, 5), fetched: 5, position: 0, committed: null, heartbeat: true },
  { where: all('batch', 0, 3, all('buffer', 3, 5)), fetched: 5, position: 3, committed: null, heartbeat: true },
  { where: all('done', 0, 3, all('buffer', 3, 5)), fetched: 5, position: 3, committed: null, heartbeat: true },
  { where: all('done', 0, 3, all('buffer', 3, 5)), fetched: 5, position: 3, committed: 3, heartbeat: true },
  { where: all('done', 0, 3, all('batch', 3, 5, all('buffer', 5, 10))), fetched: 10, position: 5, committed: 3, heartbeat: true },
  { where: all('none', 0, 0), fetched: 3, position: 3, committed: 3, heartbeat: false, crashed: true },
  { where: all('batch', 3, 5, all('buffer', 5, 8)), fetched: 8, position: 5, committed: 3, heartbeat: true, redelivered: [3, 4] },
]

const STEPS = [
  { title: 'Join the group, find a starting point', body: <p>The consumer subscribes, joins its group and is assigned P0. The group has no committed offset for P0 yet, so <code>auto.offset.reset</code> decides: <code>earliest</code> starts at offset 0 (<code>latest</code> would start at the end and only see new records).</p> },
  { title: 'The fetcher pulls a batch in the background', body: <p>A fetch request asks the broker for records from offset 0. The broker answers when it has <code>fetch.min.bytes</code> of data or after <code>fetch.max.wait.ms</code>. Records 0–4 land in the consumer’s <strong>fetch buffer</strong> — copies; the log is unchanged.</p> },
  { title: 'poll() hands your code a batch', body: <p>Your loop calls <code>poll()</code>. It returns at most <code>max.poll.records</code> records (3 here) from the buffer. The consumer’s <strong>position</strong> — the next offset poll will return — moves to 3. Nothing is saved yet.</p> },
  { title: 'Your code processes the records', body: <p>This is your business logic: save to a database, call a service… While it runs, a separate <strong>heartbeat</strong> thread keeps telling the group coordinator the consumer is alive.</p> },
  { title: 'Commit: save progress in Kafka', body: <p>A commit stores offset 3 for (group, P0) in the internal topic <code>__consumer_offsets</code>: “everything before 3 is done”. With <code>enable.auto.commit=true</code> this happens on a later <code>poll()</code> once <code>auto.commit.interval.ms</code> (5 s) has passed; or you call <code>commitSync()</code> yourself.</p> },
  { title: 'The next poll, while the fetcher reads ahead', body: <p>poll() returns 3 and 4; the position moves to 5. Meanwhile the fetcher already pulled 5–9 into the buffer, so the next poll will not wait for the network.</p> },
  { title: 'The consumer crashes before committing', body: <p>It processed 3 and 4 but crashed before the commit. The buffer, the batch and the position were in memory: all gone. What survives is the committed offset: 3. Heartbeats stop; after <code>session.timeout.ms</code> the coordinator removes the member and rebalances.</p> },
  { title: 'A consumer resumes from the committed offset', body: <p>Whoever gets P0 next starts from the committed offset 3, so records 3 and 4 are delivered <strong>again</strong>. That is at-least-once delivery: commit after processing and make the processing safe to repeat (idempotent).</p> },
]

const LOG_X = 34
const STEP = 30
const BUF_X = 420
const logPos = (o: number) => ({ x: LOG_X + o * STEP, y: 83 })

function placeOf(f: Frame, o: number): { x: number; y: number; visible: boolean } {
  const w = f.where[o]
  if (w === 'none') return { ...logPos(o), visible: false }
  const list = f.where.map((x, i) => [x, i] as const).filter(([x]) => x === w).map(([, i]) => i)
  const k = list.indexOf(o)
  if (w === 'buffer') return { x: BUF_X + 22 + k * 28, y: 83, visible: true }
  if (w === 'batch') return { x: BUF_X + 22 + k * 28, y: 145, visible: true }
  return { x: BUF_X + 110 + (o % 5) * 26, y: 200, visible: true }
}

function Diagram({ index }: { index: number }) {
  const f = FRAMES[index]
  const marker = (o: number, label: string, row: number) => (
    <g className={styles.marker} style={{ transform: `translateX(${LOG_X + o * STEP}px)` }}>
      <path d={`M0,${104 + row * 22} L-5,${112 + row * 22} L5,${112 + row * 22} z`} className={styles.markerMark} />
      <text x={8} y={112 + row * 22} className={styles.markerLabel}>{label} {o}</text>
    </g>
  )
  return (
    <div className={styles.scroll}>
    <svg viewBox="0 0 760 230" className={styles.svg} role="img" aria-label="Inside a consumer">
      {/* broker */}
      <rect x={12} y={30} width={340} height={190} rx={10} className={styles.box} />
      <text x={24} y={50} className={styles.title}>broker · partition P0 (the log)</text>
      {Array.from({ length: N }, (_, o) => (
        <g key={o}>
          <rect x={logPos(o).x - 12} y={71} width={24} height={24} rx={4} className={cx(styles.logCell, o < f.fetched && styles.logFetched)} />
          <text x={logPos(o).x} y={87} className={styles.cellText}>{o}</text>
        </g>
      ))}
      {marker(f.fetched, 'fetched to', 0)}
      {marker(f.position, 'position', 1)}
      {f.committed !== null ? marker(f.committed, 'committed', 2) : <text x={24} y={178} className={styles.markerLabel}>committed: none yet</text>}

      {/* consumer process */}
      <rect x={398} y={30} width={350} height={190} rx={10} className={cx(styles.box, f.crashed && styles.crashed)} />
      <text x={410} y={50} className={styles.title}>{f.crashed ? 'consumer process — crashed' : 'consumer process'}</text>
      <g className={cx(styles.heartbeat, f.heartbeat && styles.beating)}>
        <circle cx={734} cy={45} r={5} />
        <text x={724} y={49} className={styles.small} textAnchor="end">heartbeat</text>
      </g>
      <text x={410} y={64} className={styles.lane}>fetch buffer (filled in the background)</text>
      <rect x={406} y={68} width={334} height={30} rx={6} className={styles.laneBox} />
      <text x={410} y={126} className={styles.lane}>poll() → your code (max.poll.records = 3)</text>
      <rect x={406} y={130} width={334} height={30} rx={6} className={styles.laneBox} />
      <text x={410} y={204} className={styles.lane}>processed</text>
      {f.redelivered && <text x={736} y={200} className={styles.warn} textAnchor="end">3 and 4 again</text>}

      {/* copies of records moving through the consumer */}
      {Array.from({ length: N }, (_, o) => {
        const p = placeOf(f, o)
        const w = f.where[o]
        return (
          <g key={o} className={cx(styles.copy, !p.visible && styles.hidden, w === 'done' && styles.done, f.redelivered?.includes(o) && w === 'batch' && styles.again)} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
            <rect x={-11} y={-11} width={22} height={22} rx={5} />
            <text y={4}>{o}</text>
          </g>
        )
      })}
    </svg>
    </div>
  )
}

/** A step-through of one consumer's internals: fetch, poll, process, commit, crash. */
export function ConsumerInternals() {
  return (
    <Walkthrough title="Inside a consumer: fetch, poll, process, commit" steps={STEPS} intervalMs={3200}>
      {(index) => <Diagram index={index} />}
    </Walkthrough>
  )
}
