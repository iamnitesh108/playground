import { readFileSync } from 'node:fs'
import { emit } from './out.ts'

const experiments: Record<string, () => Promise<unknown> | unknown> = {
  singleflight: async () => (await import('./singleflight.ts')).run(),
  footprint: async () => (await import('./memory.ts')).footprint(),
  weight: async () => (await import('./memory.ts')).weight(),
  bench: async () => (await import('./bench.ts')).run(),
  stats: async () => (await import('./stats.ts')).run(),
  pitfalls: async () => (await import('./pitfalls.ts')).run(),
}

const lruVersion = JSON.parse(readFileSync(new URL('./node_modules/lru-cache/package.json', import.meta.url), 'utf8')).version
emit({ exp: 'runtime', node: process.version, lruCache: lruVersion })
await experiments[process.argv[2]]()
