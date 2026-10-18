import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './RunTopologies.module.css'

interface Topology {
  name: string
  short: string
  nodes: number
  drives: number
  survives: string
}

const TOPOLOGIES: Topology[] = [
  { name: 'Single node, single drive', short: 'SNSD', nodes: 1, drives: 1, survives: 'nothing: one broken disk loses the data' },
  { name: 'Single node, several drives', short: 'SNMD', nodes: 1, drives: 4, survives: 'broken drives (with 4 drives: up to 2), not a broken server' },
  { name: 'Several nodes, several drives', short: 'MNMD', nodes: 4, drives: 4, survives: 'broken drives and whole servers, up to the parity count' },
]

/** The three ways to lay out a RustFS deployment, drawn as servers holding drives (schematic). */
export function RunTopologies() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Three layouts (schematic): servers hold drives, objects are spread over drives</figcaption>
      <div className={styles.grid}>
        {TOPOLOGIES.map((t) => (
          <section key={t.short} className={styles.card}>
            <h4>
              {t.name} <span>({t.short})</span>
            </h4>
            <div className={styles.servers}>
              {Array.from({ length: t.nodes }, (_, n) => (
                <div key={n} className={styles.server} style={hue(HUE.server)}>
                  <span className={styles.label}>server {n + 1} · {t.nodes > 1 ? 1 : t.drives} drive{t.nodes > 1 || t.drives === 1 ? '' : 's'}</span>
                  <div className={styles.drives}>
                    {Array.from({ length: t.nodes > 1 ? 1 : t.drives }, (_, d) => (
                      <span key={d} className={styles.drive} style={hue(HUE.disk)} title="drive" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p>
              <strong>Survives:</strong> {t.survives}
            </p>
          </section>
        ))}
      </div>
    </figure>
  )
}
