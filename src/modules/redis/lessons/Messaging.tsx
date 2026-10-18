import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { CliSession, LogLines, StreamPlayground } from '../components'
import { CAPTURE } from '../data/captures'
import styles from './lesson.module.css'

const M = CAPTURE.messaging
const S = M.slowSubscriber
const mb = (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`
const limits = M.outputBufferDefault.split(' ')
const [pubsubHard, pubsubSoft, pubsubSeconds] = limits.slice(limits.indexOf('pubsub') + 1)

export default function Messaging() {
  return (
    <>
      <LessonGoals
        goals={[
          'tell apart the three ways Redis moves messages: Pub/Sub, lists and Streams',
          'build a queue that does not lose a job when a worker crashes',
          'use consumer groups: pending entries, acknowledgements and claiming',
          'pick the right tool for an event, a job or a log',
        ]}
        before="Lesson 1 — one thread, blocking commands; lesson 9 — idempotency keys"
      />

      <h2>Three tools, three promises</h2>
      <p>
        Redis has no single “message queue” feature. It has three building blocks that make very different promises about what happens to a
        message nobody is reading at the moment it is sent. That one question decides which to use.
      </p>
      <TermList
        items={[
          { term: 'Pub/Sub', definition: 'A message is pushed to whoever is subscribed right now, then forgotten. Nothing is stored.' },
          { term: 'List queue', definition: 'A message is an element of a list; a worker removes it. Stored until taken, but each element goes to one worker only.' },
          { term: 'Stream', definition: 'An append-only log of entries with ids. Entries stay after they are read; consumer groups track who read and acknowledged what.' },
          { term: 'Consumer group', definition: 'A named reader of a stream with one position (last delivered id) shared by its consumers, who split the entries between them.' },
          { term: 'PEL', definition: 'Pending entries list: entries delivered to a consumer of a group but not yet acknowledged with XACK.' },
        ]}
      />

      <h2>Pub/Sub: fire and forget</h2>
      <p>
        A subscriber’s connection is switched into a special mode where the server pushes messages to it. <code>PUBLISH</code> returns how many
        clients received the message — and that number is the whole delivery guarantee. Two subscribers, one on a channel and one on a pattern:
      </p>
      <CliSession title="recorded: one publisher, two subscribers that go away" steps={M.pubsub} />
      <p>
        <code>order 1003</code> was published, acknowledged with <code>(integer) 0</code>, and is gone: no buffer, no retry, no history. A
        subscriber that reconnects starts with the next message.
      </p>

      <Predict
        question={<p>A service subscribes to <code>orders</code>. It is redeployed and is disconnected for 4 seconds while 20 orders are published. How many of them does it receive after reconnecting?</p>}
        options={['All 20, in order', 'Only the last one', 'None of them']}
        answer={2}
        explanation="Pub/Sub only delivers to connections that are subscribed at the moment of PUBLISH. The 20 messages went to the other subscribers (or to nobody) and were never stored."
      />

      <h3>A subscriber that cannot keep up</h3>
      <p>
        Messages for a slow subscriber pile up in its output buffer on the server, in Redis’s memory. The limit for Pub/Sub clients is
        part of <code>client-output-buffer-limit</code>; the default is <code>pubsub {mb(Number(pubsubHard))} {mb(Number(pubsubSoft))} {pubsubSeconds}</code>:
        disconnect at {mb(Number(pubsubHard))}, or after more than {mb(Number(pubsubSoft))} for {pubsubSeconds} seconds. Recorded with a lower
        limit (<code>{S.limit}</code>) and a subscriber that stopped reading while {mb(S.publishedBytes)} were published:
      </p>
      <LogLines title="server log" lines={S.log} highlight={/scheduled to be closed/} />
      <p className={styles.note}>
        The server dropped the subscriber ({S.disconnections} disconnection in <code>client_output_buffer_limit_disconnections</code>,{' '}
        {S.subscribersAtEnd} subscribers left). That protects Redis — and silently loses everything that subscriber had not read.
      </p>
      <Callout tone="note" title="Pub/Sub in a cluster">
        Classic <code>PUBLISH</code> is broadcast to every node of a Redis Cluster, which gets expensive with many nodes. Sharded Pub/Sub
        (<code>SPUBLISH</code> / <code>SSUBSCRIBE</code>, Redis 7+) hashes the channel name to a slot like a key, so a message only travels to the
        shard that owns it (lesson 12).
      </Callout>
      <p>
        Use Pub/Sub for things where a missed message does not matter or is repaired another way: “cache entry X changed, drop your local
        copy”, live dashboards, chat typing indicators, a websocket fan-out where the client reloads state on reconnect.
      </p>

      <h2>Lists as a work queue</h2>
      <p>
        A list is a simple, fast queue: producers <code>LPUSH</code>, workers pop from the other end. The blocking variants
        (<code>BLPOP</code>, <code>BLMOVE</code>) wait on the server until an element arrives, so workers do not poll. The danger is the moment
        between “taken from the queue” and “work done”: if the worker dies there, a plain <code>BLPOP</code> has already removed the job.
      </p>
      <p>
        The reliable pattern moves the job atomically into a per-worker <em>processing</em> list, and removes it from there only when the work
        is finished:
      </p>
      <CliSession title="recorded: a reliable queue with BLMOVE" steps={M.listQueue} />
      <p>
        <code>BLPOP jobs:sms 5</code> blocked until the producer pushed — the reply arrived the moment <code>RPUSH</code> ran, not after
        polling. A separate “reaper” periodically looks at processing lists of dead workers and moves stale jobs back to the main queue.
      </p>
      <Callout tone="warn" title="What a list cannot do">
        One element goes to exactly one consumer, and once acknowledged (removed) it is gone. Two different services cannot both process every
        job, there is no replay, and the reaper is your code. When you need those, use a stream.
      </Callout>

      <h2>Streams: a log with consumer groups</h2>
      <p>
        A stream is an append-only sequence of entries, each a small hash of fields, with an id <code>&lt;milliseconds&gt;-&lt;sequence&gt;</code>{' '}
        that only grows. Reading does not remove anything. A <strong>consumer group</strong> keeps one position per group and hands every new
        entry to exactly one of its consumers; each delivered entry waits in that consumer’s pending list until it is acknowledged.
      </p>
      <CliSession title="recorded: a stream, a group, two workers, a crash and a claim" steps={M.streams} />
      <Table
        head={['Step', 'What it shows']}
        rows={[
          ['XREADGROUP … >', 'the special id > means “entries never delivered to this group”; worker-1 and worker-2 got different entries'],
          ['XPENDING', 'worker-2 crashed holding two entries: they are delivered but not acknowledged, with an idle time and a delivery count'],
          ['XAUTOCLAIM … 1000', 'entries idle for more than 1000 ms change owner; worker-1 processes them'],
          ['XINFO GROUPS', 'pending 0, lag 0: every entry was delivered and acknowledged'],
          ['a second group (analytics)', 'a second group starts at 0 and reads every entry again — each group is an independent reader of the same log'],
        ]}
      />
      <StreamPlayground />

      <h3>Blocking reads and trimming</h3>
      <CliSession title="recorded: a consumer waiting for new entries" steps={M.streamsBlocking} />
      <p>
        Streams live in memory, so they must be capped. <code>MAXLEN ~</code> trims whole internal nodes (macro nodes of up to 100 entries by
        default), which is cheap; an exact <code>MAXLEN</code> may have to cut inside a node:
      </p>
      <CliSession title="recorded: trimming a stream of 2000 entries" steps={M.streamTrim} />
      <p className={styles.note}>
        Here the approximate trim happened to land exactly on 1000 because the entries filled whole nodes; in general <code>~</code> leaves a few
        more than asked. Trim on every write with <code>XADD key MAXLEN ~ N * …</code>, or by age with <code>MINID ~</code>.
      </p>

      <h2>Which one?</h2>
      <Table
        head={['', 'Pub/Sub', 'List queue', 'Stream + group', 'Log-based broker']}
        rows={[
          ['Stored?', 'no', 'until taken', 'yes, until trimmed', 'yes, on disk, by retention time'],
          ['Missed while offline', 'lost', 'waits in the list', 'waits; read on return', 'waits; read on return'],
          ['Several independent readers', 'yes (all subscribers)', 'no', 'yes (one group each)', 'yes (one group each)'],
          ['Crashed consumer', 'nothing to recover', 'your processing-list pattern', 'PEL + XAUTOCLAIM', 'uncommitted offset re-read'],
          ['Replay old messages', 'no', 'no', 'yes, by id', 'yes, by offset or time'],
          ['Ordering', 'per publisher connection', 'per list', 'per stream', 'per partition'],
          ['Size limit', 'output buffers', 'RAM', 'RAM — trim it', 'disk'],
          ['Good for', 'notifications, invalidation', 'simple background jobs', 'jobs and events inside one system', 'high-volume event logs kept for days'],
        ]}
      />
      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Streams and list queues deliver <strong>at least once</strong>: after a crash and a claim, an entry is processed again. Make consumers idempotent (an idempotency key, a unique constraint — lesson 9).</li>
          <li>Watch the delivery count in <code>XPENDING</code>; after N attempts move the entry to a dead-letter stream instead of retrying forever.</li>
          <li>Always trim streams (<code>MAXLEN ~</code> or <code>MINID ~</code>) and alert on group lag; a stream nobody reads grows until memory is full.</li>
          <li>Use Pub/Sub only where a lost message is acceptable or repaired by a reload.</li>
          <li>When messages must survive for days, be replayed at volume, or exceed RAM, use a disk-based log broker and keep Redis for the fast parts.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'PUBLISH returns the number of receivers; a message to nobody is gone, and a slow subscriber is disconnected at its output-buffer limit.',
          'A reliable list queue moves the job into a processing list (BLMOVE) and removes it only after the work is done.',
          'A stream keeps entries; a consumer group delivers each entry to one consumer and keeps it pending until XACK; XAUTOCLAIM rescues a crashed consumer’s entries.',
          'Everything here is at least once and in memory: idempotent consumers, dead letters, and trimming are part of the design.',
        ]}
      />
    </>
  )
}
