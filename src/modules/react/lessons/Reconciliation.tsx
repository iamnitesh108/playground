import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { ReconcilePlayground } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const LIST = `function Row({ name }) {
  const [note, setNote] = useState('')          // state inside each row
  return <li>{name} <input value={note} onChange={…} /></li>
}

items.map((item, index) => <Row key={index} name={item.name} />)    // or key={item.id}`

export default function Reconciliation() {
  const { list, preserve } = CAPTURE.keys
  return (
    <>
      <LessonGoals
        goals={[
          'know the two rules React uses to match old and new elements',
          'see why index keys attach state to the wrong item',
          'reset a component on purpose with a key',
          'follow which DOM nodes React moves when a list changes',
        ]}
        before="Lesson 2 — render and commit"
      />

      <h2>Matching old and new</h2>
      <p>
        After a render, React compares the new elements with the previous ones to decide what to keep. Comparing two arbitrary trees optimally is far too
        slow, so React uses two rules:
      </p>
      <Table
        head={['Rule', 'Consequence']}
        rows={[
          ['Same type at the same place → same component instance', 'its state is kept and its DOM node updated'],
          ['Different type → throw the old subtree away', 'all state below is lost; DOM nodes are recreated'],
          ['In lists, match by key instead of by position', 'items keep their state when the list is reordered'],
        ]}
      />

      <h2>Index keys move state to the wrong row</h2>
      <CodeBlock title="each row has its own state" code={LIST} />
      <Predict
        question={<p>The tea row has a note. A new item “coffee” is added at the top. With <code>key={'{index}'}</code>, where does the note end up?</p>}
        options={['Still next to tea', 'Next to coffee', 'It disappears']}
        answer={1}
        explanation="Coffee is now at index 0, which was tea’s key. React keeps the component with key 0 — and its state — and just gives it new props. Recorded:"
      />
      <div className={own.grid2}>
        <CodeBlock title="key={index} — recorded" code={`before:\n${list.index.before.join('\n')}\n\nafter adding coffee:\n${list.index.after.join('\n')}`} />
        <CodeBlock title="key={item.id} — recorded" code={`before:\n${list.id.before.join('\n')}\n\nafter adding coffee:\n${list.id.after.join('\n')}`} />
      </div>
      <p>
        Use a stable id from the data. Index keys are only safe when the list never changes order and items are never inserted or removed except at the
        end. Random keys (<code>Math.random()</code>) are worse: every render creates new components and loses all state.
      </p>

      <h2>Same place, same state — unless the key says otherwise</h2>
      <CodeBlock
        title="recorded: both counters at 2, then switch to Bob"
        code={`{mode === 'a' ? <Counter label="Alice" /> : <Counter label="Bob" />}
{mode === 'a' ? <Counter key="alice" label="Alice (keyed)" /> : <Counter key="bob" label="Bob (keyed)" />}

before: ${preserve.before.join(', ')}
after:  ${preserve.after.join(', ')}`}
      />
      <p>
        Without a key, Bob’s counter is “the Counter at that position” — Alice’s instance with new props, so it shows 2. With different keys React sees
        different components, and Bob starts at 0. Giving a component a new key is the standard way to reset its state (for example{' '}
        <code>{'<Form key={userId} />'}</code>).
      </p>

      <h2>Which DOM nodes move</h2>
      <p>
        For a keyed list, React walks the new list once. It remembers <code>lastPlacedIndex</code> — the highest old position kept in place so far. An item
        whose old position is lower than that must move; others stay. The simulator below follows that algorithm, and its DOM operations match what React
        did in every recorded case:
      </p>
      <ReconcilePlayground />
      <Callout tone="note" title="Moving one item to the front is the expensive direction">
        Moving the last item to the front made React move the three others; moving the first item to the end was one move. Both end correctly; it only
        matters for very long lists.
      </Callout>

      <Recap
        points={[
          'Same type at the same position keeps state; a different type resets the subtree.',
          'Keys match list items across renders — use stable ids, not indexes.',
          'Change a key to reset a component deliberately.',
          'React moves only items whose old index is below lastPlacedIndex.',
        ]}
      />
    </>
  )
}
