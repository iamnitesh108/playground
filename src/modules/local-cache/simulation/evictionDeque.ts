/*
 * The doubly linked list every LRU-style policy is built on: the least recently used entry at the head, the most
 * recently used at the tail. Together with a map from key to node, every operation is O(1): unlink a node from
 * wherever it is and append it at the tail.
 */

export interface DequeNode<R extends string = string> {
  key: number
  /** Which list (region) the node is in: window, probation, protected… */
  region: R
  prev: DequeNode<R> | null
  next: DequeNode<R> | null
}

export class Deque<R extends string = string> {
  head: DequeNode<R> | null = null
  tail: DequeNode<R> | null = null
  size = 0

  /** Appends at the tail (most recently used end). */
  pushBack(node: DequeNode<R>): void {
    node.prev = this.tail
    node.next = null
    if (this.tail) this.tail.next = node
    else this.head = node
    this.tail = node
    this.size++
  }

  remove(node: DequeNode<R>): void {
    if (node.prev) node.prev.next = node.next
    else this.head = node.next
    if (node.next) node.next.prev = node.prev
    else this.tail = node.prev
    node.prev = node.next = null
    this.size--
  }

  moveToBack(node: DequeNode<R>): void {
    if (this.tail === node) return
    this.remove(node)
    this.pushBack(node)
  }

  /** Removes and returns the head (least recently used end). */
  popFront(): DequeNode<R> | null {
    const node = this.head
    if (node) this.remove(node)
    return node
  }

  /** Keys from head (oldest) to tail (newest). */
  keys(): number[] {
    const out: number[] = []
    for (let n = this.head; n; n = n.next) out.push(n.key)
    return out
  }
}
