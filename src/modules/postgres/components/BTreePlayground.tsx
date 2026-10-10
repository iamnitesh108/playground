import { useMemo, useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { Button, Demo, Segmented, TextField } from '@/shared/ui'
import { BTree, type BTreeEvent } from '../simulation/btree'
import { BTreeView } from './BTreeView'
import styles from './BTreePlayground.module.css'

const SEED = [50, 20, 80, 10, 30, 60, 90, 40, 70]

function build(maxKeys: number) {
  const tree = new BTree(maxKeys)
  for (const k of SEED) tree.insert(k)
  return tree
}

/** Insert and search keys, watching each step travel down the tree. */
export function BTreePlayground() {
  const [maxKeys, setMaxKeys] = useState(3)
  const [tree, setTree] = useState(() => build(3))
  const [version, setVersion] = useState(0)
  const [input, setInput] = useState('45')
  const [events, setEvents] = useState<BTreeEvent[]>([])
  const [step, setStep] = useState(0)
  const [key, setKey] = useState<number | null>(null)

  // The tree mutates in place; `version` marks each change so the levels are recomputed only then.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const levels = useMemo(() => tree.levels(), [tree, version])
  const shown = useMemo(() => events.slice(0, step + 1), [events, step])
  const path = useMemo(() => new Set(shown.map((e) => e.node)), [shown])
  const current = events[step]
  const animating = step < events.length - 1

  useInterval(() => setStep((s) => s + 1), animating ? 1100 : null)

  const run = (action: 'insert' | 'search') => {
    const k = Number.parseInt(input, 10)
    if (!Number.isFinite(k)) return
    setKey(k)
    setEvents(action === 'insert' ? tree.insert(k) : tree.search(k))
    setStep(0)
    setVersion((v) => v + 1)
  }

  const reset = (capacity: number) => {
    setMaxKeys(capacity)
    setTree(build(capacity))
    setEvents([])
    setStep(0)
    setKey(null)
    setVersion((v) => v + 1)
  }

  return (
    <Demo
      title="A B-tree index, live"
      hint="Search for a key and watch the path from the root. Insert keys until a page splits — and until the root splits and the tree grows a level."
      controls={
        <>
          <TextField label="key" value={input} onChange={(e) => setInput(e.target.value.replace(/[^0-9]/g, ''))} />
          <Button size="sm" variant="primary" onClick={() => run('insert')}>
            Insert
          </Button>
          <Button size="sm" onClick={() => run('search')}>
            Search
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setInput(String(Math.floor(Math.random() * 100)))}>
            Random key
          </Button>
          <Segmented label="keys per page" value={maxKeys} onChange={reset} options={[3, 4].map((n) => ({ value: n, label: String(n) }))} />
        </>
      }
    >
      <BTreeView levels={levels} path={path} focus={current?.node ?? null} highlightKey={key} />
      <div className={styles.log} aria-live="polite">
        {events.length === 0 ? (
          <span className={styles.idle}>Height {levels.length} · {levels.at(-1)!.length} leaf pages. Real index pages hold hundreds of keys, not {maxKeys}.</span>
        ) : (
          shown.map((e, i) => (
            <div key={i} className={styles.event} data-kind={e.kind}>
              <span className={styles.n}>{i + 1}</span>
              {e.text}
            </div>
          ))
        )}
      </div>
    </Demo>
  )
}
