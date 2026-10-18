import { useMemo, useState } from 'react'
import { Button, Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { Skiplist } from '../simulation/skiplist'
import styles from './SkiplistPlayground.module.css'

const PLAYERS = ['ann', 'bob', 'cai', 'dan', 'eve', 'fay', 'gus', 'hal', 'ida', 'jon', 'kim', 'lea', 'max', 'ned', 'ona', 'pia', 'quy', 'rae']

/** A skiplist growing as members are added, and the path a lookup takes. */
export function SkiplistPlayground() {
  const [n, setN] = useState(10)
  const [target, setTarget] = useState(6)
  const list = useMemo(() => {
    const s = new Skiplist(7, 5)
    PLAYERS.slice(0, n).forEach((p, i) => s.add(p, ((i * 37) % 50) * 100 + 1000))
    return s
  }, [n])
  const t = list.nodes[Math.min(target, list.nodes.length - 1)]
  const path = list.path(t.score, t.member)
  const visited = new Set(path.map((p) => `${p.level}:${p.node}`))
  const levels = list.levels
  return (
    <Demo
      title="A skiplist: ordered by score, with express lanes"
      hint="Each node is on level 1; one in four is also on level 2, one in sixteen on level 3… A lookup starts on the highest level and drops down when the next node would overshoot."
      controls={
        <>
          <Button size="sm" disabled={n >= PLAYERS.length} onClick={() => setN(n + 1)}>ZADD a member</Button>
          <Button size="sm" variant="ghost" onClick={() => setN(4)}>Reset</Button>
          <label className={styles.pick}>
            look up
            <select value={Math.min(target, list.nodes.length - 1)} onChange={(e) => setTarget(Number(e.target.value))}>
              {list.nodes.map((node, i) => <option key={node.member} value={i}>{node.member} ({node.score})</option>)}
            </select>
          </label>
        </>
      }
    >
      <div className={styles.grid} style={{ gridTemplateColumns: `56px repeat(${list.nodes.length}, minmax(44px, 1fr))` }}>
        {Array.from({ length: levels }, (_, r) => levels - 1 - r).map((level) => (
          <div key={level} className={styles.row} style={{ display: 'contents' }}>
            <span className={styles.levelLabel}>L{level + 1}</span>
            {list.nodes.map((node, i) => (
              <span key={node.member} className={cx(node.height > level ? styles.node : styles.gap, visited.has(`${level}:${i}`) && styles.visited, i === list.nodes.indexOf(t) && node.height > level && level === 0 && styles.target)}>
                {node.height > level ? (level === 0 ? <><b>{node.member}</b><small>{node.score}</small></> : '•') : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className={styles.caption}>
        {list.nodes.length} members · {levels} levels · finding <b>{t.member}</b> touched {path.length} nodes instead of {list.nodes.indexOf(t) + 1}.
      </p>
    </Demo>
  )
}
