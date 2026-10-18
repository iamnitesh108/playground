import { seeded } from './random'

/*
 * The skiplist half of a sorted set (the other half is a hash table member → score).
 * Nodes are ordered by score, then by member; each node gets a random height
 * (each extra level with probability 1/4), so searches skip ahead on high levels.
 */

export interface SkipNode {
  member: string
  score: number
  /** forward[i] = index (in `nodes`) of the next node on level i, or -1. */
  height: number
}

export interface SearchStep {
  level: number
  node: number
}

const less = (a: SkipNode, score: number, member: string) => a.score < score || (a.score === score && a.member < member)
const lessOrEqual = (a: SkipNode, score: number, member: string) => less(a, score, member) || (a.score === score && a.member === member)

export class Skiplist {
  /** Nodes in order. The header is not stored; level i links are derived from heights. */
  nodes: SkipNode[] = []
  private readonly random: () => number
  readonly maxLevel: number

  constructor(seed = 7, maxLevel = 8) {
    this.random = seeded(seed)
    this.maxLevel = maxLevel
  }

  private randomHeight(): number {
    let h = 1
    while (h < this.maxLevel && this.random() < 0.25) h++
    return h
  }

  get levels(): number {
    return Math.max(1, ...this.nodes.map((n) => n.height))
  }

  /** Next node index after `from` (-1 = header) that reaches `level`. */
  next(from: number, level: number): number {
    for (let i = from + 1; i < this.nodes.length; i++) if (this.nodes[i].height > level) return i
    return -1
  }

  /**
   * The search path for (score, member), as in Redis's rank lookup: move right while the next node is
   * not past the target, drop a level otherwise, and stop as soon as the target node is reached.
   * Includes the node passed through on each lower level when dropping (for drawing).
   */
  path(score: number, member: string): SearchStep[] {
    const steps: SearchStep[] = []
    let at = -1
    for (let level = this.levels - 1; level >= 0; level--) {
      if (at >= 0) steps.push({ level, node: at })
      for (;;) {
        const n = this.next(at, level)
        if (n < 0 || !lessOrEqual(this.nodes[n], score, member)) break
        at = n
        steps.push({ level, node: at })
        if (this.nodes[at].score === score && this.nodes[at].member === member) return steps
      }
    }
    return steps
  }

  add(member: string, score: number): number {
    const existing = this.nodes.findIndex((n) => n.member === member)
    if (existing >= 0) this.nodes.splice(existing, 1)
    let i = 0
    while (i < this.nodes.length && less(this.nodes[i], score, member)) i++
    this.nodes.splice(i, 0, { member, score, height: this.randomHeight() })
    return i
  }

  rank(member: string): number {
    return this.nodes.findIndex((n) => n.member === member)
  }

  /** Distinct nodes visited by a search: about log4(n) levels with a few nodes each, instead of n. */
  comparisons(score: number, member: string): number {
    return new Set(this.path(score, member).map((s) => s.node)).size
  }
}
