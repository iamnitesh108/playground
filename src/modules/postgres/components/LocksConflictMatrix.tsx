import { useState, type ReactNode } from 'react'
import { hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import styles from './LocksConflictMatrix.module.css'

interface Cell {
  readonly held: string
  readonly asked: string
  readonly ok: boolean
}

interface LocksConflictMatrixProps {
  title: string
  /** Modes in order, weakest first. */
  modes: readonly string[]
  cells: readonly Cell[]
  /** Short label for a mode (rows and columns). */
  short?: (mode: string) => string
  /** Statements that take a mode, shown under the row label. */
  takenBy?: (mode: string) => ReactNode
  caption?: ReactNode
}

/** Which lock modes can be held together — every cell from a recorded NOWAIT attempt. Hover a cell to read it as a sentence. */
export function LocksConflictMatrix({ title, modes, cells, short = (m) => m, takenBy, caption }: LocksConflictMatrixProps) {
  const [hover, setHover] = useState<Cell | null>(null)
  const at = (held: string, asked: string) => cells.find((c) => c.held === held && c.asked === asked)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ gridTemplateColumns: `minmax(150px, 1.6fr) repeat(${modes.length}, minmax(44px, 1fr))` }}>
          <span className={styles.corner}>
            held ↓ · requested →
          </span>
          {modes.map((m) => (
            <span key={m} className={cx(styles.colHead, hover?.asked === m && styles.on)} title={m}>
              {short(m)}
            </span>
          ))}
          {modes.map((held) => (
            <div key={held} className={styles.row}>
              <span className={cx(styles.rowHead, hover?.held === held && styles.on)}>
                <span className={styles.mode}>{held}</span>
                {takenBy && <span className={styles.taken}>{takenBy(held)}</span>}
              </span>
              {modes.map((asked) => {
                const c = at(held, asked)
                const ok = c?.ok ?? false
                return (
                  <span
                    key={asked}
                    className={cx(styles.cell, hover === c && styles.cellOn)}
                    style={hue(ok ? 6 : 8)}
                    onMouseEnter={() => setHover(c ?? null)}
                    onMouseLeave={() => setHover(null)}
                    aria-label={`${held} held, ${asked} requested: ${ok ? 'granted' : 'waits'}`}
                  >
                    {ok ? '✓' : '✕'}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.readout} aria-live="polite">
        {hover ? (
          <>
            One session holds <strong>{hover.held}</strong>; another asks for <strong>{hover.asked}</strong>:{' '}
            {hover.ok ? 'granted at once (✓).' : 'it waits (✕) — with NOWAIT it got an error instead.'}
          </>
        ) : (
          <>✓ both can hold the lock at once · ✕ the second one waits. Hover a cell.</>
        )}
      </div>
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
