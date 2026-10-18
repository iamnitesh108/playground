import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { CliSession } from '../components'
import { UsingRedisAppOutput } from '../components/UsingRedisAppOutput'
import { USAGE } from '../data/usage'
import { USAGE_APP } from '../data/usageApp'

const U = USAGE

// ---- recorded numbers, read from the recordings rather than retyped
const timeoutLine = U.appTimeout.find((l) => l.includes('Exception')) ?? ''
const timedOutAfter = Number(timeoutLine.match(/after (\d+) ms/)?.[1])
const configured = U.appConfig.map((l) => l.split('->')[1].trim())

interface Incr {
  at: number
  value: number
  waited: number
}
const incrs: Incr[] = U.appReconnect.flatMap((l) => {
  const m = l.match(/^\s*(\d+) ms {2}incr\("visits"\) {2}-> {2}(\d+)(?: {2}\(waited (\d+) ms\))?/)
  return m ? [{ at: Number(m[1]), value: Number(m[2]), waited: Number(m[3] ?? 0) }] : []
})
const slow = incrs.find((i) => i.waited > 0) ?? incrs[0]
const before = incrs[incrs.indexOf(slow) - 1]
const last = incrs[incrs.length - 1]
// The recording script stopped the server 1500 ms after the first INCR and restarted it downMs later
const downFrom = 1500
const downTo = downFrom + U.downMs
const reconnectLogs = U.appReconnect.filter((l) => !l.includes(' ms  incr') && !l.startsWith('# '))

const watchRetry = U.appWatch.filter((l) => l.startsWith('attempt')).length

export default function Clients() {
  return (
    <>
      <LessonGoals
        goals={[
          'know why one Lettuce connection serves a whole application, and when it does not',
          'configure Redis in Micronaut, including the timeout trap',
          'predict what your code sees when the server is slow, restarts, or another client changes your data',
        ]}
        before="Using Redis day to day"
      />

      <h2>One connection, many threads</h2>
      <p>A Lettuce connection is thread-safe: every thread in your app can send commands over the same one.</p>
      <Flow
        title="Lettuce: many threads, one shared connection"
        cols={3}
        rows={3}
        rowHeight={72}
        nodes={[
          { id: 't1', label: 'thread 1', sub: 'GET', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 't2', label: 'thread 2', sub: 'INCR', col: 0, row: 1, hue: 1, shape: 'actor' },
          { id: 't3', label: 'thread 3', sub: 'HSET', col: 0, row: 2, hue: 1, shape: 'actor' },
          { id: 'conn', label: 'one connection', sub: 'commands in order', col: 1, row: 1, hue: 7 },
          { id: 'srv', label: 'Redis server', sub: 'replies in order', col: 2, row: 1, hue: 2 },
        ]}
        edges={[
          { from: 't1', to: 'conn', flow: true, hue: 1 },
          { from: 't2', to: 'conn', flow: true, hue: 1 },
          { from: 't3', to: 'conn', flow: true, hue: 1 },
          { from: 'conn', to: 'srv', both: true, label: 'TCP', hue: 7 },
        ]}
        caption="Redis answers commands on a connection in the order they were sent, so the client matches each reply to the command that is waiting for it."
      />
      <TermList
        items={[
          { term: 'multiplexing', definition: 'Many callers share one connection; their commands are written one after another and replies come back in the same order.' },
          { term: 'connection pool', definition: 'A set of open connections; each caller borrows one, uses it alone, and returns it. Jedis works this way.' },
          { term: 'connection state', definition: 'Things a connection remembers: SELECTed database, WATCHed keys, an open MULTI, subscriptions, CLIENT TRACKING.' },
        ]}
      />
      <p>
        Because of this, Micronaut creates <strong>one</strong> <code>StatefulRedisConnection</code> and injects it everywhere. You do not need a
        pool for ordinary commands — a pool would only add connections the server has to keep. You need a connection of your own when a command
        either <strong>holds</strong> the connection or <strong>changes its state</strong>:
      </p>
      <Table
        head={['You use…', 'Why the shared connection is wrong', 'Instead']}
        rows={[
          [<code key="a">BLPOP / BRPOP / XREAD BLOCK</code>, 'it waits on the connection; every other thread’s command queues behind it', 'client.connect() for the worker, or a pool built with Lettuce’s ConnectionPoolSupport'],
          [<code key="b">WATCH … MULTI … EXEC</code>, 'WATCH and MULTI belong to the connection; another thread’s commands would slip into your transaction', 'client.connect() for the transaction, as in the recording below'],
          [<code key="c">SUBSCRIBE</code>, 'a subscribed connection can do nothing else', 'connectPubSub() (Micronaut injects StatefulRedisPubSubConnection)'],
          [<code key="d">SELECT 3</code>, 'changes the database for every user of the connection', 'a separate URI with /3, or better, key prefixes in database 0'],
        ]}
      />

      <h2>Configuring Micronaut</h2>
      <p>With micronaut-redis-lettuce, one property block creates the client and the connection.</p>
      <CodeBlock title="application.yml (the file the recordings ran with)" language="yaml" code={USAGE_APP['application.yml']} />
      <p>
        The comment in that file is there because of a trap that this app hit. With <code>redis.uri</code> set, Micronaut builds the connection
        from the URI alone, and <code>redis.timeout</code> is not applied. The recorded <code>connection.getTimeout()</code>:
      </p>
      <StatTiles
        title="Recorded: the command timeout the app actually got (redis.timeout: 2s in both runs)"
        stats={[
          { label: 'redis://localhost:6379', value: configured[0], sub: 'Lettuce’s default: 60 s', hue: 8 },
          { label: 'redis://localhost:6379?timeout=500ms', value: configured[1], sub: 'the URI parameter wins', hue: 6 },
        ]}
      />
      <p>
        So put the timeout in the URI, or configure <code>redis.host</code> and <code>redis.port</code> instead of <code>redis.uri</code>. Other
        properties of the same block:
      </p>
      <Table
        head={['Property', 'What it does']}
        rows={[
          [<code key="a">redis.uri</code>, 'server, password, database and ?timeout= in one string (rediss:// for TLS)'],
          [<code key="b">redis.servers.&lt;name&gt;.uri</code>, 'more named servers; inject with @Named("<name>")'],
          [<code key="c">redis.uris</code>, 'several nodes of a Redis Cluster'],
          [<code key="d">redis.pool.*</code>, 'a connection pool for the Micronaut Redis cache (redis.caches.*), not for your own commands'],
          [<code key="e">redis.io-thread-pool-size</code>, 'Netty I/O threads Lettuce uses (default: number of CPUs, at least 2)'],
        ]}
      />
      <Callout tone="note" title="Not recorded">
        Only <code>redis.uri</code> and the timeout were exercised here. The other property names were checked against the micronaut-redis-lettuce
        6.4 configuration classes; check the documentation of your version before relying on them.
      </Callout>

      <h2>Timeouts</h2>
      <p>A command timeout is how long your code waits for a reply before giving up.</p>
      <p>
        Redis runs one command at a time, so a slow command — a big <code>KEYS</code>, a long Lua script — makes every other client wait. The
        recording simulates that with <code>DEBUG SLEEP 2</code> from another connection while the app, configured with a 500 ms timeout, sends a
        GET:
      </p>
      <Timeline
        title="Recorded: a GET during a 2-second busy period, with ?timeout=500ms"
        start={0}
        end={3800}
        unit="ms"
        lanes={[
          { id: 'srv', label: 'Redis server' },
          { id: 'app', label: 'app' },
        ]}
        segments={[
          { lane: 'srv', from: 0, to: 2000, label: 'busy: DEBUG SLEEP 2', hue: 8 },
          { lane: 'app', from: 300, to: 300 + timedOutAfter, label: 'GET waits', hue: 1 },
        ]}
        events={[
          { lane: 'app', at: 300 + timedOutAfter, label: `timeout after ${timedOutAfter} ms`, hue: 8 },
          { lane: 'srv', at: 2000, label: 'GET finally runs', hue: 2 },
          { lane: 'app', at: 3300, label: 'next GET: fine', hue: 6 },
        ]}
      />
      <UsingRedisAppOutput title="recorded output of TimeoutDemo" lines={U.appTimeout} />
      <ul>
        <li>
          The exception is <code>RedisCommandTimeoutException</code>. The connection is <strong>not</strong> broken: the next command works.
        </li>
        <li>
          A timeout means “no answer in time”, not “not done”. The GET still ran on the server at the 2-second mark. For a write such as INCR, a
          timeout leaves you <strong>not knowing</strong> whether it happened.
        </li>
        <li>
          There is also a <strong>connect</strong> timeout (Lettuce default 10 s), for opening the TCP connection. Keep both short enough that a
          stuck Redis fails a request quickly instead of piling up threads.
        </li>
      </ul>
      <CodeBlock title="TimeoutDemo.java (the code that ran)" language="java" code={USAGE_APP['TimeoutDemo.java']} />

      <h2>When the server restarts</h2>
      <p>Lettuce notices a dropped connection and reconnects by itself; commands sent meanwhile wait for it.</p>
      <Predict
        question={
          <p>
            The app runs <code>INCR visits</code> every 250 ms. After a few increments the server restarts (it has no persistence). What does the
            app see?
          </p>
        }
        options={[
          'an exception for every INCR until someone restarts the app',
          'one INCR waits, then the counting continues from 1',
          'the counting continues from where it was, with no visible gap',
        ]}
        answer={1}
        explanation={
          <p>
            Recorded: the INCR sent at {slow.at} ms waited {slow.waited} ms for the reconnect and then returned <code>{slow.value}</code>. No
            exception reached the code. The value was <code>{before.value}</code> before the restart; the data was gone because this server keeps
            nothing on disk.
          </p>
        }
      />
      <Timeline
        title="Recorded: INCR every 250 ms while the server restarts (down/up times approximate)"
        start={0}
        end={last.at + 300}
        unit="ms"
        lanes={[
          { id: 'srv', label: 'Redis server' },
          { id: 'app', label: 'app' },
        ]}
        segments={[
          { lane: 'srv', from: 0, to: downFrom, label: 'up', hue: 2 },
          { lane: 'srv', from: downFrom, to: downTo, label: 'down', hue: 8 },
          { lane: 'srv', from: downTo, to: last.at + 300, label: 'up again, empty', hue: 2 },
          { lane: 'app', from: slow.at, to: slow.at + slow.waited, label: 'INCR waits', hue: 4 },
        ]}
        events={[
          { lane: 'app', at: before.at, label: `→ ${before.value}`, hue: 1 },
          { lane: 'app', at: slow.at + slow.waited, label: `→ ${slow.value}`, hue: 6 },
          { lane: 'app', at: last.at, label: `→ ${last.value}`, hue: 1 },
        ]}
      />
      <p>The two lines in the middle are Lettuce’s own log (the ConnectionWatchdog), printed while the server was down:</p>
      <UsingRedisAppOutput title="recorded output of ReconnectDemo" lines={U.appReconnect} />
      <Callout tone="warn" title="Reconnecting is not the same as not losing data">
        Lettuce hid the outage; it could not bring back the counter. Losing a cache is fine. Losing a counter, a lock or a queue is not: that is
        what persistence and replication (earlier lessons) are for. The {reconnectLogs.length} reconnect log lines above are worth an alert.
      </Callout>

      <h2>Retries and idempotency</h2>
      <p>Retrying is only safe when running a command twice gives the same result as running it once.</p>
      <p>
        By default Lettuce is <strong>at-least-once</strong>: commands written but not answered when the connection dropped are sent again after
        the reconnect. A timeout is different — Lettuce does not retry it; your code decides. Either way, ask of each command: if it already
        happened, is doing it again harmless?
      </p>
      <Table
        head={['Safe to retry (idempotent)', 'Not safe to retry blindly']}
        rows={[
          [<code key="a">SET k v, GET, DEL, HSET, SADD, ZADD, EXPIRE</code>, <code key="b">INCR, INCRBY, LPUSH, RPUSH, RPOP, ZINCRBY</code>],
          ['the end state is the same after two runs', 'two runs count twice, queue twice, or pop two items'],
        ]}
      />
      <p>
        To make a non-idempotent write safe, give it an id: <code>SET op:7f3a done NX EX 3600</code> first, and only do the work if that SET
        succeeded (lesson “Locks, rate limits and idempotency”). Retry with a short, growing delay and a limit, never in a tight loop.
      </p>

      <h2>WATCH from code: optimistic locking</h2>
      <p>WATCH makes EXEC fail if another client changed the key since you read it, so you can retry with fresh data.</p>
      <Flow
        title="Read, compute, write — and start again if someone was faster"
        cols={4}
        rows={2}
        rowHeight={76}
        nodes={[
          { id: 'watch', label: 'WATCH + GET', sub: 'read balance 100', col: 0, row: 0, hue: 1 },
          { id: 'other', label: 'other client', sub: 'INCRBY +50', col: 1, row: 1, hue: 1, shape: 'actor' },
          { id: 'exec', label: 'MULTI … EXEC', sub: 'SET 70', col: 1, row: 0, hue: 2 },
          { id: 'nil', label: 'discarded', sub: 'key changed', col: 2, row: 0, hue: 8 },
          { id: 'ok', label: 'retry commits', sub: 'read 150, SET 120', col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'watch', to: 'exec', hue: 1 },
          { from: 'other', to: 'exec', dashed: true, hue: 8, label: 'changes key' },
          { from: 'exec', to: 'nil', hue: 8 },
          { from: 'nil', to: 'ok', hue: 6, label: 'retry' },
        ]}
      />
      <Tabs
        items={[
          { label: 'recorded output', content: <UsingRedisAppOutput title="recorded output of WatchDemo" lines={U.appWatch} /> },
          { label: 'WatchDemo.java', content: <CodeBlock title="WatchDemo.java (the code that ran)" language="java" code={USAGE_APP['WatchDemo.java']} /> },
        ]}
      />
      <p>
        It took {watchRetry} attempts, and the final balance is right: 100 + 50 − 30 = 120. Without WATCH the first attempt would have written
        70 and the +50 would have been lost. Note the two <code>client.connect()</code> calls: the transaction runs on its own connection.
      </p>

      <h2>Client-side caching</h2>
      <p>A client can keep copies of hot keys in its own memory, and Redis tells it when a copy goes stale.</p>
      <CliSession title="recorded: CLIENT TRACKING, invalidations sent to a listener connection" steps={U.tracking} />
      <p>
        After <code>CLIENT TRACKING ON</code>, Redis remembers which keys this client read. When anyone changes one, Redis sends the key name on{' '}
        <code>__redis__:invalidate</code> and the client drops its copy. With RESP3 the message arrives on the same connection instead of a
        second one. Lettuce wraps this as <code>ClientSideCaching</code>; it saves round trips for keys read far more often than written. Not
        recorded from Java.
      </p>

      <h2>Sentinel and Cluster clients</h2>
      <p>With replication or sharding, the client must find the right server itself.</p>
      <CliSession title="recorded: a three-node cluster, without and with a cluster-aware client" steps={U.moved} prompt="$" />
      <ul>
        <li>
          <strong>Cluster:</strong> a plain client gets <code>MOVED</code> and an error. A cluster-aware client (Lettuce’s{' '}
          <code>RedisClusterClient</code>, redis-cli <code>-c</code>) follows it and keeps a slot map. Turn on topology refresh (periodic and
          adaptive, in <code>ClusterTopologyRefreshOptions</code>) so the map is updated after a failover.
        </li>
        <li>
          <strong>Sentinel:</strong> connect to the Sentinels, not to the primary. Lettuce asks them where the primary is and asks again after a
          failover: <code>redis-sentinel://sentinel-1:26379,sentinel-2:26379/0#mymaster</code> (not recorded).
        </li>
      </ul>

      <h2>Health checks and names</h2>
      <p>Name your connections and check Redis the way the app uses it.</p>
      <CliSession title="recorded: a health check and a named connection" steps={U.health} />
      <CodeBlock title="recorded: that connection in CLIENT LIST (some fields)" language="text" code={U.clientList} />
      <p>
        <code>CLIENT SETNAME</code> (Lettuce: <code>RedisURI.setClientName</code> or <code>?clientName=</code> in the URI) makes{' '}
        <code>CLIENT LIST</code> and the slow log show which app a connection belongs to. Micronaut adds a Redis health indicator to the{' '}
        <code>/health</code> endpoint when the management module is on (not recorded); keep that check a PING, so a slow Redis does not mark
        every instance unhealthy at once.
      </p>

      <h2>Design rules</h2>
      <p>The client settings that matter most in production.</p>
      <Table
        head={['Rule', 'Because']}
        rows={[
          ['Share one Lettuce connection; open extra ones only for blocking, WATCH or SUBSCRIBE', 'the shared connection is thread-safe; those commands hold or change it'],
          ['Set an explicit command timeout, and check it took effect', `the default is 60 s, and redis.timeout was ignored next to redis.uri (recorded: ${configured[0]})`],
          ['Treat a timeout on a write as “unknown”', 'the command may still run, as the GET did after the busy period'],
          ['Retry only idempotent commands, with backoff and a limit', 'Lettuce is at-least-once; INCR twice counts twice'],
          ['Alert on reconnect logs', 'reconnects hide outages from your code, not data loss'],
          ['Use Sentinel- or Cluster-aware clients with topology refresh', 'otherwise a failover leaves the client talking to the old primary or slot map'],
          ['Name connections', 'CLIENT LIST and the slow log then tell you who did what'],
        ]}
      />

      <Recap
        points={[
          'One Lettuce connection is thread-safe and enough for most apps; blocking commands, WATCH and SUBSCRIBE need their own.',
          'With redis.uri, set ?timeout= in the URI — recorded: without it the timeout was 60 s.',
          `A timeout (recorded after ${timedOutAfter} ms) does not break the connection, and does not mean the command did not run.`,
          `Lettuce reconnected by itself after a restart; one INCR waited ${slow.waited} ms — and the counter started again at ${slow.value}.`,
          'WATCH + retry fixes lost updates; idempotent commands are the ones safe to retry.',
        ]}
      />
    </>
  )
}
