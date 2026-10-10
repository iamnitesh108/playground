import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const SEARCH = `function Search() {
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  return (<>
    <input value={text} onChange={(e) => {
      setText(e.target.value)                          // urgent: the input must update now
      startTransition(() => setQuery(e.target.value))  // can wait: the slow results
    }} />
    {isPending && <Spinner />}
    <Results query={query} />
  </>)
}`

const SUSPENSE = `function Order() {
  const order = use(orderPromise)       // suspends until the promise resolves
  return <p>Order {order.id}: {order.status}</p>
}

function Page() {
  return (
    <Suspense fallback={<p>Loading order…</p>}>
      <Order />
    </Suspense>
  )
}`

export default function Concurrent() {
  const c = CAPTURE.concurrent
  return (
    <>
      <LessonGoals
        goals={[
          'separate urgent updates from ones that can wait',
          'read the two renders a transition produces',
          'show a fallback while data loads, with Suspense and use()',
        ]}
        before="Lesson 3 — state and batching"
      />

      <h2>Not every update is urgent</h2>
      <p>
        Typing must feel instant; the search results below the input can follow a moment later. A <strong>transition</strong> marks an update as
        non-urgent: React renders it in the background, can interrupt it when something urgent arrives, and keeps showing the old UI meanwhile.
      </p>
      <CodeBlock title="search.jsx" code={SEARCH} />
      <Predict
        question={<p>The user types “tea”. How many times does Search render, and what is <code>isPending</code> in each?</p>}
        options={['Once, isPending false', 'Twice: first with the new text and the old query (isPending true), then with both', 'Twice, both with isPending true']}
        answer={1}
        explanation="The urgent update renders first — the input shows “tea” while the results still show the old query and isPending is true. Then the transition renders. Recorded:"
      />
      <CodeBlock title="render log — recorded" code={c.transition.join('\n')} />
      <Table
        head={['API', 'Use for']}
        rows={[
          ['startTransition / useTransition', 'you own the state update; wrap the non-urgent setState'],
          ['useDeferredValue(value)', 'you receive a value (a prop); render with a lagging copy of it'],
        ]}
      />

      <h2>Suspense: a fallback while waiting</h2>
      <p>
        A component can <em>suspend</em>: tell React it cannot render yet because data is missing. <code>use(promise)</code> does that. The nearest{' '}
        <code>{'<Suspense>'}</code> above shows its fallback until the promise resolves, then React renders the component again.
      </p>
      <CodeBlock title="order.jsx" code={SUSPENSE} />
      <div className={own.grid2}>
        <CodeBlock title="first render — recorded" code={`log:  ${c.suspenseFirst.log.join(', ')}\nDOM:  ${c.suspenseFirst.html}`} />
        <CodeBlock title="after the promise resolved — recorded" code={`log:  ${c.suspenseResolved.log.join(', ')}\nDOM:  ${c.suspenseResolved.html}`} />
      </div>
      <Callout tone="warn" title="Where the promise comes from matters">
        A promise created during render is a new promise on every render and never settles in time. Create it outside the component, cache it, or let a
        data library (or a framework’s server components) provide it.
      </Callout>
      <p>
        If an update inside a transition suspends, React keeps showing the current content instead of replacing it with a fallback — the user sees the old
        page with a pending indicator, not a sudden spinner.
      </p>

      <Recap
        points={[
          'startTransition marks updates as non-urgent; urgent updates render first.',
          'isPending is true in the urgent render while the transition is still to come.',
          'use(promise) suspends; the nearest Suspense shows its fallback until the data is there.',
        ]}
      />
    </>
  )
}
