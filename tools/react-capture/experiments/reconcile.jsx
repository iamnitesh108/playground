// The DOM operations React performs to turn one keyed list into another.
import { useEffect, useState } from 'react'
export const CASES = [
  { name: 'move last to front', from: ['a', 'b', 'c', 'd'], to: ['d', 'a', 'b', 'c'] },
  { name: 'move first to end', from: ['a', 'b', 'c', 'd'], to: ['b', 'c', 'd', 'a'] },
  { name: 'swap two', from: ['a', 'b', 'c', 'd'], to: ['a', 'c', 'b', 'd'] },
  { name: 'reverse', from: ['a', 'b', 'c', 'd'], to: ['d', 'c', 'b', 'a'] },
  { name: 'insert in the middle', from: ['a', 'b', 'c'], to: ['a', 'x', 'b', 'c'] },
  { name: 'remove one', from: ['a', 'b', 'c', 'd'], to: ['a', 'c', 'd'] },
  { name: 'replace all', from: ['a', 'b'], to: ['c', 'd'] },
  { name: 'mixed', from: ['a', 'b', 'c', 'd', 'e'], to: ['e', 'b', 'x', 'a', 'd'] },
]
export async function run({ render, act, container }) {
  const results = []
  for (const c of CASES) {
    const handle = {}
    function List() {
      const [items, setItems] = useState(c.from)
      useEffect(() => { handle.set = setItems }, [])
      return <ul>{items.map((k) => <li key={k}>{k}</li>)}</ul>
    }
    await render(<List key={c.name} />)
    const ul = container.querySelector('ul')
    const ops = []
    const name = (n) => n?.textContent ?? 'end'
    const node = globalThis.Node.prototype
    const original = { insertBefore: node.insertBefore, appendChild: node.appendChild, removeChild: node.removeChild }
    node.insertBefore = function (child, ref) { if (this === ul) ops.push(`${child.parentNode === ul ? 'move' : 'insert'} ${name(child)} before ${name(ref)}`); return original.insertBefore.call(this, child, ref) }
    node.appendChild = function (child) { if (this === ul) ops.push(`${child.parentNode === ul ? 'move' : 'insert'} ${name(child)} at end`); return original.appendChild.call(this, child) }
    node.removeChild = function (child) { if (this === ul) ops.push(`remove ${name(child)}`); return original.removeChild.call(this, child) }
    try {
      await act(() => handle.set(c.to))
    } finally {
      Object.assign(node, original)
    }
    results.push({ ...c, ops, result: [...ul.children].map((li) => li.textContent) })
  }
  return results
}
