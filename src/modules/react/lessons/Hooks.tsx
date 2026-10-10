import { Callout, CodeBlock, LessonGoals, Predict, Recap } from '@/shared/ui'
import { HookSlots, type HookSlot } from '../components'
import { CAPTURE } from '../data/captures'

const PROFILE = `function Profile() {
  const [loggedIn, setLoggedIn] = useState(false)       // hook 1
  if (loggedIn) {
    const [name] = useState('ann')                      // only sometimes!
  }
  const [theme] = useState('light')                     // hook 2 … or 3
  useEffect(() => {}, [theme])                          // hook 3 … or 4
  return <button onClick={() => setLoggedIn(true)}>{theme}</button>
}`

/** What each slot holds before and after logging in. The types React compares come from its recorded warning below. */
const SLOTS: HookSlot[] = [
  { previous: 'useState → loggedIn', next: 'useState → loggedIn', verdict: 'ok' },
  { previous: 'useState → theme', next: 'useState → name (new)', verdict: 'silent', note: 'same type: React cannot tell — this slot now holds theme’s state for name' },
  { previous: 'useEffect', next: 'useState → theme', verdict: 'detected', note: 'different type: React detects the change' },
  { previous: null, next: 'useEffect', verdict: 'detected', note: 'no slot from the previous render' },
]

export default function Hooks() {
  const { consoleErrors, shown } = CAPTURE.hooks
  const warning = consoleErrors[0]
  return (
    <>
      <LessonGoals
        goals={[
          'know where hook state is stored',
          'explain the rules of hooks from how hooks work',
          'read React’s hook-order warning',
        ]}
        before="Lesson 1 — elements and fibers"
      />

      <h2>A list per component</h2>
      <p>
        A hook call has no name React could see — <code>useState('light')</code> does not say which state it is. React keeps, for each component instance,
        a <strong>list of hooks</strong> in call order. On every render, the first hook call gets the first entry, the second gets the second, and so on.
      </p>
      <Predict
        question={<p>What happens if a component calls one extra useState only after the user logs in?</p>}
        options={['Nothing — React tracks hooks by variable name', 'Every hook after it gets another hook’s state', 'React adds the new hook at the end']}
        answer={1}
        explanation="Positions shift by one: the next hook reads the slot of the previous one. React noticed and complained — recorded below."
      />
      <CodeBlock title="profile.jsx" code={PROFILE} />
      <HookSlots slots={SLOTS} />
      <CodeBlock title="React’s warning — recorded" code={warning.split('\n').slice(0, 1).join('\n') + '\n\n' + warning.split('\n').slice(2).join('\n')} />
      <CodeBlock title="then the render failed — recorded" code={shown} />

      <h2>The rules, explained</h2>
      <ul>
        <li><strong>Only call hooks at the top level</strong> — not in conditions, loops or after an early return — so the order is the same on every render.</li>
        <li><strong>Only call hooks from components or other hooks</strong> — the list belongs to the component that is rendering.</li>
      </ul>
      <Callout tone="tip">
        The <code>react-hooks</code> lint rules catch both at edit time. To use a value conditionally, call the hook unconditionally and put the condition
        inside it (or in its result). <code>use()</code> is the one exception: it may be called conditionally.
      </Callout>
      <p>
        Custom hooks are functions that call hooks; their hook calls simply become part of the calling component’s list. That is why two components using
        the same custom hook do not share state.
      </p>

      <Recap
        points={[
          'Hook state lives in a list attached to the component instance, matched by call order.',
          'Hooks must run in the same order on every render: top level only, no conditions.',
          'Custom hooks share logic, not state.',
        ]}
      />
    </>
  )
}
