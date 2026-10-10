import { useState } from 'react'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Segmented, Table } from '@/shared/ui'
import { RenderTree, type TreeNode } from '../components'
import { CAPTURE } from '../data/captures'

const SHOP: TreeNode = {
  name: 'App',
  note: 'state: count',
  children: [
    { name: 'Header' },
    { name: 'MemoHeader', note: 'memo()' },
    { name: 'Cart', note: 'state: open', children: [{ name: 'CartItem tea' }, { name: 'CartItem milk' }] },
    { name: 'Footer' },
  ],
}
const PAGE: TreeNode = { name: 'Page', children: [{ name: 'Collapsible', note: 'state: open; renders {children}', children: [{ name: 'Expensive', note: 'passed as children by Page' }] }] }

const SCENARIOS = {
  mount: { label: 'first render', tree: SHOP, text: 'Everything renders once, parents before children.' },
  appState: { label: 'App state changes', tree: SHOP, text: 'App’s state changed: App and every component below it rendered again — except the memo() one, whose props did not change.' },
  cartState: { label: 'Cart state changes', tree: SHOP, text: 'Only Cart rendered: state changes re-render the owner and below, never the parent. (It closed, so the items were removed rather than rendered.)' },
  sameValue: { label: 'set the same value', tree: SHOP, text: 'setCount(c => c) returned the same value: React bailed out and rendered nothing.' },
  childrenToggle: { label: 'children as props', tree: PAGE, text: 'Collapsible re-rendered, but Expensive did not: it is an element Page created and passed in as children. Collapsible only moved it.' },
} as const

type ScenarioId = keyof typeof SCENARIOS

export default function Rendering() {
  const [id, setId] = useState<ScenarioId>('appState')
  const s = SCENARIOS[id]
  return (
    <>
      <LessonGoals
        goals={[
          'separate React’s two phases: render and commit',
          'predict which components render after a state change',
          'know that “render” does not mean “update the DOM”',
        ]}
        before="Lesson 1 — elements"
      />

      <h2>Two phases</h2>
      <Table
        head={['Phase', 'What happens', 'Must be']}
        rows={[
          ['render', 'React calls your components; they return elements. React compares them with the previous ones (reconciliation).', 'pure: no DOM changes, no requests, no subscriptions'],
          ['commit', 'React applies the differences to the DOM, then runs layout effects; the browser paints; then effects run.', 'where side effects belong (lesson 5)'],
        ]}
      />
      <p>
        A component <em>rendering</em> only means its function was called. If the elements it returns are the same as before, the DOM is not touched.
        Re-rendering is normal and usually cheap; unnecessary DOM changes are what React avoids.
      </p>

      <h2>What triggers a render</h2>
      <Predict
        question={<p>App holds a counter in state. It renders Header, Cart (with two CartItems) and Footer, which take no props from it. The counter changes. Which components render again?</p>}
        options={['Only App', 'App, and only children whose props changed', 'App and everything below it']}
        answer={2}
        explanation="When a component renders, React renders all its children too — by default it does not compare props. memo() opts a component out. Recorded:"
      />
      <Segmented label="scenario" value={id} options={(Object.keys(SCENARIOS) as ScenarioId[]).map((k) => ({ value: k, label: SCENARIOS[k].label }))} onChange={setId} />
      <RenderTree key={id} tree={s.tree} log={CAPTURE.rerender[id]} />
      <p>{s.text}</p>
      <Table
        head={['A component renders when…', 'Notes']}
        rows={[
          ['its own state changes', 'set to a different value (compared with Object.is)'],
          ['its parent renders', 'unless wrapped in memo() and its props are unchanged'],
          ['a context it reads changes', 'even inside memo()'],
        ]}
      />

      <h2>Children passed as props</h2>
      <CodeBlock
        title="the “children” scenario"
        code={`function Page() {
  return <Collapsible><Expensive /></Collapsible>    // Page creates the <Expensive /> element
}
function Collapsible({ children }) {
  const [open, setOpen] = useState(true)            // only this state changes
  return <section><button onClick={() => setOpen(!open)} />{children}</section>
}`}
      />
      <Callout tone="tip" title="Move state down, or lift content up">
        Before reaching for memo(), keep state in the smallest component that needs it, and pass expensive parts in as children. Both keep re-renders
        local without any memoization.
      </Callout>

      <Recap
        points={[
          'Render = calling components; commit = applying differences to the DOM.',
          'A state change renders that component and everything below it.',
          'Setting the same state value renders nothing.',
          'Elements passed in as children are not re-created by the component that renders them.',
        ]}
      />
    </>
  )
}
