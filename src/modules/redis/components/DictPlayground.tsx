import { useState } from 'react'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { Dict } from '../simulation/dict'
import styles from './play.module.css'

const bin = (n: number, size: number) => n.toString(2).padStart(Math.log2(size), '0')

/** Keys going into a hash table that grows by rehashing a bucket at a time; and a SCAN walking it. */
export function DictPlayground() {
  const dict = useObservable(() => new Dict())
  const [next, setNext] = useState(1)
  const [cursor, setCursor] = useState<number | null>(null)
  const [found, setFound] = useState<string[]>([])
  const [last, setLast] = useState<{ table: number; index: number }[]>([])
  const add = (n: number) => { for (let i = 0; i < n; i++) dict.add(`user:${next + i}`); setNext(next + n) }
  const scanStep = () => {
    const r = dict.scan(cursor ?? 0)
    setFound((f) => [...f, ...r.keys])
    setLast(r.buckets)
    setCursor(r.next)
  }
  const done = cursor === 0
  const unique = new Set(found)
  const missing = dict.tables.flatMap((t) => t.buckets.flat()).filter((k) => !unique.has(k))
  return (
    <Demo
      title="The keyspace: a hash table that grows a bucket at a time"
      hint="When the table is full, Redis allocates one twice the size and moves one bucket per command (and a little more in the background). SCAN visits buckets in reversed-bit order, so a scan that runs across a resize still returns every key that was there all along."
      controls={
        <>
          <Button size="sm" onClick={() => add(1)}>SET one key</Button>
          <Button size="sm" onClick={() => add(5)}>SET 5 keys</Button>
          <Button size="sm" disabled={!dict.rehashing} onClick={() => dict.touch()}>GET (moves a bucket)</Button>
          <Button size="sm" onClick={scanStep} disabled={done}>SCAN {cursor ?? 0}</Button>
          <Button size="sm" variant="ghost" onClick={() => { setCursor(null); setFound([]); setLast([]) }}>restart SCAN</Button>
        </>
      }
    >
      {dict.tables.map((t, ti) => (
        <div key={ti}>
          <div className={styles.label}>
            {ti === 0 ? (dict.rehashing ? 'table 0 (old)' : 'table 0') : 'table 1 (rehashing target)'} · {t.buckets.length} buckets · {t.buckets.flat().length} keys
          </div>
          <div className={styles.cells}>
            {t.buckets.map((b, bi) => (
              <span key={bi} className={cx(styles.cell, b.length > 0 && styles.cellOn, ti === 0 && dict.rehashing && bi < dict.rehashIndex && styles.cellOk, last.some((l) => l.table === ti && l.index === bi) && styles.cellWarn)} title={b.join(', ') || 'empty'}>
                <span>{bin(bi, t.buckets.length)}</span>
                <br />
                {b.length || '·'}
              </span>
            ))}
          </div>
        </div>
      ))}
      <dl className={styles.stats}>
        <div><dt>keys</dt><dd>{dict.size}</dd></div>
        <div><dt>rehashing</dt><dd>{dict.rehashing ? `bucket ${dict.rehashIndex} of ${dict.tables[0].buckets.length}` : 'no'}</dd></div>
        <div><dt>SCAN cursor</dt><dd className={styles.mono}>{cursor === null ? '—' : `${cursor}${done ? ' (done)' : ''}`}</dd></div>
        <div className={done && missing.length === 0 ? styles.good : undefined}><dt>keys found by SCAN</dt><dd>{unique.size}{found.length > unique.size ? ` (+${found.length - unique.size} dup)` : ''}</dd></div>
      </dl>
      {done && <p className={styles.verdict}>Scan complete. {missing.length === 0 ? 'Every key was returned.' : `Not returned: ${missing.join(', ')} — added after the scan passed their bucket.`}</p>}
    </Demo>
  )
}
