import { useMemo, useState } from 'react'
import { useStepper } from '@/shared/hooks/useStepper'
import { Button, Demo, Segmented } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { CAPTURE } from '../data/captures'
import { reconcile } from '../simulation/reconcile'
import styles from './ReconcilePlayground.module.css'

const CASES = CAPTURE.reconcile

function Replay({ from, to, recorded }: { from: readonly string[]; to: readonly string[]; recorded?: readonly string[] }) {
  const { steps, ops } = useMemo(() => reconcile(from, to), [from, to])
  const stepper = useStepper(steps.length + 1, 1100)
  const done = steps.slice(0, stepper.index)
  const current = done.at(-1)
  const decisionOf = (key: string) => done.find((s) => s.key === key)?.decision

  return (
    <>
      <div className={styles.lists}>
        <div>
          <div className={styles.label}>before</div>
          <div className={styles.row}>
            {from.map((k, i) => (
              <span key={k} className={cx(styles.item, current?.key === k && styles.focus)} data-decision={decisionOf(k)}>
                {k}
                <sub>{i}</sub>
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className={styles.label}>after</div>
          <div className={styles.row}>
            {to.map((k, i) => (
              <span key={k} className={cx(styles.item, current?.key === k && styles.focus)} data-decision={decisionOf(k)}>
                {k}
                <sub>{i}</sub>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.caption} aria-live="polite">
        <span className={styles.counter}>
          {stepper.index}/{steps.length}
        </span>
        {current ? (
          <>
            <strong>{current.key}</strong>: {current.why}
            <span className={styles.lpi}>lastPlacedIndex = {current.lastPlacedIndex}</span>
          </>
        ) : (
          'Each key in the new list is matched with the old one. Press Next.'
        )}
      </div>
      <div className={styles.footer}>
        <div className={styles.legend}>
          {(['keep', 'move', 'insert', 'delete'] as const).map((d) => (
            <span key={d} className={styles.item} data-decision={d}>
              {d}
            </span>
          ))}
        </div>
        <div className={styles.buttons}>
          <Button size="sm" variant="ghost" onClick={stepper.reset} disabled={stepper.isFirst}>Reset</Button>
          <Button size="sm" onClick={stepper.previous} disabled={stepper.isFirst}>Back</Button>
          <Button size="sm" variant="primary" onClick={stepper.next} disabled={stepper.isLast}>Next</Button>
        </div>
      </div>
      {stepper.isLast && (
        <div className={styles.ops}>
          <div className={styles.label}>DOM operations at commit</div>
          <code>{ops.length ? ops.join(' · ') : 'none'}</code>
          {recorded && (
            <div className={styles.verdict}>
              {recorded.join() === ops.join() ? `Same operations as React ${CAPTURE.react} performed.` : `React performed: ${recorded.join(' · ')}`}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** Pick a list change; step through how React matches keys and which DOM nodes move. */
export function ReconcilePlayground() {
  const [name, setName] = useState<string>(CASES[0].name)
  const c = CASES.find((x) => x.name === name)!
  return (
    <Demo title="Reconciling a keyed list" hint="Which <li> elements does React keep, move, create or delete? Every case below was also run in real React, and its DOM calls recorded.">
      <Segmented label="change" value={name} options={CASES.map((x) => ({ value: x.name, label: x.name }))} onChange={setName} />
      <Replay key={name} from={c.from} to={c.to} recorded={c.ops} />
    </Demo>
  )
}
