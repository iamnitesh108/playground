import { useMemo, useState } from 'react'
import { TextField } from '@/shared/ui'
import styles from './CommandReference.module.css'

export interface CommandEntry {
  group: string
  command: string
  does: string
  lesson?: string
}

/** A filterable list of commands, grouped. */
export function CommandReference({ entries }: { entries: readonly CommandEntry[] }) {
  const [query, setQuery] = useState('')
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? entries.filter((e) => `${e.command} ${e.does} ${e.group}`.toLowerCase().includes(q)) : entries
  }, [entries, query])
  const groups = [...new Set(shown.map((e) => e.group))]
  return (
    <div className={styles.reference}>
      <TextField label="Filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. undo, branch, remote, stash" />
      <div className={styles.count}>{shown.length} of {entries.length} commands</div>
      {groups.map((g) => (
        <section key={g} className={styles.group}>
          <h3 className={styles.groupTitle}>{g}</h3>
          <dl className={styles.list}>
            {shown.filter((e) => e.group === g).map((e) => (
              <div key={e.command} className={styles.row}>
                <dt><code>{e.command}</code></dt>
                <dd>
                  {e.does}
                  {e.lesson && <a className={styles.link} href={`#/git/${e.lesson}`}>lesson</a>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
