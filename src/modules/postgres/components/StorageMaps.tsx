import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Segmented } from '@/shared/ui'
import styles from './StorageMaps.module.css'

export interface PageMaps {
  page: number
  /** Free bytes as the free space map records them. */
  free: number
  all_visible: boolean
  all_frozen: boolean
  live: number
}

interface StorageMapsProps {
  title: string
  stages: readonly { label: string; note: string; pages: readonly PageMaps[] }[]
  /** Live rows a full page holds. */
  full: number
}

/** The pages of a table with what the free space map and the visibility map say about each. */
export function StorageMaps({ title, stages, full }: StorageMapsProps) {
  const [at, setAt] = useState(0)
  const stage = stages[at]
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.head}>
        <span className={styles.title}>{title}</span>
        <Segmented value={at} options={stages.map((s, i) => ({ value: i, label: s.label }))} onChange={setAt} />
      </figcaption>
      <p className={styles.note}>{stage.note}</p>
      <ol className={styles.pages}>
        {stage.pages.map((p) => (
          <li key={p.page} className={styles.page}>
            <span className={styles.label}>page {p.page}</span>
            <span className={styles.bar} title={`${p.live} live rows`}>
              <span className={styles.live} style={{ ...hue(3), height: `${(p.live / full) * 100}%` }} />
            </span>
            <span className={styles.rows}>{p.live} rows</span>
            <span className={styles.fsm} style={hue(4)} data-zero={p.free === 0 || undefined}>FSM {p.free.toLocaleString()} B</span>
            <span className={styles.flag} style={hue(6)} data-on={p.all_visible || undefined}>{p.all_visible ? 'all-visible' : 'not all-visible'}</span>
            <span className={styles.flag} style={hue(5)} data-on={p.all_frozen || undefined}>{p.all_frozen ? 'all-frozen' : 'not all-frozen'}</span>
          </li>
        ))}
      </ol>
    </figure>
  )
}
