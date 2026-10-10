// State is a snapshot; updates are batched.
import { useState } from 'react'
import { flushSync } from 'react-dom'
export async function run({ render, act, log, container }) {
  const out = {}
  const click = (id) => act(async () => {
    container.querySelector(`#${id}`).click()
    await new Promise((r) => setTimeout(r, 0)) // let async handlers finish inside act
  })
  let renders = 0
  const seen = []
  function Counter() {
    const [n, setN] = useState(0)
    const [label, setLabel] = useState('idle')
    renders++
    log(`render n=${n} label=${label}`)
    return (
      <div>
        <button id="three" onClick={() => { setN(n + 1); setN(n + 1); setN(n + 1); seen.push(`n right after setN: ${n}`) }} />
        <button id="updater" onClick={() => { setN((p) => p + 1); setN((p) => p + 1); setN((p) => p + 1) }} />
        <button id="later" onClick={async () => { await Promise.resolve(); setN((p) => p + 1); setLabel('saved') }} />
        <button id="flush" onClick={() => { flushSync(() => setN((p) => p + 1)); flushSync(() => setLabel('flushed')) }} />
        <span id="value">{n}</span>
      </div>
    )
  }
  await render(<Counter />)
  const measure = async (name, id) => {
    const before = renders
    await click(id)
    out[name] = { renders: renders - before, value: container.querySelector('#value').textContent }
  }
  await measure('three', 'three')
  await measure('updater', 'updater')
  await measure('afterAwait', 'later')
  await measure('flushSync', 'flush')
  out.seen = seen
  return out
}
