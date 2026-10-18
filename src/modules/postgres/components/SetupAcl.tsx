import { useState } from 'react'
import { hue, type Hue } from '@/shared/figures'
import { Segmented } from '@/shared/ui'
import styles from './SetupAcl.module.css'

const LETTERS: Record<string, { privilege: string; table: string; sequence?: string }> = {
  a: { privilege: 'INSERT', table: 'add rows' },
  r: { privilege: 'SELECT', table: 'read rows', sequence: 'currval()' },
  w: { privilege: 'UPDATE', table: 'change rows', sequence: 'setval()' },
  d: { privilege: 'DELETE', table: 'remove rows' },
  D: { privilege: 'TRUNCATE', table: 'empty the table' },
  x: { privilege: 'REFERENCES', table: 'point a foreign key at it' },
  t: { privilege: 'TRIGGER', table: 'create triggers on it' },
  m: { privilege: 'MAINTAIN', table: 'VACUUM, ANALYZE, REINDEX…' },
  U: { privilege: 'USAGE', table: 'use it', sequence: 'nextval() — new ids' },
}

const ROW_HUE: Hue = 6
const ROLE_HUE: Hue = 1
const GRANTOR_HUE: Hue = 7

interface AclEntry {
  object: string
  kind: string
  grantee: string
  letters: string
  grantor: string
}

/** Reads every grantee=letters/grantor item out of a recorded \dp table. */
function parseAcl(dp: string): AclEntry[] {
  const out: AclEntry[] = []
  let object = '', kind = ''
  for (const line of dp.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (cells.length < 4) continue
    if (cells[1] && cells[1] !== 'Name') {
      object = cells[1]
      kind = cells[2]
    }
    const m = cells[3].match(/^(\w+)=(\w*)\/(\w+)/)
    if (m) out.push({ object, kind, grantee: m[1], letters: m[2], grantor: m[3] })
  }
  return out
}

/** One access-privilege item, letter by letter. */
export function SetupAcl({ dp }: { dp: string }) {
  const entries = parseAcl(dp)
  const [i, setI] = useState(String(Math.max(0, entries.findIndex((e) => e.grantee === 'app_rw'))))
  const e = entries[Number(i)]
  if (!e) return null
  const isSeq = e.kind === 'sequence'
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Reading one item of “Access privileges”</figcaption>
      <Segmented label="item" value={i} onChange={setI} options={entries.map((x, k) => ({ value: String(k), label: `${x.object}: ${x.grantee}` }))} />
      <div className={styles.parts}>
        <span className={styles.part} style={hue(ROLE_HUE)}>
          <code>{e.grantee}</code>
          <span>who (grantee)</span>
        </span>
        <span className={styles.sep}>=</span>
        {[...e.letters].map((l, k) => (
          <span key={k} className={styles.part} style={hue(ROW_HUE)}>
            <code>{l}</code>
            <span>{LETTERS[l]?.privilege ?? '?'}</span>
            <span className={styles.meaning}>{(isSeq ? LETTERS[l]?.sequence : undefined) ?? LETTERS[l]?.table}</span>
          </span>
        ))}
        <span className={styles.sep}>/</span>
        <span className={styles.part} style={hue(GRANTOR_HUE)}>
          <code>{e.grantor}</code>
          <span>granted by</span>
        </span>
      </div>
      <div className={styles.caption}>
        {e.object} is a {e.kind}. Recorded with <code>\dp app.*</code>; a role missing from the list has no privileges on it (unless it owns it or is a superuser).
      </div>
    </figure>
  )
}
