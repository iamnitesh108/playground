// Recorded by tools/redis-capture/capture-tiered.mjs (Redis 8.8.3, PostgreSQL 17.11) — do not edit by hand.

export const TIERED = {
 "redisVersion": "8.8.3",
 "postgresVersion": "17.11",
 "l1TtlMs": 3000,
 "explain": "GroupAggregate (actual time=0.463..0.464 rows=1 loops=1)\n  ->  Nested Loop Left Join (actual time=0.090..0.450 rows=50 loops=1)\n        ->  Index Scan using products_pkey on products p (actual time=0.035..0.036 rows=1 loops=1)\n              Index Cond: (id = 42)\n        ->  Bitmap Heap Scan on reviews r (actual time=0.051..0.405 rows=50 loops=1)\n              Recheck Cond: (product_id = 42)\n              Heap Blocks: exact=50\n              ->  Bitmap Index Scan on reviews_product_id (actual time=0.037..0.038 rows=50 loops=1)\n                    Index Cond: (product_id = 42)\nPlanning Time: 0.400 ms\nExecution Time: 0.523 ms",
 "rows": {
  "products": 10000,
  "reviews": 500000
 },
 "apps": {
  "micronaut": {
   "steps": [
    {
     "at": 116,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 2.234,
      "version": 1,
      "price": 1999
     },
     "note": "cold: missed L1 and Redis, read Postgres, filled both"
    },
    {
     "at": 121,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.309,
      "version": 1,
      "price": 1999
     },
     "note": "now in A’s own memory"
    },
    {
     "at": 127,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L2",
      "ms": 0.933,
      "version": 1,
      "price": 1999
     },
     "note": "B has never seen it, but Redis has: A’s load helps B"
    },
    {
     "at": 132,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.338,
      "version": 1,
      "price": 1999
     },
     "note": "and now B has it in memory too"
    },
    {
     "at": 149,
     "cmd": "A> update 42 2499",
     "event": {
      "inst": "A",
      "ev": "update",
      "key": "product:42",
      "price": 2499,
      "version": 2,
      "publish": true,
      "ms": 12.095
     },
     "note": "Postgres updated, Redis copy deleted, invalidation published"
    },
    {
     "at": 150,
     "cmd": null,
     "event": {
      "inst": "A",
      "ev": "evict",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "A heard the invalidation and dropped its copy"
    },
    {
     "at": 150,
     "cmd": null,
     "event": {
      "inst": "B",
      "ev": "evict",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "B heard the invalidation and dropped its copy"
    },
    {
     "at": 171,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 18.075,
      "version": 2,
      "price": 2499
     },
     "note": "new price, loaded fresh from Postgres"
    },
    {
     "at": 188,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "L2",
      "ms": 14.085,
      "version": 2,
      "price": 2499
     },
     "note": "A finds the fresh copy B just put in Redis"
    },
    {
     "at": 192,
     "cmd": "A> update-silent 42 2999",
     "event": {
      "inst": "A",
      "ev": "update",
      "key": "product:42",
      "price": 2999,
      "version": 3,
      "publish": false,
      "ms": 2.234
     },
     "note": "a write that forgets to publish the invalidation"
    },
    {
     "at": 195,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.038,
      "version": 2,
      "price": 2499
     },
     "note": "B still serves the old price from its own memory"
    },
    {
     "at": 3508,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 3.575,
      "version": 3,
      "price": 2999
     },
     "note": "after the 3 s L1 TTL: the stale copy expired"
    }
   ],
   "stampede": [
    {
     "inst": "A",
     "ev": "stampede",
     "n": 100,
     "coalesce": false,
     "pgQueries": 100,
     "ms": 29.201
    },
    {
     "inst": "A",
     "ev": "stampede",
     "n": 100,
     "coalesce": true,
     "pgQueries": 1,
     "ms": 4.388
    }
   ],
   "bench": [
    {
     "inst": "A",
     "ev": "bench",
     "mode": "pg",
     "n": 20000,
     "l1": 0,
     "l2": 0,
     "pg": 20000,
     "pgQueries": 20000,
     "p50us": 49.3,
     "p95us": 103.6,
     "p99us": 153.7,
     "avgUs": 56.8,
     "readsPerSec": 17456
    },
    {
     "inst": "A",
     "ev": "bench",
     "mode": "redis",
     "n": 20000,
     "l1": 0,
     "l2": 16657,
     "pg": 3343,
     "pgQueries": 3343,
     "p50us": 43,
     "p95us": 276.1,
     "p99us": 427.8,
     "avgUs": 84.4,
     "readsPerSec": 11741
    },
    {
     "inst": "A",
     "ev": "bench",
     "mode": "tiered",
     "n": 20000,
     "l1": 15688,
     "l2": 969,
     "pg": 3343,
     "pgQueries": 3343,
     "p50us": 0.4,
     "p95us": 183.3,
     "p99us": 261.1,
     "avgUs": 32.1,
     "readsPerSec": 30831
    }
   ]
  },
  "ts": {
   "steps": [
    {
     "at": 28,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 1.53,
      "version": 1,
      "price": 1999
     },
     "note": "cold: missed L1 and Redis, read Postgres, filled both"
    },
    {
     "at": 32,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.203,
      "version": 1,
      "price": 1999
     },
     "note": "now in A’s own memory"
    },
    {
     "at": 38,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L2",
      "ms": 0.389,
      "version": 1,
      "price": 1999
     },
     "note": "B has never seen it, but Redis has: A’s load helps B"
    },
    {
     "at": 43,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.198,
      "version": 1,
      "price": 1999
     },
     "note": "and now B has it in memory too"
    },
    {
     "at": 51,
     "cmd": "A> update 42 2499",
     "event": {
      "inst": "A",
      "ev": "update",
      "key": "product:42",
      "price": 2499,
      "version": 2,
      "publish": true,
      "ms": 2.501
     },
     "note": "Postgres updated, Redis copy deleted, invalidation published"
    },
    {
     "at": 51,
     "cmd": null,
     "event": {
      "inst": "A",
      "ev": "evict",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "A heard the invalidation and dropped its copy"
    },
    {
     "at": 51,
     "cmd": null,
     "event": {
      "inst": "B",
      "ev": "evict",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "B heard the invalidation and dropped its copy"
    },
    {
     "at": 61,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 6.888,
      "version": 2,
      "price": 2499
     },
     "note": "new price, loaded fresh from Postgres"
    },
    {
     "at": 65,
     "cmd": "A> get 42",
     "event": {
      "inst": "A",
      "ev": "get",
      "key": "product:42",
      "served": "L2",
      "ms": 0.296,
      "version": 2,
      "price": 2499
     },
     "note": "A finds the fresh copy B just put in Redis"
    },
    {
     "at": 72,
     "cmd": "A> update-silent 42 2999",
     "event": {
      "inst": "A",
      "ev": "update",
      "key": "product:42",
      "price": 2999,
      "version": 3,
      "publish": false,
      "ms": 1.525
     },
     "note": "a write that forgets to publish the invalidation"
    },
    {
     "at": 76,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "L1",
      "ms": 0.042,
      "version": 2,
      "price": 2499
     },
     "note": "B still serves the old price from its own memory"
    },
    {
     "at": 3386,
     "cmd": "B> get 42",
     "event": {
      "inst": "B",
      "ev": "get",
      "key": "product:42",
      "served": "PG",
      "ms": 2.622,
      "version": 3,
      "price": 2999
     },
     "note": "after the 3 s L1 TTL: the stale copy expired"
    }
   ],
   "stampede": [
    {
     "inst": "A",
     "ev": "stampede",
     "n": 100,
     "coalesce": false,
     "pgQueries": 100,
     "ms": 27.402
    },
    {
     "inst": "A",
     "ev": "stampede",
     "n": 100,
     "coalesce": true,
     "pgQueries": 1,
     "ms": 1.263
    }
   ],
   "bench": [
    {
     "inst": "A",
     "ev": "bench",
     "mode": "pg",
     "n": 20000,
     "l1": 0,
     "l2": 0,
     "pg": 20000,
     "pgQueries": 20000,
     "p50us": 151.8,
     "p95us": 288.5,
     "p99us": 359.6,
     "avgUs": 175.1,
     "readsPerSec": 5693
    },
    {
     "inst": "A",
     "ev": "bench",
     "mode": "redis",
     "n": 20000,
     "l1": 0,
     "l2": 16657,
     "pg": 3343,
     "pgQueries": 3343,
     "p50us": 23.9,
     "p95us": 275.2,
     "p99us": 387,
     "avgUs": 65.4,
     "readsPerSec": 15214
    },
    {
     "inst": "A",
     "ev": "bench",
     "mode": "tiered",
     "n": 20000,
     "l1": 15324,
     "l2": 1333,
     "pg": 3343,
     "pgQueries": 3343,
     "p50us": 0.5,
     "p95us": 252.9,
     "p99us": 364.7,
     "avgUs": 44.4,
     "readsPerSec": 22377
    }
   ]
  },
  "rust": {
   "steps": [
    {
     "at": 25,
     "cmd": "A> get 42",
     "event": {
      "ev": "get",
      "inst": "A",
      "key": "product:42",
      "ms": 1.195,
      "price": 1999,
      "served": "PG",
      "version": 1
     },
     "note": "cold: missed L1 and Redis, read Postgres, filled both"
    },
    {
     "at": 30,
     "cmd": "A> get 42",
     "event": {
      "ev": "get",
      "inst": "A",
      "key": "product:42",
      "ms": 0.011,
      "price": 1999,
      "served": "L1",
      "version": 1
     },
     "note": "now in A’s own memory"
    },
    {
     "at": 36,
     "cmd": "B> get 42",
     "event": {
      "ev": "get",
      "inst": "B",
      "key": "product:42",
      "ms": 0.31,
      "price": 1999,
      "served": "L2",
      "version": 1
     },
     "note": "B has never seen it, but Redis has: A’s load helps B"
    },
    {
     "at": 41,
     "cmd": "B> get 42",
     "event": {
      "ev": "get",
      "inst": "B",
      "key": "product:42",
      "ms": 0.011,
      "price": 1999,
      "served": "L1",
      "version": 1
     },
     "note": "and now B has it in memory too"
    },
    {
     "at": 50,
     "cmd": "A> update 42 2499",
     "event": {
      "ev": "update",
      "inst": "A",
      "key": "product:42",
      "ms": 2.031,
      "price": 2499,
      "publish": true,
      "version": 2
     },
     "note": "Postgres updated, Redis copy deleted, invalidation published"
    },
    {
     "at": 50,
     "cmd": null,
     "event": {
      "ev": "evict",
      "inst": "A",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "A heard the invalidation and dropped its copy"
    },
    {
     "at": 50,
     "cmd": null,
     "event": {
      "ev": "evict",
      "inst": "B",
      "key": "product:42",
      "reason": "pubsub"
     },
     "note": "B heard the invalidation and dropped its copy"
    },
    {
     "at": 56,
     "cmd": "B> get 42",
     "event": {
      "ev": "get",
      "inst": "B",
      "key": "product:42",
      "ms": 2.038,
      "price": 2499,
      "served": "PG",
      "version": 2
     },
     "note": "new price, loaded fresh from Postgres"
    },
    {
     "at": 58,
     "cmd": "A> get 42",
     "event": {
      "ev": "get",
      "inst": "A",
      "key": "product:42",
      "ms": 0.283,
      "price": 2499,
      "served": "L2",
      "version": 2
     },
     "note": "A finds the fresh copy B just put in Redis"
    },
    {
     "at": 67,
     "cmd": "A> update-silent 42 2999",
     "event": {
      "ev": "update",
      "inst": "A",
      "key": "product:42",
      "ms": 1.867,
      "price": 2999,
      "publish": false,
      "version": 3
     },
     "note": "a write that forgets to publish the invalidation"
    },
    {
     "at": 70,
     "cmd": "B> get 42",
     "event": {
      "ev": "get",
      "inst": "B",
      "key": "product:42",
      "ms": 0.012,
      "price": 2499,
      "served": "L1",
      "version": 2
     },
     "note": "B still serves the old price from its own memory"
    },
    {
     "at": 3377,
     "cmd": "B> get 42",
     "event": {
      "ev": "get",
      "inst": "B",
      "key": "product:42",
      "ms": 1.123,
      "price": 2999,
      "served": "PG",
      "version": 3
     },
     "note": "after the 3 s L1 TTL: the stale copy expired"
    }
   ],
   "stampede": [
    {
     "coalesce": false,
     "ev": "stampede",
     "inst": "A",
     "ms": 12.066,
     "n": 100,
     "pgQueries": 100
    },
    {
     "coalesce": true,
     "ev": "stampede",
     "inst": "A",
     "ms": 0.84,
     "n": 100,
     "pgQueries": 1
    }
   ],
   "bench": [
    {
     "avgUs": 214.2,
     "ev": "bench",
     "inst": "A",
     "l1": 0,
     "l2": 0,
     "mode": "pg",
     "n": 20000,
     "p50us": 196.9,
     "p95us": 311.2,
     "p99us": 383.6,
     "pg": 20000,
     "pgQueries": 20000,
     "readsPerSec": 4659
    },
    {
     "avgUs": 76.8,
     "ev": "bench",
     "inst": "A",
     "l1": 0,
     "l2": 16657,
     "mode": "redis",
     "n": 20000,
     "p50us": 31.9,
     "p95us": 308.2,
     "p99us": 374.8,
     "pg": 3343,
     "pgQueries": 3343,
     "readsPerSec": 12971
    },
    {
     "avgUs": 54.3,
     "ev": "bench",
     "inst": "A",
     "l1": 15654,
     "l2": 1003,
     "mode": "tiered",
     "n": 20000,
     "p50us": 0.6,
     "p95us": 322.3,
     "p99us": 399.3,
     "pg": 3343,
     "pgQueries": 3343,
     "readsPerSec": 18334
    }
   ]
  }
 },
 "valueBytes": 85,
 "memoryUsage": 144
} as const
