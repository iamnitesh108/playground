import { useState } from 'react'
import { Demo, TextField } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { hashedPart, initialRanges, keySlot, ownerOf, sameSlot } from '../simulation/cluster'
import styles from './play.module.css'

const NODES = ['7001', '7002', '7003']

/** Type keys; see the hashed part, the slot, and which of three primaries owns it. */
export function SlotCalculator() {
  const [text, setText] = useState('user:1000, {user:1000}:cart, {user:1000}:orders, order:42')
  const keys = text.split(',').map((k) => k.trim()).filter(Boolean)
  const ranges = initialRanges(3)
  return (
    <Demo
      title="Key → hash slot → node"
      hint="slot = CRC16(key) mod 16384. If the key contains {…} with something inside, only that part is hashed: keys with the same tag land in the same slot, so multi-key commands work on them."
      controls={<TextField label="keys, comma-separated" value={text} onChange={(e) => setText(e.target.value)} />}
    >
      <table className={styles.mono} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}><th>key</th><th>hashed</th><th>slot</th><th>node</th></tr>
        </thead>
        <tbody>
          {keys.map((k) => {
            const h = hashedPart(k)
            const slot = keySlot(k)
            return (
              <tr key={k}>
                <td>{k}</td>
                <td>{h.tagged ? `{${h.part}}` : h.part}</td>
                <td>{slot}</td>
                <td>127.0.0.1:{NODES[ownerOf(slot, ranges)]}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className={styles.label}>Slots of 3 primaries (as redis-cli --cluster create assigns them)</div>
      <div className={styles.track}>
        {ranges.map((r, i) => <span key={i} className={styles.segment} style={{ left: `${(r.from / 16384) * 100}%`, width: `${((r.to - r.from + 1) / 16384) * 100}%`, opacity: 0.35 + i * 0.25 }} title={`${NODES[i]}: ${r.from}–${r.to}`} />)}
        {keys.map((k) => <span key={k} className={styles.segmentSlow} style={{ left: `${(keySlot(k) / 16384) * 100}%`, width: 3 }} title={`${k}: ${keySlot(k)}`} />)}
      </div>
      <p className={cx(styles.verdict, keys.length > 1 && !sameSlot(keys) && styles.verdictBad)}>
        {keys.length < 2 ? 'Add a second key to check a multi-key command.' : sameSlot(keys) ? `MSET ${keys.join(' … ')} would work: one slot.` : 'MSET with these keys → (error) CROSSSLOT Keys in request don\'t hash to the same slot'}
      </p>
    </Demo>
  )
}
