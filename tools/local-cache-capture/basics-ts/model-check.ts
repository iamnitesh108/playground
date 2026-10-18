// Runs the same scripted session against lru-cache and against the lesson's model, and prints both removal logs
// and final recency orders as JSON, so the capture can say whether the model matches the library.
import { LRUCache } from 'lru-cache'
import { apply, BoundedCache, CHECK_SCRIPT, type Op } from '../../../src/modules/local-cache/simulation/usingCache.ts'

const MAX = 3
const TTL = 60_000

function runLibrary(script: readonly Op[]) {
  let now = 1_000
  const removals: string[] = []
  const cache = new LRUCache<string, string>({
    max: MAX,
    ttl: TTL,
    ttlResolution: 0,
    perf: { now: () => now },
    dispose: (_value, key, reason) => removals.push(`${key}:${{ evict: 'SIZE', expire: 'EXPIRED', delete: 'EXPLICIT', set: 'REPLACED', fetch: 'FETCH' }[reason]}`),
  })
  let loads = 0
  for (const step of script) {
    if (step.op === 'get') cache.get(step.key)
    else if (step.op === 'put') cache.set(step.key, step.value)
    else if (step.op === 'load') {
      if (cache.get(step.key) === undefined) {
        loads++
        cache.set(step.key, `loaded ${step.key}`)
      }
    } else if (step.op === 'invalidate') cache.delete(step.key)
    else if (step.op === 'invalidateAll') cache.clear()
    else if (step.op === 'advance') now += step.ms
    else cache.purgeStale()
  }
  return { removals, order: [...cache.keys()], loads }
}

function runModel(script: readonly Op[]) {
  const cache = new BoundedCache({ maximumSize: MAX, ttl: TTL })
  const removals: string[] = []
  cache.onRemoval((r) => removals.push(`${r.key}:${r.cause}`))
  for (const step of script) apply(cache, step)
  return { removals, order: cache.snapshot().map((e) => e.key), loads: cache.stats().loads }
}

console.log(JSON.stringify({ library: runLibrary(CHECK_SCRIPT), model: runModel(CHECK_SCRIPT) }))
