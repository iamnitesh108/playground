// Recorded by tools/local-cache-capture/capture-basics.mjs (Caffeine 3.1.8, lru-cache 11.5.3, moka 0.12.16) — do not edit by hand.

export const BASICS = {
 "versions": {
  "caffeine": "3.1.8",
  "micronautCache": "4.3.0",
  "micronautCore": "4.5.3",
  "lettuce": "6.4.0.RELEASE",
  "lruCache": "11.5.3",
  "ioredis": "5.11.1",
  "moka": "0.12.16",
  "redisCrate": "0.27.6",
  "java": "17.0.20.1",
  "node": "v24.21.0",
  "rust": "1.98.1",
  "redis": "8.8.3",
  "cpu": "AMD Ryzen 5 8640HS w/ Radeon 760M Graphics",
  "cores": 12
 },
 "runs": 3,
 "using": {
  "java": {
   "build": [
    "estimatedSize() = 0"
   ],
   "get-put": [
    "getIfPresent(\"p1\") = null",
    "getIfPresent(\"p1\") = Product p1 (1001)",
    "asMap().containsKey(\"p2\") = false"
   ],
   "loader": [
    "two calls for p7 → loader ran 1 time(s)"
   ],
   "invalidate": [
    "after invalidate(\"p2\"): estimatedSize() = 2",
    "after invalidateAll(): estimatedSize() = 0"
   ],
   "bulk": [
    "getAllPresent = [p1, p3]",
    "bulk loader asked for [p9]",
    "getAll = [p1, p3, p9], loader ran 1 time(s)"
   ],
   "iterate": [
    "estimatedSize() = 4",
    "p1 → Product p1",
    "p2 → Product p2",
    "p3 → Product p3",
    "p9 → Product p9",
    "hottest(2) = [p3, p2]"
   ],
   "loading": [
    "get(\"p4\") twice → loader ran 1 time(s)"
   ],
   "async": [
    "3 concurrent get(\"p5\") → [Product p5 (1005), Product p5 (1005), Product p5 (1005)]; loader ran 1 time(s)"
   ],
   "removal": [
    "removed a=v1 (REPLACED)",
    "removed b=v1 (EXPLICIT)",
    "removed c=v1 (SIZE)",
    "removed a=v2 (EXPIRED)",
    "removed d=v1 (EXPIRED)"
   ],
   "stats": [
    "hitCount = 4, missCount = 1, hitRate = 0.80, evictionCount = 0"
   ]
  },
  "ts": {
   "build": [
    "size = 0, max = 100, ttl = 600000 ms"
   ],
   "get-put": [
    "get(\"p1\") = undefined",
    "get(\"p1\") = Product p1 (1001)",
    "has(\"p2\") = false"
   ],
   "loader": [
    "two calls for p7 → loader ran 1 time(s)"
   ],
   "invalidate": [
    "delete(\"p2\") = true, size = 2",
    "after clear(): size = 0"
   ],
   "bulk": [
    "present: p1, p3; missing: p9"
   ],
   "iterate": [
    "size = 4",
    "p1 → Product p1",
    "p9 → Product p9",
    "p3 → Product p3",
    "p2 → Product p2",
    "keys(): p1, p9, p3, p2"
   ],
   "loading": [
    "memo(\"p4\") twice → loader ran 1 time(s)"
   ],
   "async": [
    "3 concurrent fetch(\"p5\") → Product p5 (1005) | Product p5 (1005) | Product p5 (1005); loader ran 1 time(s)"
   ],
   "removal": [
    "removed a=v1 (set)",
    "removed b=v1 (delete)",
    "removed a=v2 (evict)",
    "removed c=v1 (expire)",
    "removed d=v1 (expire)"
   ],
   "stats": [
    "hits = 4, misses = 1, hit ratio = 0.80"
   ]
  },
  "rust": {
   "build": [
    "entry_count() = 0"
   ],
   "get-put": [
    "get(\"p1\") = None",
    "get(\"p1\") = Product p1 (1001)",
    "contains_key(\"p2\") = false"
   ],
   "loader": [
    "two calls for p7 → loader ran 1 time(s)"
   ],
   "invalidate": [
    "after invalidate(\"p2\"): entry_count() = 2",
    "after invalidate_all(): entry_count() = 0"
   ],
   "bulk": [
    "got 3 products, loader ran 1 time(s)"
   ],
   "iterate": [
    "entry_count() before maintenance = 0",
    "entry_count() after run_pending_tasks() = 4",
    "p1 → Product p1",
    "p2 → Product p2",
    "p3 → Product p3",
    "p9 → Product p9"
   ],
   "loading": [
    "product(\"p4\") twice → loader ran 1 time(s)"
   ],
   "async": [
    "3 concurrent get_with(\"p5\") → Product p5 (1005) | Product p5 (1005) | Product p5 (1005); loader ran 1 time(s)"
   ],
   "removal": [
    "removed a=v1 (Replaced)",
    "removed b=v1 (Explicit)",
    "removed d=v1 (Size)",
    "removed a=v2 (Expired)",
    "removed c=v1 (Expired)"
   ],
   "stats": [
    "hits = 4, misses = 1, hit ratio = 0.80"
   ]
  }
 },
 "micronaut": [
  "#1 find(\"p1\") → 1999, method ran 1 time(s)",
  "#2 find(\"p1\") → 1999, method ran 1 time(s)",
  "#3 find(\"p1\") → 1999, method ran 1 time(s)",
  "   updatePriceWrongKey(\"p1\", 1899)   @CacheInvalidate on (id, priceCents)",
  "#4 find(\"p1\") → 1999, method ran 1 time(s)",
  "   updatePrice(\"p1\", 1799)           @CacheInvalidate(parameters = \"id\")",
  "#5 find(\"p1\") → 1799, method ran 2 time(s)",
  "native cache: BoundedLocalManualCache, maximum = 1000, expireAfterWrite = PT10M",
  "stats: hitCount = 3, missCount = 2"
 ],
 "modelCheck": {
  "library": {
   "removals": [
    "b:SIZE",
    "c:REPLACED",
    "a:SIZE",
    "d:SIZE",
    "c:EXPLICIT",
    "e:EXPIRED"
   ],
   "order": [
    "g",
    "f"
   ],
   "loads": 2
  },
  "model": {
   "removals": [
    "b:SIZE",
    "c:REPLACED",
    "a:SIZE",
    "d:SIZE",
    "c:EXPLICIT",
    "e:EXPIRED"
   ],
   "order": [
    "g",
    "f"
   ],
   "loads": 2
  },
  "matches": true
 },
 "why": {
  "java": {
   "heap": [
    {
     "kind": "map",
     "inserted": 100000,
     "size": 100000,
     "mb": 22.2
    },
    {
     "kind": "map",
     "inserted": 200000,
     "size": 200000,
     "mb": 44.8
    },
    {
     "kind": "map",
     "inserted": 300000,
     "size": 300000,
     "mb": 65.5
    },
    {
     "kind": "map",
     "inserted": 400000,
     "size": 400000,
     "mb": 88.2
    },
    {
     "kind": "map",
     "inserted": 500000,
     "size": 500000,
     "mb": 108.8
    },
    {
     "kind": "map",
     "inserted": 600000,
     "size": 600000,
     "mb": 129.4
    },
    {
     "kind": "map",
     "inserted": 700000,
     "size": 700000,
     "mb": 150
    },
    {
     "kind": "map",
     "inserted": 800000,
     "size": 800000,
     "mb": 174.6
    },
    {
     "kind": "map",
     "inserted": 900000,
     "size": 900000,
     "mb": 195.3
    },
    {
     "kind": "map",
     "inserted": 1000000,
     "size": 1000000,
     "mb": 215.9
    },
    {
     "kind": "cache",
     "inserted": 100000,
     "size": 10000,
     "mb": 2.6
    },
    {
     "kind": "cache",
     "inserted": 200000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 300000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 400000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 500000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 600000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 700000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 800000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 900000,
     "size": 10000,
     "mb": 2.7
    },
    {
     "kind": "cache",
     "inserted": 1000000,
     "size": 10000,
     "mb": 2.7
    }
   ],
   "latency": {
    "cache-get": {
     "ns": 24.1
    },
    "map-get": {
     "ns": 6.4
    },
    "compute": {
     "ns": 21.6
    },
    "redis-get": {
     "ns": 27612,
     "p99": 51707
    }
   }
  },
  "ts": {
   "heap": [
    {
     "kind": "map",
     "inserted": 100000,
     "size": 100000,
     "mb": 27.2
    },
    {
     "kind": "map",
     "inserted": 200000,
     "size": 200000,
     "mb": 54.3
    },
    {
     "kind": "map",
     "inserted": 300000,
     "size": 300000,
     "mb": 85
    },
    {
     "kind": "map",
     "inserted": 400000,
     "size": 400000,
     "mb": 108.6
    },
    {
     "kind": "map",
     "inserted": 500000,
     "size": 500000,
     "mb": 132.3
    },
    {
     "kind": "map",
     "inserted": 600000,
     "size": 600000,
     "mb": 169.9
    },
    {
     "kind": "map",
     "inserted": 700000,
     "size": 700000,
     "mb": 193.6
    },
    {
     "kind": "map",
     "inserted": 800000,
     "size": 800000,
     "mb": 217.2
    },
    {
     "kind": "map",
     "inserted": 900000,
     "size": 900000,
     "mb": 240.9
    },
    {
     "kind": "map",
     "inserted": 1000000,
     "size": 1000000,
     "mb": 264.6
    },
    {
     "kind": "cache",
     "inserted": 100000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 200000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 300000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 400000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 500000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 600000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 700000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 800000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 900000,
     "size": 10000,
     "mb": 3.3
    },
    {
     "kind": "cache",
     "inserted": 1000000,
     "size": 10000,
     "mb": 3.3
    }
   ],
   "latency": {
    "cache-get": {
     "ns": 18.5
    },
    "map-get": {
     "ns": 15.8
    },
    "compute": {
     "ns": 24.9
    },
    "redis-get": {
     "ns": 20238,
     "p99": 41758
    }
   }
  },
  "rust": {
   "heap": [
    {
     "kind": "map",
     "inserted": 100000,
     "size": 100000,
     "mb": 21.1
    },
    {
     "kind": "map",
     "inserted": 200000,
     "size": 200000,
     "mb": 43.2
    },
    {
     "kind": "map",
     "inserted": 300000,
     "size": 300000,
     "mb": 69.3
    },
    {
     "kind": "map",
     "inserted": 400000,
     "size": 400000,
     "mb": 87.3
    },
    {
     "kind": "map",
     "inserted": 500000,
     "size": 500000,
     "mb": 121.7
    },
    {
     "kind": "map",
     "inserted": 600000,
     "size": 600000,
     "mb": 139.6
    },
    {
     "kind": "map",
     "inserted": 700000,
     "size": 700000,
     "mb": 157.6
    },
    {
     "kind": "map",
     "inserted": 800000,
     "size": 800000,
     "mb": 175.5
    },
    {
     "kind": "map",
     "inserted": 900000,
     "size": 900000,
     "mb": 193.4
    },
    {
     "kind": "map",
     "inserted": 1000000,
     "size": 1000000,
     "mb": 244.3
    },
    {
     "kind": "cache",
     "inserted": 100000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 200000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 300000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 400000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 500000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 600000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 700000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 800000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 900000,
     "size": 10000,
     "mb": 4.2
    },
    {
     "kind": "cache",
     "inserted": 1000000,
     "size": 10000,
     "mb": 4.2
    }
   ],
   "latency": {
    "cache-get": {
     "ns": 162.4
    },
    "map-get": {
     "ns": 21.1
    },
    "compute": {
     "ns": 62
    },
    "redis-get": {
     "ns": 16180,
     "p99": 30398
    }
   }
  }
 }
} as const
