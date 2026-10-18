import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { apply, read, start, type KeyState } from '../simulation/versions'
import { HUE } from './legend'
import styles from './VersioningStack.module.css'

const PRICES = ['14.00', '9.99', '15.50', '11.25']

/** One key's versions as a stack: upload, delete, undo, restore and purge, and see what a plain GET returns. */
export function VersioningStack({ initial }: { initial: { id: string; content: string }[] }) {
  const [state, setState] = useState<KeyState>(() => start(initial))
  const [selected, setSelected] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  const got = read(state)
  const top = state.stack[0]
  const pick = state.stack.find((e) => e.id === selected)
  const act = (next: KeyState, line: string) => {
    setState(next)
    setLog((l) => [line, ...l].slice(0, 5))
  }
  const price = PRICES[state.counter % PRICES.length]
  return (
    <Demo
      title="A key’s version stack"
      hint="Start: the three recorded versions of prices.csv. Click a version to select it."
      controls={
        <Segmented
          label="versioning"
          value={state.versioning ? 'on' : 'suspended'}
          options={[
            { value: 'on', label: 'Enabled' },
            { value: 'suspended', label: 'Suspended' },
          ]}
          onChange={(v) => act(apply(state, { type: 'versioning', on: v === 'on' }), `versioning ${v}`)}
        />
      }
    >
      <div className={styles.layout}>
        <div>
          <div className={styles.label}>prices.csv — newest on top</div>
          <ol className={styles.stack}>
            {state.stack.map((e, i) => (
              <li key={`${e.id}-${i}`}>
                <button
                  type="button"
                  className={`${styles.entry} ${e.kind === 'marker' ? styles.marker : ''} ${selected === e.id ? styles.selected : ''}`}
                  style={hue(e.kind === 'marker' ? HUE.error : i === 0 ? HUE.ok : HUE.data)}
                  onClick={() => setSelected(e.id === selected ? null : e.id)}
                >
                  <span className={styles.kind}>{e.kind === 'marker' ? 'delete marker' : `version · ${e.content}`}</span>
                  <code>{e.id === 'null' ? 'id “null”' : e.id.length > 12 ? `${e.id.slice(0, 8)}…` : e.id}</code>
                  {i === 0 && <span className={styles.latest}>latest</span>}
                </button>
              </li>
            ))}
            {state.stack.length === 0 && <li className={styles.empty}>no versions left: the key is gone for good</li>}
          </ol>
        </div>
        <div className={styles.side}>
          <div className={styles.get} style={hue(got.status === 200 ? HUE.ok : HUE.error)}>
            <code>GET /catalog/prices.csv</code>
            <strong>{got.status === 200 ? `200 · MUG-350,${got.content}` : '404 NoSuchKey'}</strong>
            <small>{got.why}</small>
          </div>
          <div className={styles.buttons}>
            <Button size="sm" onClick={() => act(apply(state, { type: 'put', content: price }), `PUT → new version (${price})`)}>
              Upload a new price
            </Button>
            <Button size="sm" onClick={() => act(apply(state, { type: 'delete' }), 'DELETE → delete marker')}>
              Delete (no version id)
            </Button>
            <Button size="sm" disabled={top?.kind !== 'marker'} onClick={() => top && act(apply(state, { type: 'delete-version', id: top.id }), 'DELETE the marker → object is back')}>
              Undo the delete
            </Button>
            <Button size="sm" disabled={!pick || pick.kind !== 'version'} onClick={() => pick && act(apply(state, { type: 'restore', id: pick.id }), `copy ${pick.id.slice(0, 8)} → new latest`)}>
              Restore selected
            </Button>
            <Button size="sm" variant="danger" disabled={!pick} onClick={() => pick && (act(apply(state, { type: 'delete-version', id: pick.id }), `DELETE ?versionId=${pick.id.slice(0, 8)} → gone forever`), setSelected(null))}>
              Delete selected version
            </Button>
          </div>
          <ul className={styles.log} aria-live="polite">
            {log.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      </div>
    </Demo>
  )
}
