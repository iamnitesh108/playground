// Stream defaults, chunking, and what happens with and without backpressure.
import { Readable, Writable, PassThrough } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createReadStream, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const out = {}
out.defaults = {
  writable: new Writable({ write(c, e, cb) { cb() } }).writableHighWaterMark,
  readable: new Readable({ read() {} }).readableHighWaterMark,
  objectMode: new Readable({ objectMode: true, read() {} }).readableHighWaterMark,
  fileRead: createReadStream(import.meta.filename).readableHighWaterMark,
}
const file = join(tmpdir(), 'stream-1mb.bin')
writeFileSync(file, Buffer.alloc(1024 * 1024, 1))
const sizes = []
for await (const chunk of createReadStream(file)) sizes.push(chunk.length)
out.fileChunks = { fileBytes: 1024 * 1024, chunks: sizes.length, sizes: [...new Set(sizes)] }

// A slow consumer: 16 KiB buffer, accepts one 1 KiB chunk per millisecond.
const slow = () => new Writable({ highWaterMark: 16 * 1024, write(chunk, enc, cb) { setTimeout(cb, 1) } })
const CHUNK = Buffer.alloc(1024)
const TOTAL = 2000
// Ignoring write()'s return value: everything piles up in memory.
{
  const w = slow()
  let maxBuffered = 0
  const falseReturns = []
  for (let i = 0; i < TOTAL; i++) {
    if (!w.write(CHUNK)) falseReturns.push(i)
    maxBuffered = Math.max(maxBuffered, w.writableLength)
  }
  out.ignoring = { chunksWritten: TOTAL, firstFalseAt: falseReturns[0], falseCount: falseReturns.length, maxBufferedBytes: maxBuffered }
  await new Promise((r) => w.end(r))
}
// Respecting it: wait for 'drain' whenever write() returns false.
{
  const w = slow()
  let maxBuffered = 0
  let drains = 0
  for (let i = 0; i < TOTAL; i++) {
    const ok = w.write(CHUNK)
    maxBuffered = Math.max(maxBuffered, w.writableLength)
    if (!ok) { drains++; await new Promise((r) => w.once('drain', r)) }
  }
  out.respecting = { chunksWritten: TOTAL, waitsForDrain: drains, maxBufferedBytes: maxBuffered }
  await new Promise((r) => w.end(r))
}
// pipeline: an error in any stage destroys every stage and rejects.
{
  const source = Readable.from(['a', 'b', 'c'])
  const failing = new Writable({ write(c, e, cb) { cb(new Error('disk full')) } })
  const middle = new PassThrough()
  try { await pipeline(source, middle, failing) } catch (e) { out.pipeline = { error: e.message, sourceDestroyed: source.destroyed, middleDestroyed: middle.destroyed } }
}
console.log(JSON.stringify(out))
