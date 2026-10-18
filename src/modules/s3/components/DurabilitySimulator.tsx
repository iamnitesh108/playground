import { useState } from 'react'
import { hue, Proportion, StatTiles } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { defaultParity, quorums, setStatus } from '../simulation/erasure'
import { HUE } from './legend'
import styles from './DurabilitySimulator.module.css'

const SIZES = [4, 6, 8, 12, 16]

/** An erasure set to break: choose drives and parity, click drives to fail them, see what still works. */
export function DurabilitySimulator({ recordedDrives = 4, recordedParity = 2 }: { recordedDrives?: number; recordedParity?: number }) {
  const [drives, setDrives] = useState(recordedDrives)
  const [parity, setParity] = useState(recordedParity)
  const [failed, setFailed] = useState<Set<number>>(new Set())
  const [driveTB, setDriveTB] = useState(8)
  const data = drives - parity
  const st = setStatus(data, parity, failed.size)
  const q = quorums(data, parity)
  const choose = (n: number) => {
    setDrives(n)
    setParity(defaultParity(n))
    setFailed(new Set())
  }
  const toggle = (i: number) =>
    setFailed((f) => {
      const next = new Set(f)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  return (
    <Demo
      title="Break an erasure set"
      hint={`Start: the recorded layout, ${recordedDrives} drives with parity ${recordedParity}. Click drives to fail them. Changing the drive count picks RustFS’s default parity.`}
      controls={
        <>
          <Segmented label="drives in the set" value={drives} options={SIZES.map((n) => ({ value: n, label: String(n) }))} onChange={choose} />
          <Segmented
            label="parity"
            value={parity}
            options={Array.from({ length: Math.floor(drives / 2) + 1 }, (_, p) => ({ value: p, label: `${p}${p === defaultParity(drives) ? ' (default)' : ''}` }))}
            onChange={(p) => {
              setParity(p)
              setFailed(new Set())
            }}
          />
          <Segmented label="each drive" value={driveTB} options={[4, 8, 16].map((t) => ({ value: t, label: `${t} TB` }))} onChange={setDriveTB} />
        </>
      }
    >
      <div className={styles.drives} role="group" aria-label="drives of the erasure set">
        {Array.from({ length: drives }, (_, i) => {
          const isParity = i >= data
          const down = failed.has(i)
          return (
            <button
              key={i}
              type="button"
              className={down ? styles.down : styles.drive}
              style={hue(down ? HUE.error : isParity ? HUE.network : HUE.data)}
              onClick={() => toggle(i)}
              aria-pressed={down}
            >
              <span className={styles.shard}>{isParity ? `P${i - data + 1}` : `D${i + 1}`}</span>
              <span className={styles.what}>{down ? 'failed' : isParity ? 'parity' : 'data'}</span>
            </button>
          )
        })}
      </div>
      <div className={styles.actions}>
        <Button size="sm" onClick={() => setFailed(new Set())} disabled={failed.size === 0}>
          Repair all drives
        </Button>
      </div>
      <StatTiles
        stats={[
          { label: 'drives online', value: `${st.online} of ${drives}`, sub: `${failed.size} failed`, hue: failed.size ? HUE.error : HUE.ok, bar: { value: st.online, max: drives } },
          { label: 'reads', value: st.readable ? 'work' : 'fail', sub: `need ${q.read} drives (read quorum)`, hue: st.readable ? HUE.ok : HUE.error },
          { label: 'writes', value: st.writable ? 'work' : 'fail', sub: `need ${q.write} drives (write quorum)`, hue: st.writable ? HUE.ok : HUE.error },
          { label: 'usable space', value: `${Math.round(st.usable * 100)} %`, sub: `${(drives * driveTB * st.usable).toFixed(0)} of ${drives * driveTB} TB raw · ${st.overhead.toFixed(2)}× stored`, hue: HUE.disk },
        ]}
      />
      <Proportion
        title={`Each object: ${data} data + ${parity} parity shards`}
        parts={[
          { label: 'data shards', value: data, hue: HUE.data, display: `${data}` },
          { label: 'parity shards', value: parity, hue: HUE.network, display: `${parity}` },
        ]}
      />
    </Demo>
  )
}
