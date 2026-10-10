import { useState } from 'react'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Segmented, Table } from '@/shared/ui'
import { EffectsTimeline } from '../components'
import { CAPTURE } from '../data/captures'

const CODE = `function Parent() {
  const [n, setN] = useState(0)
  useLayoutEffect(() => { log('layout effect Parent'); return () => log('layout cleanup Parent') }, [n])
  useEffect(() => { log('effect Parent'); return () => log('cleanup Parent') }, [n])
  useEffect(() => { log('effect Parent [] (mount only)') }, [])
  return <Child n={n} />          // Child has the same two effects
}`

const PHASES = {
  mount: 'mount',
  update: 'n changes',
  unmountChild: 'Child removed',
  unmountParent: 'all removed',
  strictMount: 'Strict Mode mount',
} as const
type PhaseId = keyof typeof PHASES

export default function Effects() {
  const [id, setId] = useState<PhaseId>('mount')
  const e = CAPTURE.effects
  return (
    <>
      <LessonGoals
        goals={[
          'order render, layout effects, paint and effects',
          'know when cleanups run',
          'read dependency arrays',
          'understand why Strict Mode runs effects twice in development',
        ]}
        before="Lesson 2 — render and commit"
      />

      <h2>Effects run after the commit</h2>
      <p>
        Effects synchronise a component with something outside React: a subscription, a timer, a WebSocket, a non-React widget. They run after React has
        updated the DOM, so they never slow down rendering.
      </p>
      <CodeBlock title="the recorded components" code={CODE} />
      <Predict
        question={<p>On the first render, which runs first: the Parent’s effect or the Child’s effect?</p>}
        options={['Parent — it rendered first', 'Child — effects run from the inside out']}
        answer={1}
        explanation="Render goes top-down (Parent, then Child); effects go bottom-up, so a parent’s effect can rely on its children’s effects having run. Step through the recordings:"
      />
      <Segmented label="recording" value={id} options={(Object.keys(PHASES) as PhaseId[]).map((k) => ({ value: k, label: PHASES[k] }))} onChange={setId} />
      <EffectsTimeline key={id} title={PHASES[id]} lines={e[id]} />
      <Table
        head={['', 'useLayoutEffect', 'useEffect']}
        rows={[
          ['runs', 'after the DOM update, before the browser paints', 'after paint (usually)'],
          ['blocks painting', 'yes — keep it short', 'no'],
          ['use for', 'measuring layout and adjusting before the user sees it', 'almost everything else'],
        ]}
      />
      <p>In a layout effect the DOM is already updated — recorded: “{e.domReady[0]}”.</p>

      <h2>Dependencies and cleanup</h2>
      <Table
        head={['Dependency array', 'Effect runs']}
        rows={[
          ['none', 'after every render'],
          ['[]', 'once after mount (cleanup at unmount)'],
          ['[a, b]', 'after mount, and after any render where a or b changed (Object.is)'],
        ]}
      />
      <p>
        Before an effect runs again, the cleanup of its previous run executes — with the <em>old</em> values (see “n changes”: cleanup n=0, then effect
        n=1). At unmount, every cleanup runs.
      </p>

      <h2>Strict Mode runs it twice — on purpose</h2>
      <p>
        In development, <code>{'<StrictMode>'}</code> renders each component twice and, on mount, runs every effect, its cleanup, and the effect again. That
        flushes out effects without a correct cleanup: a subscription made twice and removed once shows up immediately. Production runs everything once.
      </p>
      <Callout tone="tip" title="You might not need an effect">
        Values computed from props or state belong in the render (or useMemo). Responses to a click belong in the event handler. Effects are for
        synchronising with external systems.
      </Callout>

      <Recap
        points={[
          'Order: render (top-down) → DOM update → layout effects (bottom-up) → paint → effects (bottom-up).',
          'A cleanup runs before the next run of its effect and at unmount, with the old values.',
          'Strict Mode in development double-renders and re-runs effects to expose missing cleanups.',
        ]}
      />
    </>
  )
}
