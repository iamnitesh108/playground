import { hue, type Hue } from '@/shared/figures'
import styles from './SetupContexts.module.css'

/** When a change to a setting takes effect, by pg_settings.context, with the settings of the sample file in each column. */
const COLUMNS: { context: string; when: string; how: string; hue: Hue }[] = [
  { context: 'postmaster', when: 'restart only', how: 'systemctl restart', hue: 8 },
  { context: 'sighup', when: 'on reload', how: 'SELECT pg_reload_conf()', hue: 4 },
  { context: 'superuser-backend', when: 'new connections, after reload', how: 'reload; old sessions keep theirs', hue: 7 },
  { context: 'superuser', when: 'reload, or SET by a superuser', how: 'SET … in a session', hue: 5 },
  { context: 'user', when: 'reload, or SET by anyone', how: 'SET work_mem = … per session', hue: 6 },
]

export function SetupContexts({ settings }: { settings: readonly { name: string; context: string }[] }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>When a change takes effect — the settings of the file above, by their recorded context</figcaption>
      <div className={styles.grid}>
        {COLUMNS.map((c) => (
          <div key={c.context} className={styles.col} style={hue(c.hue)}>
            <div className={styles.head}>
              <code>{c.context}</code>
              <span className={styles.when}>{c.when}</span>
              <span className={styles.how}>{c.how}</span>
            </div>
            <ul className={styles.list}>
              {settings
                .filter((s) => s.context === c.context)
                .map((s) => (
                  <li key={s.name}>
                    {/* break long names only after an underscore */}
                    {s.name.split('_').map((part, i, all) => (
                      <span key={i}>
                        {part}
                        {i < all.length - 1 && <>_<wbr /></>}
                      </span>
                    ))}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </figure>
  )
}
