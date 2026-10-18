import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { decide, outcome, type HbaConnection, type HbaRule } from '../simulation/setupHba'
import styles from './SetupHbaPlayground.module.css'

type Who = 'admin' | 'app-local' | 'app-remote' | 'app-other-db' | 'replica' | 'stranger'

/** Typical connection attempts, each described as the server sees it. */
const ATTEMPTS: Record<Who, { label: string; conn: HbaConnection; osUser: string; how: string }> = {
  admin: { label: 'sudo -u postgres psql', conn: { via: 'socket', address: '[local]', database: 'postgres', user: 'postgres', replication: false }, osUser: 'postgres', how: 'Unix socket, OS user postgres, role postgres' },
  'app-local': { label: 'psql -h 127.0.0.1 -U app_rw shop', conn: { via: 'tcp', address: '127.0.0.1', database: 'shop', user: 'app_rw', replication: false }, osUser: 'deploy', how: 'TCP from the server itself' },
  'app-remote': { label: 'app at 10.0.1.20 → shop', conn: { via: 'tcp', address: '10.0.1.20', database: 'shop', user: 'app_rw', replication: false }, osUser: 'app', how: 'TCP from the application subnet' },
  'app-other-db': { label: 'app at 10.0.1.20 → postgres', conn: { via: 'tcp', address: '10.0.1.20', database: 'postgres', user: 'app_rw', replication: false }, osUser: 'app', how: 'same client, another database' },
  replica: { label: 'replica at 10.0.1.30', conn: { via: 'tcp', address: '10.0.1.30', database: 'replication', user: 'replicator', replication: true }, osUser: 'postgres', how: 'streaming replication from another host' },
  stranger: { label: 'psql -U app_rw shop (socket)', conn: { via: 'socket', address: '[local]', database: 'shop', user: 'app_rw', replication: false }, osUser: 'deploy', how: 'Unix socket, OS user deploy, role app_rw' },
}

const FIELDS = ['type', 'database', 'user', 'address'] as const

/** Pick a connection attempt and watch pg_hba.conf being read top to bottom until the first line matches. */
export function SetupHbaPlayground({ rules }: { rules: readonly HbaRule[] }) {
  const [who, setWho] = useState<Who>('app-remote')
  const attempt = ATTEMPTS[who]
  const decision = decide(rules, attempt.conn)
  const result = outcome(decision, attempt.conn, attempt.osUser)
  const chosenAt = decision.chosen ? decision.results.findIndex((r) => r.matches) : rules.length
  return (
    <Demo
      title="Which pg_hba.conf line decides?"
      hint="These are the rules the Ubuntu server reported in pg_hba_file_rules (recorded above). Lines are tried in order; the first line where all four columns match decides — later lines are never read."
      controls={
        <Segmented
          label="connection"
          value={who}
          onChange={setWho}
          options={(Object.keys(ATTEMPTS) as Who[]).map((k) => ({ value: k, label: ATTEMPTS[k].label }))}
        />
      }
    >
      <p className={styles.how}>
        <strong>{attempt.how}.</strong> type {attempt.conn.via === 'socket' ? 'local' : 'host'} · database{' '}
        {attempt.conn.replication ? 'replication' : attempt.conn.database} · user {attempt.conn.user} · address {attempt.conn.address}
      </p>
      <div className={styles.wrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>line</th>
              {FIELDS.map((f) => (
                <th key={f}>{f}</th>
              ))}
              <th>method</th>
              <th>result</th>
            </tr>
          </thead>
          <tbody>
            {decision.results.map((r, i) => {
              const state = i < chosenAt ? 'skipped' : i === chosenAt ? 'chosen' : 'unread'
              return (
                <tr key={r.rule.line} className={cx(styles[state])} style={hue(state === 'chosen' ? (result.ok === false ? 8 : 6) : undefined)}>
                  <td>{r.rule.line}</td>
                  {FIELDS.map((f) => {
                    const c = r.checks.find((x) => x.field === f)!
                    const text = f === 'type' ? r.rule.type : f === 'database' ? r.rule.databases.join(',') : f === 'user' ? r.rule.users.join(',') : r.rule.address ? `${r.rule.address}${r.rule.netmask && r.rule.netmask !== '255.255.255.255' && !r.rule.netmask.includes(':') ? ` / ${r.rule.netmask}` : ''}` : '—'
                    return (
                      <td key={f} className={cx(state !== 'unread' && (c.ok ? styles.ok : styles.no))}>
                        {state !== 'unread' && <span className={styles.mark}>{c.ok ? '✓' : '✗'}</span>}
                        {text}
                      </td>
                    )
                  })}
                  <td>{r.rule.method}</td>
                  <td className={styles.state}>{state === 'chosen' ? 'decides' : state === 'skipped' ? 'no match' : 'not read'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.outcome} style={hue(result.ok === false ? 8 : result.ok ? 6 : 7)}>
        <span className={styles.badge}>{decision.chosen ? `line ${decision.chosen.line}` : 'no line'}</span>
        <code>{result.text}</code>
      </p>
    </Demo>
  )
}
