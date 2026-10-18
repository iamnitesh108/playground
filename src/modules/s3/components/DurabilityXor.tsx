import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo, TextField } from '@/shared/ui'
import { rebuild, splitShards, xorAll } from '../simulation/erasure'
import { HUE } from './legend'
import styles from './DurabilityXor.module.css'

const K = 3
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join(' ')
const text = (b: Uint8Array) => new TextDecoder().decode(b.filter((x) => x !== 0))

/** The simplest erasure code, computed live: three data shards and one XOR parity shard; lose any one and rebuild it. */
export function DurabilityXor() {
  const [input, setInput] = useState('MUG-350,12.00;LAMP-7,39.90')
  const [lost, setLost] = useState<number | null>(1)
  const bytes = new TextEncoder().encode(input || ' ')
  const data = splitShards(bytes, K)
  const shards = [...data, xorAll(data)]
  const rebuilt = lost === null ? null : rebuild(shards.map((s, i) => (i === lost ? null : s)))
  const ok = rebuilt !== null && lost !== null && rebuilt.every((b, i) => b === shards[lost][i])
  return (
    <Demo
      title="One parity shard, computed in your browser"
      hint="The text is cut into 3 data shards; the parity shard is their XOR (byte by byte). Click a shard to lose it."
      controls={<TextField label="object content" value={input} onChange={(e) => setInput(e.target.value.slice(0, 48))} />}
    >
      <div className={styles.rows}>
        {shards.map((s, i) => {
          const parity = i === K
          const isLost = i === lost
          return (
            <button key={i} type="button" className={isLost ? styles.lost : styles.row} style={hue(isLost ? HUE.error : parity ? HUE.network : HUE.data)} onClick={() => setLost(isLost ? null : i)}>
              <span className={styles.name}>{parity ? 'P = D1 ⊕ D2 ⊕ D3' : `D${i + 1}`}</span>
              <code className={styles.bytes}>{isLost ? 'lost' : hex(s)}</code>
              <span className={styles.text}>{parity ? '(not text)' : isLost ? '' : `“${text(s)}”`}</span>
            </button>
          )
        })}
      </div>
      {lost !== null && rebuilt && (
        <div className={styles.result} style={hue(ok ? HUE.ok : HUE.error)}>
          <span>
            rebuilt {lost === K ? 'P' : `D${lost + 1}`} = XOR of the other three
          </span>
          <code>{hex(rebuilt)}</code>
          <strong>{lost === K ? 'parity recomputed' : `“${text(rebuilt)}” — ${ok ? 'identical to what was lost' : 'mismatch'}`}</strong>
        </div>
      )}
    </Demo>
  )
}
