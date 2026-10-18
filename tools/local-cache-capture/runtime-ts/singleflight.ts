import { LRUCache } from 'lru-cache'
import { emit, sleep } from './out.ts'

const CALLERS = 50
const LOADER_MS = 200

/** The slow source of truth: 200 ms per call. */
function makeLoader() {
  const counter = { calls: 0 }
  const load = async (key: string) => {
    counter.calls++
    await sleep(LOADER_MS)
    return `price of ${key}`
  }
  return { counter, load }
}

// #region naive
// --- naive: check, load, set ---
async function naiveGet(cache: LRUCache<string, string>, key: string, load: (k: string) => Promise<string>) {
  let value = cache.get(key)
  if (value === undefined) {
    value = await load(key)                 // every caller that missed runs this
    cache.set(key, value)
  }
  return value
}
// #endregion

// #region singleflight
// --- single-flight: fetch() starts one load per key; the other callers wait on it ---
function singleFlightCache(load: (k: string) => Promise<string>) {
  return new LRUCache<string, string>({ max: 1_000, fetchMethod: (key) => load(key) })
}
// #endregion

/** Starts every caller in the same tick and records what each one waited. */
async function together(callers: number, call: () => Promise<unknown>) {
  const errors: string[] = []
  const waits = await Promise.all(
    Array.from({ length: callers }, async () => {
      const t0 = performance.now()
      try {
        await call()
      } catch (e) {
        errors.push(`${(e as Error).name}: ${(e as Error).message}`)
      }
      return performance.now() - t0
    }),
  )
  return { waits, errors }
}

async function stampedes() {
  {
    const { counter, load } = makeLoader()
    const cache = new LRUCache<string, string>({ max: 1_000 })
    const { waits, errors } = await together(CALLERS, () => naiveGet(cache, 'product:42', load))
    emit({ exp: 'stampede', lib: 'lru-cache', mode: 'naive', callers: CALLERS, loaderMs: LOADER_MS, loaderCalls: counter.calls, waits, errors: errors.length })
  }
  {
    const { counter, load } = makeLoader()
    const cache = singleFlightCache(load)
    const { waits, errors } = await together(CALLERS, () => cache.fetch('product:42'))
    emit({ exp: 'stampede', lib: 'lru-cache', mode: 'fetch()', callers: CALLERS, loaderMs: LOADER_MS, loaderCalls: counter.calls, waits, errors: errors.length })
  }
}

async function failure() {
  let calls = 0
  // #region failing
  const cache = new LRUCache<string, string>({
    max: 1_000,
    fetchMethod: async () => {
      calls++
      await sleep(100)
      throw new Error('database timeout')
    },
  })
  // #endregion
  const t0 = performance.now()
  const { waits, errors } = await together(10, () => cache.fetch('product:42'))
  emit({ exp: 'failure', lib: 'lru-cache', mode: 'fetch()', callers: 10, loaderCalls: calls, errors: errors.length, error: errors[0], cachedAfter: cache.has('product:42'), waits, totalMs: performance.now() - t0 })
}

/** A product that does not exist, read three times: undefined is never stored; a sentinel is. */
async function absent() {
  // #region absent
  let undefinedCalls = 0
  const plain = new LRUCache<string, string>({ max: 1_000, fetchMethod: async () => { undefinedCalls++; return undefined } })
  for (let i = 0; i < 3; i++) await plain.fetch('product:999')

  const NOT_FOUND = Symbol('not found')
  let sentinelCalls = 0
  const negative = new LRUCache<string, string | typeof NOT_FOUND>({ max: 1_000, ttl: 30_000, fetchMethod: async () => { sentinelCalls++; return NOT_FOUND } })
  for (let i = 0; i < 3; i++) await negative.fetch('product:999')
  // #endregion
  emit({ exp: 'absent', lib: 'lru-cache', reads: 3, nullLoaderCalls: undefinedCalls, nullSize: plain.size, optionalLoaderCalls: sentinelCalls, optionalSize: negative.size })
}

/** ttl + allowStale: fetch() answers with the old value and reloads in the background. */
async function refresh() {
  for (const mode of ['ttl', 'ttl + allowStale'] as const) {
    let version = 0
    // #region refresh
    const cache = new LRUCache<string, string>({
      max: 1_000,
      ttl: 500,
      allowStale: mode !== 'ttl',
      fetchMethod: async () => {
        await sleep(LOADER_MS)
        return `v${++version}`
      },
    })
    // #endregion
    const reads: { atMs: number; tookMs: number; value: string | undefined }[] = []
    const start = performance.now()
    for (let i = 0; i < 16; i++) {
      const t0 = performance.now()
      const value = await cache.fetch('product:42')
      reads.push({ atMs: Math.round(t0 - start), tookMs: performance.now() - t0, value })
      await sleep(100)
    }
    emit({ exp: 'refresh', lib: 'lru-cache', mode, afterMs: 500, loaderMs: LOADER_MS, reads })
  }
}

/** A fetchMethod that fetches its own key. */
async function recursive() {
  let calls = 0
  // #region recursive
  const cache: LRUCache<string, string> = new LRUCache<string, string>({
    max: 1_000,
    fetchMethod: async (key) => {
      calls++
      return (await cache.fetch(key)) ?? 'inner'
    },
  })
  // #endregion
  const timeout = sleep(3_000).then(() => 'no answer after 3 s (the promise never settles)')
  const result = await Promise.race([cache.fetch('product:42').then((v) => `returned ${v}`, (e: Error) => `rejected: ${e.message}`), timeout])
  emit({ exp: 'recursive', lib: 'lru-cache', result, fetchMethodCalls: calls })
}

export async function run() {
  await stampedes()
  await failure()
  await absent()
  await refresh()
  await recursive()
}
