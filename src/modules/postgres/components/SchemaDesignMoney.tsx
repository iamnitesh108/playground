import { useMemo, useState } from 'react'
import { StatTiles } from '@/shared/figures'
import { Demo } from '@/shared/ui'
import { addTenCents } from '../simulation/schemaDesignMoney'
import styles from './SchemaDesignFigures.module.css'

const STOPS = [1, 3, 10, 30, 100, 300, 1000, 3000, 10_000, 30_000, 100_000, 300_000, 1_000_000]

/** Add 0.10 n times in float8 and in numeric; the recorded server sums are marked. */
export function SchemaDesignMoney({ recorded }: { recorded: readonly { n: number; float8: string; numeric: string }[] }) {
  const [k, setK] = useState(6)
  const n = STOPS[k]
  const sum = useMemo(() => addTenCents(n), [n])
  const rec = recorded.find((r) => r.n === n)
  return (
    <Demo
      title="Add ten cents, again and again"
      hint="sum() over n rows of 0.10, computed with the same IEEE 754 doubles PostgreSQL uses for float8, and in exact decimal like numeric."
      controls={
        <label className={styles.slider}>
          <span>rows</span>
          <input type="range" min={0} max={STOPS.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="number of rows" />
          <strong>{n.toLocaleString('en')}</strong>
        </label>
      }
    >
      <StatTiles
        stats={[
          { label: 'float8 sum', value: sum.float8, sub: sum.error === 0 ? 'prints as exact — for now' : `off by ${sum.error.toExponential(2)}`, hue: sum.error === 0 ? 6 : 8 },
          { label: 'numeric sum', value: sum.numeric, sub: 'always exact', hue: 6 },
        ]}
      />
      <p className={styles.note}>
        {rec
          ? `Recorded: PostgreSQL returned ${rec.float8} and ${rec.numeric} for SELECT sum(0.1::float8), sum(0.1::numeric) FROM generate_series(1, ${n.toLocaleString('en')}) — the same as here.`
          : 'Recorded on the server at 10, 100, 1,000, 10,000, 100,000 and 1,000,000 rows; those points match this calculation exactly.'}
      </p>
    </Demo>
  )
}
