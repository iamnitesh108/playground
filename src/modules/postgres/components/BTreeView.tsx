import { useLayoutEffect, useRef, useState } from 'react'
import { cx } from '@/shared/utils/cx'
import type { BTreeNode } from '../simulation/btree'
import styles from './BTreeView.module.css'

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
  hot: boolean
}

interface BTreeViewProps {
  levels: BTreeNode[][]
  /** Nodes on the current search/insert path. */
  path: ReadonlySet<number>
  /** The node the current step is about. */
  focus: number | null
  /** Key to highlight inside nodes. */
  highlightKey: number | null
}

/** Draws a B+-tree level by level, with parent–child lines measured from the layout. */
export function BTreeView({ levels, path, focus, highlightKey }: BTreeViewProps) {
  const wrap = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<number, HTMLDivElement>())
  const [lines, setLines] = useState<Line[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const box = wrap.current?.getBoundingClientRect()
    if (!box || !wrap.current) return
    const next: Line[] = []
    for (const level of levels) {
      for (const node of level) {
        const parent = refs.current.get(node.id)?.getBoundingClientRect()
        if (!parent) continue
        node.children.forEach((child, i) => {
          const c = refs.current.get(child.id)?.getBoundingClientRect()
          if (!c) return
          const slotX = parent.left + ((i + 0.5) / node.children.length) * parent.width
          next.push({
            x1: slotX - box.left + wrap.current!.scrollLeft,
            y1: parent.bottom - box.top,
            x2: c.left + c.width / 2 - box.left + wrap.current!.scrollLeft,
            y2: c.top - box.top,
            hot: path.has(node.id) && path.has(child.id),
          })
        })
      }
    }
    setLines(next)
    setSize({ w: wrap.current.scrollWidth, h: wrap.current.scrollHeight })
  }, [levels, path])

  return (
    <div ref={wrap} className={styles.tree}>
      <svg className={styles.svg} width={size.w} height={size.h} aria-hidden>
        {lines.map((l, i) => (
          <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className={cx(styles.line, l.hot && styles.hotLine)} />
        ))}
      </svg>
      {levels.map((level, depth) => (
        <div key={depth} className={styles.level}>
          <span className={styles.levelLabel}>{depth === 0 ? 'root' : level[0].leaf ? 'leaves' : 'inner'}</span>
          {level.map((node, i) => (
            <div key={node.id} className={styles.nodeWrap}>
              <div
                ref={(el) => {
                  if (el) refs.current.set(node.id, el)
                  else refs.current.delete(node.id)
                }}
                className={cx(styles.node, node.leaf && styles.leaf, path.has(node.id) && styles.onPath, focus === node.id && styles.focus)}
              >
                {node.keys.length === 0 && <span className={styles.empty}>empty</span>}
                {node.keys.map((k) => (
                  <span key={k} className={cx(styles.key, k === highlightKey && styles.keyHot)}>
                    {k}
                  </span>
                ))}
              </div>
              {node.leaf && i < level.length - 1 && <span className={styles.sibling}>→</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
