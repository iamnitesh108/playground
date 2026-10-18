import { useState } from 'react'
import { Demo, Segmented } from '@/shared/ui'
import { LIMITS } from '../data/limits'
import { encodingOf, type ValueType } from '../simulation/encoding'
import { Slider } from './Slider'
import styles from './play.module.css'

const COMPACT = new Set(['int', 'embstr', 'listpack', 'intset'])

const RULE: Record<ValueType, string> = {
  string: `int if the value is a 64-bit integer; embstr if key + value fit one 64-byte allocation (≤ ${LIMITS.embstrKeyPlusValue} bytes together); raw otherwise`,
  list: 'listpack while one node holds ≤ 8 KB (list-max-listpack-size -2); then a quicklist: a linked list of listpacks',
  hash: `listpack while ≤ ${LIMITS.hashEntries} fields (hash-max-listpack-entries) and every field and value ≤ ${LIMITS.hashValue} bytes; then a hash table`,
  set: `intset for ≤ ${LIMITS.setIntsetEntries} integers; listpack for ≤ ${LIMITS.setListpackEntries} short members; then a hash table`,
  zset: `listpack while ≤ ${LIMITS.zsetEntries} members of ≤ ${LIMITS.zsetValue} bytes; then a skiplist + hash table`,
}

/** Pick a type and a size; see the encoding Redis would use (rules checked against a real server). */
export function EncodingExplorer() {
  const [type, setType] = useState<ValueType>('hash')
  const [count, setCount] = useState(100)
  const [longest, setLongest] = useState(10)
  const [integers, setIntegers] = useState(false)
  const [keyBytes, setKeyBytes] = useState(11)
  const encoding = encodingOf(type, { count: type === 'string' ? 1 : count, longest, integers, keyBytes }, LIMITS)
  return (
    <Demo
      title="Which encoding does Redis pick?"
      hint="Small values use a compact encoding (one contiguous block, scanned linearly); past a limit Redis converts them to a structure built for speed. Hashes, sets and sorted sets never convert back; a list does once it is small again."
      controls={
        <>
          <Segmented label="type" value={type} options={(['string', 'list', 'hash', 'set', 'zset'] as const).map((t) => ({ value: t, label: t }))} onChange={setType} />
          {type !== 'string' && <Slider label="elements" value={count} min={1} max={1200} onChange={setCount} />}
          <Slider label={type === 'string' ? 'value bytes' : 'longest element'} value={longest} min={1} max={100} format={(v) => `${v} B`} onChange={setLongest} />
          {type === 'string' && <Slider label="key bytes" value={keyBytes} min={1} max={60} format={(v) => `${v} B`} onChange={setKeyBytes} />}
          {(type === 'set' || type === 'string') && (
            <Segmented label="values" value={integers ? 'int' : 'text'} options={[{ value: 'text', label: 'text' }, { value: 'int', label: 'integers' }]} onChange={(v) => setIntegers(v === 'int')} />
          )}
        </>
      }
    >
      <dl className={styles.stats}>
        <div className={COMPACT.has(encoding) ? styles.good : undefined}>
          <dt>OBJECT ENCODING</dt>
          <dd className={styles.mono}>{encoding}</dd>
        </div>
        <div><dt>kind</dt><dd>{COMPACT.has(encoding) ? 'compact' : 'pointer-based'}</dd></div>
      </dl>
      <p className={styles.mono} style={{ marginTop: 12 }}>{RULE[type]}</p>
    </Demo>
  )
}
