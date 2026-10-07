import { cx } from '@/shared/utils/cx'
import { toneForKey, toneStyle } from './tones'
import styles from './PartitionLog.module.css'

export interface LogCell {
  offset: number
  key: string | null
  value?: string | null
}

export interface OffsetMarker {
  offset: number
  label: string
  tone?: number
}

interface PartitionLogProps {
  label: string
  cells: readonly LogCell[]
  markers?: readonly OffsetMarker[]
  highlight?: number
  /** Offsets shown faded, e.g. records a consumer has already read. */
  readBefore?: number
  owners?: readonly { label: string; tone: number }[]
  showNext?: boolean
  showValues?: boolean
}

/** One partition drawn as a row of numbered cells — the append-only log. */
export function PartitionLog({
  label,
  cells,
  markers = [],
  highlight,
  readBefore,
  owners = [],
  showNext = true,
  showValues = false,
}: PartitionLogProps) {
  const endOffset = cells.length ? cells[cells.length - 1].offset + 1 : 0
  const slots: (LogCell | 'next')[] = showNext ? [...cells, 'next'] : [...cells]

  return (
    <div className={styles.partition}>
      <div className={styles.label}>
        <span>{label}</span>
        {owners.map((owner) => (
          <span key={owner.label} className={styles.owner} style={toneStyle(owner.tone)}>
            {owner.label}
          </span>
        ))}
      </div>
      <div className={styles.cells}>
        {slots.map((slot) => {
          const offset = slot === 'next' ? endOffset : slot.offset
          const here = markers.filter((m) => m.offset === offset)
          return (
            <div key={slot === 'next' ? 'next' : offset} className={styles.slot}>
              {slot === 'next' ? (
                <div className={cx(styles.cell, styles.next)} title="Next offset to be written (log end offset)">
                  <span className={styles.offset}>{offset}</span>
                  <span className={styles.key}>next</span>
                </div>
              ) : (
                <div
                  className={cx(
                    styles.cell,
                    slot.key !== null && styles.keyed,
                    highlight === offset && styles.highlight,
                    readBefore !== undefined && offset < readBefore && styles.read,
                    slot.value === null && styles.tombstone,
                  )}
                  style={toneStyle(toneForKey(slot.key))}
                  title={`offset ${offset} · key ${slot.key ?? 'null'}${slot.value !== undefined ? ` · value ${slot.value ?? 'null (tombstone)'}` : ''}`}
                >
                  <span className={styles.offset}>{offset}</span>
                  <span className={styles.key}>{slot.key ?? '∅'}</span>
                  {showValues && <span className={styles.value}>{slot.value ?? 'null'}</span>}
                </div>
              )}
              {here.map((marker) => (
                <div key={marker.label} className={styles.marker} style={toneStyle(marker.tone)}>
                  ▲ {marker.label}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
