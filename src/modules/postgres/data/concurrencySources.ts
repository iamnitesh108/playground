// The small programs the concurrency lessons were recorded with (tools/postgres-capture/concurrency-app),
// imported as text so the lessons always show the code that ran.
import retry from '../../../../tools/postgres-capture/concurrency-app/src/retry.ts?raw'
import queue from '../../../../tools/postgres-capture/concurrency-app/src/queue.ts?raw'
import idempotent from '../../../../tools/postgres-capture/concurrency-app/src/idempotent.ts?raw'

/** The text from `start` up to (not including) `end`, with the common indentation removed. */
function excerpt(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  if (from < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  const lines = source.slice(from, to).replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

export const SOURCES = {
  /** The retry helper: SERIALIZABLE transaction, retried on 40001 / 40P01. */
  retry: excerpt(retry, '/** SQLSTATEs', '/** One doctor'),
  /** The transaction it wraps. */
  retryUse: excerpt(retry, '/** One doctor', 'const pool'),
  /** One queue worker. */
  worker: excerpt(queue, '/** Claims', 'async function run'),
  /** Idempotent payment creation. */
  payment: excerpt(idempotent, '/**\n * Creates', 'const show'),
} as const
