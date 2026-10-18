import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession } from '../components'
import { CAPTURE } from '../data/captures'

const T = CAPTURE.transactions
const busy = CAPTURE.architecture.blockedBusyError

const prettyLua = (src: string) => src.replace(/ (local|if|end|return|redis\.call)/g, '\n$1').replace(/\nend\nreturn/g, '\nend\nreturn').trim()

export default function Transactions() {
  return (
    <>
      <LessonGoals
        goals={[
          'group commands with MULTI/EXEC and know exactly what that guarantees',
          'make read-modify-write safe with WATCH, or with a script',
          'remember that Redis never rolls anything back',
          'choose between a pipeline, a transaction, a script and a function',
        ]}
        before="Lesson 1 — commands run one at a time; lesson 2 — pipelining"
      />

      <h2>MULTI and EXEC: queue, then run in one go</h2>
      <p>
        After <code>MULTI</code>, the server does not run your commands; it answers <code>QUEUED</code> and keeps them. <code>EXEC</code> runs the whole
        queue at once. Because one thread runs everything (lesson 1), no other client’s command can land in the middle: the transaction is{' '}
        <strong>isolated</strong>.
      </p>
      <CliSession steps={T.basic} title="recorded: MULTI / EXEC" />
      <TermList
        items={[
          { term: 'MULTI / EXEC / DISCARD', definition: 'Start queuing / run the queue / throw the queue away.' },
          { term: 'QUEUED', definition: 'The reply to every command between MULTI and EXEC: accepted into the queue, not run yet.' },
          { term: 'WATCH', definition: 'Make the next EXEC fail (reply nil) if any watched key changes before it runs.' },
          { term: 'EVAL / FCALL', definition: 'Run a Lua script / a stored function on the server, atomically.' },
        ]}
      />

      <h2>No rollback — ever</h2>
      <p>
        Errors inside a transaction come in two kinds, and they behave very differently. An error <strong>while running</strong> — here INCR on a
        value that is not a number — fails that one command; the others still run, and whatever they changed stays changed:
      </p>
      <CliSession steps={T.runtimeError} title="recorded: an error during EXEC" />
      <p>
        An error <strong>while queuing</strong> — an unknown command, wrong number of arguments — makes Redis refuse the whole transaction at EXEC:
      </p>
      <CliSession steps={T.queueError} title="recorded: an error while queuing" />
      <CliSession steps={T.discard} title="recorded: DISCARD" />
      <Callout tone="warn" title="Atomic does not mean all-or-nothing">
        A MULTI/EXEC block is atomic in the sense that nobody sees it half done and nobody runs in between. It is <em>not</em> atomic in the database
        sense of “either every change happens or none”: there is no undo log. Validate inputs before EXEC; design commands that cannot fail at run time
        (right types, right key names).
      </Callout>

      <h2>WATCH: optimistic locking</h2>
      <p>
        Commands inside MULTI cannot see each other’s results — <code>GET</code> just returns QUEUED — so you cannot read a value and decide what to write
        within one transaction. The pattern is: <code>WATCH</code> the key, read it, compute, then MULTI/EXEC the write. If anyone changed the key since
        WATCH, EXEC returns nil and nothing runs; you read again and retry.
      </p>
      <CliSession steps={T.watch} title="recorded: two clients, A retries" />
      <Predict
        question={<p>Ten clients run the WATCH–GET–MULTI–SET–EXEC loop on the same counter at the same moment. What happens?</p>}
        options={['All ten succeed in parallel', 'One succeeds per round; the others get nil and retry', 'They deadlock']}
        answer={1}
        explanation="Each EXEC that commits changes the key, so every other watcher’s EXEC fails. Under heavy contention many retries are wasted — that is when a script is the better tool."
      />

      <h2>Scripts: logic on the server, run as one command</h2>
      <p>
        A Lua script sent with <code>EVAL</code> runs on the server from start to finish without anything in between. Inside, <code>redis.call</code>{' '}
        runs commands and sees their results, so read-decide-write needs no WATCH and no retry. This one sells seats but never more than a cap:
      </p>
      <CodeBlock title="sell a seat, up to a limit" language="lua" code={prettyLua(T.scriptSource)} />
      <CliSession steps={T.script} title="recorded: cap of 3" />
      <p>And the same rule about errors applies: a script that fails halfway keeps what it already did.</p>
      <CliSession steps={T.scriptError} title="recorded: SET, then an error" />
      <p>
        Sending the full script every time costs bandwidth. <code>SCRIPT LOAD</code> returns its SHA1 and <code>EVALSHA</code> runs it by hash. But the
        script cache is not data: it disappears on restart, failover or <code>SCRIPT FLUSH</code>, and the client must fall back to EVAL on{' '}
        <code>NOSCRIPT</code> (client libraries do this for you):
      </p>
      <CliSession steps={T.evalsha} title="recorded: EVALSHA and NOSCRIPT" />

      <h3>Functions: named, stored with the data</h3>
      <p>
        Since Redis 7, <code>FUNCTION LOAD</code> stores a library of named functions in the server itself. Unlike the script cache, functions are
        persisted in RDB/AOF and replicated, so a primary’s replicas always have them (in a cluster, load them on every primary — each shard is
        separate); clients call them with <code>FCALL name numkeys keys… args…</code>.
      </p>
      <CodeBlock title="a function library" language="lua" code={T.functionSource} />
      <CliSession steps={T.functions} title="recorded: FCALL" />

      <Callout tone="warn" title="A script blocks everyone while it runs">
        Lesson 1 recorded a {busy.slowMs} ms script: other clients waited, and after <code>busy-reply-threshold</code> they got{' '}
        <code>{busy.ping}</code>. Keep scripts short and bounded — no loops over big keys, no waiting.
      </Callout>
      <Callout tone="note" title="Declare your keys">
        Pass every key a script touches in <code>KEYS</code> (the numkeys argument) instead of building names inside the script. Redis Cluster uses them
        to route the call and requires them all in one slot (lesson 12); ACLs check them too.
      </Callout>

      <h2>Which tool when</h2>
      <Table
        head={['', 'Fewer round trips', 'Nothing in between', 'Read, decide, write', 'Rollback on error']}
        rows={[
          ['Pipeline', 'yes', 'no', 'no', 'no'],
          ['MULTI / EXEC', 'yes (with pipelining)', 'yes', 'no', 'no'],
          ['WATCH + MULTI / EXEC', 'no — read, then write', 'yes, or EXEC fails', 'yes, with retries', 'no (nothing runs if aborted)'],
          ['EVAL (Lua script)', 'yes', 'yes', 'yes, on the server', 'no'],
          ['FCALL (function)', 'yes', 'yes', 'yes, on the server', 'no'],
        ]}
      />

      <h2>Design rules</h2>
      <Callout tone="tip" title="Getting it right">
        <ul>
          <li>Need speed only? Pipeline. Need “nobody in between”? MULTI/EXEC. Need a decision based on current data? A script or function.</li>
          <li>Prefer one small script over WATCH loops when many clients compete for the same keys.</li>
          <li>Never rely on rollback: check types and arguments before EXEC, and write scripts that validate before their first write.</li>
          <li>Keep scripts short; anything heavy blocks every client.</li>
          <li>Pass keys in KEYS, keep them in one hash slot, and ship logic used everywhere as a FUNCTION library.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'MULTI queues, EXEC runs the queue with nothing in between — isolation, not rollback.',
          'A run-time error fails one command and the rest stays; a queuing error aborts the whole EXEC.',
          'WATCH makes EXEC fail if a watched key changed: optimistic locking with retries.',
          'Lua scripts and functions read, decide and write atomically on the server — and also never roll back.',
        ]}
      />
    </>
  )
}
