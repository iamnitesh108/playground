import { useId, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'
import { cx } from '@/shared/utils/cx'
import { Button } from '../ui/Button'
import { hue, type Hue } from './palette'
import styles from './Flow.module.css'

/*
 * A flow diagram built from data: nodes on a grid, edges between them, records
 * travelling along the edges. Optional steps light up part of the flow at a time.
 */

export type NodeShape = 'box' | 'store' | 'log' | 'actor' | 'queue'

export interface FlowNode {
  id: string
  label: string
  sub?: string
  /** Grid cell (0-based). A node may span several columns or rows. */
  col: number
  row: number
  span?: number
  rowSpan?: number
  hue?: Hue
  shape?: NodeShape
}

export interface FlowEdge {
  from: string
  to: string
  label?: string
  hue?: Hue
  /** Animate records moving along the edge. */
  flow?: boolean
  dashed?: boolean
  /** Draw the edge both ways (e.g. request/response). */
  both?: boolean
}

export interface FlowStep {
  title: string
  body: ReactNode
  /** Node ids and edge ids ("from>to") that are active in this step. */
  active: readonly string[]
}

interface FlowProps {
  title?: string
  nodes: readonly FlowNode[]
  edges: readonly FlowEdge[]
  cols: number
  rows: number
  steps?: readonly FlowStep[]
  /** Width of the drawing in px (it scales down on small screens). */
  width?: number
  rowHeight?: number
  caption?: ReactNode
}

const PAD = 14

export function Flow({ title, nodes, edges, cols, rows, steps, width = 760, rowHeight = 84, caption }: FlowProps) {
  const uid = useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const colW = (width - PAD * 2) / cols
  const height = rows * rowHeight + PAD * 2
  const box = (n: FlowNode) => {
    // generous gaps between cells leave room for arrows, labels and moving records
    const w = colW * (n.span ?? 1) - 46
    const h = rowHeight * (n.rowSpan ?? 1) - 30
    return { x: PAD + n.col * colW + 23, y: PAD + n.row * rowHeight + 15, w, h }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const active = steps ? new Set(steps[step].active) : null
  const isOn = (id: string) => !active || active.has(id)

  /** Edge from the side of one box to the facing side of the other, and where its label goes. */
  const route = (e: FlowEdge): { d: string; label: { x: number; y: number } } => {
    const a = box(byId.get(e.from)!), b = box(byId.get(e.to)!)
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
    const dx = bc.x - ac.x, dy = bc.y - ac.y
    if (Math.abs(dx) * rowHeight >= Math.abs(dy) * colW * 0.6) {
      const sx = dx > 0 ? a.x + a.w : a.x, ex = dx > 0 ? b.x : b.x + b.w
      const mx = (sx + ex) / 2
      // labels sit above a horizontal edge, never on top of it
      return { d: `M${sx},${ac.y} C${mx},${ac.y} ${mx},${bc.y} ${ex},${bc.y}`, label: { x: mx, y: (ac.y + bc.y) / 2 - (Math.abs(ac.y - bc.y) < 4 ? 13 : 0) } }
    }
    const sy = dy > 0 ? a.y + a.h : a.y, ey = dy > 0 ? b.y : b.y + b.h
    const my = (sy + ey) / 2
    return { d: `M${ac.x},${sy} C${ac.x},${my} ${bc.x},${my} ${bc.x},${ey}`, label: { x: (ac.x + bc.x) / 2, y: my } }
  }

  const boxes = nodes.map(box)
  /** Where an edge label fits without covering a box: on the edge, beside it, or in the gap between rows. */
  const placeLabel = (mid: { x: number; y: number }, text: string) => {
    const w = text.length * 6 + 10
    const clear = (p: { x: number; y: number }) =>
      boxes.every((b) => p.x + w / 2 < b.x - 2 || p.x - w / 2 > b.x + b.w + 2 || p.y + 8 < b.y - 2 || p.y - 8 > b.y + b.h + 2)
    // after the edge itself: the free band between rows, just above or below it (rows are rowHeight apart, boxes inset 15px)
    const row = Math.floor((mid.y - PAD) / rowHeight)
    const above = { x: mid.x, y: PAD + row * rowHeight }
    const below = { x: mid.x, y: PAD + (row + 1) * rowHeight }
    return [mid, { x: mid.x, y: mid.y - 14 }, { x: mid.x, y: mid.y + 14 }, above, below].find(clear)
  }

  const current = steps?.[step]
  return (
    <figure className={styles.figure}>
      {title && <figcaption className={styles.title}>{title}</figcaption>}
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.svg} role="img" aria-label={title ?? 'flow diagram'}>
        <defs>
          <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        {edges.map((e) => {
          const id = `${e.from}>${e.to}`
          const { d, label: mid } = route(e)
          // a label that cannot fit between the boxes becomes a tooltip on the edge instead
          const at = e.label ? placeLabel(mid, e.label) : undefined
          if (e.label && !at && import.meta.env.DEV) console.warn(`Flow: edge label "${e.label}" does not fit; shown as a tooltip`)
          const on = isOn(id)
          const pid = `${uid}-${id.replace(/[^a-z0-9]/gi, '_')}`
          return (
            <g key={id} className={cx(styles.edge, !on && styles.dim)} style={hue(e.hue)}>
              <path id={pid} d={d} className={cx(styles.edgeLine, e.dashed && styles.dashed)} markerEnd={`url(#${uid}-arrow)`} markerStart={e.both ? `url(#${uid}-arrow)` : undefined}>
                {e.label && !at && <title>{e.label}</title>}
              </path>
              {e.label && at && (
                <g transform={`translate(${at.x} ${at.y})`}>
                  <rect x={-e.label.length * 3 - 5} y={-8} width={e.label.length * 6 + 10} height={16} rx={8} className={styles.edgeLabelBg} />
                  <text className={styles.edgeLabel} y={4}>{e.label}</text>
                </g>
              )}
              {e.flow && on && !reduced &&
                [0, 1, 2].map((k) => (
                  <circle key={k} r={4.5} className={styles.packet}>
                    <animateMotion dur="2.4s" begin={`${k * 0.8}s`} repeatCount="indefinite" rotate="auto">
                      <mpath href={`#${pid}`} />
                    </animateMotion>
                  </circle>
                ))}
            </g>
          )
        })}
        {nodes.map((n) => {
          const b = box(n)
          const on = isOn(n.id)
          const shape = n.shape ?? 'box'
          // a cylinder's top rim takes the first 16px, so its text sits lower
          const labelDrop = shape === 'store' ? 7 : 0
          return (
            <g key={n.id} className={cx(styles.node, !on && styles.dim, active && on && styles.lit)} style={hue(n.hue)}>
              {shape === 'store' ? (
                <>
                  <path d={`M${b.x},${b.y + 8} v${b.h - 16} a${b.w / 2},8 0 0 0 ${b.w},0 v-${b.h - 16}`} className={styles.shape} />
                  <ellipse cx={b.x + b.w / 2} cy={b.y + 8} rx={b.w / 2} ry={8} className={styles.shape} />
                </>
              ) : shape === 'actor' ? (
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={b.h / 2} className={styles.shape} />
              ) : shape === 'log' ? (
                <>
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} className={styles.shape} />
                  {Array.from({ length: Math.max(3, Math.floor(b.w / 22)) }, (_, i) => (
                    <line key={i} x1={b.x + (i + 1) * (b.w / (Math.max(3, Math.floor(b.w / 22)) + 1))} x2={b.x + (i + 1) * (b.w / (Math.max(3, Math.floor(b.w / 22)) + 1))} y1={b.y + b.h - 7} y2={b.y + b.h - 2} className={styles.tick} />
                  ))}
                </>
              ) : shape === 'queue' ? (
                <>
                  <rect x={b.x + 6} y={b.y - 5} width={b.w} height={b.h} rx={8} className={styles.shapeBack} />
                  <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8} className={styles.shape} />
                </>
              ) : (
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={10} className={styles.shape} />
              )}
              <text x={b.x + b.w / 2} y={b.y + b.h / 2 + (n.sub ? -3 : 4) + labelDrop} className={styles.label}>{n.label}</text>
              {n.sub && <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 13 + labelDrop} className={styles.sub}>{n.sub}</text>}
            </g>
          )
        })}
      </svg>
      {steps && current && (
        <div className={styles.steps}>
          <div className={styles.stepText} aria-live="polite">
            <div className={styles.stepTitle}><span className={styles.counter}>{step + 1}/{steps.length}</span> {current.title}</div>
            <div className={styles.stepBody}>{current.body}</div>
          </div>
          <div className={styles.buttons}>
            <Button size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Button>
            <Button size="sm" variant="primary" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} disabled={step === steps.length - 1}>Next</Button>
          </div>
        </div>
      )}
      {caption && <div className={styles.caption}>{caption}</div>}
    </figure>
  )
}
