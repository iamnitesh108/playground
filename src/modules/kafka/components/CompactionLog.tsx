import { hue, type Hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import type { CompactedRecord, CompactedSegment } from '../simulation/logCompactor'
import styles from './CompactionFigures.module.css'

export type RecordMark = 'removed' | 'mapped' | 'kept' | 'horizon'

interface CompactionLogProps {
  segments: readonly CompactedSegment[]
  /** Cleaner checkpoint: offsets before it are the clean section. */
  cleanedTo: number
  /** First offset the cleaner may not touch (the active segment's base). */
  firstUncleanable: number
  /** Records drawn as they were but struck through (removed by this cleaning). */
  ghosts?: readonly CompactedRecord[]
  marks?: ReadonlyMap<number, RecordMark>
}

const sectionOf = (base: number, cleanedTo: number, firstUncleanable: number) =>
  base >= firstUncleanable ? { label: 'uncleanable: active segment', hue: 7 as Hue } : base >= cleanedTo ? { label: 'dirty: cleanable', hue: 5 as Hue } : { label: 'clean', hue: 3 as Hue }

const MARK_TEXT: Record<RecordMark, string> = { removed: 'removed', mapped: 'in the map', kept: 'kept', horizon: 'horizon set' }

function Cell({ r, mark }: { r: CompactedRecord; mark?: RecordMark }) {
  const tomb = r.value === null
  return (
    <span className={cx(styles.record, tomb && styles.tombstone, mark && styles[mark])} style={hue(mark === 'removed' || tomb ? 8 : mark === 'mapped' ? 5 : 3)}>
      <span className={styles.offset}>{r.offset}</span>
      <span className={styles.kv}>
        {r.key}={tomb ? 'null' : r.value}
      </span>
      {(tomb || mark) && <span className={styles.note}>{[tomb ? 'tombstone' : '', mark ? MARK_TEXT[mark] : ''].filter(Boolean).join(' · ')}</span>}
    </span>
  )
}

/** A compacted partition: its segments in order, each labelled with its section, records as cells. */
export function CompactionLog({ segments, cleanedTo, firstUncleanable, ghosts = [], marks = new Map() }: CompactionLogProps) {
  return (
    <div className={styles.log}>
      {segments.map((seg, i) => {
        const section = sectionOf(seg.base, cleanedTo, firstUncleanable)
        // a removed record is drawn in the segment whose offset range holds it
        const end = segments[i + 1]?.base ?? Number.POSITIVE_INFINITY
        const here = ghosts.filter((g) => g.offset >= seg.base && g.offset < end)
        const shown = [...seg.records, ...here].sort((a, b) => a.offset - b.offset)
        return (
          <div key={seg.base} className={styles.segment} style={hue(section.hue)}>
            <div className={styles.segmentHead}>
              <span className={styles.file}>…{String(seg.base).padStart(4, '0')}.log</span>
              <span className={styles.section}>{section.label}</span>
            </div>
            <div className={styles.records}>
              {shown.map((r) => (
                <Cell key={r.offset} r={r} mark={ghosts.includes(r) ? 'removed' : marks.get(r.offset)} />
              ))}
              {!shown.length && <span className={styles.empty}>empty</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
