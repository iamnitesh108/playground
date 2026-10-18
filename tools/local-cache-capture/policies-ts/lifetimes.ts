import { LRUCache } from 'lru-cache'
import { print, sleep } from './json.ts'

const TTL = 200

/** ttl without ttlAutopurge: an expired entry stays (and counts) until something touches it. */
export async function lazy(): Promise<void> {
  const start = performance.now()
  const at = () => Math.round(performance.now() - start)
  const cache = new LRUCache<string, string>({
    max: 100,
    ttl: TTL,
    dispose: (_value, key, reason) => print({ t: at(), event: 'dispose', key, reason }),
  })
  const step = (op: string, result: unknown) => print({ t: at(), event: 'op', op, result: result ?? 'undefined' })
  cache.set('a', '1')
  cache.set('b', '2')
  step('set a and b', cache.size)
  await sleep(100)
  step('get(a)', cache.get('a'))
  await sleep(200) // both are now past their 200 ms
  step('size', cache.size)
  step('get(a)', cache.get('a'))
  step('size', cache.size)
  step('purgeStale()', cache.purgeStale())
  step('size', cache.size)
}

/** ttlAutopurge: a timer per entry deletes it shortly after it expires, even if nobody asks. */
export async function autopurge(): Promise<void> {
  const start = performance.now()
  const cache = new LRUCache<string, string>({
    max: 100,
    ttl: TTL,
    ttlAutopurge: true,
    dispose: (_value, key, reason) => print({ event: 'dispose', key, reason, afterMs: Math.round((performance.now() - start) * 10) / 10 }),
  })
  cache.set('k', 'v')
  await sleep(400)
  print({ event: 'done', size: cache.size, ttlMs: TTL })
}

/** One entry read every 200 ms for a while, then left alone, with and without updateAgeOnGet. */
export async function ageOnGet(): Promise<void> {
  const plain = new LRUCache<string, string>({ max: 10, ttl: 500 })
  const sliding = new LRUCache<string, string>({ max: 10, ttl: 500, updateAgeOnGet: true })
  plain.set('k', 'v')
  sliding.set('k', 'v')
  const start = performance.now()
  for (const t of [200, 400, 600, 800, 1000, 1600]) {
    await sleep(start + t - performance.now())
    print({ t, plain: plain.get('k') !== undefined, updateAgeOnGet: sliding.get('k') !== undefined })
  }
}
