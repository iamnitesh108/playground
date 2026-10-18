import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { LRUCache } from 'lru-cache'
import { print } from './json.ts'

/**
 * Replays a trace file (one integer key per line) through lru-cache at several `max` sizes. Each request is a
 * read; a miss is followed by a set, like a cache in front of a database.
 */
export function replay(file: string, sizes: number[]): void {
  const keys = readFileSync(file, 'utf8').trim().split('\n').map(Number)
  for (const max of sizes) {
    const cache = new LRUCache<number, number>({ max })
    let hits = 0
    for (const key of keys) {
      if (cache.get(key) !== undefined) hits++
      else cache.set(key, key)
    }
    print({ lib: 'lru-cache', trace: basename(file, '.txt'), size: max, requests: keys.length, hits })
  }
}
