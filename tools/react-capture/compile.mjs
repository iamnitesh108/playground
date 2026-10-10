// Real compiler output: JSX through Vite's Oxc transform, and a component through React Compiler 1.0.
import { transformWithOxc } from 'vite'
import { transformAsync } from '@babel/core'

export const JSX_SOURCE = `export function Cart({ items }) {
  return (
    <section className="cart">
      <h2>Cart ({items.length})</h2>
      {items.map((item) => <CartItem key={item.id} item={item} />)}
    </section>
  )
}`

export const COMPILER_SOURCE = `function OrderTotal({ items, currency }) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0)
  return <p className="total">{total.toFixed(2)} {currency}</p>
}`

export async function compile() {
  const jsx = await transformWithOxc(JSX_SOURCE, 'cart.jsx', { jsx: { runtime: 'automatic', development: false } })
  const compiled = await transformAsync(COMPILER_SOURCE, {
    filename: 'order-total.jsx',
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx'] },
    plugins: [['babel-plugin-react-compiler', {}]],
  })
  return { jsx: { source: JSX_SOURCE, output: jsx.code.trim() }, compiler: { source: COMPILER_SOURCE, output: compiled.code.trim() } }
}
