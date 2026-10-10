import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const APP = `function Clock({ time }) { return <p>Rendered at <time>{time}</time></p> }
function LikeButton() {
  const [likes, setLikes] = useState(0)
  return <button onClick={() => setLikes(likes + 1)}>{likes} likes</button>
}
function App({ time }) { return <main><Clock time={time} /><LikeButton /></main> }`

export default function Hydration() {
  const h = CAPTURE.hydration
  return (
    <>
      <LessonGoals
        goals={[
          'know what server rendering produces',
          'explain hydration: attaching React to existing HTML',
          'recognise and fix a hydration mismatch',
        ]}
        before="Lesson 4 — reconciliation"
      />

      <h2>HTML first, interactivity later</h2>
      <p>
        With client rendering the browser receives an empty page plus JavaScript, and nothing is visible until the JavaScript runs. With{' '}
        <strong>server rendering</strong> the server runs the same components and sends finished HTML: the user sees content at once. Then the JavaScript
        loads and <strong>hydrates</strong> it.
      </p>
      <CodeBlock title="app.jsx" code={APP} />
      <CodeBlock title="renderToString(<App time=&quot;10:00:00&quot; />) — recorded" code={h.html} />
      <p>
        The <code>{'<!-- -->'}</code> comment separates two adjacent text pieces (<code>{'{likes}'}</code> and “ likes”) so the browser does not merge them
        into one text node — hydration needs to find each one.
      </p>

      <h2>Hydration reuses the DOM</h2>
      <Predict
        question={<p>When the browser calls <code>hydrateRoot</code> on that HTML, does React create a new button?</p>}
        options={['Yes, it replaces the server HTML', 'No, it adopts the existing nodes and attaches event handlers']}
        answer={1}
        explanation={`Recorded: the button after hydration was the same DOM node the server sent (${h.match.sameButtonNode}), and clicking it worked (“${h.match.afterClick}”).`}
      />
      <CodeBlock
        title="client entry"
        code={`import { hydrateRoot } from 'react-dom/client'
hydrateRoot(document.getElementById('root'), <App time={timeFromServer} />)`}
      />
      <p>
        Hydration renders the components in the browser and walks the existing DOM alongside, expecting it to match exactly. Where it matches, it keeps the
        node and attaches listeners.
      </p>

      <h2>A mismatch</h2>
      <p>The server rendered at 10:00:00; the client rendered with the time it saw itself, 10:00:03:</p>
      <div className={own.grid2}>
        <CodeBlock title="onRecoverableError — recorded" code={h.mismatch.recoverableErrors.join('\n')} />
        <CodeBlock title="DOM afterwards — recorded" code={h.mismatch.html} />
      </div>
      <p>React threw away the server HTML for that tree and rendered it again on the client. The page still works, but the server rendering was wasted and the content may flash.</p>
      <Table
        head={['Common cause', 'Fix']}
        rows={[
          ['Date.now(), new Date(), Math.random() in render', 'compute on the server and pass it down as a prop or data'],
          ['typeof window checks in render', 'render the same thing first; change it in an effect after hydration'],
          ['locale-dependent formatting (dates, numbers)', 'use the same locale and time zone on both sides'],
          ['invalid HTML nesting (<p> inside <p>, <div> inside <p>)', 'the browser fixes it differently from React: use valid nesting'],
          ['browser extensions changing the DOM', 'outside your control; React tolerates some changes'],
        ]}
      />
      <Callout tone="note" title="Server Components are a different thing">
        React Server Components run only on the server and send a description of the UI, not HTML, and their code never ships to the browser. They are
        usually combined with server rendering by frameworks such as Next.js; hydration is still what makes the client parts interactive.
      </Callout>

      <Recap
        points={[
          'Server rendering sends HTML; hydration makes it interactive by adopting the existing DOM.',
          'Server and client must render the same output for the first render.',
          'A mismatch makes React re-render that tree on the client and report a recoverable error.',
        ]}
      />
    </>
  )
}
