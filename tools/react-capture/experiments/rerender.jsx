// Which components render again after a state change.
import { memo, useState } from 'react'
export async function run({ render, act, log, container }) {
  const click = (label) => act(() => container.querySelector(`[data-click="${label}"]`).click())
  const scenarios = {}
  const mark = async (name, fn) => { const start = logLines().length; await fn(); scenarios[name] = logLines().slice(start) }
  let lines = []
  const logLines = () => lines
  const say = (s) => { lines.push(s); log(s) }

  function Header() { say('Header'); return <h1>Shop</h1> }
  const MemoHeader = memo(function MemoHeader() { say('MemoHeader'); return <h1>Shop</h1> })
  function CartItem({ name }) { say(`CartItem ${name}`); return <li>{name}</li> }
  function Cart({ items }) {
    const [open, setOpen] = useState(true)
    say('Cart')
    return <ul>{open && items.map((n) => <CartItem key={n} name={n} />)}<button data-click="cart" onClick={() => setOpen((o) => !o)} /></ul>
  }
  function Footer() { say('Footer'); return <footer /> }
  function App() {
    const [count, setCount] = useState(0)
    say(`App (count ${count})`)
    return (
      <main>
        <Header />
        <MemoHeader />
        <Cart items={['tea', 'milk']} />
        <Footer />
        <button data-click="app" onClick={() => setCount((c) => c + 1)} />
        <button data-click="same" onClick={() => setCount((c) => c)} />
      </main>
    )
  }
  await mark('mount', () => render(<App />))
  await mark('appState', () => click('app'))
  await mark('cartState', () => click('cart'))
  await mark('sameValue', () => click('same'))

  // children passed as props are created by the parent of the stateful component
  function Expensive() { say('Expensive'); return <p>chart</p> }
  function Collapsible({ children }) {
    const [open, setOpen] = useState(true)
    say(`Collapsible (open ${open})`)
    return <section><button data-click="toggle" onClick={() => setOpen((o) => !o)} />{children}</section>
  }
  function Page() { say('Page'); return <Collapsible><Expensive /></Collapsible> }
  await mark('childrenMount', () => render(<Page />))
  await mark('childrenToggle', () => click('toggle'))
  return scenarios
}
