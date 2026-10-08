import type { CSSProperties, ReactNode } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Diagram.module.css'

/**
 * Small composable pieces for box-and-arrow diagrams. Lessons arrange them
 * with Row/Column and toggle `active` to animate a flow step by step.
 */

interface BoxProps {
  title: ReactNode
  caption?: ReactNode
  active?: boolean
  dimmed?: boolean
  tone?: number
  children?: ReactNode
  className?: string
}

export function Box({ title, caption, active, dimmed, tone, children, className }: BoxProps) {
  const style = tone === undefined ? undefined : ({ '--box-tone': `var(--tone-${tone % 6})` } as CSSProperties)
  return (
    <div
      className={cx(styles.box, active && styles.active, dimmed && styles.dimmed, tone !== undefined && styles.toned, className)}
      style={style}
    >
      <div className={styles.boxTitle}>{title}</div>
      {caption && <div className={styles.boxCaption}>{caption}</div>}
      {children && <div className={styles.boxBody}>{children}</div>}
    </div>
  )
}

interface ConnectorProps {
  active?: boolean
  label?: ReactNode
  direction?: 'right' | 'down' | 'left' | 'up'
  /** Draws a dashed line, for asynchronous or optional links. */
  dashed?: boolean
}

export function Connector({ active, label, direction = 'right', dashed }: ConnectorProps) {
  return (
    <div className={cx(styles.connector, styles[direction], active && styles.flowing, dashed && styles.dashed)}>
      <div className={styles.line}>
        <span className={styles.packet} />
      </div>
      {label && <div className={styles.connectorLabel}>{label}</div>}
    </div>
  )
}

interface StackProps {
  children: ReactNode
  gap?: number
  align?: 'start' | 'center' | 'stretch'
  wrap?: boolean
}

export function Row({ children, gap = 0, align = 'center', wrap }: StackProps) {
  return (
    <div className={cx(styles.row, wrap && styles.wrap)} style={{ gap, alignItems: align }}>
      {children}
    </div>
  )
}

export function Column({ children, gap = 8, align = 'stretch' }: StackProps) {
  return (
    <div className={styles.column} style={{ gap, alignItems: align }}>
      {children}
    </div>
  )
}
