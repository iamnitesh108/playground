// memo only helps when props are equal; new functions and objects are never equal.
import { memo, useCallback, useMemo, useState } from 'react'
export async function run({ render, act, container }) {
  const counts = {}
  const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1)
  const List = memo(function List({ label }) { bump(label); return <ul /> })
  function App() {
    const [n, setN] = useState(0)
    const onSelectInline = (id) => id
    const onSelectStable = useCallback((id) => id, [])
    const filterInline = { status: 'PAID' }
    const filterStable = useMemo(() => ({ status: 'PAID' }), [])
    return (
      <div>
        <List label="plain props" />
        <List label="inline function" onSelect={onSelectInline} />
        <List label="useCallback" onSelect={onSelectStable} />
        <List label="inline object" filter={filterInline} />
        <List label="useMemo" filter={filterStable} />
        <button id="inc" onClick={() => setN(n + 1)}>{n}</button>
      </div>
    )
  }
  await render(<App />)
  for (let i = 0; i < 3; i++) await act(() => container.querySelector('#inc').click())
  return { parentRenders: 4, childRenders: counts }
}
