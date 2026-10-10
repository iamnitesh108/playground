// When render, layout effects, effects and cleanups run.
import { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
export async function run({ render, act, log, container }) {
  const phases = {}
  let lines = []
  const say = (s) => { lines.push(s); log(s) }
  const capture = async (name, fn) => { lines = []; await fn(); phases[name] = [...lines] }
  function Child({ n }) {
    say(`render Child n=${n}`)
    useLayoutEffect(() => { say(`  layout effect Child n=${n}`); return () => say(`  layout cleanup Child n=${n}`) }, [n])
    useEffect(() => { say(`  effect Child n=${n}`); return () => say(`  cleanup Child n=${n}`) }, [n])
    return <span>{n}</span>
  }
  function Parent() {
    const [n, setN] = useState(0)
    const [show, setShow] = useState(true)
    say(`render Parent n=${n}`)
    useLayoutEffect(() => { say(`  layout effect Parent n=${n}`); return () => say(`  layout cleanup Parent n=${n}`) }, [n])
    useEffect(() => { say(`  effect Parent n=${n}`); return () => say(`  cleanup Parent n=${n}`) }, [n])
    useEffect(() => { say('  effect Parent [] (mount only)') }, [])
    return (
      <div>
        {show && <Child n={n} />}
        <button id="inc" onClick={() => setN(n + 1)} />
        <button id="hide" onClick={() => setShow(false)} />
      </div>
    )
  }
  await capture('mount', () => render(<Parent />))
  await capture('update', () => act(() => container.querySelector('#inc').click()))
  await capture('unmountChild', () => act(() => container.querySelector('#hide').click()))
  await capture('unmountParent', () => render(null))
  await capture('strictMount', () => render(<StrictMode><Child n={7} key="strict" /></StrictMode>))

  await render(null)

  // Effects run after the browser has had a chance to paint: the DOM is already updated.
  function Reader() {
    const [v] = useState('hello')
    useLayoutEffect(() => { say(`layout effect sees DOM: "${container.querySelector('#r').textContent}"`) })
    return <b id="r">{v}</b>
  }
  await capture('domReady', () => render(<Reader />))
  return phases
}
