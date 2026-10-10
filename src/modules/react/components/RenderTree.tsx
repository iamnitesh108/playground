import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { cx } from '@/shared/utils/cx'
import styles from './RenderTree.module.css'

export interface TreeNode {
  name: string
  note?: string
  children?: TreeNode[]
}

interface RenderTreeProps {
  tree: TreeNode
  /** The recorded render log: components that rendered, in order. */
  log: readonly string[]
}

/** "App (count 1)" in the log belongs to the node "App". */
const matches = (line: string, name: string) => line === name || line.startsWith(`${name} `)

function TreeItem({ node, rendered }: { node: TreeNode; rendered: readonly string[] }) {
  const hit = rendered.findIndex((l) => matches(l, node.name))
  return (
    <li>
      <span className={cx(styles.node, hit >= 0 && styles.rendered)} data-order={hit >= 0 ? hit + 1 : undefined}>
        {node.name}
        {node.note && <span className={styles.note}>{node.note}</span>}
      </span>
      {node.children && (
        <ul>
          {node.children.map((c) => (
            <TreeItem key={c.name} node={c} rendered={rendered} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * A component tree that lights up, in order, the components that rendered.
 * Give it a new `key` to replay from the start.
 */
export function RenderTree({ tree, log }: RenderTreeProps) {
  const [shown, setShown] = useState(0)
  useInterval(() => setShown((n) => n + 1), shown < log.length ? 420 : null)
  const rendered = log.slice(0, shown)
  return (
    <div className={styles.wrap}>
      <ul className={styles.tree}>
        <TreeItem node={tree} rendered={rendered} />
      </ul>
      <div className={styles.side}>
        <div className={styles.label}>render log (recorded)</div>
        {log.length === 0 && <div className={styles.empty}>nothing rendered</div>}
        <ol className={styles.log}>
          {log.map((line, i) => (
            <li key={i} className={cx(i < shown && styles.on)}>
              {line}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
