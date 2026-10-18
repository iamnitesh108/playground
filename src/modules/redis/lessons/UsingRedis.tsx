import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { CliSession, type CliStep } from '../components'
import { UsingRedisAppOutput } from '../components/UsingRedisAppOutput'
import { USAGE } from '../data/usage'
import styles from '../components/UsingRedis.module.css'
import { USAGE_APP, javaSection, outputSection, type UsageFile } from '../data/usageApp'

const U = USAGE

/** One everyday task, twice: typed in redis-cli and called from Java. */
function Pair({ cli, section, cliTitle }: { cli: readonly CliStep[]; section: string; cliTitle: string }) {
  return (
    <Tabs
      items={[
        { label: 'redis-cli', content: <CliSession title={`recorded: ${cliTitle}`} steps={cli} /> },
        {
          label: 'Java (Lettuce)',
          content: (
            <>
              <CodeBlock title="UsageDemo.java (excerpt, the code that ran)" language="java" code={javaSection(section)} />
              <UsingRedisAppOutput title="recorded output of that code" lines={outputSection(U.appUsage, section)} />
            </>
          ),
        },
      ]}
    />
  )
}

/** Pairs of "member", "score" lines from a recorded WITHSCORES reply. */
function scores(out: string): { member: string; score: number }[] {
  const values = [...out.matchAll(/"([^"]*)"/g)].map((m) => m[1])
  const pairs: { member: string; score: number }[] = []
  for (let i = 0; i + 1 < values.length; i += 2) pairs.push({ member: values[i], score: Number(values[i + 1]) })
  return pairs
}

const step = (steps: readonly CliStep[], cmd: string) => {
  const s = steps.find((x) => x.cmd === cmd)
  if (!s?.out) throw new Error(`no recorded step ${cmd}`)
  return s.out
}

const board = scores(step(U.sortedSets, 'ZRANGE leaderboard 0 2 REV WITHSCORES'))
const ms = (label: string) => Number(U.appPipeline.find((l) => l.startsWith(label))?.split('->')[1].replace('ms', '').trim())
const syncMs = ms('sync loop')
const pipeMs = ms('pipeline')
const cartStart = U.expiry.findIndex((x) => 'cmd' in x && x.cmd?.startsWith('SET cart:3'))
const expiryBasics = U.expiry.slice(0, cartStart)
const expiryCart = U.expiry.slice(cartStart)
const pttl = Number(step(U.expiry, 'PTTL session:9').replace(/\D/g, ''))

const FILES: UsageFile[] = ['build.gradle', 'application.yml', 'Application.java', 'Out.java', 'UsageDemo.java', 'AsyncDemo.java', 'PubSubDemo.java', 'PipelineDemo.java']
const lang = (f: string) => (f.endsWith('.java') ? 'java' : f.endsWith('.yml') ? 'yaml' : 'groovy')

const CHEATS: [string, string[], string[]][] = [
  ['Store / read a value', ['SET k v', 'GET k', 'MGET k1 k2'], ['set(k, v)', 'get(k)', 'mget(k1, k2)']],
  ['Only if absent, with expiry', ['SET k v NX EX 30'], ['set(k, v, SetArgs.Builder.nx().ex(30))']],
  ['Count', ['INCR k', 'INCRBY k 10', 'DECR k'], ['incr(k)', 'incrby(k, 10)', 'decr(k)']],
  ['Expire', ['EXPIRE k 60', 'TTL k', 'PERSIST k'], ['expire(k, 60)', 'ttl(k)', 'persist(k)']],
  ['Object with fields', ['HSET k f v …', 'HGET k f', 'HGETALL k'], ['hset(k, map)', 'hget(k, f)', 'hgetall(k)']],
  ['Queue', ['LPUSH q x', 'RPOP q', 'BRPOP q 5'], ['lpush(q, x)', 'rpop(q)', 'brpop(5, q)']],
  ['Unique members', ['SADD s m', 'SISMEMBER s m', 'SCARD s'], ['sadd(s, m)', 'sismember(s, m)', 'scard(s)']],
  ['Ranking', ['ZADD z 10 m', 'ZINCRBY z 5 m', 'ZRANGE z 0 9 REV WITHSCORES'], ['zadd(z, 10, m)', 'zincrby(z, 5, m)', 'zrevrangeWithScores(z, 0, 9)']],
  ['Broadcast', ['PUBLISH ch msg', 'SUBSCRIBE ch'], ['publish(ch, msg)', 'connectPubSub() + listener']],
  ['Find keys', ['SCAN 0 MATCH p* COUNT 100'], ['scan(cursor, ScanArgs.Builder.matches("p*"))']],
  ['Delete', ['DEL k', 'UNLINK k'], ['del(k)', 'unlink(k)']],
  ['What is this key?', ['TYPE k', 'EXISTS k'], ['type(k)', 'exists(k)']],
]

/** Commands stacked one per line, so long ones never wrap mid-chip. */
const stack = (items: string[]) => (
  <span className={styles.stack}>
    {items.map((c) => (
      <code key={c}>{c}</code>
    ))}
  </span>
)


export default function UsingRedis() {
  return (
    <>
      <LessonGoals
        goals={[
          'connect with redis-cli and with a connection URL',
          'do the everyday jobs — values, counters, expiry, objects, queues, sets, rankings, messages — from the CLI and from Java',
          'find keys safely, send many commands at once, and name keys well',
        ]}
        before="Nothing — this page stands on its own. It shows how to use Redis, not how it works inside; the other lessons do that."
      />

      <h2>The whole picture in one figure</h2>
      <p>Your application talks to Redis through a client library, and every command reads or changes one key.</p>
      <Flow
        title="From your code to a key"
        cols={4}
        rows={2}
        rowHeight={80}
        nodes={[
          { id: 'app', label: 'your code', sub: 'redis.get("user:1:name")', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'lib', label: 'client library', sub: 'Lettuce, Jedis, redis-cli', col: 1, row: 0, hue: 1 },
          { id: 'server', label: 'Redis server', sub: 'runs each command', col: 2, row: 0, hue: 2 },
          { id: 'keys', label: 'keyspace', sub: 'key → typed value', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'reply', label: 'reply', sub: '"Ann", 1, (nil), OK…', col: 1, row: 1, span: 2, hue: 6 },
        ]}
        edges={[
          { from: 'app', to: 'lib', flow: true, hue: 1 },
          { from: 'lib', to: 'server', label: 'GET', flow: true, hue: 1 },
          { from: 'server', to: 'keys', both: true, hue: 3 },
          { from: 'server', to: 'reply', hue: 6, dashed: true },
        ]}
        caption="Colours follow the module legend: client side, server, keyspace, and a successful reply."
      />
      <TermList
        items={[
          { term: 'key', definition: 'A name such as user:1:name. Every value lives under exactly one key.' },
          { term: 'type', definition: 'What the value is: string, hash, list, set, sorted set, stream… The type decides which commands work on it.' },
          { term: 'TTL', definition: 'Time to live: seconds until Redis deletes the key by itself. Keys without a TTL live until deleted.' },
          { term: '(nil)', definition: 'redis-cli’s way of saying “no value”. In Java it arrives as null.' },
        ]}
      />
      <p>
        Everything below was recorded on Redis {U.version}. The CLI tabs are real redis-cli sessions; the Java tabs show the exact code a small
        Micronaut app ran and what it printed. The full app is at the end of the page.
      </p>

      <h2>Connecting</h2>
      <p>You need a host, a port, and usually a user name and password.</p>
      <CliSession title="recorded: connecting with flags and with a URL" steps={U.connect} prompt="$" />
      <p>
        The first try fails with <code>NOAUTH</code>: this server has a password. Both ways of passing it work. The URL form is the same one
        application configs use, so it is worth learning:
      </p>
      <Table
        head={['Part', 'Example', 'Meaning']}
        rows={[
          [<code key="a">redis://</code>, 'scheme', 'rediss:// (two s) means TLS'],
          [<code key="b">default:app-secret@</code>, 'user:password', 'the user is “default” unless you created ACL users'],
          [<code key="c">localhost:6379</code>, 'host:port', '6379 is the standard port'],
          [<code key="d">/0</code>, 'database number', '0 if omitted; most setups only use 0'],
        ]}
      />
      <Callout tone="warn" title="Passwords on the command line">
        <code>-a</code> and <code>-u</code> put the password in your shell history and in the process list, and redis-cli prints a warning to say
        so. For anything but a lab, export <code>REDISCLI_AUTH</code> instead; redis-cli reads the password from it.
      </Callout>

      <h2>Strings: store and read a value</h2>
      <p>A string is the simplest value: text, a number or bytes under one key.</p>
      <Pair cli={U.strings} section="strings" cliTitle="SET, GET, NX, MGET, DEL" />
      <ul>
        <li>
          A missing key is not an error: <code>GET</code> returns <code>(nil)</code>, and Lettuce returns <code>null</code>.
        </li>
        <li>
          <code>SET … NX EX 30</code> writes only if the key does not exist, and expires it after 30 s. The second worker got{' '}
          <code>(nil)</code> — that is how a simple lock or “do this once” flag works.
        </li>
        <li>
          <code>MGET</code> reads many keys in one round trip. Lettuce returns <code>KeyValue</code> objects, empty where the key is missing.
        </li>
      </ul>

      <h2>Counters</h2>
      <p>Redis can add to a number in place, so many clients can count without overwriting each other.</p>
      <CliSession title="recorded: INCR and friends" steps={U.counters} />
      <p>
        <code>INCR</code> on a missing key starts from 0. The value is still a string, so <code>GET</code> works on it — but <code>INCR</code> on
        text fails. Page views, rate limits and id generators are all built on this one command.
      </p>

      <h2>Expiry: keys that delete themselves</h2>
      <p>Give a key a TTL and Redis removes it when the time is up; you do not need a cleanup job.</p>
      <Pair cli={expiryBasics} section="expiry" cliTitle="EX, TTL, PERSIST, and a key that expired" />
      <Timeline
        title={`Recorded: session:9 was set with PX ${pttl} and read 2 seconds later`}
        start={0}
        end={2200}
        unit="ms"
        lanes={[{ id: 'k', label: 'session:9' }]}
        segments={[
          { lane: 'k', from: 0, to: pttl, label: 'exists', hue: 3 },
          { lane: 'k', from: pttl, to: 2200, label: 'gone', hue: 8, striped: true },
        ]}
        events={[
          { lane: 'k', at: 0, label: 'SET … PX', hue: 1 },
          { lane: 'k', at: pttl, label: 'TTL reaches 0', hue: 4 },
          { lane: 'k', at: 2000, label: 'GET → (nil)', hue: 8 },
        ]}
      />
      <Table
        head={['TTL replies', 'Meaning']}
        rows={[
          [<code key="a">300</code>, 'seconds left'],
          [<code key="b">-1</code>, 'the key exists but never expires'],
          [<code key="c">-2</code>, 'the key does not exist (or already expired)'],
        ]}
      />
      <Predict
        question={
          <p>
            <code>cart:3</code> was written with <code>EX 600</code>. Later the app updates it with a plain <code>SET cart:3 "3 items"</code>.
            What does <code>TTL cart:3</code> return?
          </p>
        }
        options={['about 600 — the old expiry is kept', '-1 — the key no longer expires', '-2 — the key was deleted']}
        answer={1}
        explanation={
          <p>
            Recorded: <code>{step(U.expiry, 'TTL cart:3')}</code>. A plain <code>SET</code> replaces the value <strong>and drops the TTL</strong>,
            so a cache entry can quietly become permanent. Add <code>KEEPTTL</code> to keep the old expiry, or pass <code>EX</code> again
            (they cannot be combined: the recording shows <code>KEEPTTL EX</code> is a syntax error).
          </p>
        }
      />

      <CliSession title="recorded: updating a key that has a TTL" steps={expiryCart} />

      <h2>Hashes: an object with fields</h2>
      <p>A hash keeps many small fields under one key, like a row or a JSON object one level deep.</p>
      <Pair cli={U.hashes} section="hashes" cliTitle="HSET, HGET, HINCRBY, HGETALL" />
      <p>
        <code>HSET</code> returns how many fields were <strong>new</strong>: 3 the first time, 0 when it only changed <code>plan</code>. You can
        read or change one field without touching the others, and <code>HINCRBY</code> counts inside a field. Fields cannot expire on their own
        unless you use <code>HEXPIRE</code> (Redis 7.4+); the key’s TTL applies to the whole hash.
      </p>

      <h2>Lists as a queue</h2>
      <p>Push jobs on one end and pop them from the other, and a list becomes a simple work queue.</p>
      <Flow
        title="LPUSH on the left, RPOP / BRPOP on the right: first in, first out"
        cols={3}
        rows={1}
        rowHeight={80}
        nodes={[
          { id: 'web', label: 'web app', sub: 'LPUSH jobs:email job-4', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'q', label: 'jobs:email', sub: 'a list', col: 1, row: 0, hue: 3, shape: 'queue' },
          { id: 'worker', label: 'worker', sub: 'BRPOP jobs:email 5', col: 2, row: 0, hue: 1, shape: 'actor' },
        ]}
        edges={[
          { from: 'web', to: 'q', flow: true, hue: 1 },
          { from: 'q', to: 'worker', flow: true, hue: 3 },
        ]}
      />
      <Pair cli={U.lists} section="lists as a queue" cliTitle="a web app pushes, a worker pops" />
      <p>
        <code>RPOP</code> on an empty list returns <code>(nil)</code> at once, so a worker would have to poll. <code>BRPOP … 5</code> instead{' '}
        <strong>waits</strong> up to 5 seconds and returns the moment a job arrives (0 means wait forever). The reply names the list, because
        one BRPOP can watch several.
      </p>
      <Callout tone="note" title="When a list is not enough">
        A popped job lives only in the worker’s memory; if the worker crashes, the job is lost. For jobs that must not be lost, use a processing
        list with <code>BLMOVE</code> or a Stream with consumer groups (lesson “Pub/Sub, lists and Streams”).
      </Callout>

      <h2>Sets: unique members</h2>
      <p>A set holds each member at most once and answers “is X in it?” in constant time.</p>
      <Pair cli={U.sets} section="sets" cliTitle="SADD, SISMEMBER, SMEMBERS, SINTER" />
      <p>
        <code>SADD</code> was given <code>redis</code> twice and reported 2 added. Sets have no order: <code>SMEMBERS</code> may list members in
        any order. Use them for tags, “who liked this”, or de-duplicating ids; <code>SINTER</code> and <code>SUNION</code> combine sets.
      </p>

      <h2>Sorted sets: rankings</h2>
      <p>A sorted set is a set where every member has a score, kept in score order.</p>
      <BarChart
        title="Recorded: ZRANGE leaderboard 0 2 REV WITHSCORES (after bob got +500)"
        bars={board.map((b, i) => ({ label: `${i + 1}. ${b.member}`, value: b.score, hue: b.member === 'bob' ? 6 : 3, note: b.member === 'bob' ? 'ZINCRBY +500' : undefined }))}
        unit="points"
      />
      <Pair cli={U.sortedSets} section="sorted sets" cliTitle="a leaderboard" />
      <ul>
        <li>
          <code>ZRANK</code> counts from the <strong>lowest</strong> score (ann is 0); <code>ZREVRANK</code> from the highest (ann is 2). For a
          leaderboard you almost always want the <code>REV</code> forms.
        </li>
        <li>
          <code>ZRANGE … BYSCORE</code> reads by score range (“everyone with at least 3000”). Scores are floating-point numbers, which is why
          Lettuce returns <code>3300.0</code>.
        </li>
      </ul>

      <h2>Publish and subscribe</h2>
      <p>PUBLISH sends a message to everyone subscribed to a channel at that moment, and to no one else.</p>
      <Flow
        title="Pub/Sub keeps nothing: no subscriber, no delivery"
        cols={3}
        rows={2}
        rowHeight={74}
        nodes={[
          { id: 'pub', label: 'publisher', sub: 'PUBLISH orders …', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'ch', label: 'channel orders', sub: 'stores nothing', col: 1, row: 0, hue: 2 },
          { id: 'sub', label: 'subscriber', sub: 'SUBSCRIBE orders', col: 2, row: 0, hue: 1, shape: 'actor' },
          { id: 'lost', label: 'nobody listening', sub: 'PUBLISH returns 0', col: 2, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'pub', to: 'ch', flow: true, hue: 1 },
          { from: 'ch', to: 'sub', label: 'push', flow: true, hue: 2 },
          { from: 'ch', to: 'lost', dashed: true, hue: 8 },
        ]}
      />
      <Tabs
        items={[
          { label: 'redis-cli', content: <CliSession title="recorded: two connections" steps={U.pubsub} /> },
          {
            label: 'Java (Lettuce)',
            content: (
              <>
                <CodeBlock title="PubSubDemo.java (the code that ran)" language="java" code={USAGE_APP['PubSubDemo.java']} />
                <UsingRedisAppOutput title="recorded output" lines={U.appPubsub} />
              </>
            ),
          },
        ]}
      />
      <p>
        The number PUBLISH returns is how many subscribers received the message. After the subscriber left, the next message reached 0 and
        was gone. A subscribed connection can only (un)subscribe and ping, so the app opens a <strong>separate</strong> connection for it.
      </p>

      <h2>Finding keys: SCAN, never KEYS</h2>
      <p>To list keys matching a pattern, walk the keyspace in small pages with SCAN.</p>
      <CliSession title="recorded: the first page of a SCAN" steps={U.scan} />
      <StatTiles
        title="Recorded: SCAN MATCH session:* COUNT 20 over 70 keys"
        stats={[
          { label: 'SCAN calls until cursor 0', value: U.scanTotals.calls, hue: 2 },
          { label: 'session keys found', value: U.scanTotals.keys, hue: 6 },
          { label: 'keys in the database', value: step(U.scan, 'DBSIZE').replace(/\D/g, ''), hue: 3 },
        ]}
      />
      <ul>
        <li>
          Start with cursor <code>0</code>, pass back the cursor each reply gives you, and stop when it is <code>0</code> again.
        </li>
        <li>
          <code>KEYS pattern</code> does the same in one command that blocks the server until it has looked at every key — fine on a laptop,
          an outage on a production database with millions of keys.
        </li>
        <li>
          <code>COUNT</code> is a hint, pages can be empty, and a key may appear twice: de-duplicate on your side.
        </li>
      </ul>
      <CliSession title="recorded: redis-cli does the cursor loop for you" steps={[U.scanCli]} prompt="$" />
      <p>In Java, loop until the cursor is finished:</p>
      <CodeBlock title="UsageDemo.java (excerpt)" language="java" code={javaSection('SCAN instead of KEYS')} />
      <UsingRedisAppOutput lines={outputSection(U.appUsage, 'SCAN instead of KEYS')} />

      <h2>Many commands at once</h2>
      <p>Sending commands one by one costs a network round trip each; a pipeline sends them all together.</p>
      <BarChart
        title="Recorded: 10,000 INCRs from the Java app, same connection, local server"
        bars={[
          { label: 'one by one (wait for each reply)', value: syncMs, display: `${syncMs} ms`, hue: 8 },
          { label: 'pipelined (send all, then wait)', value: pipeMs, display: `${pipeMs} ms`, hue: 6 },
        ]}
        unit="ms"
      />
      <p>
        Over a real network the gap grows: each round trip costs the network latency, often 0.2–1 ms inside a data centre. A pipeline is{' '}
        <strong>not atomic</strong> — other clients’ commands can run in between. When a group of commands must run together, use{' '}
        <code>MULTI</code>/<code>EXEC</code>:
      </p>
      <Tabs
        items={[
          {
            label: 'redis-cli',
            content: (
              <>
                <CliSession title="recorded: a transaction" steps={U.multi} />
                <CliSession title="recorded: a pipeline from a file with --pipe" steps={[U.pipeCli]} prompt="$" />
              </>
            ),
          },
          {
            label: 'Java (Lettuce)',
            content: (
              <>
                <CodeBlock title="PipelineDemo.java (the code that ran)" language="java" code={USAGE_APP['PipelineDemo.java']} />
                <UsingRedisAppOutput title="recorded output" lines={U.appPipeline} />
              </>
            ),
          },
        ]}
      />
      <p>
        Inside <code>MULTI</code> every command answers <code>QUEUED</code> (Lettuce’s sync API returns <code>null</code>); the real results
        arrive together from <code>EXEC</code>. The next lesson shows <code>WATCH</code> for “only if nobody changed it”.
      </p>

      <h2>Without blocking a thread</h2>
      <p>The same connection also has an asynchronous and a reactive API, for code that should not wait on each reply.</p>
      <CodeBlock title="AsyncDemo.java (the code that ran)" language="java" code={USAGE_APP['AsyncDemo.java']} />
      <UsingRedisAppOutput title="recorded output" lines={U.appAsync} />
      <p>
        <code>connection.sync()</code>, <code>.async()</code> and <code>.reactive()</code> are three views of one connection: pick the one that
        matches the rest of your code. The commands and their names are the same in all three.
      </p>

      <h2>When a command does not fit the key</h2>
      <p>Each command works on one type; using it on another type is an error, not a conversion.</p>
      <CliSession title="recorded: TYPE and WRONGTYPE" steps={U.typeErrors} />
      <p>
        In Java this arrives as a <code>RedisCommandExecutionException</code> with the same message. <code>TYPE</code> tells you what a key holds
        when you are exploring a database you did not create.
      </p>

      <h2>Naming keys</h2>
      <p>Redis has no tables, so the key name is your schema: make it predictable.</p>
      <Table
        head={['Rule', 'Good', 'Why']}
        rows={[
          ['object-type:id:field, separated by colons', <code key="a">user:1:name</code>, 'readable; tools group keys by the colons'],
          ['one prefix per app or feature', <code key="b">cart:3</code>, 'SCAN MATCH cart:* finds them; ACLs can limit an app to its prefix'],
          ['ids, not personal data, in names', <code key="c">session:9f2c</code>, 'keys show up in logs, SCAN output and monitoring'],
          ['short but clear', <code key="d">page:home:views</code>, 'every key name is stored in memory; avoid 200-character names'],
          ['related keys share a {tag} in Cluster', <code key="e">{'{order:42}'}:items</code>, 'multi-key commands need keys in the same slot (lesson “Redis Cluster”)'],
        ]}
      />

      <h2>Cheat sheet</h2>
      <p>The everyday commands on one screen, with the Lettuce method that sends each one.</p>
      <Table head={['Job', 'redis-cli', 'Lettuce (RedisCommands)']} rows={CHEATS.map(([job, cli, java]) => [job, stack(cli), stack(java)])} />

      <h2>Checklist</h2>
      <p>Habits that keep everyday Redis use out of trouble.</p>
      <ul>
        <li>Give every cache entry a TTL, and remember that a plain SET removes it.</li>
        <li>Never run KEYS, HGETALL on huge hashes or SMEMBERS on huge sets in production; SCAN, HSCAN and SSCAN page through them.</li>
        <li>Batch many commands with MGET/HMGET or a pipeline instead of loops of single calls.</li>
        <li>Check for null: a missing key is a normal answer, not an exception.</li>
        <li>Use Pub/Sub only for messages you can afford to lose; use a Stream when they must arrive.</li>
        <li>Keep passwords out of command lines and code: environment variables or a secret store.</li>
      </ul>

      <h2>The app that made the recordings</h2>
      <p>These are the real files of the Micronaut app (micronaut-redis-lettuce) used above.</p>
      <Tabs items={FILES.map((f) => ({ label: f, content: <CodeBlock title={f} language={lang(f)} code={USAGE_APP[f]} /> }))} />
      <UsingRedisAppOutput title="recorded output of APP_MODE=usage (the whole run)" lines={U.appUsage} />

      <Recap
        points={[
          'Connect with host, port and password, or one URL: redis://user:pass@host:6379/0 (rediss:// for TLS).',
          'Strings, counters, hashes, lists, sets and sorted sets cover most everyday jobs; each command works on one type.',
          'A TTL deletes keys for you — and a plain SET silently removes it.',
          'SCAN instead of KEYS; pipelines for many commands; MULTI/EXEC when they must run together.',
          'In Java the same commands are methods on connection.sync(), .async() or .reactive().',
        ]}
      />
    </>
  )
}
