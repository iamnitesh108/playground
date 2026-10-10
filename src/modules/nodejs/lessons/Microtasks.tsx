import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { EventLoopPlayer } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

export default function Microtasks() {
  const { order, starve } = CAPTURE
  return (
    <>
      <LessonGoals
        goals={[
          'know the two queues that run between every callback',
          'predict the order of nextTick, promises and timers',
          'explain why the order differs between CommonJS and ES modules',
          'avoid starving the event loop',
        ]}
        before="Lesson 3 — the event loop phases"
      />

      <h2>Two queues that cut in line</h2>
      <Table
        head={['Queue', 'Filled by', 'Emptied']}
        rows={[
          ['nextTick queue', 'process.nextTick(cb) — Node.js only', 'after the current callback, completely, before the event loop continues'],
          ['microtask queue', 'promise reactions (.then, await), queueMicrotask(cb) — standard JavaScript', 'right after the nextTick queue, completely'],
        ]}
      />
      <p>
        After every callback — a timer, an I/O callback, an immediate, the main script — Node.js runs: all nextTicks, then all microtasks, and
        again while either has something new. Only then does the loop move on. Callbacks added to these queues while they are being emptied run{' '}
        <em>in the same round</em>.
      </p>

      <Predict
        question={<p>In a CommonJS file: <code>Promise.resolve().then(A)</code>, then <code>process.nextTick(B)</code>. Which runs first?</p>}
        options={['A — it was scheduled first', 'B — the nextTick queue is emptied first', 'It varies']}
        answer={1}
        explanation="In CommonJS, the nextTick queue is drained before the microtask queue. In an ES module it is the other way round at top level — see below."
      />
      <EventLoopPlayer initial="basics" />

      <h2>The ES module twist</h2>
      <p>The same seven lines, recorded as a .cjs file and as an .mjs file:</p>
      <div className={own.grid2}>
        <CodeBlock title="CommonJS" code={order.cjs.basics.join('\n')} />
        <CodeBlock title="ES module" code={order.esm.basics.join('\n')} />
      </div>
      <p className={own.note}>The last two lines are the timer race from lesson 3; in these two runs the timer happened to win.</p>
      <p>
        An ES module is evaluated by V8 as part of a promise job, so when its top-level code ends, V8 is <em>already</em> emptying the microtask
        queue — the promise callbacks run before Node.js gets to its nextTick queue. After that first round, both files behave the same. Switch the{' '}
        <em>file</em> option in the simulator to compare, and try the <code>nested</code> program.
      </p>
      <Callout tone="tip" title="Do not depend on it">
        Code whose correctness depends on nextTick-versus-promise order is fragile. Prefer <code>queueMicrotask</code> or promises everywhere; keep
        process.nextTick for the rare case of “after this function returns, before any I/O” in library code.
      </Callout>

      <h2>await is a microtask</h2>
      <p>
        <code>await</code> pauses the async function and schedules the rest of it as a microtask. Everything before the first await runs
        synchronously, as part of the call. Pick the <code>async</code> program in the simulator to watch it.
      </p>

      <h2>Starving the loop</h2>
      <p>
        Because these queues are emptied completely, a callback that keeps adding to them never lets the loop move on. Recorded: a 0 ms timer, and a
        function that reschedules itself {starve.nextTick.iterations.toLocaleString('en')} times —
      </p>
      <Table
        head={['Rescheduled with', 'Timer fired after', 'at']}
        rows={[
          ['process.nextTick', `${starve.nextTick.timerFiredAfterIterations.toLocaleString('en')} iterations (all of them)`, `${starve.nextTick.timerFiredAtMs} ms`],
          ['setImmediate', `${starve.setImmediate.timerFiredAfterIterations.toLocaleString('en')} iteration(s)`, `${starve.setImmediate.timerFiredAtMs} ms`],
        ]}
      />
      <p>
        With nextTick (or an endless promise chain) nothing else ran until the recursion ended — no timers, no I/O, no incoming requests. With
        setImmediate each round is one callback in the check phase, so timers and I/O get their turn in between.
      </p>

      <Recap
        points={[
          'After every callback: drain nextTick, then microtasks (promises, queueMicrotask), until both are empty.',
          'Then the loop continues to the next callback or phase.',
          'In ES modules, top-level promise callbacks run before top-level nextTicks; in CommonJS, nextTicks first.',
          'Recursive nextTick or promise chains starve the loop; setImmediate does not.',
        ]}
      />
    </>
  )
}
