import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const APP = `const List = memo(function List(props) { … })

function App() {
  const [n, setN] = useState(0)
  const onSelectInline = (id) => id                          // new function every render
  const onSelectStable = useCallback((id) => id, [])         // same function every render
  const filterInline = { status: 'PAID' }                    // new object every render
  const filterStable = useMemo(() => ({ status: 'PAID' }), [])

  return (<>
    <List label="plain props" />
    <List label="inline function" onSelect={onSelectInline} />
    <List label="useCallback"     onSelect={onSelectStable} />
    <List label="inline object"   filter={filterInline} />
    <List label="useMemo"         filter={filterStable} />
  </>)
}`

export default function Memoization() {
  const { memoization: m, compiled } = CAPTURE
  return (
    <>
      <LessonGoals
        goals={[
          'know what memo, useMemo and useCallback each do',
          'see why memo silently fails with inline functions and objects',
          'read what React Compiler generates, and when you still need manual memoization',
        ]}
        before="Lesson 2 — what triggers a render"
      />

      <h2>memo compares props</h2>
      <p>
        <code>memo(Component)</code> skips rendering when every prop is equal to last time (<code>Object.is</code>, one level deep). A function or object
        created during render is a <em>new</em> value every time — never equal.
      </p>
      <CodeBlock title="recorded experiment" code={APP} />
      <Predict
        question={<p>App renders {m.parentRenders} times (mount + 3 updates). How many times does the memo’d List with an inline function prop render?</p>}
        options={['1 — it is memo’d', `${m.parentRenders} — the prop is new each time`, '0']}
        answer={1}
        explanation="memo saw a new function on every render, so it rendered every time — memo only cost a comparison. Recorded render counts:"
      />
      <Table head={['List with…', `renders (of ${m.parentRenders} parent renders)`]} rows={Object.entries(m.childRenders).map(([k, v]) => [k, String(v)])} />

      <h2>Three tools</h2>
      <Table
        head={['', 'Caches', 'Use when']}
        rows={[
          ['memo(Component)', 'the rendered output of a component, by props', 'a component renders often with the same props and is costly'],
          ['useMemo(fn, deps)', 'a computed value', 'an expensive calculation, or an object passed to a memo’d child or used as an effect dependency'],
          ['useCallback(fn, deps)', 'a function', 'a callback passed to a memo’d child or used as an effect dependency'],
        ]}
      />
      <Callout tone="warn" title="Measure first">
        Memoization costs memory and comparisons, and one unstable prop silently defeats it. Use the React DevTools Profiler to find components that are
        both slow and rendering without need.
      </Callout>

      <h2>React Compiler</h2>
      <p>
        React Compiler (1.0) is a build step that adds memoization automatically, at a finer grain than you would by hand. Its real output for a small
        component:
      </p>
      <div className={own.grid2}>
        <CodeBlock title="order-total.jsx" code={compiled.compiler.source} />
        <CodeBlock title="compiled by babel-plugin-react-compiler 1.0 — recorded" code={compiled.compiler.output} />
      </div>
      <ul>
        <li><code>_c(7)</code> allocates a cache of 7 slots for this component instance (stored with its hooks).</li>
        <li>The total is recomputed only when <code>items</code> changed (<code>$[0] !== items</code>); otherwise the cached results are reused.</li>
        <li>The <code>{'<p>'}</code> element is reused when nothing it depends on changed — so a memo’d child would see the same props.</li>
        <li>The reduce callback became a module-level <code>_temp</code> function: it captures nothing, so it never needs to be recreated.</li>
      </ul>
      <p>
        The compiler assumes your components follow the rules of React (pure render, no mutation of props or state). With it enabled, most manual{' '}
        <code>useMemo</code>/<code>useCallback</code> becomes unnecessary; it remains useful as an escape hatch, e.g. to keep an effect dependency stable.
      </p>

      <Recap
        points={[
          'memo skips a render only when all props are Object.is-equal.',
          'Inline functions and objects defeat memo; useCallback and useMemo keep them stable.',
          'React Compiler inserts this memoization automatically, per value, with a cache per component.',
        ]}
      />
    </>
  )
}
