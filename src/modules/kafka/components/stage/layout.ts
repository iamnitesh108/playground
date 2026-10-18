import type { KafkaCluster } from '../../simulation'

/*
 * Geometry of the animated stage, computed from the model alone, so the renderer
 * and the animations always agree on where a partition, a cell or a consumer is.
 */

export const STAGE_WIDTH = 760
export const VISIBLE_CELLS = 10
const CELL = 24
const CELL_GAP = 3
const ROW = 58
const TOPIC_X = 150
const TAPE_X = 196
const TOPIC_RIGHT = 474
const GROUP_X = 532
const GROUP_W = 212
const CONSUMER_ROW = 32
const GROUP_HEAD = 26
const GROUP_GAP = 14
const TOP = 34

export interface Point {
  x: number
  y: number
}

export interface StageLayout {
  height: number
  producer: Point & { w: number; h: number }
  topic: { x: number; y: number; w: number; h: number }
  partitionY: (partition: number) => number
  /** First offset shown in a partition's tape (older ones scroll out on the left). */
  windowStart: (partition: number) => number
  cellX: (partition: number, offset: number) => number
  cellWidth: number
  tapeEnd: number
  groups: { id: string; x: number; y: number; w: number; h: number; consumers: { id: string; x: number; y: number }[] }[]
  consumer: (memberId: string) => Point | undefined
}

export function layoutOf(cluster: KafkaCluster): StageLayout {
  const partitions = cluster.topic.partitionCount
  const topicH = 30 + partitions * ROW
  let y = TOP
  const groups = cluster.groups.map((g) => {
    const h = GROUP_HEAD + Math.max(1, g.members.length) * CONSUMER_ROW + 8
    const box = {
      id: g.id,
      x: GROUP_X,
      y,
      w: GROUP_W,
      h,
      consumers: g.members.map((m, i) => ({ id: m.id, x: GROUP_X + 12, y: y + GROUP_HEAD + i * CONSUMER_ROW + CONSUMER_ROW / 2 })),
    }
    y += h + GROUP_GAP
    return box
  })
  const height = Math.max(TOP + topicH + 16, y + 4, 170)
  const partitionY = (p: number) => TOP + 30 + p * ROW + ROW / 2 - 6
  const windowStart = (p: number) => Math.max(0, cluster.topic.endOffset(p) - VISIBLE_CELLS)
  return {
    height,
    producer: { x: 16, y: TOP + topicH / 2 - 22, w: 100, h: 44 },
    topic: { x: TOPIC_X, y: TOP, w: TOPIC_RIGHT - TOPIC_X, h: topicH },
    partitionY,
    windowStart,
    cellX: (p, offset) => TAPE_X + (offset - windowStart(p)) * (CELL + CELL_GAP),
    cellWidth: CELL,
    tapeEnd: TOPIC_RIGHT,
    groups,
    consumer: (memberId) => {
      for (const g of groups) {
        const c = g.consumers.find((x) => x.id === memberId)
        if (c) return { x: c.x, y: c.y }
      }
      return undefined
    },
  }
}
