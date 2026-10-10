import type { Commit, Head } from '../simulation/graph'
import styles from './GraphView.module.css'

interface GraphViewProps {
  commits: ReadonlyMap<string, Commit>
  branches: ReadonlyMap<string, string>
  head: Head
  reachable: ReadonlySet<string>
}

const X = 78
const Y = 54
const R = 13

/** Commits left to right in creation order, one row per branch, with branch labels and HEAD. */
export function GraphView({ commits, branches, head, reachable }: GraphViewProps) {
  const list = [...commits.values()].sort((a, b) => a.seq - b.seq)
  const rows = Math.max(1, ...list.map((c) => c.lane + 1))
  const pos = (c: Commit) => ({ x: 40 + c.seq * X, y: 34 + c.lane * Y })
  const width = 80 + Math.max(1, list.length) * X
  const height = 40 + rows * Y + 24
  const labels = new Map<string, string[]>()
  for (const [name, id] of branches) labels.set(id, [...(labels.get(id) ?? []), name])
  const headId = head.kind === 'branch' ? branches.get(head.name) : head.id

  return (
    <div className={styles.scroll}>
      <svg className={styles.svg} width={width} height={height} role="img" aria-label="commit graph">
        {list.flatMap((c) =>
          c.parents.map((p) => {
            const a = pos(commits.get(p)!)
            const b = pos(c)
            const mid = (a.x + b.x) / 2
            return (
              <path
                key={`${p}-${c.id}`}
                d={a.y === b.y ? `M${a.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`}
                className={reachable.has(c.id) ? styles.edge : styles.edgeLost}
              />
            )
          }),
        )}
        {list.map((c) => {
          const { x, y } = pos(c)
          const names = labels.get(c.id) ?? []
          const isHead = c.id === headId
          return (
            <g key={c.id} className={reachable.has(c.id) ? styles.commit : styles.lost}>
              <circle cx={x} cy={y} r={R} className={c.parents.length > 1 ? styles.merge : undefined} />
              <text x={x} y={y + 4} textAnchor="middle" className={styles.id}>
                {c.id.slice(0, 4)}
              </text>
              <text x={x} y={y + R + 13} textAnchor="middle" className={styles.message}>
                {c.message.length > 14 ? `${c.message.slice(0, 13)}…` : c.message}
              </text>
              {names.map((n, i) => (
                <text key={n} x={x} y={y - R - 6 - i * 13} textAnchor="middle" className={styles.branch}>
                  {head.kind === 'branch' && head.name === n ? `HEAD → ${n}` : n}
                </text>
              ))}
              {isHead && head.kind === 'detached' && (
                <text x={x} y={y - R - 6 - names.length * 13} textAnchor="middle" className={styles.detached}>
                  HEAD (detached)
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
