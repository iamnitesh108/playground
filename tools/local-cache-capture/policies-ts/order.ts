import { LRUCache } from 'lru-cache'
import { print } from './json.ts'

/** A few requests against a tiny cache: after each one, what was evicted and what is left (most recent first). */
export function order(max: number, requests: string[]): void {
  const evicted: string[] = []
  const cache = new LRUCache<string, string>({
    max,
    dispose: (_value, key, reason) => { if (reason === 'evict') evicted.push(key) },
  })
  requests.forEach((key, i) => {
    const hit = cache.get(key) !== undefined
    if (!hit) cache.set(key, key)
    print({ lib: 'lru-cache', step: i + 1, key, hit, evicted: evicted.splice(0), contents: [...cache.keys()] })
  })
}
