import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

export default function Elements() {
  const { compiled, elements } = CAPTURE
  const show = (e: unknown) => JSON.stringify(e, null, 2)
  return (
    <>
      <LessonGoals
        goals={[
          'read what JSX compiles to',
          'know what a React element is — and that it is not a DOM node or a component instance',
          'tell components, elements and the DOM apart',
        ]}
      />

      <h2>JSX is function calls</h2>
      <p>Browsers do not understand JSX. A compiler turns it into calls to <code>jsx()</code>. This is the real output of the compiler this site is built with (Oxc, via Vite):</p>
      <div className={own.grid2}>
        <CodeBlock title="cart.jsx" code={compiled.jsx.source} />
        <CodeBlock title="compiled — recorded" code={compiled.jsx.output} />
      </div>
      <ul>
        <li>Lower-case tags become strings (<code>"section"</code>); capitalised ones become references to your function (<code>CartItem</code>) — that is why components must start with a capital letter.</li>
        <li>Attributes become one <code>props</code> object; nested content becomes <code>props.children</code>.</li>
        <li><code>key</code> is not a prop: it is passed separately (the third argument).</li>
        <li><code>jsxs</code> is the same as <code>jsx</code>, used when children are a static array.</li>
      </ul>

      <h2>An element is a description</h2>
      <Predict
        question={<p>What does <code>{'<Button kind="primary">Pay</Button>'}</code> evaluate to?</p>}
        options={['A <button> DOM node', 'An instance of Button with its state', 'A small plain object describing what to render']}
        answer={2}
        explanation="It calls nothing and creates nothing on screen. It is a frozen object: which type, which props, which key. Recorded in React:"
      />
      <div className={own.grid2}>
        <CodeBlock title={'<Button kind="primary" key="pay">Pay</Button>'} code={show(elements.element)} />
        <CodeBlock title={'<div className="cart"><h2>…</h2><Button …/></div>'} code={`${show(elements.nested)}\n\nchildren types: ${JSON.stringify(elements.childTypes)}`} />
      </div>
      <p>
        <code>$$typeof</code> marks the object as a real React element (JSON from a server cannot contain a Symbol, so it cannot be smuggled in as an
        element). <code>frozen: true</code>: elements are immutable — to change the screen you create new elements, you never edit old ones.
      </p>

      <h2>Three different things</h2>
      <Table
        head={['Thing', 'What it is', 'Who creates it']}
        rows={[
          ['component', 'a function: props in, elements out', 'you'],
          ['element', 'a plain object describing one piece of UI, created anew on every render', 'JSX, every time a component runs'],
          ['component instance (fiber)', 'React’s long-lived record for one component in the tree: its state, hooks, effects', 'React, when an element of that type first appears at that place'],
          ['DOM node', 'what the browser shows', 'React, during the commit'],
        ]}
      />
      <Callout tone="analogy">
        A component is a recipe; an element is one order slip (“one Button, primary, saying Pay”); React is the kitchen that keeps the dishes (fibers and
        DOM nodes) and only changes what the new order slips differ in.
      </Callout>

      <Recap
        points={[
          'JSX compiles to jsx(type, props, key) calls.',
          'An element is a frozen object {$$typeof, type, key, props} — a description, not a DOM node.',
          'State lives in React’s fibers, not in elements; a new set of elements is created on every render.',
        ]}
      />
    </>
  )
}
