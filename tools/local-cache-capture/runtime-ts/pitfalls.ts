import { LRUCache } from 'lru-cache'
import { emit } from './out.ts'

interface Cart { items: string[]; totalCents: number }

export function run() {
  // 0. lru-cache refuses to be built without a bound
  let unbounded = 'constructed'
  try {
    // #region unbounded
    new LRUCache<string, string>({})
    // #endregion
  } catch (e) {
    unbounded = `${(e as Error).name}: ${(e as Error).message}`
  }
  emit({ exp: 'unbounded', lib: 'lru-cache', result: unbounded })

  // #region mutation
  // 1. a caller changes the object it got from the cache, and every later reader sees it
  const carts = new LRUCache<string, Cart>({ max: 100 })
  carts.set('cart:7', { items: ['book'], totalCents: 1200 })
  const mine = carts.get('cart:7')!
  mine.totalCents = 0                         // e.g. a discount meant for this request only
  mine.items.push('free gift')
  const other = carts.get('cart:7')!
  // #endregion
  emit({ exp: 'mutation', lib: 'lru-cache', sameObject: mine === other, otherSees: `${JSON.stringify(other.items)} total ${other.totalCents}`, originalTotal: 1200 })

  // #region badKey
  // 2. object keys are compared by identity: an equal-looking new object is a different key
  const bad = new LRUCache<{ region: string; id: number }, string>({ max: 10_000 })
  const good = new LRUCache<string, string>({ max: 10_000 })
  let badHits = 0, goodHits = 0
  for (let i = 0; i < 1_000; i++) {
    const objKey = { region: 'eu', id: i % 10 }
    if (bad.get(objKey) !== undefined) badHits++
    else bad.set(objKey, 'product')
    const strKey = `eu:${i % 10}`                 // the fix: a string (or number) key
    if (good.get(strKey) !== undefined) goodHits++
    else good.set(strKey, 'product')
  }
  // #endregion
  emit({ exp: 'badKey', lib: 'lru-cache', reads: 1_000, distinctProducts: 10, badHits, badSize: bad.size, goodHits, goodSize: good.size })
}
