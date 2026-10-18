import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { isVisible, possibleXmax, type XidCase } from '../simulation/mvccVisibility'
import styles from './MvccFigures.module.css'

const XMIN: { value: Exclude<XidCase, 'none'>; label: string }[] = [
  { value: 'committed', label: 'committed before' },
  { value: 'committed-later', label: 'committed after' },
  { value: 'running', label: 'running' },
  { value: 'aborted', label: 'aborted' },
  { value: 'mine', label: 'me' },
]
const XMAX: { value: XidCase; label: string }[] = [{ value: 'none', label: '0' }, ...XMIN]

/** Choose what xmin and xmax mean to the reader; see the two checks decide. */
export function MvccVisibilityChecker() {
  const [xmin, setXmin] = useState<Exclude<XidCase, 'none'>>('committed')
  const [xmax, setXmax] = useState<XidCase>('running')
  const allowed = possibleXmax(xmin)
  const v = isVisible(xmin, xmax)
  const chooseXmin = (next: Exclude<XidCase, 'none'>) => {
    setXmin(next)
    // a combination that cannot happen on a real page falls back to xmax 0
    if (!possibleXmax(next).includes(xmax)) setXmax('none')
  }
  return (
    <Demo
      title="Is this tuple visible to me?"
      hint="“Before” and “after” are relative to my snapshot. Try an UPDATE that is still running (xmax running), a row I deleted myself (xmax me), or an insert that rolled back (xmin aborted). Only xmax values that can occur with the chosen xmin are offered: nobody can delete a row they cannot see."
      controls={
        <>
          <Segmented label="xmin (inserted by)" value={xmin} options={XMIN} onChange={chooseXmin} />
          <Segmented label="xmax (deleted by)" value={xmax} options={XMAX.filter((o) => allowed.includes(o.value))} onChange={setXmax} />
        </>
      }
    >
      <ol className={styles.checks}>
        {v.checks.map((c) => (
          <li key={c.label} style={hue(c.passed ? 6 : 8)}>
            <span className={styles.badge}>{c.passed ? 'pass' : 'fail'}</span>
            <span>
              <strong>{c.label}</strong> {c.reason}.
            </span>
          </li>
        ))}
        {v.checks.length === 1 && <li className={styles.skipped}>xmax is not even looked at.</li>}
      </ol>
      <p className={styles.verdict} style={hue(v.visible ? 6 : 8)}>
        {v.visible ? 'Visible: this version is part of my snapshot.' : 'Invisible: I skip this version.'}
      </p>
    </Demo>
  )
}
