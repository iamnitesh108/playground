import { LRUCache } from 'lru-cache'
import { print, sleep } from './json.ts'

/**
 * One reader asks for the same key every 100 ms; loading it takes 200 ms. Without allowStale the reader waits for
 * every reload once the TTL has passed; with allowStale, fetch() returns the stale value and reloads in the
 * background (stale-while-revalidate).
 */
export async function staleWhileRevalidate(): Promise<void> {
  for (const allowStale of [false, true]) {
    const mode = allowStale ? 'allowStale' : 'ttl only'
    const start = performance.now()
    const at = () => Math.round(performance.now() - start)
    let version = 0
    const cache = new LRUCache<string, number>({
      max: 100,
      ttl: 1000,
      allowStale,
      fetchMethod: async () => {
        const from = at()
        await sleep(200) // the database query
        version++
        print({ mode, event: 'load', from, to: at(), version })
        return version
      },
    })
    for (let i = 0; i <= 30; i++) {
      await sleep(start + i * 100 - performance.now())
      const t0 = performance.now()
      const value = await cache.fetch('price:7')
      print({ mode, event: 'read', at: at(), ms: Math.round((performance.now() - t0) * 1000) / 1000, version: value })
    }
  }
}
