// Keys decide which component instance (and its state) belongs to which item.
import { useState } from 'react'
export async function run({ render, act, container }) {
  function Row({ name }) {
    const [note, setNote] = useState('')
    return (
      <li>
        <span>{name}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
        <button data-type={name} onClick={() => setNote(`note for ${name}`)} />
      </li>
    )
  }
  const snapshot = () => [...container.querySelectorAll('li')].map((li) => `${li.querySelector('span').textContent}: "${li.querySelector('input').value}"`)
  const results = {}
  for (const keying of ['index', 'id']) {
    function List() {
      const [items, setItems] = useState([{ id: 1, name: 'tea' }, { id: 2, name: 'milk' }])
      return (
        <>
          <ul>{items.map((item, i) => <Row key={keying === 'index' ? i : item.id} name={item.name} />)}</ul>
          <button id="prepend" onClick={() => setItems((xs) => [{ id: 3, name: 'coffee' }, ...xs])} />
        </>
      )
    }
    await render(<List key={keying} />)
    await act(() => container.querySelector('[data-type="tea"]').click())
    const before = snapshot()
    await act(() => container.querySelector('#prepend').click())
    results[keying] = { before, after: snapshot() }
  }

  // Same position and type keeps state; a different key resets it.
  function Counter({ label }) {
    const [n, setN] = useState(0)
    return <p><span>{label}: {n}</span><button className="inc" onClick={() => setN(n + 1)} /></p>
  }
  function Switcher() {
    const [mode, setMode] = useState('a')
    return (
      <div>
        {mode === 'a' ? <Counter label="Alice" /> : <Counter label="Bob" />}
        {mode === 'a' ? <Counter key="alice" label="Alice (keyed)" /> : <Counter key="bob" label="Bob (keyed)" />}
        <button id="switch" onClick={() => setMode((m) => (m === 'a' ? 'b' : 'a'))} />
      </div>
    )
  }
  await render(<Switcher />)
  const texts = () => [...container.querySelectorAll('p span')].map((s) => s.textContent)
  for (const b of container.querySelectorAll('.inc')) { await act(() => b.click()); await act(() => b.click()) }
  const preserve = { before: texts() }
  await act(() => container.querySelector('#switch').click())
  preserve.after = texts()
  return { list: results, preserve }
}
