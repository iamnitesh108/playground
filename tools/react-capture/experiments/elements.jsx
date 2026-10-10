// What JSX becomes, and what an element is.
export async function run() {
  function Button({ kind, children }) {
    return <button className={kind}>{children}</button>
  }
  const element = (
    <Button kind="primary" key="pay">
      Pay
    </Button>
  )
  const describe = (el) => ({
    $$typeof: String(el.$$typeof),
    type: typeof el.type === 'function' ? `function ${el.type.name}` : el.type,
    key: el.key,
    props: Object.fromEntries(Object.entries(el.props).map(([k, v]) => [k, typeof v === 'object' && v ? '[element]' : v])),
    frozen: Object.isFrozen(el),
  })
  const nested = <div className="cart"><h2>Cart</h2><Button kind="primary">Pay</Button></div>
  return { element: describe(element), nested: describe(nested), childTypes: nested.props.children.map((c) => (typeof c.type === 'function' ? c.type.name : c.type)) }
}
