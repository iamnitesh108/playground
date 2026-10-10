import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { EventLoopPlayer } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const PHASES = [
  ['timers', 'callbacks of setTimeout / setInterval whose time has come'],
  ['pending callbacks', 'a few I/O callbacks deferred from the previous iteration (e.g. some TCP errors)'],
  ['idle, prepare', 'internal to Node.js'],
  ['poll', 'wait for I/O and run its callbacks: data arrived on a socket, a file read finished …'],
  ['check', 'setImmediate callbacks'],
  ['close callbacks', "'close' events, e.g. socket.on('close')"],
]

export default function EventLoop() {
  const { race } = CAPTURE
  return (
    <>
      <LessonGoals
        goals={[
          'name the phases of the event loop and what runs in each',
          'explain why setImmediate runs before setTimeout(0) inside an I/O callback',
          'step through real programs and match their output',
        ]}
        before="Lesson 1 — the main thread and libuv"
      />

      <h2>A loop around one question</h2>
      <p>
        After your main script finishes, Node.js does not exit if there is still something to wait for: a timer, a server socket, a file being
        read. It enters the <strong>event loop</strong>, which repeats, in order:
      </p>
      <div className={own.loop}>
        {PHASES.map(([name], i) => (
          <span key={name} className={own.loopPhase}>
            {i + 1}. {name}
          </span>
        ))}
        <span className={own.loopBack}>↺ next iteration</span>
      </div>
      <Table head={['Phase', 'Runs']} rows={PHASES} />
      <p>
        When every queue is empty and nothing is pending — no timers, no open sockets or servers, no I/O in progress — the loop ends and the process
        exits. That is why a script with only <code>console.log</code> exits at once, and a server keeps running.
      </p>
      <Callout tone="note" title="And between every callback">
        After <em>each</em> callback in any phase, Node.js empties two more queues — process.nextTick and promise microtasks — before running the
        next one. They are the subject of the next lesson; the simulator shows them already.
      </Callout>

      <h2>Inside an I/O callback</h2>
      <Predict
        question={
          <p>
            Inside a <code>readFile</code> callback you call <code>setTimeout(cb, 0)</code> and <code>setImmediate(cb)</code>. Which runs first?
          </p>
        }
        options={['setTimeout', 'setImmediate', 'It varies']}
        answer={1}
        explanation="The callback runs in the poll phase. The next phase is check, so the immediate runs; the timer waits for the timers phase of the next iteration. Always. Step through it — the order below is what Node.js printed:"
      />
      <EventLoopPlayer initial="io" />

      <h2>From the main script it is a race</h2>
      <p>
        <code>setTimeout(cb, 0)</code> is really 1 ms. When the main script schedules both, the first timers phase may come before or after that
        millisecond has passed — it depends on how long startup took. Recorded in {race.runs} fresh processes on this machine:
      </p>
      <Table
        head={['First to print', 'Runs']}
        rows={[
          ['setImmediate', String(race.firsts.immediate)],
          ['setTimeout(0)', String(race.firsts.timeout)],
        ]}
      />
      <CodeBlock title="the program" code={`setTimeout(() => process.stdout.write('timeout'), 0)\nsetImmediate(() => process.stdout.write('immediate'))`} />
      <p>
        Never rely on either order from the main script. In the simulator, the <em>1 ms timer at loop start</em> switch lets you replay both outcomes
        of the <code>basics</code> and <code>timers</code> programs.
      </p>

      <h2>Choosing</h2>
      <Table
        head={['Want', 'Use']}
        rows={[
          ['run after a delay', 'setTimeout(cb, ms) — a minimum, not a guarantee'],
          ['run after the current I/O callbacks, before timers', 'setImmediate(cb)'],
          ['run repeatedly', 'setInterval, or a setTimeout that reschedules itself (no overlap if a run is slow)'],
          ['keep the process alive only while other work exists', 'timer.unref()'],
        ]}
      />

      <Recap
        points={[
          'The event loop repeats: timers → pending → poll (I/O) → check (setImmediate) → close.',
          'It exits when nothing is scheduled or open.',
          'In an I/O callback, setImmediate always runs before setTimeout(0); from the main script it is a race.',
        ]}
      />
    </>
  )
}
