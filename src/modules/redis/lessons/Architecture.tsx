import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, Flow, StatTiles, Timeline } from '@/shared/figures'
import { BarList } from '../components/BarList'
import { CliSession } from '../components/CliSession'
import { EventLoopPlayground } from '../components/EventLoopPlayground'
import { CAPTURE, REDIS_VERSION } from '../data/captures'

const A = CAPTURE.architecture

const THREAD_ROLE: Record<string, string> = {
  'redis-server': 'The main thread. It runs the event loop and executes every command, one at a time.',
  bio_close_file: 'Closes files in the background (for example an old AOF file after a rewrite), because closing can block.',
  bio_aof: 'Calls fsync on the append-only file once per second (appendfsync everysec), so the main thread never waits for the disk.',
  bio_lazy_free: 'Frees big values in the background after UNLINK, FLUSHALL ASYNC or lazy eviction/expiry.',
  jemalloc_bg_thd: 'The memory allocator (jemalloc) returning unused pages to the operating system.',
}

const threadRows = [...new Set(A.threads)].map((t) => [<code key={t}>{t}</code>, String(A.threads.filter((x) => x === t).length), THREAD_ROLE[t] ?? '—'])

export default function Architecture() {
  return (
    <>
      <LessonGoals
        goals={[
          'describe the parts of a Redis server: memory, one command thread, an event loop and a few helper threads',
          'follow one command from the socket to the reply',
          'predict what a slow command does to every other client — with numbers measured on a real server',
          'know which commands to keep out of a hot path, and what to use instead',
        ]}
        before="None — this is the first lesson. Every recording in this module comes from a real Redis server."
      />

      <h2>A data structure server in memory</h2>
      <p>
        Redis keeps <strong>all data in RAM</strong>, as data structures: strings, lists, hashes, sets, sorted sets, streams. A client does not send
        queries to be planned; it sends <em>commands</em> that act directly on one of those structures — <code>INCR</code> a counter, <code>LPUSH</code>{' '}
        onto a list, <code>ZADD</code> to a sorted set. Most commands touch a handful of memory locations, which is why a single command usually takes
        microseconds. Disks are used only to <em>survive restarts</em> (lesson 10), never to answer a read.
      </p>
      <p>
        Every recording in this module was made with Redis {REDIS_VERSION} on Linux, using the default configuration unless the lesson says otherwise.
      </p>
      <TermList
        items={[
          { term: 'command', definition: 'One request: a name and arguments, like SET user:1 Ann. Each command is atomic — no other command runs in the middle of it.' },
          { term: 'event loop', definition: 'A loop that asks the operating system "which sockets are ready?", handles them, and asks again.' },
          { term: 'epoll', definition: 'The Linux system call the event loop uses to wait on thousands of sockets at once.' },
          { term: 'blocking', definition: 'While one command runs, nothing else is executed. A slow command makes every other client wait.' },
        ]}
      />

      <h2>One thread runs every command</h2>
      <p>A Redis server is one process: one thread executes all commands, and a few helper threads do slow chores in the background.</p>
      <p>
        The recorded server reported <code>multiplexing_api:{A.server.multiplexing_api}</code>: its event loop is built on epoll. These are the
        threads of an idle server, read from the operating system:
      </p>
      <Flow
        title={`The ${A.threads.length} threads of the recorded server — only one runs commands`}
        cols={4}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'clients', label: 'clients', sub: 'many sockets', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'main', label: 'redis-server', sub: 'main thread: event loop + every command', col: 1, row: 0, span: 2, hue: 2 },
          { id: 'keyspace', label: 'keyspace', sub: 'all data, in RAM', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'aof', label: 'bio_aof', sub: 'fsync the AOF', col: 0, row: 2, hue: 4 },
          { id: 'close', label: 'bio_close_file', sub: 'close old files', col: 1, row: 2, hue: 4 },
          { id: 'free', label: 'bio_lazy_free', sub: 'free big values', col: 2, row: 2, hue: 3 },
          { id: 'jemalloc', label: `jemalloc_bg_thd ×${A.threads.filter((t) => t === 'jemalloc_bg_thd').length}`, sub: 'return pages to the OS', col: 3, row: 2, hue: 7 },
        ]}
        edges={[
          { from: 'clients', to: 'main', flow: true, hue: 1, both: true },
          { from: 'main', to: 'keyspace', flow: true, hue: 3 },
          { from: 'main', to: 'aof', label: 'jobs', hue: 4, dashed: true },
          { from: 'main', to: 'close', hue: 4, dashed: true },
          { from: 'main', to: 'free', hue: 3, dashed: true },
          { from: 'keyspace', to: 'jemalloc', hue: 7, dashed: true },
        ]}
        caption="Solid arrows: requests and replies, and every read and write of the keyspace — all on the main thread. Dashed: slow jobs handed to a helper so the main thread never waits for the disk or for freeing memory."
      />
      <Table head={['Thread', 'Count', 'What it does']} rows={threadRows} />
      <p>
        Only <code>redis-server</code> executes commands. The others do slow work that would otherwise stall it: flushing to disk, closing files,
        freeing memory. Because one thread executes everything, Redis needs no locks on its data, and every command is <strong>atomic</strong> for free:
        an <code>INCR</code> can never be interrupted halfway by another client’s <code>INCR</code>.
      </p>
      <Callout tone="note" title="What io-threads change — and what they do not">
        <p>
          The recorded server has <code>io-threads {A.ioThreads}</code> (the default) and <code>io_threads_active:{A.server.io_threads_active}</code>.
          Raising <code>io-threads</code> adds threads that <strong>read and parse requests and write replies</strong> — useful when a server spends
          its time on network I/O for many clients. Commands are still executed by the main thread, one at a time. Nothing in this lesson about slow
          commands changes with io-threads.
        </p>
      </Callout>

      <h2>The path of one command</h2>
      <p>A command passes through the kernel, the event loop and the keyspace, and its reply goes back the same way — all on the main thread.</p>
      <Flow
        title="One SET, from the client's socket to the reply"
        cols={5}
        rows={2}
        nodes={[
          { id: 'client', label: 'client', sub: 'your app', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'socket', label: 'kernel socket', sub: 'TCP buffer', col: 1, row: 0, hue: 7 },
          { id: 'loop', label: 'event loop', sub: `${A.server.multiplexing_api} wakes it`, col: 2, row: 0, hue: 2 },
          { id: 'exec', label: 'execute', sub: 'parse argv, run SET', col: 3, row: 0, hue: 2 },
          { id: 'keyspace', label: 'keyspace', sub: 'hash table in RAM', col: 4, row: 0, hue: 3, shape: 'store' },
          { id: 'aof', label: 'AOF buffer', sub: 'written before replies', col: 3, row: 1, hue: 4, shape: 'log' },
          { id: 'reply', label: 'output buffer', sub: '+OK\\r\\n, per client', col: 2, row: 1, hue: 1, shape: 'queue' },
        ]}
        edges={[
          { from: 'client', to: 'socket', label: 'bytes', flow: true, hue: 1 },
          { from: 'socket', to: 'loop', label: 'readable', flow: true, hue: 7 },
          { from: 'loop', to: 'exec', flow: true, hue: 2 },
          { from: 'exec', to: 'keyspace', label: 'set key', flow: true, hue: 3 },
          { from: 'exec', to: 'aof', label: 'if appendonly', hue: 4, dashed: true },
          { from: 'aof', to: 'reply', hue: 4, dashed: true },
          { from: 'reply', to: 'client', label: '+OK', flow: true, hue: 1 },
        ]}
        steps={[
          { title: 'The client writes bytes', body: <p>The command travels as RESP bytes (lesson 2) into the server's TCP receive buffer in the kernel.</p>, active: ['client', 'socket', 'client>socket'] },
          { title: 'The event loop wakes up', body: <p>{A.server.multiplexing_api} reports the socket as readable; the single main thread reads the bytes into that client's query buffer.</p>, active: ['socket', 'loop', 'socket>loop'] },
          { title: 'Parse and execute', body: <p>Once a complete command is buffered, the thread parses it into arguments, looks the key up in the keyspace and runs the command — nothing else runs meanwhile, so it is atomic.</p>, active: ['loop', 'exec', 'keyspace', 'loop>exec', 'exec>keyspace'] },
          { title: 'Persist before replying', body: <p>With the append-only file on, the command is appended to the AOF buffer, which is written to the file before any reply leaves (lesson 10).</p>, active: ['exec', 'aof', 'exec>aof', 'aof>reply', 'reply'] },
          { title: 'The reply goes out', body: <p>The reply waits in the client's output buffer; before the loop sleeps again it is written to the socket. Median round trip here: {A.pingBaselineMs.p50} ms.</p>, active: ['reply', 'client', 'reply>client'] },
        ]}
      />
      <p>
        Step through it with <strong>Next</strong>. The keyspace is a hash table (lesson 5); with <code>appendfsync always</code> the AOF is also
        fsync&apos;d before the reply leaves (lesson 10).
      </p>
      <p>
        On the recorded server, with the client on the same machine, a <code>PING</code> round trip took a median of{' '}
        <strong>{A.pingBaselineMs.p50} ms</strong> (99th percentile {A.pingBaselineMs.p99} ms). That is the cost when nothing else is happening.
      </p>

      <Predict
        question={
          <p>
            Client A starts a Lua script that loops for about 600 ms. 30 ms later, client B sends <code>PING</code>. How long does B wait for{' '}
            <code>PONG</code>?
          </p>
        }
        options={['About 0.03 ms — PING is trivial', 'About 570 ms — until the script ends', 'B gets an error immediately']}
        answer={1}
        explanation={
          <>
            Recorded: the script took {A.blockedDefault.slowMs} ms and B’s PING took <strong>{A.blockedDefault.pingMs} ms</strong>, replied{' '}
            <code>{A.blockedDefault.ping}</code>. The command thread was busy; B’s request sat in its socket until the script finished.
          </>
        }
      />
      <Timeline
        title="The recorded run, on one time axis"
        playable
        end={Math.ceil((A.blockedDefault.slowMs + 60) / 50) * 50}
        lanes={[
          { id: 'main', label: 'main thread' },
          { id: 'a', label: 'client A' },
          { id: 'b', label: 'client B' },
        ]}
        segments={[
          { lane: 'main', from: 0, to: A.blockedDefault.slowMs, label: 'runs the Lua script — nothing else', hue: 2 },
          { lane: 'a', from: 0, to: A.blockedDefault.slowMs, label: 'waits for its script', hue: 1 },
          { lane: 'b', from: 30, to: 30 + A.blockedDefault.pingMs, label: `PING waits ${A.blockedDefault.pingMs} ms`, hue: 8 },
        ]}
        events={[
          { lane: 'b', at: 30, label: 'PING sent', hue: 1 },
          { lane: 'b', at: 30 + A.blockedDefault.pingMs, label: 'PONG', hue: 6 },
          { lane: 'a', at: A.blockedDefault.slowMs, label: 'script done', hue: 6 },
        ]}
      />

      <h2>What one slow command does to everybody</h2>
      <p>While one command runs, every other client waits — so the slowest command sets the latency for everybody.</p>
      <StatTiles
        title="Recorded on the server, one thread doing everything"
        stats={[
          { label: 'PING, nothing else running', value: `${A.pingBaselineMs.p50} ms`, sub: 'median round trip', hue: 6 },
          { label: 'PING during a 600 ms script', value: `${A.blockedDefault.pingMs} ms`, sub: 'waited for the script', hue: 8, bar: { value: A.blockedDefault.pingMs, max: A.blockedDefault.slowMs } },
          { label: `KEYS on ${A.keyspace.toLocaleString()} keys`, value: `${A.keysMs} ms`, sub: 'everyone else paused', hue: 8 },
          { label: 'SCAN over the same keys', value: `${A.scanFull.calls.toLocaleString()} calls`, sub: `${A.scanFull.totalMs} ms in total, others ran between`, hue: 2 },
        ]}
      />
      <EventLoopPlayground />
      <p>
        In each recording below a second client sent a PING during the slow command. The baseline and the script ran on an almost empty server; the KEYS
        run on a server holding {A.keyspace.toLocaleString()} keys:
      </p>
      <BarList
        title="How long a PING from another client waited (ms)"
        bars={[
          { label: 'PING alone (p50)', value: A.pingBaselineMs.p50, display: `${A.pingBaselineMs.p50} ms` },
          { label: 'during KEYS nomatch*', value: A.keysPing.pingMs, display: `${A.keysPing.pingMs} ms`, emphasis: true },
          { label: 'during a 600 ms script', value: A.blockedDefault.pingMs, display: `${A.blockedDefault.pingMs} ms`, emphasis: true },
        ]}
      />
      <p>
        <code>KEYS nomatch*</code> returns nothing at all — and still took <strong>{A.keysMs} ms</strong>, because it has to look at every one of the{' '}
        {A.keyspace.toLocaleString()} key names. For those milliseconds the server answered nobody.
      </p>

      <h3>SCAN: the same work in small pieces</h3>
      <p>
        <code>SCAN</code> walks the keyspace with a cursor, a bounded amount of work per call. The same search with{' '}
        <code>SCAN cursor MATCH nomatch* COUNT 1000</code> took <strong>{A.scanFull.calls.toLocaleString()} calls</strong> and{' '}
        {A.scanFull.totalMs} ms in total — on average about {(A.scanFull.totalMs / A.scanFull.calls).toFixed(2)} ms per call, including the round trip (the first one returned cursor{' '}
        <code>{A.scanFirst.cursor}</code> and {A.scanFirst.returned} keys). Other clients’ commands run between the calls, so nobody waits more than one
        small step. Lesson 5 explains how the cursor works.
      </p>
      <BarChart
        title="Longest stretch other clients had to wait, recorded"
        unit=" ms"
        bars={[
          { label: 'KEYS nomatch* (one command)', value: A.keysMs, display: `${A.keysMs} ms`, hue: 8 },
          { label: 'one SCAN … COUNT 1000 (average)', value: +(A.scanFull.totalMs / A.scanFull.calls).toFixed(2), display: `${(A.scanFull.totalMs / A.scanFull.calls).toFixed(2)} ms`, hue: 6, note: `${A.scanFull.calls.toLocaleString()} such calls covered the same ${A.keyspace.toLocaleString()} keys (average includes the round trip)` },
        ]}
      />

      <h3>Scripts that run too long</h3>
      <p>
        A script cannot be interrupted halfway — that is what makes it atomic. After <code>busy-reply-threshold</code> milliseconds (default{' '}
        {A.busyThresholdDefault}) Redis starts answering other clients with an error instead of making them wait. With the threshold lowered to 200 ms,
        a PING sent 300 ms into the same script got this reply at once ({A.blockedBusyError.pingMs} ms):
      </p>
      <CliSession title="recorded: PING while a long script runs, threshold 200 ms" steps={[{ who: 'B', cmd: 'PING', out: A.blockedBusyError.ping }]} />
      <p>
        The script itself still ran to the end ({A.blockedBusyError.slowMs} ms). <code>SCRIPT KILL</code> can stop a script that has not written
        anything yet; one that has written can only be stopped with <code>SHUTDOWN NOSAVE</code>, losing data.
      </p>

      <h3>The slow log</h3>
      <p>
        Redis records every command that took longer than <code>slowlog-log-slower-than</code> microseconds (default 10000 = 10 ms). Each entry has an
        id, a Unix timestamp, the <strong>execution time in microseconds</strong>, the command and the client address. The two KEYS calls and the
        command that created the million test keys are all there:
      </p>
      <CliSession title="recorded" steps={A.slowlog} />
      <Callout tone="tip" title="The slow log measures execution only">
        The time is spent inside the command thread — not network time, not time spent waiting in the queue. A command with a small slow-log time can
        still have been slow for its client if it waited behind a big one. Lesson 16 adds the latency monitor.
      </Callout>

      <h2>Design rules</h2>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['Never call KEYS in application code. Use SCAN, or keep your own index (a set of ids).', `KEYS on ${A.keyspace.toLocaleString()} keys blocked everyone for ${A.keysMs} ms.`],
          ['Avoid O(N) commands on big values in hot paths: HGETALL, SMEMBERS, LRANGE 0 -1 on huge keys.', 'Their cost grows with the value; read in pages (HSCAN, SSCAN, LRANGE with limits) or keep values small.'],
          ['Delete big keys with UNLINK, not DEL.', 'UNLINK removes the key at once; a big value is freed on the bio_lazy_free thread (small ones are freed inline, which is cheap).'],
          ['Keep scripts and functions short — milliseconds, not seconds.', 'They block the server for their whole run and cannot be interrupted safely.'],
          ['Scale CPU with more processes, not more threads.', 'One Redis process uses one core for commands: read from replicas (lesson 11) or shard with Cluster (lesson 12).'],
          ['Watch the slow log and latency in production.', 'They show the commands that make every other client wait (lesson 16).'],
        ]}
      />

      <Recap
        points={[
          'Redis keeps data in memory and executes every command on one thread, so each command is atomic.',
          'The event loop (epoll) multiplexes all clients; helper threads only do background I/O and freeing; io-threads parallelise network I/O, not commands.',
          `One slow command delays every client: a ${A.blockedDefault.slowMs} ms script made a PING wait ${A.blockedDefault.pingMs} ms; KEYS on a million keys blocked for ${A.keysMs} ms.`,
          'Use SCAN instead of KEYS, UNLINK for big deletes, and short scripts.',
        ]}
      />
    </>
  )
}
