import { hue, type Hue } from '@/shared/figures'
import styles from './SecurityAclGrid.module.css'

const RESOURCES = ['Topic', 'Group', 'TransactionalId', 'Cluster'] as const

interface Role {
  who: string
  hue: Hue
  needs: Partial<Record<(typeof RESOURCES)[number], string>>
  note: string
}

const ROLES: readonly Role[] = [
  { who: 'producer', hue: 7, needs: { Topic: 'WRITE' }, note: 'recorded above; idempotence needs nothing more' },
  { who: 'consumer in a group', hue: 1, needs: { Topic: 'READ', Group: 'READ' }, note: 'recorded above' },
  { who: 'consumer with assign(), no commits', hue: 1, needs: { Topic: 'READ' }, note: 'no group, so no group ACL' },
  { who: 'transactional producer', hue: 7, needs: { Topic: 'WRITE', TransactionalId: 'WRITE', Group: 'READ *' }, note: '* only when it commits consumer offsets in the transaction' },
  { who: 'tool that creates topics', hue: 5, needs: { Topic: 'CREATE', Cluster: 'or CREATE' }, note: 'CREATE on the topic name, or on the whole cluster' },
]

/** Which ACL (operation on a resource) each kind of client needs. */
export function SecurityAclGrid() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>What each client needs: an operation on a resource (READ and WRITE include DESCRIBE)</figcaption>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>client</th>
              {RESOURCES.map((r) => <th key={r}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROLES.map((r) => (
              <tr key={r.who} style={hue(r.hue)}>
                <th scope="row">
                  <span className={styles.who}>{r.who}</span>
                  <span className={styles.note}>{r.note}</span>
                </th>
                {RESOURCES.map((res) => (
                  <td key={res}>{r.needs[res] ? <span className={styles.op}>{r.needs[res]}</span> : <span className={styles.none}>—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
