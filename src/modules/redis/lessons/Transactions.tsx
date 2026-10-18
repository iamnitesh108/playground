import { Callout, CodeBlock, LessonGoals, Predict, Recap, TermList } from '@/shared/ui'
import { Flow, Timeline, type TimelineEvent, type TimelineSegment } from '@/shared/figures'
import { CliSession } from '../components/CliSession'
import { TransactionsMatrix, TransactionsNoRollback } from '../components/TransactionsFigures'
import { CAPTURE } from '../data/captures'

const T = CAPTURE.transactions
const busy = CAPTURE.architecture.blockedBusyError

/** The recorded EXEC with a failing command: what was queued, what each reply was, what stayed. */
const rt = T.runtimeError.filter((st) => 'cmd' in st)
const queued = rt.filter((st) => st.out === 'QUEUED').map((st) => st.cmd)
const execReplies = (rt.find((st) => st.cmd === 'EXEC')?.out ?? '').split('\n').map((l) => l.replace(/^\d+\) /, ''))
const counterAfter = rt.find((st) => st.cmd === 'GET counter')?.out ?? ''

/** The recorded WATCH session as a timeline: one step per command, the key's value on its own lane. */
const watchSteps = T.watch.filter((st): st is Extract<(typeof T.watch)[number], { cmd: string }> => 'cmd' in st)
const shortStep = (cmd: string, out: string) => {
  const verb = cmd.split(' ')[0]
  if (verb === 'GET') return `GET ${out.replaceAll('"', '')}`
  if (verb === 'EXEC') return out === '(nil)' ? 'EXEC nil' : 'EXEC OK'
  if (verb === 'INCRBY') return `INCRBY → ${out.replace('(integer) ', '')}`
  if (verb === 'SET') return `SET ${cmd.split(' ')[2]}`
  return verb
}
/** Client A's reads and its transaction go on separate lanes so neighbouring labels do not collide. */
const watchLane = (who: string, cmd: string) => (who === 'B' ? 'B' : /^(WATCH|GET)/.test(cmd) ? 'Aread' : 'Atx')
const watchHue = (st: (typeof watchSteps)[number]) => {
  if (st.cmd === 'EXEC') return st.out === '(nil)' ? 8 : 6
  return 1
}
const watchEvents: TimelineEvent[] = watchSteps.map((st, i) => ({ lane: watchLane(st.who, st.cmd), at: i, label: shortStep(st.cmd, st.out), hue: watchHue(st) }))
const watchValue = (() => {
  const segs: TimelineSegment[] = []
  let value = watchSteps.find((st) => st.cmd.startsWith('GET'))?.out.replaceAll('"', '') ?? ''
  let from = 0
  watchSteps.forEach((st, i) => {
    let next: string | null = null
    if (st.who === 'B') next = st.out.replace('(integer) ', '')
    if (st.cmd === 'EXEC' && st.out !== '(nil)') next = [...watchSteps.slice(0, i)].reverse().find((x) => x.cmd.startsWith('SET'))?.cmd.split(' ')[2] ?? null
    if (next !== null) {
      segs.push({ lane: 'key', from, to: i, label: `= ${value}`, hue: 3 })
      value = next
      from = i
    }
  })
  segs.push({ lane: 'key', from, to: watchSteps.length + 1, label: `= ${value}`, hue: 6 })
  return segs
})()

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
      <p>A transaction is a list of commands that Redis runs back to back, with no other client’s command in between.</p>
      <p>
        After <code>MULTI</code>, the server does not run your commands; it answers <code>QUEUED</code> and keeps them. <code>EXEC</code> runs the whole
        queue at once. Because one thread runs everything (lesson 1), no other client’s command can land in the middle: the transaction is{' '}
        <strong>isolated</strong>.
      </p>
      <Flow
        title="MULTI queues, EXEC runs the queue — another client cannot get in between"
        cols={4}
        rows={2}
        nodes={[
          { id: 'a', label: 'client A', sub: 'MULTI … EXEC', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'queue', label: 'queue of A', sub: 'DECRBY, RPUSH', col: 1, row: 0, hue: 2, shape: 'queue' },
          { id: 'exec', label: 'EXEC', sub: 'runs all, one go', col: 2, row: 0, hue: 2 },
          { id: 'keyspace', label: 'keyspace', sub: 'stock:42, orders:42', col: 3, row: 0, rowSpan: 2, hue: 3, shape: 'store' },
          { id: 'b', label: 'client B', sub: 'any command', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 'wait', label: 'before or after', sub: 'never in the middle', col: 2, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'a', to: 'queue', flow: true, hue: 1 },
          { from: 'queue', to: 'exec', hue: 2 },
          { from: 'exec', to: 'keyspace', flow: true, hue: 2 },
          { from: 'b', to: 'wait', flow: true, hue: 1 },
          { from: 'wait', to: 'keyspace', dashed: true, hue: 8 },
        ]}
        steps={[
          { title: 'MULTI: start queuing', body: <p>After MULTI every command gets the reply QUEUED and is kept in this connection’s queue — nothing runs yet.</p>, active: ['a', 'queue', 'a>queue'] },
          { title: 'Meanwhile, client B', body: <p>Other clients keep running commands while A is still queuing — A has not locked anything.</p>, active: ['b', 'wait', 'keyspace', 'b>wait', 'wait>keyspace'] },
          { title: 'EXEC: the whole queue in one go', body: <p>EXEC runs every queued command back to back on the one thread. B’s next command runs before or after — never in the middle.</p>, active: ['queue', 'exec', 'keyspace', 'queue>exec', 'exec>keyspace'] },
        ]}
      />
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
      <TransactionsNoRollback
        title="The same EXEC, command by command"
        commands={queued.map((cmd, i) => ({ cmd, reply: execReplies[i] ?? '' }))}
        after={`counter = ${counterAfter}`}
      />
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
      <Timeline
        title="The same session over time: B’s write makes A’s first EXEC fail; the retry wins"
        start={0}
        end={watchSteps.length + 1}
        unit="steps"
        lanes={[
          { id: 'Aread', label: 'A: watch, read' },
          { id: 'Atx', label: 'A: MULTI / EXEC' },
          { id: 'B', label: 'client B' },
          { id: 'key', label: 'balance:7' },
        ]}
        segments={watchValue}
        events={watchEvents}
        playable
      />
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
      <p>The four tools differ in three things: round trips, isolation and whether the server can decide based on what it reads.</p>
      <TransactionsMatrix
        title="Which tool gives what"
        columns={['Fewer round trips', 'Nothing in between', 'Read, decide, write', 'Rollback on error']}
        rows={[
          { tool: 'Pipeline', cells: [{ verdict: 'yes', text: 'yes' }, { verdict: 'no', text: 'no' }, { verdict: 'no', text: 'no' }, { verdict: 'no', text: 'no' }] },
          { tool: 'MULTI / EXEC', cells: [{ verdict: 'yes', text: 'yes, with pipelining' }, { verdict: 'yes', text: 'yes' }, { verdict: 'no', text: 'no' }, { verdict: 'no', text: 'no' }] },
          { tool: 'WATCH + MULTI / EXEC', cells: [{ verdict: 'no', text: 'no — read, then write' }, { verdict: 'partly', text: 'yes, or EXEC fails' }, { verdict: 'partly', text: 'yes, with retries' }, { verdict: 'no', text: 'no (nothing runs if aborted)' }] },
          { tool: 'EVAL (Lua script)', cells: [{ verdict: 'yes', text: 'yes' }, { verdict: 'yes', text: 'yes' }, { verdict: 'yes', text: 'yes, on the server' }, { verdict: 'no', text: 'no' }] },
          { tool: 'FCALL (function)', cells: [{ verdict: 'yes', text: 'yes' }, { verdict: 'yes', text: 'yes' }, { verdict: 'yes', text: 'yes, on the server' }, { verdict: 'no', text: 'no' }] },
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
