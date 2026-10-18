import { hue, type Hue } from '@/shared/figures'
import styles from './TransactionsFigures.module.css'

export type Verdict = 'yes' | 'no' | 'partly'

interface MatrixProps {
  title: string
  columns: readonly string[]
  rows: readonly { tool: string; cells: readonly { verdict: Verdict; text: string }[] }[]
}

const HUE: Record<Verdict, Hue> = { yes: 6, no: 8, partly: 4 }
const MARK: Record<Verdict, string> = { yes: '✓', no: '✕', partly: '~' }

/** A comparison grid: each cell coloured by its verdict, and always labelled with a mark and words. */
export function TransactionsMatrix({ title, columns, rows }: MatrixProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.scroll}>
        <div className={styles.grid} style={{ gridTemplateColumns: `minmax(120px, 1.1fr) repeat(${columns.length}, minmax(110px, 1fr))` }}>
          <div />
          {columns.map((c) => (
            <div key={c} className={styles.head}>{c}</div>
          ))}
          {rows.map((r) => (
            <div key={r.tool} className={styles.row}>
              <div className={styles.tool}>{r.tool}</div>
              {r.cells.map((cell, i) => (
                <div key={i} className={styles.cell} style={hue(HUE[cell.verdict])}>
                  <span className={styles.mark}>{MARK[cell.verdict]}</span>
                  <span>{cell.text}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.legend}>
        <span style={hue(6)}><i /> ✓ yes</span>
        <span style={hue(4)}><i /> ~ with conditions</span>
        <span style={hue(8)}><i /> ✕ no</span>
      </div>
    </figure>
  )
}

interface NoRollbackProps {
  title: string
  /** One entry per queued command: the command and the reply it got inside EXEC. */
  commands: readonly { cmd: string; reply: string }[]
  /** What the key holds afterwards, e.g. counter = "2". */
  after: string
}

/** The commands of one EXEC with their replies: an error in the middle does not undo the others. */
export function TransactionsNoRollback({ title, commands, after }: NoRollbackProps) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.queue}>
        <div className={styles.exec}>EXEC</div>
        {commands.map((c, i) => {
          const failed = c.reply.startsWith('(error)')
          return (
            <div key={i} className={styles.command} style={hue(failed ? 8 : 6)}>
              <span className={styles.index}>{i + 1}</span>
              <code className={styles.cmd}>{c.cmd}</code>
              <span className={styles.reply}>{failed ? '✕ ' : '✓ '}{c.reply}</span>
            </div>
          )
        })}
        <div className={styles.after} style={hue(3)}>afterwards: <code>{after}</code> — nothing was undone</div>
      </div>
    </figure>
  )
}
