// The everyday lru-cache API, one section per task. Each section prints "## <name>" and then what happened.
import { LRUCache } from 'lru-cache'

type Product = { id: string; name: string; priceCents: number }

let loads = 0
function loadProduct(id: string): Product {
  loads++
  return { id, name: `Product ${id}`, priceCents: 1000 + Number(id.slice(1)) }
}
const section = (name: string) => console.log(`## ${name}`)
const show = (p: Product | undefined) => (p ? `${p.name} (${p.priceCents})` : 'undefined')

section('build')
// #region build
const cache = new LRUCache<string, Product>({
  max: 100, // at most 100 entries (required: max, maxSize or ttl)
  ttl: 10 * 60_000, // each entry lives 10 minutes (milliseconds)
})
// #endregion
console.log(`size = ${cache.size}, max = ${cache.max}, ttl = ${cache.ttl} ms`)

section('get-put')
// #region get-put
console.log(`get("p1") = ${show(cache.get('p1'))}`) // a miss: undefined
cache.set('p1', loadProduct('p1'))
console.log(`get("p1") = ${show(cache.get('p1'))}`) // a hit
console.log(`has("p2") = ${cache.has('p2')}`)
// #endregion

section('loader')
// #region loader
// No get-with-loader on a plain cache: check, load, set. (Fine in Node: nothing else runs in between.)
function getProduct(id: string): Product {
  let product = cache.get(id)
  if (product === undefined) {
    product = loadProduct(id)
    cache.set(id, product)
  }
  return product
}
loads = 0
getProduct('p7')
getProduct('p7')
console.log(`two calls for p7 → loader ran ${loads} time(s)`)
// #endregion

section('invalidate')
// #region invalidate
cache.set('p2', loadProduct('p2'))
console.log(`delete("p2") = ${cache.delete('p2')}, size = ${cache.size}`) // one key
cache.clear() // everything
console.log(`after clear(): size = ${cache.size}`)
// #endregion

section('bulk')
// #region bulk
for (const id of ['p1', 'p2', 'p3']) cache.set(id, loadProduct(id))
const wanted = ['p1', 'p3', 'p9']
// No getAll: ask key by key, then load the misses.
const found = new Map(wanted.flatMap((id) => (cache.has(id) ? [[id, cache.get(id)!]] : [])))
const missing = wanted.filter((id) => !found.has(id))
console.log(`present: ${[...found.keys()].join(', ')}; missing: ${missing.join(', ')}`)
for (const id of missing) cache.set(id, loadProduct(id))
// #endregion

section('iterate')
// #region iterate
cache.get('p1') // touch p1: it becomes the most recently used
console.log(`size = ${cache.size}`)
for (const [id, product] of cache.entries()) console.log(`${id} → ${product.name}`) // most recent first
console.log(`keys(): ${[...cache.keys()].join(', ')}`)
// #endregion

section('loading')
// #region loading
// memoMethod turns the cache into a loading cache: memo(key) loads on a miss.
const products = new LRUCache<string, Product>({
  max: 100,
  memoMethod: (id) => loadProduct(id),
})
loads = 0
products.memo('p4')
products.memo('p4')
console.log(`memo("p4") twice → loader ran ${loads} time(s)`)
// #endregion

section('async')
// #region async
// fetch() + fetchMethod: an async loading cache that shares one in-flight load per key.
const remote = new LRUCache<string, Product>({
  max: 100,
  fetchMethod: async (id) => {
    await new Promise((resolve) => setTimeout(resolve, 20)) // a slow source
    return loadProduct(id)
  },
})
loads = 0
const results = await Promise.all([remote.fetch('p5'), remote.fetch('p5'), remote.fetch('p5')])
console.log(`3 concurrent fetch("p5") → ${results.map(show).join(' | ')}; loader ran ${loads} time(s)`)
// #endregion

section('removal')
// #region removal
let now = 1_000 // a fake clock (ms), so expiry is exact
const small = new LRUCache<string, string>({
  max: 2,
  ttl: 60_000,
  ttlResolution: 0,
  perf: { now: () => now },
  dispose: (value, key, reason) => console.log(`removed ${key}=${value} (${reason})`),
})
small.set('a', 'v1')
small.set('a', 'v2') // replaces v1
small.set('b', 'v1')
small.delete('b')
small.set('c', 'v1')
small.set('d', 'v1') // a third entry in a cache of 2
now += 2 * 60_000 // two minutes later
small.purgeStale() // expired entries are otherwise removed only when touched
// #endregion

section('stats')
// #region stats
// No counters built in; a status object tells each get() what happened.
let hits = 0
let misses = 0
function trackedGet(id: string): Product | undefined {
  const status: LRUCache.Status<Product> = {}
  const product = cache.get(id, { status })
  if (status.get === 'hit') hits++
  else misses++
  return product
}
for (const id of ['p1', 'p1', 'p2', 'p3', 'p404']) trackedGet(id)
console.log(`hits = ${hits}, misses = ${misses}, hit ratio = ${(hits / (hits + misses)).toFixed(2)}`)
// #endregion
