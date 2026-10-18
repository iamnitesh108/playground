import { useState } from 'react'
import { BarChart, StatTiles, Timeline } from '@/shared/figures'
import { Demo } from '@/shared/ui'
import { analyzeThreshold, DEFAULTS, vacuumThreshold } from '../simulation/vacuumThresholds'
import { StorageSlider } from './StorageSlider'

const pow = (e: number) => Math.round(10 ** e)
const short = (n: number) => (n >= 1e9 ? `${+(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(Math.round(n)))
const duration = (s: number) => (s < 120 ? `${s.toFixed(0)} s` : s < 7200 ? `${(s / 60).toFixed(0)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} days`)

/** When autovacuum vacuums a table, for its size, its settings and its write rate. */
export function VacuumAutovacuumCalc() {
  const [rowsExp, setRowsExp] = useState(7)
  const [scale, setScale] = useState(0.2)
  const [base, setBase] = useState(DEFAULTS.threshold)
  const [rateExp, setRateExp] = useState(2)
  const rows = pow(rowsExp)
  const rate = pow(rateExp)
  const mine = vacuumThreshold(rows, { ...DEFAULTS, scaleFactor: scale, threshold: base })
  const deflt = vacuumThreshold(rows)
  const every = Math.max(1, mine) / rate
  const HOUR = 3600
  const runs = Array.from({ length: Math.min(40, Math.floor(HOUR / every)) }, (_, i) => (i + 1) * every)
  return (
    <Demo
      title="When does autovacuum pick this table?"
      hint="Dead tuples come from UPDATEs and DELETEs. With the default scale factor a big table waits for millions of them; per-table settings (ALTER TABLE … SET (autovacuum_vacuum_scale_factor = 0.01)) make it vacuum sooner and in smaller bites."
      controls={
        <>
          <StorageSlider label="rows (reltuples)" value={rowsExp} min={3} max={9} step={0.25} format={(e) => short(pow(e))} onChange={setRowsExp} />
          <StorageSlider label="scale factor" value={scale} min={0} max={0.5} step={0.01} format={(v) => v.toFixed(2)} onChange={setScale} />
          <StorageSlider label="base threshold" value={base} min={0} max={10000} step={50} format={(v) => v.toLocaleString()} onChange={setBase} />
          <StorageSlider label="updates + deletes per second" value={rateExp} min={0} max={4} step={0.25} format={(e) => short(pow(e))} onChange={setRateExp} />
        </>
      }
    >
      <StatTiles
        stats={[
          { label: 'dead tuples that trigger a vacuum', value: short(mine), sub: `${base} + ${scale} × ${short(rows)}${mine === DEFAULTS.maxThreshold ? ' (capped at 100M)' : ''}`, hue: 8 },
          { label: 'dead share of the table at that point', value: `${((mine / (rows + mine)) * 100).toFixed(1)} %`, hue: 3 },
          { label: 'time between autovacuums', value: duration(every), sub: `at ${short(rate)} dead tuples/s`, hue: 4 },
          { label: 'ANALYZE every', value: duration(analyzeThreshold(rows) / rate), sub: '50 + 0.1 × rows changes', hue: 7 },
        ]}
      />
      <BarChart
        title="Dead tuples allowed before autovacuum"
        bars={[
          { label: 'defaults (50 + 0.2 × rows)', value: deflt, display: short(deflt), hue: 4 },
          { label: 'your setting', value: mine, display: short(mine), hue: 1 },
        ]}
      />
      <Timeline
        title={runs.length ? `Autovacuum runs in one hour (${runs.length}${runs.length === 40 ? '+' : ''})` : `No autovacuum within the hour: the next one is ${duration(every)} away`}
        lanes={[{ id: 'av', label: 'this table' }]}
        events={runs.map((t, i) => ({ lane: 'av', at: t / 60, label: i === 0 || runs.length < 6 ? 'vacuum' : '', hue: 4 }))}
        segments={[{ lane: 'av', from: 0, to: Math.min(60, every / 60), label: 'dead tuples pile up', hue: 8, striped: true }]}
        end={60}
        unit="min"
      />
    </Demo>
  )
}
