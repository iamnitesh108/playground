import { hue, type Hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './RunConsoleMap.module.css'

/** Where each sidebar entry is explained in this module. */
const LESSON_OF: Record<string, { slug: string; title: string }> = {
  Browser: { slug: 'using', title: 'Using S3' },
  'Access Keys': { slug: 'access', title: 'Access' },
  Policies: { slug: 'access', title: 'Access' },
  Users: { slug: 'access', title: 'Access' },
  'User Groups': { slug: 'access', title: 'Access' },
  Lifecycle: { slug: 'versioning', title: 'Versioning' },
  'Bucket Events': { slug: 'patterns', title: 'Patterns' },
  'Event Destinations': { slug: 'patterns', title: 'Patterns' },
  'Bucket Replication': { slug: 'patterns', title: 'Patterns' },
  'Running Status': { slug: 'patterns', title: 'Patterns' },
}
const GROUP_HUES: Hue[] = [HUE.data, HUE.server, HUE.network]
const GROUP_NAMES = ['data and access', 'bucket and server features', 'about']

/** The console's sidebar as recorded, with links to the lessons that use each part. */
export function RunConsoleMap({ menu }: { menu: readonly (readonly string[])[] }) {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Recorded: the console’s sidebar, and where this module uses it</figcaption>
      <div className={styles.groups}>
        {menu.map((items, g) => (
          <section key={g} className={styles.group} style={hue(GROUP_HUES[g % GROUP_HUES.length])}>
            <h4>{GROUP_NAMES[g] ?? `group ${g + 1}`}</h4>
            <ul>
              {items.map((item) => {
                const lesson = LESSON_OF[item]
                return (
                  <li key={item} className={lesson ? styles.used : undefined}>
                    <span>{item}</span>
                    {lesson && <a href={`#/s3/${lesson.slug}`}>{lesson.title} →</a>}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </figure>
  )
}
