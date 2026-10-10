import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const SEQ = `await sleep(200)
await sleep(200)
await sleep(200)`
const PAR = `await Promise.all([sleep(200), sleep(200), sleep(200)])`
const ALL = `await Promise.all([
  sleep(100, 'a'),
  fail(50, 'payment service down'),
  sleep(300, 'c'),
])`
const FOREACH = `const done = []
;[1, 2, 3].forEach(async (n) => {
  await sleep(50)
  done.push(n)
})
console.log(done)          // right after forEach`

export default function Async() {
  const { async: a, errors } = CAPTURE
  const out = (r: { stdout: string; stderr: string; exit: number | null }) => [r.stdout, r.stderr].filter(Boolean).join('\n') + `\n(exit code ${r.exit})`
  return (
    <>
      <LessonGoals
        goals={[
          'run independent operations concurrently instead of one after another',
          'choose between Promise.all and Promise.allSettled',
          'know where an error goes, and what an unhandled rejection does',
          'avoid the async-forEach trap',
        ]}
        before="Lesson 4 — await is a microtask"
      />

      <h2>Sequential or concurrent</h2>
      <p>Three independent calls of 200 ms each — awaited one by one, then together. Recorded:</p>
      <div className={own.grid2}>
        <CodeBlock title={`sequential: ${a.sequentialMs} ms`} code={SEQ} />
        <CodeBlock title={`Promise.all: ${a.parallelMs} ms`} code={PAR} />
      </div>
      <p>
        <code>await</code> waits before starting the next line. When the calls do not depend on each other, start them all first and await them
        together. Concurrency is not free: thousands at once can overload a database or an API — limit it (a small pool, or batches).
      </p>

      <h2>When one fails</h2>
      <Predict
        question={<p>Three promises; the second rejects after 50 ms. What does <code>await Promise.all([...])</code> do?</p>}
        options={['Waits for all three, then throws', 'Throws as soon as the second rejects', 'Returns two results and one error']}
        answer={1}
        explanation="Promise.all rejects with the first error, immediately. The other operations keep running — their results are just ignored."
      />
      <div className={own.grid2}>
        <CodeBlock title="Promise.all — recorded" code={`${ALL}\n\n→ throws: ${a.allError}`} />
        <CodeBlock
          title="Promise.allSettled — recorded"
          code={`${ALL.replace('Promise.all', 'Promise.allSettled')}\n\n→ ${a.allSettled.map((r) => JSON.stringify(r)).join('\n  ')}`}
        />
      </div>
      <Table
        head={['Combinator', 'Resolves', 'Rejects']}
        rows={[
          ['Promise.all', 'with all values, in order', 'at the first rejection'],
          ['Promise.allSettled', 'always, with {status, value | reason} for each', 'never'],
          ['Promise.race', 'with the first to settle', 'if the first to settle rejects'],
          ['Promise.any', 'with the first to fulfil', 'only if all reject (AggregateError)'],
        ]}
      />

      <h2>Where errors go</h2>
      <p>try/catch catches errors thrown <em>now</em>. A callback runs later, from the event loop, outside your try block:</p>
      <div className={own.grid2}>
        <CodeBlock
          title="callback — recorded"
          code={`try {\n  setTimeout(() => { throw new Error('thrown inside setTimeout') }, 0)\n  console.log('try block finished without error')\n} catch (e) {\n  console.log('caught:', e.message)\n}\n\n${out(errors.tryCatch)}`}
        />
        <CodeBlock
          title="await — recorded"
          code={`try {\n  await charge()          // rejects after 10 ms\n} catch (e) {\n  console.log('caught:', e.message)\n}\n\n${out(errors.awaitCatch)}`}
        />
      </div>
      <p>With await, the rejection resumes the function inside the try block, so catch works. That is the main reason to prefer async/await over callbacks.</p>
      <h3>Unhandled rejections end the process</h3>
      <CodeBlock title="recorded" code={`setTimeout(() => console.log('this line never runs'), 100)\nPromise.reject(new Error('card declined'))\n\n${out(errors.unhandled)}`} />
      <Callout tone="warn" title="Since Node.js 15">
        A rejected promise with no handler is treated like an uncaught exception: the process prints the error and exits with code 1. Every promise
        needs an await or a <code>.catch</code> somewhere — including fire-and-forget calls.
      </Callout>

      <h2>forEach does not wait</h2>
      <div className={own.grid2}>
        <CodeBlock title="recorded" code={`${FOREACH}\n\n→ ${JSON.stringify(a.forEachDoneRightAfter)}   (100 ms later: ${JSON.stringify(a.forEachDoneLater)})`} />
        <CodeBlock title="recorded" code={`const seen = []\nfor (const n of [1, 2, 3]) {\n  await sleep(50)\n  seen.push(n)\n}\n\n→ ${JSON.stringify(a.forOfDone)}`} />
      </div>
      <p>
        forEach ignores the promises its callback returns. Use <code>for … of</code> to go one by one, or <code>await Promise.all(items.map(…))</code>{' '}
        to go concurrently.
      </p>

      <Recap
        points={[
          'Start independent work together and await it together.',
          'Promise.all fails fast; allSettled reports every outcome.',
          'try/catch catches awaited rejections, not errors thrown later in callbacks.',
          'An unhandled rejection exits the process with code 1.',
          'forEach does not await; use for…of or Promise.all with map.',
        ]}
      />
    </>
  )
}
