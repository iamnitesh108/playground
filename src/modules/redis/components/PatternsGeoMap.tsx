import styles from './PatternsGeoMap.module.css'

export interface GeoPlace {
  name: string
  lon: number
  lat: number
  /** Distance from the search point in km, when the search returned it. */
  dist?: number
}

interface PatternsGeoMapProps {
  title: string
  center: { lon: number; lat: number }
  radiusKm: number
  places: readonly GeoPlace[]
}

const SIZE = 360
const SPAN_KM = 11 // half the width of the map, in km
const LABEL_W = 190
const LABEL_GAP = 26

/** Places drawn at their real coordinates (equirectangular, fine at city scale), with the search radius. */
export function PatternsGeoMap({ title, center, radiusKm, places }: PatternsGeoMapProps) {
  const kmX = (lon: number) => (lon - center.lon) * Math.cos((center.lat * Math.PI) / 180) * 111.32
  const kmY = (lat: number) => (lat - center.lat) * 110.57
  const px = (km: number) => SIZE / 2 + (km / SPAN_KM) * (SIZE / 2)
  const py = (km: number) => SIZE / 2 - (km / SPAN_KM) * (SIZE / 2)
  const r = (radiusKm / SPAN_KM) * (SIZE / 2)
  // Labels sit in a column beside the map, joined by leader lines, so nearby points never collide.
  const marks = [
    { name: 'search point', x: SIZE / 2, y: SIZE / 2, className: undefined, origin: true, text: 'search point' },
    ...places.map((p) => ({
      name: p.name,
      x: px(kmX(p.lon)),
      y: py(kmY(p.lat)),
      className: p.dist !== undefined ? styles.inside : styles.outside,
      origin: false,
      text: `${p.name}${p.dist !== undefined ? ` · ${p.dist} km` : ' · outside'}`,
    })),
  ].sort((a, b) => a.y - b.y)
  const labelTop = SIZE / 2 - ((marks.length - 1) * LABEL_GAP) / 2
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <svg viewBox={`0 0 ${SIZE + LABEL_W} ${SIZE}`} className={styles.svg} role="img" aria-label={title}>
        {[-10, -5, 0, 5, 10].map((k) => (
          <g key={k}>
            <line x1={px(k)} x2={px(k)} y1={0} y2={SIZE} className={styles.grid} />
            <line y1={py(k)} y2={py(k)} x1={0} x2={SIZE} className={styles.grid} />
          </g>
        ))}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={r} className={styles.radius} />
        <text x={SIZE / 2} y={SIZE / 2 - r - 6} className={styles.radiusLabel}>BYRADIUS {radiusKm} km</text>
        <line x1={px(-10)} x2={px(-5)} y1={SIZE - 14} y2={SIZE - 14} className={styles.scale} />
        <text x={px(-7.5)} y={SIZE - 20} className={styles.scaleLabel}>5 km</text>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={6} className={styles.center} />
        {marks.map((m, i) => {
          const ly = labelTop + i * LABEL_GAP
          return (
            <g key={m.name} className={m.className}>
              <polyline points={`${m.x},${m.y} ${SIZE + 8},${ly} ${SIZE + 18},${ly}`} className={styles.leader} />
              {!m.origin && <circle cx={m.x} cy={m.y} r={6} />}
              <text x={SIZE + 22} y={ly + 4} className={styles.label}>{m.text}</text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
