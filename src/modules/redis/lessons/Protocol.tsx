import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarList } from '../components/BarList'
import { CliSession } from '../components/CliSession'
import { PipelinePlayground } from '../components/PipelinePlayground'
import { WireView } from '../components/WireView'
import { CAPTURE } from '../data/captures'
import { StatTiles, Timeline, type ByteField, type Hue } from '@/shared/figures'
import { ProtocolFrames } from '../components/ProtocolFrames'

const P = CAPTURE.protocol
const rps = (line: string) => Number(line.match(/: ([\d.]+) requests per second/)?.[1] ?? 0)
const p50 = (line: string) => line.match(/p50=([\d.]+ msec)/)?.[1] ?? ''

/** Splits recorded RESP bytes into its frames; every frame is followed by \r\n (2 bytes). */
function frames(raw: string): ByteField[] {
  return raw.split('\\r\\n').filter((t) => t !== '').map((t) => {
    const kind: [string, string, Hue] =
      t.startsWith('*') ? ['array', t, 7]
      : t === '$-1' ? ['nil', t, 8]
      : t.startsWith('$') ? ['length', t, 7]
      : t.startsWith('+') ? ['status', t, 6]
      : t.startsWith('-') ? ['error', t, 8]
      : t.startsWith(':') ? ['integer', t, 3]
      : ['data', t, 3]
    return { label: kind[0], content: kind[1], bytes: t.length + 2, hue: kind[2] }
  })
}

/** Recorded averages: one round trip per command vs one write for a whole pipeline (microseconds). */
const RTT_US = (P.incr.sequentialMs * 1000) / P.incr.n
const PIPED_US = (P.incr.pipelinedMs * 1000) / P.incr.n

export default function Protocol() {
  const bench = [
    { label: '1 client, 1 command at a time', line: P.benchmark.oneClient[0] },
    { label: '50 clients, 1 at a time each', line: P.benchmark.plain[0] },
    { label: '50 clients, pipelines of 16', line: P.benchmark.pipeline16[0] },
  ]
  return (
    <>
      <LessonGoals
        goals={[
          'read the bytes a client and Redis exchange (RESP)',
          'explain why a round trip, not the server, sets the speed of most programs',
          'use pipelining — and know how it differs from MULTI and from scripts',
        ]}
        before="Lesson 1 — one thread, one command at a time"
      />

      <h2>RESP: the bytes on the wire</h2>
      <p>RESP is the small text protocol every Redis client speaks: each value is announced by one type byte and, for strings, its length.</p>
      <p>
        Clients talk to Redis over TCP with <strong>RESP</strong> (REdis Serialization Protocol). A command is sent as an <em>array of bulk
        strings</em>: <code>*3</code> means three elements follow, each one announced by <code>$</code> and its length in bytes. Lines end in{' '}
        <code>\r\n</code>. Because every string carries its length, values can contain any bytes — spaces, newlines, binary — and the server never has to
        search for the end of a value.
      </p>
      <ProtocolFrames
        title="A recorded request and five recorded replies, all on one byte scale"
        rows={[
          { label: `client → server: ${P.wire[0].cmd}`, fields: frames(P.wire[0].sent) },
          ...P.wire.slice(0, 5).map((w) => ({ label: `server → client: reply to ${w.cmd}`, fields: frames(w.received) })),
        ]}
        caption="Each block is one line of the protocol, sized in bytes including its \r\n. The first byte names the type: * array and $ length are framing (the data follows on the next line); + status; : integer; - error; $-1 is nil. The label under each block says which it is."
      />
      <p>These are the exact bytes recorded for a few commands (prefix characters highlighted):</p>
      <WireView rows={P.wire} />
      <Table
        head={['First byte', 'Type', 'Example from the recording']}
        rows={[
          [<code key="a">+</code>, 'simple string (status)', <code key="b">+OK</code>],
          [<code key="a">-</code>, 'error', <code key="b">-ERR value is not an integer…</code>],
          [<code key="a">:</code>, 'integer', <code key="b">:1</code>],
          [<code key="a">$</code>, 'bulk string; $-1 = nil', <code key="b">$3 Ann · $-1</code>],
          [<code key="a">*</code>, 'array', <code key="b">*2 $5 apple $4 pear</code>],
        ]}
      />
      <p>
        <code>GET user:2</code> on a missing key answered <code>$-1</code> — the nil bulk string, which redis-cli prints as <code>(nil)</code>. Redis 6
        and later also speak <strong>RESP3</strong> (switched on per connection with <code>HELLO 3</code>), which adds maps, sets, doubles and push
        messages; the framing idea is the same.
      </p>
      <p>
        Redis also accepts <em>inline</em> commands — plain text lines, as you would type them in telnet. Sending <code>PING\r\nGET user:1\r\n</code>{' '}
        on a raw socket returned exactly <code>{P.inline}</code>. Real clients always use the array form.
      </p>
      <TermList
        items={[
          { term: 'RTT', definition: 'Round-trip time: from sending a request until the reply arrives. Network distance, not server work.' },
          { term: 'pipelining', definition: 'Sending many commands without waiting for each reply, then reading all replies. One RTT for the batch.' },
          { term: 'throughput', definition: 'Commands per second a client or server completes.' },
        ]}
      />

      <h2>Round trips are the real cost</h2>
      <p>For most programs the network round trip, not the server, decides how fast Redis feels.</p>
      <p>
        Executing a simple command takes the server about a microsecond or two (reading the request and writing the reply cost a little more). But a client that sends a command and waits for its reply before sending the next
        one pays a full round trip for every command. The recording: {P.incr.n.toLocaleString()} <code>INCR</code>s against a server on the same
        machine.
      </p>
      <Timeline
        title={`Four INCRs at the recorded averages: ${RTT_US.toFixed(1)} µs per round trip, ${PIPED_US.toFixed(1)} µs per pipelined command`}
        unit="µs"
        end={Math.ceil((4 * RTT_US) / 10) * 10}
        lanes={[
          { id: 'one', label: 'one at a time' },
          { id: 'pipe', label: 'pipelined' },
        ]}
        segments={[
          ...[0, 1, 2, 3].map((i) => ({ lane: 'one', from: i * RTT_US, to: (i + 1) * RTT_US - 0.6, label: `INCR ${i + 1}`, hue: 1 as const })),
          { lane: 'pipe', from: 0, to: RTT_US + 4 * PIPED_US, label: '4 INCRs, one write', hue: 6 },
        ]}
        events={[
          ...[0, 1, 2, 3].map((i) => ({ lane: 'one', at: (i + 1) * RTT_US - 0.6, label: 'reply', hue: 6 as const })),
          { lane: 'pipe', at: RTT_US + 4 * PIPED_US, label: '4 replies', hue: 6 },
        ]}
      />
      <BarList
        title={`${P.incr.n.toLocaleString()} INCR commands, client and server on one machine`}
        bars={[
          { label: 'one at a time', value: P.incr.sequentialMs, display: `${P.incr.sequentialMs} ms` },
          { label: 'pipelines of 100', value: P.incr.batched100Ms, display: `${P.incr.batched100Ms} ms`, emphasis: true },
          { label: 'one pipeline of all', value: P.incr.pipelinedMs, display: `${P.incr.pipelinedMs} ms`, emphasis: true },
        ]}
      />
      <p>
        All three ended with the same counter (the final value was {P.incr.final} after the three runs). Even over loopback — the shortest network
        there is — waiting for each reply was over ten times slower. Across a real network the gap grows with the round trip:
      </p>
      <PipelinePlayground />

      <Predict
        question={<p>An API handler reads 50 product prices with 50 GETs. The Redis server is in the same data centre, 0.5 ms away. Roughly how long does the handler spend on Redis?</p>}
        options={['About 0.1 ms', 'About 25 ms', 'About 2.5 seconds']}
        answer={1}
        explanation="50 round trips × 0.5 ms = 25 ms, while the server itself spent well under a millisecond. One MGET (or a pipeline of 50 GETs) does it in a single round trip: about 0.5 ms."
      />

      <h2>What redis-benchmark measured</h2>
      <p>The same effect shows up in server throughput: more clients and pipelining both keep the one command thread busier.</p>
      <p>The bundled <code>redis-benchmark</code> tool, 200,000 SETs on the recorded server:</p>
      <StatTiles
        title="SET requests per second, recorded"
        stats={bench.map((b, i) => ({
          label: b.label,
          value: `${Math.round(rps(b.line)).toLocaleString()}/s`,
          sub: `median latency ${p50(b.line)}`,
          hue: ([1, 2, 6] as const)[i],
          bar: { value: rps(b.line), max: Math.max(...bench.map((x) => rps(x.line))) },
        }))}
      />
      <CodeBlock title="recorded output" language="text" code={[...P.benchmark.oneClient.map((l) => `-c 1        ${l}`), ...P.benchmark.plain.map((l) => `-c 50       ${l}`), ...P.benchmark.pipeline16.map((l) => `-c 50 -P 16 ${l}`)].join('\n')} />
      <p>
        One client is limited by its own round trips. Fifty clients keep the server busier. Pipelining cuts the per-command overhead of reading,
        parsing and writing on both sides — and so it raises the server’s capacity too, not only the client’s speed.
      </p>

      <h2>Pipeline, MULTI or script?</h2>
      <p>Pipelining, transactions and scripts all save round trips, but only the last two keep other clients out.</p>
      <p>
        A pipeline is only a way of using the network: the commands still execute one by one, and <strong>another client’s commands can run between
        them</strong>. When a read from a socket brings several complete commands, Redis runs all of them before serving the next ready client — so the
        gaps fall where a long pipeline is split across socket reads. If the commands must run together, with nothing in between, use a transaction or a
        script (lesson 8):
      </p>
      <Timeline
        title="Schematic: client A's long pipeline arrives in two reads; client B's command runs in between"
        unit="steps"
        end={6}
        lanes={[
          { id: 'server', label: 'server thread' },
          { id: 'a', label: 'client A (pipeline)' },
          { id: 'b', label: 'client B' },
        ]}
        segments={[
          { lane: 'a', from: 0, to: 0.6, label: 'A1 A2', hue: 1 },
          { lane: 'a', from: 1.4, to: 2, label: 'A3 A4', hue: 1 },
          { lane: 'b', from: 1.1, to: 1.6, label: 'B1', hue: 1 },
          { lane: 'server', from: 0.7, to: 1.4, label: 'A1', hue: 2 },
          { lane: 'server', from: 1.5, to: 2.2, label: 'A2', hue: 2 },
          { lane: 'server', from: 2.3, to: 3.0, label: 'B1', hue: 2 },
          { lane: 'server', from: 3.1, to: 3.8, label: 'A3', hue: 2 },
          { lane: 'server', from: 3.9, to: 4.6, label: 'A4', hue: 2 },
        ]}
        events={[{ lane: 'server', at: 2.3, label: 'B1 runs between A2 and A3', hue: 2 }]}
      />
      <CliSession title="recorded: MULTI queues commands and EXEC runs them together" steps={P.multi} />
      <Table
        head={['', 'Round trips', 'Atomic (nothing in between)', 'Can use a result to decide the next step']}
        rows={[
          ['one command at a time', 'one per command', 'no', 'yes, in the client'],
          ['pipeline', 'one per batch', 'no', 'no — replies come back at the end'],
          ['MULTI … EXEC', 'one if pipelined', 'yes', 'no (WATCH lets you retry, lesson 8)'],
          ['Lua script / function', 'one', 'yes', 'yes, inside the script'],
          ['multi-key command (MGET, MSET, HMGET…)', 'one', 'yes', '—'],
        ]}
      />
      <Callout tone="tip" title="Client libraries">
        Most clients pipeline for you when you ask: a <em>pipeline</em> or <em>batch</em> object, or auto-pipelining of commands issued in the same
        tick. They also keep a pool of connections; each connection carries one conversation, so blocking commands (BLPOP, XREADGROUP BLOCK) need a
        connection of their own.
      </Callout>

      <h2>Design rules</h2>
      <ul>
        <li>Count round trips per request, not commands. A request that needs 30 values should make one or two round trips: MGET, HMGET, a pipeline.</li>
        <li>Pipeline batches of hundreds to a few thousand commands; a single gigantic pipeline holds a big buffer on both sides.</li>
        <li>Put Redis close to the application: in the same zone, not across regions. Every millisecond of RTT is paid per round trip.</li>
        <li>Pipelining is not atomic. If two writes must be seen together, use MULTI/EXEC or a script.</li>
        <li>Reuse connections (a pool). Opening a TCP connection — and authenticating, and maybe TLS — costs several round trips.</li>
      </ul>

      <Recap
        points={[
          'RESP frames every value with its length: *N for arrays, $N for bulk strings, + - : for status, errors and integers.',
          `Round trips dominate: ${P.incr.n.toLocaleString()} INCRs took ${P.incr.sequentialMs} ms one by one and ${P.incr.batched100Ms} ms in pipelines of 100, on the same machine.`,
          'Pipelining saves round trips but is not atomic; MULTI/EXEC and scripts are.',
        ]}
      />
    </>
  )
}
