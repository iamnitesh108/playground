import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

export default function State() {
  const b = CAPTURE.batching
  return (
    <>
      <LessonGoals
        goals={[
          'see state as a snapshot for one render',
          'use updater functions when the next value depends on the previous one',
          'know that updates are batched — also after await',
          'know what flushSync does',
        ]}
        before="Lesson 2 — render and commit"
      />

      <h2>Three times plus one</h2>
      <Predict
        question={
          <p>
            <code>n</code> is 0. A click handler calls <code>setN(n + 1)</code> three times. What is <code>n</code> after the click, and how many times does the
            component render?
          </p>
        }
        options={['3, rendered 3 times', '3, rendered once', '1, rendered once', '1, rendered 3 times']}
        answer={2}
        explanation={`Recorded: value ${b.three.value}, ${b.three.renders} render. In this render n is 0, so all three calls ask for 0 + 1. And right after setN, the handler still read: “${b.seen[0]}”.`}
      />
      <p>
        State does not change inside a render. <code>n</code> is a constant for that render — a <strong>snapshot</strong>. <code>setN</code> asks React to
        render again with a new value; it does not change the variable you already have.
      </p>

      <h2>Updater functions</h2>
      <div className={own.grid2}>
        <CodeBlock title={`value → ${b.three.value}, ${b.three.renders} render — recorded`} code={`setN(n + 1)\nsetN(n + 1)\nsetN(n + 1)`} />
        <CodeBlock title={`+3 (→ ${b.updater.value}), ${b.updater.renders} render — recorded`} code={`setN((prev) => prev + 1)\nsetN((prev) => prev + 1)\nsetN((prev) => prev + 1)`} />
      </div>
      <p>
        An updater function receives the latest pending value. React queues the three functions and applies them in order during the next render: 1 → 2 →
        3 more. Use the updater form whenever the new state is computed from the old one.
      </p>

      <h2>Batching</h2>
      <p>Several updates in one event produce one render. Since React 18 this also holds after <code>await</code>, in timeouts and in promises:</p>
      <Table
        head={['Handler', 'Renders (recorded)']}
        rows={[
          ['three setN calls in a click', String(b.three.renders)],
          ['await …; then setN(…); setLabel(…)', String(b.afterAwait.renders)],
          ['flushSync(() => setN(…)); flushSync(() => setLabel(…))', String(b.flushSync.renders)],
        ]}
      />
      <Callout tone="note" title="flushSync">
        <code>flushSync</code> from react-dom forces React to render and commit the update immediately — for example, to scroll to an element that the update
        just added. It costs extra renders; use it rarely.
      </Callout>

      <h2>Objects and arrays: replace, never mutate</h2>
      <CodeBlock
        title="React compares state with Object.is"
        code={`cart.items.push(item)          // ✗ same array: React sees no change
setCart(cart)

setCart({ ...cart, items: [...cart.items, item] })   // ✓ new objects`}
      />

      <Recap
        points={[
          'A state variable is fixed for one render; setState schedules the next render.',
          'Use setX(prev => …) when the next value depends on the previous one.',
          'Updates in the same event — also after await — are batched into one render.',
          'Replace objects and arrays instead of mutating them.',
        ]}
      />
    </>
  )
}
