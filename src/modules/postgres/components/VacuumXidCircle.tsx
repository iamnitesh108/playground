import { useState } from 'react'
import { Button, Demo } from '@/shared/ui'
import { ageZone, STOP_REMAINING, WARN_REMAINING, XID_HORIZON, XID_SPACE, type AgeZone } from '../simulation/vacuumThresholds'
import { StorageSlider } from './StorageSlider'
import styles from './VacuumFigures.module.css'

const R = 100
const C = 130
/** Point on the circle; 0° is the current xid at the top, negative angles are older xids. */
const at = (deg: number, r = R) => {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) }
}
const arc = (from: number, to: number, r = R) => {
  const a = at(from, r), b = at(to, r)
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M${a.x},${a.y} A${r},${r} 0 ${large} ${to > from ? 1 : 0} ${b.x},${b.y}`
}
const deg = (xids: number) => (xids / XID_SPACE) * 360

const ZONES: Record<AgeZone, { hue: number; text: string }> = {
  normal: { hue: 6, text: 'Normal. Regular (auto)vacuums freeze old rows as they go.' },
  aggressive: { hue: 4, text: 'Older than autovacuum_freeze_max_age: autovacuum now runs an anti-wraparound vacuum on the table, even if autovacuum is off for it, and it cannot be skipped.' },
  warning: { hue: 8, text: 'Fewer than 40 million xids left: every transaction logs WARNING: database must be vacuumed within … transactions.' },
  stopped: { hue: 8, text: 'Fewer than 3 million left: the server refuses to assign new xids — no writes at all — until the database is vacuumed.' },
}
const SLIDER_MAX = XID_HORIZON - 1_000_000
// a slider in "millions", with fine steps at the start where the recorded value lives
const fmt = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)} billion` : n >= 1e6 ? `${(n / 1e6).toFixed(1)} million` : n.toLocaleString())

/** The 32-bit xid space as a circle: half of it is the past, half the future. */
export function VacuumXidCircle({ recordedAge, freezeMaxAge }: { recordedAge: number; freezeMaxAge: number }) {
  const [age, setAge] = useState(recordedAge)
  const zone = ageZone(age, freezeMaxAge)
  const oldest = at(-deg(age))
  return (
    <Demo
      title="How old may the oldest unfrozen xid be?"
      hint="Drag the age of the oldest unfrozen transaction id in a database — age(datfrozenxid). Comparisons are modulo 2³², so only the 2³¹ xids behind the current one count as the past."
      controls={
        <>
          <StorageSlider label="age(datfrozenxid)" value={age} min={0} max={SLIDER_MAX} step={1_000_000} format={fmt} onChange={setAge} />
          <Button size="sm" onClick={() => setAge(recordedAge)}>Recorded: {recordedAge.toLocaleString()}</Button>
          <Button size="sm" onClick={() => setAge(freezeMaxAge + 30_000_000)}>Past freeze_max_age</Button>
          <Button size="sm" onClick={() => setAge(XID_HORIZON - 2_000_000)}>2 million left</Button>
        </>
      }
    >
      <div className={styles.circleWrap}>
        <svg viewBox="0 0 260 260" className={styles.circle} role="img" aria-label={`xid circle, oldest unfrozen xid ${fmt(age)} old: ${zone}`}>
          {/* the future half */}
          <path d={arc(0, 180)} className={styles.future} />
          {/* the past half, zones by how far back */}
          <path d={arc(-180, -deg(XID_HORIZON - WARN_REMAINING))} className={styles.danger} />
          <path d={arc(-deg(freezeMaxAge), 0)} className={styles.safe} />
          <path d={arc(-deg(XID_HORIZON - WARN_REMAINING), -deg(freezeMaxAge))} className={styles.aggr} />
          {/* unfrozen xids still on disk */}
          {age > 0 && <path d={arc(-deg(age), 0, R - 16)} className={styles.inUse} style={{ stroke: `var(--c${ZONES[zone].hue})` }} />}
          <circle cx={at(0).x} cy={at(0).y} r={6} className={styles.now} />
          <circle cx={oldest.x} cy={oldest.y} r={5} className={styles.oldest} style={{ fill: `var(--c${ZONES[zone].hue})` }} />
          <text x={C} y={18} className={styles.svgLabel}>current xid</text>
          <text x={C + 62} y={C + 4} className={styles.svgLabel}>future</text>
          <text x={C - 62} y={C + 4} className={styles.svgLabel}>past</text>
          <text x={C} y={C - 6} className={styles.svgBig}>{fmt(age)}</text>
          <text x={C} y={C + 12} className={styles.svgSmall}>xids old</text>
          <text x={C} y={254} className={styles.svgSmall}>2³¹ back = 2³¹ ahead</text>
        </svg>
        <ul className={styles.circleLegend}>
          <li><span className={styles.sw} data-k="safe" /> 0 – {fmt(freezeMaxAge)}: normal</li>
          <li><span className={styles.sw} data-k="aggr" /> past autovacuum_freeze_max_age: forced vacuum</li>
          <li><span className={styles.sw} data-k="danger" /> last {fmt(WARN_REMAINING)}: warnings; last {fmt(STOP_REMAINING)}: writes stop</li>
          <li><span className={styles.sw} data-k="future" /> the other half: xids that look newer than now</li>
        </ul>
      </div>
      <p className={styles.verdict} style={{ borderColor: `var(--c${ZONES[zone].hue})` }}>{ZONES[zone].text}</p>
    </Demo>
  )
}
