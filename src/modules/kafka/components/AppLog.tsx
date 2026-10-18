import styles from './AppLog.module.css'
import { Highlighted } from '@/shared/code'

interface AppLogProps {
  /** One panel per running process: its name, how it was started, and the log lines it printed. */
  panels: readonly { readonly name: string; readonly lines: readonly string[]; readonly command?: string }[]
  title?: string
}

const kindOf = (line: string) => (/ received | sent /.test(line) ? 'record' : /Revoke/.test(line) ? 'revoke' : /assigned/.test(line) ? 'assign' : 'other')

/** Log lines of several application instances side by side, recorded. */
export function AppLog({ panels, title = 'recorded application logs' }: AppLogProps) {
  return (
    <figure className={styles.log}>
      <figcaption className={styles.head}>{title}</figcaption>
      <div className={styles.panels}>
        {panels.map((p) => (
          <section key={p.name} className={styles.panel}>
            <div className={styles.name}>{p.name}</div>
            {p.command && <div className={styles.command}>$ <Highlighted language="bash" code={p.command} /></div>}
            <ol className={styles.lines}>
              {p.lines.length === 0 && <li className={styles.empty}>(nothing)</li>}
              {p.lines.map((l, i) => (
                <li key={i} data-kind={kindOf(l)}>{l.replace(/^INFO\s+/, '')}</li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </figure>
  )
}
