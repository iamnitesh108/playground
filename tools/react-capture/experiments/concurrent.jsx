// useTransition and Suspense: what renders and commits, in which order.
import { Suspense, use, useState, useTransition } from 'react'
export async function run({ render, act, log, container }) {
  const out = {}
  let lines = []
  const say = (s) => { lines.push(s); log(s) }

  // A transition: the input updates at once, the slow list follows.
  function Results({ query }) { say(`  render Results query="${query}"`); return <p id="results">{query || '(all)'}</p> }
  function Search() {
    const [text, setText] = useState('')
    const [query, setQuery] = useState('')
    const [isPending, startTransition] = useTransition()
    say(`render Search text="${text}" query="${query}" isPending=${isPending}`)
    return (
      <div>
        <button id="type" onClick={() => { setText('tea'); startTransition(() => setQuery('tea')) }} />
        <Results query={query} />
      </div>
    )
  }
  await render(<Search />)
  lines = []
  await act(() => container.querySelector('#type').click())
  out.transition = lines

  // Suspense: a component that reads a promise shows the fallback until it resolves.
  lines = []
  let resolve
  const order = new Promise((r) => { resolve = r })
  function Order() { const o = use(order); say(`render Order (data: ${o.status})`); return <p>Order {o.id}: {o.status}</p> }
  function Page() { say('render Page'); return <Suspense fallback={<p>Loading order…</p>}><Order /></Suspense> }
  await render(<Page />)
  out.suspenseFirst = { log: lines, html: container.innerHTML }
  lines = []
  await act(async () => { resolve({ id: 42, status: 'PAID' }) })
  out.suspenseResolved = { log: lines, html: container.innerHTML }
  return out
}
