import { useMemo, useState } from 'react'
import { BarChart, StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { distribute, remap, type KeyHash, type WeightedKey } from '../simulation/keysDistribution'
import { KeysMoveList } from './KeysMoveList'
import styles from './KeysFigures.module.css'

/* Type keys (or pick a preset), choose a partition count, and see where every key lands with the
   Java client's murmur2 partitioner, how even the load is, and which keys move when the count changes. */

const range = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i))

const PRESETS = {
  customers: { label: 'customer ids', text: range(24, (i) => `customer-${1001 + i}`).join('\n') },
  statuses: { label: 'statuses', text: 'PAID x80\nPENDING x15\nFAILED x5' },
  tenants: { label: 'tenants', text: 'tenant-a x60\ntenant-b x20\ntenant-c x10\ntenant-d x5\ntenant-e x5' },
  composite: { label: 'tenant:order', text: range(18, (i) => `tenant-${'abc'[i % 3]}:order-${2001 + i}`).join('\n') },
  boolean: { label: 'true / false', text: 'true x50\nfalse x50' },
} as const
type Preset = keyof typeof PRESETS

/** "PAID x80" → { key: 'PAID', weight: 80 }; a plain line weighs 1. */
function parse(text: string): WeightedKey[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(.*\S)\s+[x×](\d+)$/.exec(line)
      return m ? { key: m[1], weight: Math.max(1, Number(m[2])) } : { key: line, weight: 1 }
    })
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className={styles.slider}>
      {label}
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{value}</output>
    </label>
  )
}

const SHOWN = 36

export function KeysExplorer() {
  const [preset, setPreset] = useState<Preset>('customers')
  const [text, setText] = useState<string>(PRESETS.customers.text)
  const [partitions, setPartitions] = useState(6)
  const [after, setAfter] = useState(8)
  const [hash, setHash] = useState<KeyHash>('murmur2')

  const keys = useMemo(() => parse(text), [text])
  const now = useMemo(() => distribute(keys, partitions, hash), [keys, partitions, hash])
  const moves = useMemo(() => remap(keys.map((k) => k.key), partitions, after, hash), [keys, partitions, after, hash])
  const total = keys.reduce((a, k) => a + k.weight, 0)
  const moved = moves.filter((m) => m.from !== m.to).length
  const even = total / partitions

  const choose = (p: Preset) => {
    setPreset(p)
    setText(PRESETS[p].text)
  }

  return (
    <Demo
      title="Key → partition explorer"
      hint="One key per line; “PAID x80” means 80 records carry that key. Change the partition count, or compare with the hash librdkafka-based clients use by default."
      controls={
        <>
          <Segmented label="preset" value={preset} onChange={choose} options={(Object.keys(PRESETS) as Preset[]).map((p) => ({ value: p, label: PRESETS[p].label }))} />
          <Slider label="partitions" value={partitions} min={1} max={24} onChange={setPartitions} />
          <Slider label="change to" value={after} min={1} max={24} onChange={setAfter} />
          <Segmented
            label="hash"
            value={hash}
            onChange={setHash}
            options={[
              { value: 'murmur2', label: 'murmur2 (Java)' },
              { value: 'crc32', label: 'CRC-32 (librdkafka)' },
            ]}
          />
        </>
      }
    >
      <textarea className={styles.keysInput} value={text} onChange={(e) => setText(e.target.value)} aria-label="keys, one per line" spellCheck={false} />
      <StatTiles
        stats={[
          { label: 'distinct keys', value: keys.length, sub: `${total.toLocaleString()} records`, hue: 7 },
          { label: 'partitions used', value: `${partitions - now.idle} of ${partitions}`, sub: now.idle ? `${now.idle} get nothing` : 'all get records', hue: now.idle ? 8 : 3, bar: { value: partitions - now.idle, max: partitions } },
          { label: 'busiest vs even share', value: `+${now.skewPercent}%`, sub: now.skewPercent > 50 ? 'skewed: one consumer does more work' : 'roughly even', hue: now.skewPercent > 50 ? 8 : 6 },
          { label: `keys that move ${partitions}→${after}`, value: `${moved} of ${keys.length}`, sub: partitions === after ? 'same count: nothing moves' : 'new records land elsewhere', hue: moved ? 8 : 6 },
        ]}
      />
      <BarChart
        title={`Records per partition with ${partitions} partitions (${hash}); the line is a perfectly even share`}
        bars={now.records.map((r, p) => ({
          label: `P${p}`,
          value: r,
          hue: r > even * 1.5 ? 8 : 3,
          display: `${r.toLocaleString()} · ${now.keys[p]} key${now.keys[p] === 1 ? '' : 's'}${r > even * 1.5 ? ' · hot' : r === 0 ? ' · idle' : ''}`,
        }))}
        marker={{ value: even, label: `even share: ${Math.round(even * 10) / 10} records` }}
      />
      <div className={styles.label}>
        Each key now ({partitions} partitions) → after changing to {after}
      </div>
      <KeysMoveList moves={moves.slice(0, SHOWN)} compare={partitions !== after} />
      {moves.length > SHOWN && <div className={styles.more}>…and {moves.length - SHOWN} more keys.</div>}
    </Demo>
  )
}
