import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const HANDLER = `process.on('SIGTERM', () => {
  log('SIGTERM received: stop accepting, finish in-flight requests')
  server.close(() => {                      // stop accepting; callback when all connections are closed
    log('all connections closed, exiting')
    process.exit(0)
  })
  setTimeout(() => {                        // never hang forever
    log('still busy after 10 s, forcing exit')
    process.exit(1)
  }, 10_000).unref()
})`

export default function Shutdown() {
  const { abrupt, graceful } = CAPTURE.shutdown
  const exitOf = (e: { code: number | null; signal: string | null }) => (e.signal ? `killed by ${e.signal} (a shell shows exit code 143 = 128 + 15)` : `exit code ${e.code}`)
  return (
    <>
      <LessonGoals
        goals={[
          'know how a Node.js process ends, and with which exit code',
          'handle SIGTERM so deploys do not cut requests off',
          'decide what to do after an uncaught exception',
        ]}
        before="Lesson 6 — unhandled rejections; lesson 8 — keep-alive"
      />

      <h2>How a process ends</h2>
      <Table
        head={['Situation', 'Result']}
        rows={[
          ['nothing left in the event loop', 'exit code 0 (or process.exitCode if you set it)'],
          ['process.exit(n)', 'exits at once with code n — pending callbacks and buffered writes may be lost'],
          ['uncaught exception, unhandled rejection', 'error printed, exit code 1 (recorded in lesson 6)'],
          ['SIGTERM / SIGINT with no handler', 'killed by the signal; a shell reports 128 + signal number (143, 130)'],
          ['SIGKILL', 'killed at once; cannot be caught'],
        ]}
      />
      <p>
        Orchestrators stop a service by sending <strong>SIGTERM</strong>, waiting (Kubernetes: 30 s by default, Docker: 10 s), then sending SIGKILL.
        What happens to requests that are in progress at that moment?
      </p>

      <h2>Without a handler</h2>
      <Predict
        question={<p>A request is being handled (it takes 1 s). After 200 ms the process receives SIGTERM, and there is no handler. What does the client get?</p>}
        options={['The response, then the process exits', 'An error: the connection is reset', 'A 503 Service Unavailable']}
        answer={1}
        explanation="The default action for SIGTERM is to terminate immediately. The socket is closed mid-request. Recorded:"
      />
      <div className={own.grid2}>
        <CodeBlock title="server log — recorded" code={abrupt.log} />
        <CodeBlock title="outcome — recorded" code={`process: ${exitOf(abrupt.exit)}\nclient:  ${abrupt.client}`} />
      </div>

      <h2>With a handler</h2>
      <CodeBlock title="graceful shutdown" code={HANDLER} />
      <div className={own.grid2}>
        <CodeBlock title="server log — recorded" code={graceful.log} />
        <CodeBlock title="outcome — recorded" code={`process: ${exitOf(graceful.exit)}\nclient:  ${graceful.client}`} />
      </div>
      <p>
        <code>server.close()</code> stops accepting new connections and waits for open ones to finish. The request that was in progress completed,
        then the process exited with 0. Since Node.js 19, <code>close()</code> also closes idle keep-alive connections; busy ones are closed after
        their current response.
      </p>
      <Callout tone="tip" title="A complete shutdown, in order">
        1. Mark the service not ready (fail the readiness check) so the load balancer stops sending traffic. 2. <code>server.close()</code>. 3. Stop
        consumers and background jobs. 4. Close pools: database, Redis, Kafka producers (flush them). 5. Exit with 0 — and have a timer that forces
        exit before the orchestrator’s SIGKILL.
      </Callout>

      <h2>After an uncaught exception</h2>
      <p>
        <code>process.on('uncaughtException', …)</code> keeps the process alive — but the program is now in an unknown state: a half-finished
        operation, a lock not released, a connection in the middle of a protocol exchange. The safe pattern is to log the error, shut down
        gracefully, and let the process manager start a fresh process.
      </p>
      <CodeBlock
        title="last-resort handlers"
        code={`process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaught exception')
  shutdown(1)           // the same graceful path, then exit code 1
})
process.on('unhandledRejection', (reason) => {
  throw reason          // turn it into an uncaught exception, handled above
})`}
      />

      <Recap
        points={[
          'SIGTERM without a handler kills the process at once; in-flight requests are reset.',
          'Handle SIGTERM: stop accepting (server.close), finish in-flight work, close pools, exit 0 — with a deadline.',
          'Exit codes: 0 success, 1 uncaught error, 128 + n for a signal.',
          'After an uncaught exception, log and restart; do not carry on.',
        ]}
      />
    </>
  )
}
