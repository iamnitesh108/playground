import type { ReactNode } from 'react'
import styles from './Table.module.css'

interface TableProps {
  head: readonly ReactNode[]
  rows: readonly (readonly ReactNode[])[]
}

export function Table({ head, rows }: TableProps) {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {head.map((cell, i) => (
              <th key={i}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
