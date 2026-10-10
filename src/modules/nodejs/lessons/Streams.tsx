import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { BackpressurePlayground } from '../components'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const kib = (n: number) => `${n / 1024} KiB`

const IGNORING = `for (let i = 0; i < 2000; i++) {
  writable.write(chunk)     // result ignored
}`
const RESPECTING = `for (let i = 0; i < 2000; i++) {
  if (!writable.write(chunk)) {
    await once(writable, 'drain')
  }
}`
const PIPELINE = `import { pipeline } from 'node:stream/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { createGzip } from 'node:zlib'

await pipeline(
  createReadStream('orders.csv'),
  createGzip(),
  createWriteStream('orders.csv.gz'),
)   // handles backpressure between every pair, and errors in any stage`

export default function Streams() {
  const s = CAPTURE.streams
  return (
    <>
      <LessonGoals
        goals={[
          'explain why streams keep memory flat for any data size',
          'know the four stream types and their default buffer sizes',
          'handle backpressure: write() returning false, and drain',
          'connect streams safely with pipeline',
        ]}
        before="Lesson 3 — the event loop"
      />

      <h2>Chunks instead of everything</h2>
      <p>
        <code>fs.readFile</code> loads a whole file into memory. A <strong>stream</strong> hands it over in chunks as it arrives, so a 10 GB file
        needs no more memory than a 10 KB one. Recorded: a {kib(s.fileChunks.fileBytes)} file read with <code>createReadStream</code> arrived as{' '}
        {s.fileChunks.chunks} chunks of {s.fileChunks.sizes.map(kib).join(', ')}.
      </p>
      <Table
        head={['Type', 'You…', 'Examples']}
        rows={[
          ['Readable', 'read from it', 'fs.createReadStream, an HTTP request on the server, process.stdin'],
          ['Writable', 'write to it', 'fs.createWriteStream, an HTTP response, process.stdout'],
          ['Duplex', 'both, independently', 'a TCP socket'],
          ['Transform', 'write in, read transformed data out', 'zlib.createGzip, crypto.createHash'],
        ]}
      />
      <Table
        head={['highWaterMark (buffer size), recorded', 'value']}
        rows={[
          ['new Writable() / new Readable()', kib(s.defaults.writable)],
          ['fs.createReadStream()', kib(s.defaults.fileRead)],
          ['objectMode streams', `${s.defaults.objectMode} objects`],
        ]}
      />
      <Callout tone="note">The default was raised from 16 KiB to 64 KiB in Node.js 22; older articles say 16 KiB.</Callout>

      <h2>Backpressure</h2>
      <p>
        When the writer is faster than the reader — reading a fast disk into a slow network client — the data has to wait somewhere. A Writable
        buffers it, and tells you when to stop: <code>write()</code> returns <code>false</code> once the buffer reaches highWaterMark. It still
        accepts the chunk. If you keep writing anyway, the buffer just grows.
      </p>
      <Predict
        question={<p>A writer pushes 2,000 chunks of 1 KiB into a stream with a 16 KiB buffer and a slow consumer, ignoring <code>write()</code>’s return value. How much ends up buffered in memory?</p>}
        options={['16 KiB — the stream refuses the rest', 'About 2 MB — everything', 'Nothing — write() blocks until there is room']}
        answer={1}
        explanation="write() never blocks and never refuses. It returned false from chunk 16 on, and the buffer took all 2,000. Recorded:"
      />
      <div className={own.grid2}>
        <CodeBlock title="ignoring false — recorded" code={`${IGNORING}\n\nreturned false: ${s.ignoring.falseCount}×\nfirst false at chunk ${s.ignoring.firstFalseAt + 1}\nmax buffered: ${s.ignoring.maxBufferedBytes.toLocaleString('en')} bytes`} />
        <CodeBlock title="waiting for drain — recorded" code={`${RESPECTING}\n\nwaited for 'drain': ${s.respecting.waitsForDrain}×\nmax buffered: ${s.respecting.maxBufferedBytes.toLocaleString('en')} bytes`} />
      </div>
      <p>
        Same data, same consumer: 2 MB in memory versus 16 KiB. With a thousand concurrent downloads, that is the difference between a stable server
        and one killed for running out of memory.
      </p>
      <BackpressurePlayground />

      <h2>pipeline does it for you</h2>
      <p>
        Connecting streams by hand means handling backpressure between every pair and cleaning up when any of them fails. <code>pipeline</code> does
        both:
      </p>
      <CodeBlock title="compress a file" code={PIPELINE} />
      <p>
        Recorded: a three-stage pipeline whose last stage failed with “{s.pipeline.error}”. pipeline rejected with that error and destroyed the other
        stages (source destroyed: {String(s.pipeline.sourceDestroyed)}, middle destroyed: {String(s.pipeline.middleDestroyed)}), so no file handle or
        socket was left open.
      </p>
      <Callout tone="warn" title="Avoid .pipe() for new code">
        <code>a.pipe(b)</code> handles backpressure but not errors: if <code>b</code> fails, <code>a</code> is not destroyed and keeps its resources.
        Use <code>pipeline</code>, or <code>for await (const chunk of readable)</code> for simple reading.
      </Callout>

      <Recap
        points={[
          'Streams process data in chunks, so memory stays flat for any size.',
          'Default highWaterMark: 64 KiB (16 objects in objectMode) since Node.js 22.',
          'write() returning false means: stop until drain. Ignoring it buffers everything in memory.',
          'Use pipeline (from node:stream/promises): backpressure and error cleanup across all stages.',
        ]}
      />
    </>
  )
}
