/*
 * How React reconciles a keyed list (reconcileChildrenArray), reduced to keys:
 *  1. Walk old and new lists side by side while the keys match: keep in place.
 *  2. Put the remaining old children in a map by key.
 *  3. For each remaining new child: reuse the old one with the same key, or create one.
 *     A reused child whose old index is below `lastPlacedIndex` must move;
 *     otherwise it stays and `lastPlacedIndex` becomes its old index.
 *  4. Old children left in the map are deleted.
 * Commit: deletions first, then placements in order. A placed node is inserted
 * before its next sibling that is not itself being placed, or appended.
 * Tested against the DOM operations real React performed.
 */

export type Decision = 'keep' | 'move' | 'insert' | 'delete'

export interface Step {
  key: string
  decision: Decision
  oldIndex: number | null
  newIndex: number | null
  /** lastPlacedIndex after this step. */
  lastPlacedIndex: number
  why: string
}

export interface Reconciliation {
  steps: Step[]
  /** DOM operations, in commit order, in the same words as the recordings. */
  ops: string[]
}

export function reconcile(from: readonly string[], to: readonly string[]): Reconciliation {
  const steps: Step[] = []
  let lastPlacedIndex = 0
  let i = 0

  // 1. Same keys at the same positions.
  for (; i < from.length && i < to.length && from[i] === to[i]; i++) {
    lastPlacedIndex = i
    steps.push({ key: to[i], decision: 'keep', oldIndex: i, newIndex: i, lastPlacedIndex, why: `same key at position ${i}: update in place` })
  }

  // 2. Remaining old children by key.
  const remaining = new Map(from.slice(i).map((key, k) => [key, i + k]))

  // 3. Remaining new children.
  const placed = new Set<number>()
  for (let n = i; n < to.length; n++) {
    const key = to[n]
    const oldIndex = remaining.get(key)
    if (oldIndex === undefined) {
      placed.add(n)
      steps.push({ key, decision: 'insert', oldIndex: null, newIndex: n, lastPlacedIndex, why: `key "${key}" is new: create it` })
      continue
    }
    remaining.delete(key)
    if (oldIndex < lastPlacedIndex) {
      placed.add(n)
      steps.push({ key, decision: 'move', oldIndex, newIndex: n, lastPlacedIndex, why: `old index ${oldIndex} < lastPlacedIndex ${lastPlacedIndex}: it must move` })
    } else {
      lastPlacedIndex = oldIndex
      steps.push({ key, decision: 'keep', oldIndex, newIndex: n, lastPlacedIndex, why: `old index ${oldIndex} ≥ lastPlacedIndex: stays; lastPlacedIndex = ${oldIndex}` })
    }
  }

  // 4. Leftovers are deleted.
  const deleted = [...remaining.keys()]
  for (const key of deleted) {
    steps.push({ key, decision: 'delete', oldIndex: remaining.get(key)!, newIndex: null, lastPlacedIndex, why: `key "${key}" is gone: delete it` })
  }

  // Commit: deletions, then placements with their host sibling.
  const ops = deleted.map((key) => `remove ${key}`)
  for (let n = 0; n < to.length; n++) {
    if (!placed.has(n)) continue
    let sibling: string | null = null
    for (let s = n + 1; s < to.length; s++) {
      if (!placed.has(s)) {
        sibling = to[s]
        break
      }
    }
    const verb = steps.find((s) => s.newIndex === n)!.decision === 'insert' ? 'insert' : 'move'
    ops.push(sibling === null ? `${verb} ${to[n]} at end` : `${verb} ${to[n]} before ${sibling}`)
  }
  return { steps, ops }
}
