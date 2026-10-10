/**
 * A B+-tree as used for PostgreSQL indexes, reduced to what can be drawn:
 * keys live in leaves (each pointing to a heap tuple), internal nodes hold
 * separator keys, leaves are linked left to right.
 * Simplified: no high keys or right-links (Lehman–Yao), no deletion.
 */
export interface BTreeNode {
  id: number
  leaf: boolean
  keys: number[]
  children: BTreeNode[]
}

export type BTreeEvent =
  | { kind: 'visit'; node: number; text: string }
  | { kind: 'insert'; node: number; text: string }
  | { kind: 'split'; node: number; created: number; text: string }
  | { kind: 'root'; node: number; text: string }
  | { kind: 'found'; node: number; text: string }
  | { kind: 'missing'; node: number; text: string }

interface SplitResult {
  separator: number
  right: BTreeNode
}

export class BTree {
  readonly maxKeys: number
  root: BTreeNode
  private nextId = 1

  constructor(maxKeys: number) {
    this.maxKeys = maxKeys
    this.root = this.node(true)
  }

  private node(leaf: boolean): BTreeNode {
    return { id: this.nextId++, leaf, keys: [], children: [] }
  }

  /** Index of the child to follow for `key`: the first separator greater than key. */
  private childIndex(node: BTreeNode, key: number): number {
    let i = 0
    while (i < node.keys.length && key >= node.keys[i]) i++
    return i
  }

  search(key: number): BTreeEvent[] {
    const events: BTreeEvent[] = []
    let node = this.root
    while (!node.leaf) {
      const i = this.childIndex(node, key)
      events.push({ kind: 'visit', node: node.id, text: `Inner page [${node.keys.join(', ')}]: ${key} goes to child ${i + 1}.` })
      node = node.children[i]
    }
    const found = node.keys.includes(key)
    events.push(
      found
        ? { kind: 'found', node: node.id, text: `Leaf page [${node.keys.join(', ')}] contains ${key} → its entry points to the heap tuple.` }
        : { kind: 'missing', node: node.id, text: `Leaf page [${node.keys.join(', ')}] has no ${key}: not in the index.` },
    )
    return events
  }

  insert(key: number): BTreeEvent[] {
    const events: BTreeEvent[] = []
    const split = this.insertInto(this.root, key, events)
    if (split) {
      const root = this.node(false)
      root.keys = [split.separator]
      root.children = [this.root, split.right]
      this.root = root
      events.push({ kind: 'root', node: root.id, text: `The root itself split, so a new root [${split.separator}] is created: the tree is one level taller.` })
    }
    return events
  }

  private insertInto(node: BTreeNode, key: number, events: BTreeEvent[]): SplitResult | null {
    if (node.leaf) {
      if (node.keys.includes(key)) {
        events.push({ kind: 'found', node: node.id, text: `${key} is already in leaf [${node.keys.join(', ')}] — a unique index rejects it.` })
        return null
      }
      node.keys.push(key)
      node.keys.sort((a, b) => a - b)
      events.push({ kind: 'insert', node: node.id, text: `Insert ${key} into the leaf, keeping keys sorted: [${node.keys.join(', ')}].` })
      if (node.keys.length <= this.maxKeys) return null
      const right = this.node(true)
      const mid = Math.ceil(node.keys.length / 2)
      right.keys = node.keys.splice(mid)
      events.push({
        kind: 'split',
        node: node.id,
        created: right.id,
        text: `The leaf is over capacity (${this.maxKeys} keys): split into [${node.keys.join(', ')}] and [${right.keys.join(', ')}]; ${right.keys[0]} is copied up as separator.`,
      })
      return { separator: right.keys[0], right }
    }

    const i = this.childIndex(node, key)
    events.push({ kind: 'visit', node: node.id, text: `Inner page [${node.keys.join(', ')}]: ${key} goes to child ${i + 1}.` })
    const split = this.insertInto(node.children[i], key, events)
    if (!split) return null

    node.keys.splice(i, 0, split.separator)
    node.children.splice(i + 1, 0, split.right)
    events.push({ kind: 'insert', node: node.id, text: `Separator ${split.separator} added to the parent: [${node.keys.join(', ')}].` })
    if (node.keys.length <= this.maxKeys) return null

    const right = this.node(false)
    const mid = Math.floor(node.keys.length / 2)
    const separator = node.keys[mid]
    right.keys = node.keys.splice(mid + 1)
    node.keys.splice(mid, 1)
    right.children = node.children.splice(mid + 1)
    events.push({
      kind: 'split',
      node: node.id,
      created: right.id,
      text: `The inner page is over capacity: split into [${node.keys.join(', ')}] and [${right.keys.join(', ')}]; ${separator} moves up.`,
    })
    return { separator, right }
  }

  /** Nodes per level, root first. */
  levels(): BTreeNode[][] {
    const levels: BTreeNode[][] = []
    let current = [this.root]
    while (current.length) {
      levels.push(current)
      current = current.flatMap((n) => n.children)
    }
    return levels
  }

  height(): number {
    return this.levels().length
  }
}
