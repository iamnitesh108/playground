// Recorded from Redis 8.8.3 by tools/redis-capture — do not edit by hand.

export const REDIS_VERSION = "8.8.3"

export const CAPTURE = {
 "architecture": {
  "threads": [
   "bio_aof",
   "bio_close_file",
   "bio_lazy_free",
   "jemalloc_bg_thd",
   "jemalloc_bg_thd",
   "redis-server"
  ],
  "server": {
   "redis_version": "8.8.3",
   "redis_mode": "standalone",
   "arch_bits": "64",
   "multiplexing_api": "epoll",
   "io_threads_active": "0",
   "hz": "10",
   "configured_hz": "10"
  },
  "ioThreads": "1",
  "pingBaselineMs": {
   "p50": 0.034,
   "p99": 0.124
  },
  "busyScript": "local i = 0 while i < tonumber(ARGV[1]) do i = i + 1 end return i",
  "blockedDefault": {
   "slowMs": 603,
   "pingMs": 573,
   "ping": "PONG",
   "slowReply": "integer"
  },
  "busyThresholdDefault": "5000",
  "blockedBusyError": {
   "slowMs": 601,
   "pingMs": 0,
   "ping": "(error) BUSY Redis is busy running a script. You can only call SCRIPT KILL or SHUTDOWN NOSAVE.",
   "slowReply": "integer"
  },
  "keyspace": 1000000,
  "keysMs": 60,
  "keysPing": {
   "slowMs": 57,
   "pingMs": 52,
   "ping": "PONG",
   "slowReply": "array"
  },
  "scanStepMs": 0,
  "scanFirst": {
   "cursor": "770560",
   "returned": 0
  },
  "scanFull": {
   "calls": 1000,
   "totalMs": 219
  },
  "slowlog": [
   {
    "cmd": "SLOWLOG GET 3",
    "out": "1) 1) (integer) 5\n   2) (integer) 1792288266\n   3) (integer) 56877\n   4) 1) \"KEYS\"\n      2) \"nomatch*\"\n   5) \"127.0.0.1:37508\"\n   6) \"\"\n2) 1) (integer) 4\n   2) (integer) 1792288266\n   3) (integer) 59094\n   4) 1) \"KEYS\"\n      2) \"nomatch*\"\n   5) \"127.0.0.1:37508\"\n   6) \"\"\n3) 1) (integer) 3\n   2) (integer) 1792288266\n   3) (integer) 359090\n   4) 1) \"DEBUG\"\n      2) \"POPULATE\"\n      3) \"1000000\"\n      4) \"item\"\n   5) \"127.0.0.1:37508\"\n   6) \"\""
   }
  ]
 },
 "version": "8.8.3",
 "protocol": {
  "wire": [
   {
    "cmd": "SET user:1 Ann",
    "sent": "*3\\r\\n$3\\r\\nSET\\r\\n$6\\r\\nuser:1\\r\\n$3\\r\\nAnn\\r\\n",
    "received": "+OK\\r\\n"
   },
   {
    "cmd": "GET user:1",
    "sent": "*2\\r\\n$3\\r\\nGET\\r\\n$6\\r\\nuser:1\\r\\n",
    "received": "$3\\r\\nAnn\\r\\n"
   },
   {
    "cmd": "GET user:2",
    "sent": "*2\\r\\n$3\\r\\nGET\\r\\n$6\\r\\nuser:2\\r\\n",
    "received": "$-1\\r\\n"
   },
   {
    "cmd": "INCR visits",
    "sent": "*2\\r\\n$4\\r\\nINCR\\r\\n$6\\r\\nvisits\\r\\n",
    "received": ":1\\r\\n"
   },
   {
    "cmd": "INCR user:1",
    "sent": "*2\\r\\n$4\\r\\nINCR\\r\\n$6\\r\\nuser:1\\r\\n",
    "received": "-ERR value is not an integer or out of range\\r\\n"
   },
   {
    "cmd": "RPUSH cart:1 apple pear",
    "sent": "*4\\r\\n$5\\r\\nRPUSH\\r\\n$6\\r\\ncart:1\\r\\n$5\\r\\napple\\r\\n$4\\r\\npear\\r\\n",
    "received": ":2\\r\\n"
   },
   {
    "cmd": "LRANGE cart:1 0 -1",
    "sent": "*4\\r\\n$6\\r\\nLRANGE\\r\\n$6\\r\\ncart:1\\r\\n$1\\r\\n0\\r\\n$2\\r\\n-1\\r\\n",
    "received": "*2\\r\\n$5\\r\\napple\\r\\n$4\\r\\npear\\r\\n"
   }
  ],
  "inline": "+PONG\\r\\n$3\\r\\nAnn\\r\\n",
  "incr": {
   "n": 10000,
   "sequentialMs": 214,
   "pipelinedMs": 10.4,
   "batched100Ms": 13.9,
   "final": "30000"
  },
  "benchmark": {
   "plain": [
    "SET: 101163.38 requests per second, p50=0.255 msec",
    "GET: 98135.42 requests per second, p50=0.263 msec"
   ],
   "pipeline16": [
    "SET: 1449275.38 requests per second, p50=0.455 msec",
    "GET: 1666666.75 requests per second, p50=0.263 msec"
   ],
   "oneClient": [
    "SET: 49962.53 requests per second, p50=0.015 msec",
    "GET: 49627.79 requests per second, p50=0.015 msec"
   ]
  },
  "multi": [
   {
    "who": "A",
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "who": "A",
    "cmd": "SET stock 10",
    "out": "QUEUED"
   },
   {
    "who": "A",
    "cmd": "DECR stock",
    "out": "QUEUED"
   },
   {
    "who": "A",
    "cmd": "EXEC",
    "out": "1) OK\n2) (integer) 9"
   }
  ]
 },
 "types": {
  "config": {
   "hash-max-listpack-entries": "512",
   "hash-max-listpack-value": "64",
   "list-max-listpack-size": "-2",
   "set-max-intset-entries": "512",
   "set-max-listpack-entries": "128",
   "set-max-listpack-value": "64",
   "zset-max-listpack-entries": "128",
   "zset-max-listpack-value": "64",
   "stream-node-max-entries": "100",
   "stream-node-max-bytes": "4096"
  },
  "strings": [
   {
    "key": "counter",
    "bytes": 5,
    "encoding": "int",
    "memory": 32
   },
   {
    "key": "short",
    "bytes": 44,
    "encoding": "raw",
    "memory": 80
   },
   {
    "key": "long",
    "bytes": 45,
    "encoding": "raw",
    "memory": 96
   },
   {
    "key": "huge-number",
    "bytes": 30,
    "encoding": "embstr",
    "memory": 64
   },
   {
    "key": "float",
    "bytes": 4,
    "encoding": "embstr",
    "memory": 32
   }
  ],
  "embstrLimit": [
   {
    "key": "k",
    "keyBytes": 1,
    "maxValueBytes": 40
   },
   {
    "key": "user:1:name",
    "keyBytes": 11,
    "maxValueBytes": 30
   },
   {
    "key": "session:3f2a9c1e-77d0-4b2e",
    "keyBytes": 26,
    "maxValueBytes": 15
   }
  ],
  "appendTurnsRaw": {
   "before": "embstr",
   "after": "raw"
  },
  "transitions": [
   {
    "type": "hash",
    "key": "h",
    "steps": [
     {
      "count": 1,
      "encoding": "listpack",
      "memory": 58
     },
     {
      "count": 513,
      "encoding": "hashtable",
      "memory": 31365
     }
    ]
   },
   {
    "type": "set of integers",
    "key": "si",
    "steps": [
     {
      "count": 1,
      "encoding": "intset",
      "memory": 42
     },
     {
      "count": 513,
      "encoding": "hashtable",
      "memory": 23049
     }
    ]
   },
   {
    "type": "set of strings",
    "key": "ss",
    "steps": [
     {
      "count": 1,
      "encoding": "listpack",
      "memory": 49
     },
     {
      "count": 129,
      "encoding": "hashtable",
      "memory": 6672
     }
    ]
   },
   {
    "type": "sorted set",
    "key": "z",
    "steps": [
     {
      "count": 1,
      "encoding": "listpack",
      "memory": 51
     },
     {
      "count": 129,
      "encoding": "skiplist",
      "memory": 12976
     }
    ]
   },
   {
    "type": "list (10-byte items)",
    "key": "l",
    "steps": [
     {
      "count": 1,
      "encoding": "listpack",
      "memory": 51
     },
     {
      "count": 683,
      "encoding": "quicklist",
      "memory": 8386
     }
    ]
   }
  ],
  "hashJump": {
   "atLimit": {
    "fields": 512,
    "encoding": "listpack",
    "memory": 9767
   },
   "above": {
    "fields": 513,
    "encoding": "hashtable",
    "memory": 31363
   }
  },
  "longValue": {
   "before": "listpack",
   "after": "hashtable",
   "valueBytes": 65
  },
  "noWayBack": {
   "fields": 1,
   "encoding": "hashtable"
  },
  "bucketing": {
   "objects": 100000,
   "asKeysBytes": 6873840,
   "asHashesBytes": 2093872,
   "hashEncoding": "listpack"
  },
  "tour": [
   {
    "cmd": "SET page:home:views 1042",
    "out": "OK"
   },
   {
    "cmd": "OBJECT ENCODING page:home:views",
    "out": "\"int\""
   },
   {
    "cmd": "SET user:1:name \"Ann Lee\"",
    "out": "OK"
   },
   {
    "cmd": "OBJECT ENCODING user:1:name",
    "out": "\"embstr\""
   },
   {
    "cmd": "RPUSH queue:emails m1 m2 m3",
    "out": "(integer) 3"
   },
   {
    "cmd": "OBJECT ENCODING queue:emails",
    "out": "\"listpack\""
   },
   {
    "cmd": "HSET user:1 name Ann email ann@example.com plan pro",
    "out": "(integer) 3"
   },
   {
    "cmd": "OBJECT ENCODING user:1",
    "out": "\"listpack\""
   },
   {
    "cmd": "SADD tags:post:9 redis cache db",
    "out": "(integer) 3"
   },
   {
    "cmd": "OBJECT ENCODING tags:post:9",
    "out": "\"listpack\""
   },
   {
    "cmd": "SADD online:ids 4 8 15 16 23 42",
    "out": "(integer) 6"
   },
   {
    "cmd": "OBJECT ENCODING online:ids",
    "out": "\"intset\""
   },
   {
    "cmd": "ZADD leaderboard 3200 ann 2800 bob 4100 eve",
    "out": "(integer) 3"
   },
   {
    "cmd": "OBJECT ENCODING leaderboard",
    "out": "\"listpack\""
   },
   {
    "cmd": "XADD events * type signup user 1",
    "out": "\"1792300000000-0\""
   },
   {
    "cmd": "TYPE events",
    "out": "stream"
   },
   {
    "cmd": "OBJECT ENCODING events",
    "out": "\"stream\""
   }
  ]
 },
 "keyspace": {
  "htEmpty": "[Dictionary HT]\n[Expires HT]",
  "ht4": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 4\n number of elements: 4\n[Expires HT]",
  "ht5": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 4\n number of elements: 3\nHash table 1 stats (rehashing target):\n table size: 8\n number of elements: 2\n[Expires HT]",
  "ht5AfterAccess": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 8\n number of elements: 5\n[Expires HT]",
  "htFull": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 65536\n number of elements: 65536\n[Expires HT]",
  "htRehashing": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 65536\n number of elements: 65535\nHash table 1 stats (rehashing target):\n table size: 131072\n number of elements: 2\n[Expires HT]",
  "htRehashingLater": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 65536\n number of elements: 65140\nHash table 1 stats (rehashing target):\n table size: 131072\n number of elements: 397\n[Expires HT]",
  "htDone": "[Dictionary HT]\nHash table 0 stats (main hash table):\n table size: 65536\n number of elements: 38188\nHash table 1 stats (rehashing target):\n table size: 131072\n number of elements: 27349\n[Expires HT]",
  "scan": [
   {
    "cmd": "SCAN 0 MATCH user:* COUNT 5",
    "out": "1) \"4\"\n2) 1) \"user:8\"\n   2) \"user:13\"\n   3) \"user:20\"\n   4) \"user:5\"\n   5) \"user:16\""
   },
   {
    "cmd": "SCAN 4 MATCH user:* COUNT 5",
    "out": "1) \"10\"\n2) 1) \"user:14\"\n   2) \"user:4\"\n   3) \"user:18\"\n   4) \"user:17\"\n   5) \"user:12\""
   },
   {
    "cmd": "SCAN 10 MATCH user:* COUNT 5",
    "out": "1) \"5\"\n2) 1) \"user:10\"\n   2) \"user:1\"\n   3) \"user:9\"\n   4) \"user:6\"\n   5) \"user:7\""
   },
   {
    "cmd": "SCAN 5 MATCH user:* COUNT 5",
    "out": "1) \"15\"\n2) 1) \"user:11\"\n   2) \"user:3\"\n   3) \"user:2\"\n   4) \"user:19\"\n   5) \"user:15\""
   },
   {
    "cmd": "SCAN 15 MATCH user:* COUNT 5",
    "out": "1) \"0\"\n2) (empty array)"
   }
  ],
  "scanFilter": [
   {
    "cmd": "SCAN 0 MATCH user:1* COUNT 5",
    "out": "1) \"4\"\n2) 1) \"user:13\"\n   2) \"user:16\""
   },
   {
    "cmd": "SCAN 0 TYPE string COUNT 100",
    "out": "1) \"0\"\n2)  1) \"user:8\"\n    2) \"user:13\"\n    3) \"user:20\"\n    4) \"user:5\"\n    5) \"user:16\"\n    6) \"user:14\"\n    7) \"user:4\"\n    8) \"user:18\"\n    9) \"user:17\"\n   10) \"user:12\"\n   11) \"user:10\"\n   12) \"user:1\"\n   13) \"user:9\"\n   14) \"user:6\"\n   15) \"user:7\"\n   16) \"user:11\"\n   17) \"user:3\"\n   18) \"user:2\"\n   19) \"user:19\"\n   20) \"user:15\""
   }
  ],
  "cursorSequence": {
   "tableSize": 16,
   "cursors": [
    4,
    10,
    6,
    14,
    5,
    13,
    3,
    0
   ]
  }
 },
 "eviction": {
  "noeviction": {
   "acceptedBeforeError": 8244,
   "error": "OOM command not allowed when used memory > 'maxmemory'.",
   "transcript": [
    {
     "cmd": "GET k:1",
     "out": "\"vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv\""
    },
    {
     "cmd": "SET one:more value",
     "out": "(error) OOM command not allowed when used memory > 'maxmemory'."
    },
    {
     "cmd": "DEL k:1",
     "out": "(integer) 1"
    },
    {
     "cmd": "SET one:more value",
     "out": "(error) OOM command not allowed when used memory > 'maxmemory'."
    }
   ]
  },
  "volatileNoTtl": {
   "acceptedBeforeError": 8240,
   "error": "OOM command not allowed when used memory > 'maxmemory'."
  },
  "hotCold": [
   {
    "policy": "allkeys-random",
    "keysLeft": 125380,
    "hotSurvived": 538,
    "coldSurvived": 124842,
    "evicted": 75948,
    "writeErrors": 0
   },
   {
    "policy": "allkeys-lru",
    "keysLeft": 126250,
    "hotSurvived": 618,
    "coldSurvived": 125632,
    "evicted": 75076,
    "writeErrors": 0
   },
   {
    "policy": "allkeys-lfu",
    "keysLeft": 126099,
    "hotSurvived": 1000,
    "coldSurvived": 125099,
    "evicted": 75095,
    "writeErrors": 0
   },
   {
    "policy": "allkeys-lru",
    "maxmemory-samples": 1,
    "keysLeft": 125463,
    "hotSurvived": 587,
    "coldSurvived": 124876,
    "evicted": 75776,
    "writeErrors": 90
   },
   {
    "policy": "allkeys-lru",
    "maxmemory-samples": 10,
    "keysLeft": 125695,
    "hotSurvived": 933,
    "coldSurvived": 124762,
    "evicted": 75504,
    "writeErrors": 0
   }
  ],
  "lruPace": [
   {
    "policy": "allkeys-lru",
    "keysLeft": 126247,
    "hotSurvived": 602,
    "coldSurvived": 125645,
    "evicted": 75081,
    "writeErrors": 0
   },
   {
    "policy": "allkeys-lru",
    "keysLeft": 126251,
    "hotSurvived": 653,
    "coldSurvived": 125598,
    "evicted": 75074,
    "writeErrors": 0
   },
   {
    "policy": "allkeys-lru",
    "pauseMsPerBatch": 100,
    "keysLeft": 124628,
    "hotSurvived": 1000,
    "coldSurvived": 123628,
    "evicted": 76567,
    "writeErrors": 0
   }
  ],
  "lfu": {
   "logFactor": 10,
   "decayTime": 1,
   "points": [
    {
     "accesses": 1,
     "freq": 6
    },
    {
     "accesses": 10,
     "freq": 7
    },
    {
     "accesses": 100,
     "freq": 10
    },
    {
     "accesses": 1000,
     "freq": 19
    },
    {
     "accesses": 10000,
     "freq": 44
    },
    {
     "accesses": 100000,
     "freq": 157
    },
    {
     "accesses": 1000000,
     "freq": 255
    }
   ],
   "initial": 5
  },
  "idletime": 2
 },
 "expiry": {
  "rules": [
   {
    "cmd": "SET session:42 \"user=7\" EX 1800",
    "out": "OK"
   },
   {
    "cmd": "TTL session:42",
    "out": "(integer) 1800"
   },
   {
    "cmd": "GET session:42",
    "out": "\"user=7\""
   },
   {
    "cmd": "SET session:42 \"user=7;cart=3\"",
    "out": "OK"
   },
   {
    "cmd": "TTL session:42",
    "out": "(integer) -1"
   },
   {
    "cmd": "SET session:42 \"user=7\" EX 1800",
    "out": "OK"
   },
   {
    "cmd": "SET session:42 \"user=7;cart=3\" KEEPTTL",
    "out": "OK"
   },
   {
    "cmd": "TTL session:42",
    "out": "(integer) 1800"
   },
   {
    "cmd": "INCR views",
    "out": "(integer) 1"
   },
   {
    "cmd": "EXPIRE views 60",
    "out": "(integer) 1"
   },
   {
    "cmd": "INCR views",
    "out": "(integer) 2"
   },
   {
    "cmd": "TTL views",
    "out": "(integer) 60"
   },
   {
    "cmd": "RENAME views views:old",
    "out": "OK"
   },
   {
    "cmd": "TTL views:old",
    "out": "(integer) 60"
   },
   {
    "cmd": "PERSIST views:old",
    "out": "(integer) 1"
   },
   {
    "cmd": "TTL views:old",
    "out": "(integer) -1"
   },
   {
    "cmd": "TTL nosuchkey",
    "out": "(integer) -2"
   },
   {
    "cmd": "EXPIRE nosuchkey 60",
    "out": "(integer) 0"
   },
   {
    "cmd": "SET otp:7 381920 PX 300000",
    "out": "OK"
   },
   {
    "cmd": "PTTL otp:7",
    "out": "(integer) 300000"
   },
   {
    "cmd": "EXPIRE otp:7 600 GT",
    "out": "(integer) 1"
   },
   {
    "cmd": "EXPIRE otp:7 60 GT",
    "out": "(integer) 0"
   },
   {
    "cmd": "TTL otp:7",
    "out": "(integer) 600"
   },
   {
    "cmd": "SET temp 1 EX 1",
    "out": "OK"
   },
   {
    "note": "(1.1 seconds later)"
   },
   {
    "cmd": "GET temp",
    "out": "(nil)"
   },
   {
    "cmd": "EXISTS temp",
    "out": "(integer) 0"
   }
  ],
  "fieldTtl": [
   {
    "cmd": "HSET user:7 name Ann reset_token 9f3k2",
    "out": "(integer) 2"
   },
   {
    "cmd": "HEXPIRE user:7 900 FIELDS 1 reset_token",
    "out": "1) (integer) 1"
   },
   {
    "cmd": "HTTL user:7 FIELDS 2 name reset_token",
    "out": "1) (integer) -1\n2) (integer) 900"
   },
   {
    "cmd": "HGETALL user:7",
    "out": "1) \"reset_token\"\n2) \"9f3k2\"\n3) \"name\"\n4) \"Ann\""
   }
  ],
  "lazy": {
   "afterExpiry": {
    "dbsize": 10000,
    "expired": 0
   },
   "afterOneGet": {
    "dbsize": 9999,
    "expired": 1
   }
  },
  "active": [
   {
    "hz": 10,
    "samples": [
     {
      "ms": 0,
      "keys": 200000
     },
     {
      "ms": 51,
      "keys": 200000
     },
     {
      "ms": 101,
      "keys": 200000
     },
     {
      "ms": 152,
      "keys": 200000
     },
     {
      "ms": 202,
      "keys": 200000
     },
     {
      "ms": 253,
      "keys": 200000
     },
     {
      "ms": 303,
      "keys": 200000
     },
     {
      "ms": 354,
      "keys": 200000
     },
     {
      "ms": 404,
      "keys": 200000
     },
     {
      "ms": 454,
      "keys": 200000
     },
     {
      "ms": 505,
      "keys": 200000
     },
     {
      "ms": 556,
      "keys": 200000
     },
     {
      "ms": 606,
      "keys": 200000
     },
     {
      "ms": 656,
      "keys": 200000
     },
     {
      "ms": 707,
      "keys": 199885
     },
     {
      "ms": 758,
      "keys": 199885
     },
     {
      "ms": 808,
      "keys": 156361
     },
     {
      "ms": 858,
      "keys": 156361
     },
     {
      "ms": 909,
      "keys": 88351
     },
     {
      "ms": 967,
      "keys": 88351
     },
     {
      "ms": 1019,
      "keys": 57894
     },
     {
      "ms": 1085,
      "keys": 57894
     },
     {
      "ms": 1135,
      "keys": 2948
     },
     {
      "ms": 1208,
      "keys": 2948
     },
     {
      "ms": 1261,
      "keys": 362
     },
     {
      "ms": 1311,
      "keys": 362
     },
     {
      "ms": 1361,
      "keys": 32
     },
     {
      "ms": 1413,
      "keys": 32
     },
     {
      "ms": 1463,
      "keys": 2
     },
     {
      "ms": 1513,
      "keys": 2
     },
     {
      "ms": 1564,
      "keys": 0
     }
    ],
    "expiredKeys": 200000,
    "cycleCpuMs": 88
   },
   {
    "hz": 100,
    "samples": [
     {
      "ms": 0,
      "keys": 200000
     },
     {
      "ms": 50,
      "keys": 200000
     },
     {
      "ms": 100,
      "keys": 200000
     },
     {
      "ms": 152,
      "keys": 200000
     },
     {
      "ms": 203,
      "keys": 200000
     },
     {
      "ms": 253,
      "keys": 200000
     },
     {
      "ms": 304,
      "keys": 200000
     },
     {
      "ms": 355,
      "keys": 200000
     },
     {
      "ms": 405,
      "keys": 200000
     },
     {
      "ms": 456,
      "keys": 200000
     },
     {
      "ms": 506,
      "keys": 200000
     },
     {
      "ms": 557,
      "keys": 200000
     },
     {
      "ms": 607,
      "keys": 199992
     },
     {
      "ms": 659,
      "keys": 199803
     },
     {
      "ms": 710,
      "keys": 198796
     },
     {
      "ms": 760,
      "keys": 183792
     },
     {
      "ms": 814,
      "keys": 168718
     },
     {
      "ms": 866,
      "keys": 139568
     },
     {
      "ms": 917,
      "keys": 116384
     },
     {
      "ms": 968,
      "keys": 94966
     },
     {
      "ms": 1019,
      "keys": 67953
     },
     {
      "ms": 1070,
      "keys": 46004
     },
     {
      "ms": 1122,
      "keys": 25777
     },
     {
      "ms": 1177,
      "keys": 0
     }
    ],
    "expiredKeys": 200000,
    "cycleCpuMs": 120
   }
  ],
  "mixed": {
   "keys": 100000,
   "shortLived": 10000,
   "after3s": {
    "dbsize": 99921,
    "expired": 79,
    "expiredStalePerc": 6.67
   }
  },
  "activeExpireEffort": "1"
 },
 "locks": {
  "releaseScript": "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
  "happy": [
   {
    "who": "A",
    "cmd": "SET lock:order:42 token-a NX PX 10000",
    "out": "OK"
   },
   {
    "who": "B",
    "cmd": "SET lock:order:42 token-b NX PX 10000",
    "out": "(nil)"
   },
   {
    "who": "B",
    "cmd": "PTTL lock:order:42",
    "out": "(integer) 10000"
   },
   {
    "who": "A",
    "cmd": "EVAL \"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end\" 1 lock:order:42 token-a",
    "out": "(integer) 1"
   },
   {
    "who": "B",
    "cmd": "SET lock:order:42 token-b NX PX 10000",
    "out": "OK"
   }
  ],
  "naive": [
   {
    "who": "A",
    "cmd": "SET lock:report token-a NX PX 500",
    "out": "OK"
   },
   {
    "note": "A is paused (a long GC pause, a slow call) for 800 ms — its lock expires after 500 ms"
   },
   {
    "who": "B",
    "cmd": "SET lock:report token-b NX PX 5000",
    "out": "OK"
   },
   {
    "note": "A wakes up, finishes, and releases \"its\" lock with a plain DEL"
   },
   {
    "who": "A",
    "cmd": "DEL lock:report",
    "out": "(integer) 1"
   },
   {
    "who": "C",
    "cmd": "SET lock:report token-c NX PX 5000",
    "out": "OK"
   },
   {
    "note": "B and C now both believe they hold the lock"
   }
  ],
  "safe": [
   {
    "who": "A",
    "cmd": "SET lock:report token-a NX PX 500",
    "out": "OK"
   },
   {
    "note": "A is paused for 800 ms — its lock expires"
   },
   {
    "who": "B",
    "cmd": "SET lock:report token-b NX PX 5000",
    "out": "OK"
   },
   {
    "note": "A releases with the compare-and-delete script"
   },
   {
    "who": "A",
    "cmd": "EVAL \"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end\" 1 lock:report token-a",
    "out": "(integer) 0"
   },
   {
    "who": "C",
    "cmd": "SET lock:report token-c NX PX 5000",
    "out": "(nil)"
   },
   {
    "who": "B",
    "cmd": "GET lock:report",
    "out": "\"token-b\""
   }
  ],
  "fencedWriteScript": "local last = tonumber(redis.call('HGET', KEYS[1], 'token') or '0') if tonumber(ARGV[1]) <= last then return redis.error_reply('STALE token ' .. ARGV[1] .. ' <= ' .. last) end redis.call('HSET', KEYS[1], 'token', ARGV[1], 'body', ARGV[2]) return 'OK'",
  "fencing": [
   {
    "who": "A",
    "cmd": "INCR fence:report",
    "out": "(integer) 1"
   },
   {
    "note": "A pauses, its lock expires, B acquires the lock"
   },
   {
    "who": "B",
    "cmd": "INCR fence:report",
    "out": "(integer) 2"
   },
   {
    "who": "B",
    "cmd": "EVAL \"local last = tonumber(redis.call('HGET', KEYS[1], 'token') or '0') if tonumber(ARGV[1]) <= last then return redis.error_reply('STALE token ' .. ARGV[1] .. ' <= ' .. last) end redis.call('HSET', KEYS[1], 'token', ARGV[1], 'body', ARGV[2]) return 'OK'\" 1 report:2026-10 2 \"written by B\"",
    "out": "\"OK\""
   },
   {
    "note": "A wakes up and writes with its old token"
   },
   {
    "who": "A",
    "cmd": "EVAL \"local last = tonumber(redis.call('HGET', KEYS[1], 'token') or '0') if tonumber(ARGV[1]) <= last then return redis.error_reply('STALE token ' .. ARGV[1] .. ' <= ' .. last) end redis.call('HSET', KEYS[1], 'token', ARGV[1], 'body', ARGV[2]) return 'OK'\" 1 report:2026-10 1 \"written by A\"",
    "out": "(error) STALE token 1 <= 2"
   },
   {
    "who": "A",
    "cmd": "HGETALL report:2026-10",
    "out": "1) \"token\"\n2) \"2\"\n3) \"body\"\n4) \"written by B\""
   }
  ],
  "fixedWindow": [
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 1"
   },
   {
    "cmd": "EXPIRE rate:user:7:2026-10-18T10:41 60 NX",
    "out": "(integer) 1"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 2"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 3"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 4"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 5"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 6"
   },
   {
    "cmd": "INCR rate:user:7:2026-10-18T10:41",
    "out": "(integer) 7"
   }
  ],
  "slidingScript": "local now = tonumber(ARGV[1]) local window = tonumber(ARGV[2]) local limit = tonumber(ARGV[3]) redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window) if redis.call('ZCARD', KEYS[1]) >= limit then return 0 end redis.call('ZADD', KEYS[1], now, ARGV[4]) redis.call('PEXPIRE', KEYS[1], window) return 1",
  "sliding": [
   {
    "atMs": 1000,
    "request": "r1",
    "allowed": 1,
    "inWindow": 1
   },
   {
    "atMs": 1200,
    "request": "r2",
    "allowed": 1,
    "inWindow": 2
   },
   {
    "atMs": 1400,
    "request": "r3",
    "allowed": 1,
    "inWindow": 3
   },
   {
    "atMs": 1500,
    "request": "r4",
    "allowed": 0,
    "inWindow": 3
   },
   {
    "atMs": 2050,
    "request": "r5",
    "allowed": 1,
    "inWindow": 3
   },
   {
    "atMs": 2300,
    "request": "r6",
    "allowed": 1,
    "inWindow": 3
   },
   {
    "atMs": 2450,
    "request": "r7",
    "allowed": 1,
    "inWindow": 3
   }
  ],
  "bucketScript": "local cap = tonumber(ARGV[1]) local rate = tonumber(ARGV[2]) local now = tonumber(ARGV[3]) local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts') local tokens = tonumber(b[1] or cap) local ts = tonumber(b[2] or now) tokens = math.min(cap, tokens + (now - ts) * rate / 1000) local ok = 0 if tokens >= 1 then tokens = tokens - 1 ok = 1 end redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now) redis.call('PEXPIRE', KEYS[1], 60000) return {ok, tostring(tokens)}",
  "bucket": [
   {
    "atMs": 0,
    "allowed": 1,
    "tokensLeft": 2
   },
   {
    "atMs": 10,
    "allowed": 1,
    "tokensLeft": 1.02
   },
   {
    "atMs": 20,
    "allowed": 1,
    "tokensLeft": 0.04
   },
   {
    "atMs": 30,
    "allowed": 0,
    "tokensLeft": 0.06
   },
   {
    "atMs": 40,
    "allowed": 0,
    "tokensLeft": 0.08
   },
   {
    "atMs": 600,
    "allowed": 1,
    "tokensLeft": 0.2
   },
   {
    "atMs": 700,
    "allowed": 0,
    "tokensLeft": 0.4
   },
   {
    "atMs": 1700,
    "allowed": 1,
    "tokensLeft": 1.4
   },
   {
    "atMs": 1710,
    "allowed": 1,
    "tokensLeft": 0.42
   },
   {
    "atMs": 1720,
    "allowed": 0,
    "tokensLeft": 0.44
   },
   {
    "atMs": 1730,
    "allowed": 0,
    "tokensLeft": 0.46
   }
  ],
  "idempotency": [
   {
    "who": "A",
    "cmd": "SET idem:pay:7f3e processing NX EX 86400",
    "out": "OK"
   },
   {
    "who": "B",
    "cmd": "SET idem:pay:7f3e processing NX EX 86400",
    "out": "(nil)"
   },
   {
    "who": "B",
    "cmd": "GET idem:pay:7f3e",
    "out": "\"processing\""
   },
   {
    "who": "A",
    "cmd": "SET idem:pay:7f3e \"done:payment=88213\" XX KEEPTTL",
    "out": "OK"
   },
   {
    "who": "B",
    "cmd": "GET idem:pay:7f3e",
    "out": "\"done:payment=88213\""
   }
  ]
 },
 "transactions": {
  "basic": [
   {
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "cmd": "DECRBY stock:42 3",
    "out": "QUEUED"
   },
   {
    "cmd": "RPUSH orders:42 order-1001",
    "out": "QUEUED"
   },
   {
    "cmd": "EXEC",
    "out": "1) (integer) 7\n2) (integer) 1"
   },
   {
    "cmd": "GET stock:42",
    "out": "\"7\""
   }
  ],
  "runtimeError": [
   {
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "cmd": "INCR counter",
    "out": "QUEUED"
   },
   {
    "cmd": "INCR name",
    "out": "QUEUED"
   },
   {
    "cmd": "INCR counter",
    "out": "QUEUED"
   },
   {
    "cmd": "EXEC",
    "out": "1) (integer) 1\n2) (error) ERR value is not an integer or out of range\n3) (integer) 2"
   },
   {
    "cmd": "GET counter",
    "out": "\"2\""
   }
  ],
  "queueError": [
   {
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "cmd": "INCR counter",
    "out": "QUEUED"
   },
   {
    "cmd": "INCRR counter",
    "out": "(error) ERR unknown command 'INCRR', with args beginning with: 'counter'"
   },
   {
    "cmd": "INCR counter",
    "out": "QUEUED"
   },
   {
    "cmd": "EXEC",
    "out": "(error) EXECABORT Transaction discarded because of previous errors."
   },
   {
    "cmd": "GET counter",
    "out": "(nil)"
   }
  ],
  "discard": [
   {
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "cmd": "SET a 1",
    "out": "QUEUED"
   },
   {
    "cmd": "DISCARD",
    "out": "OK"
   },
   {
    "cmd": "GET a",
    "out": "(nil)"
   }
  ],
  "watch": [
   {
    "who": "A",
    "cmd": "WATCH balance:7",
    "out": "OK"
   },
   {
    "who": "A",
    "cmd": "GET balance:7",
    "out": "\"100\""
   },
   {
    "who": "B",
    "cmd": "INCRBY balance:7 50",
    "out": "(integer) 150"
   },
   {
    "who": "A",
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "who": "A",
    "cmd": "SET balance:7 70",
    "out": "QUEUED"
   },
   {
    "who": "A",
    "cmd": "EXEC",
    "out": "(nil)"
   },
   {
    "who": "A",
    "cmd": "GET balance:7",
    "out": "\"150\""
   },
   {
    "note": "A reads again and retries"
   },
   {
    "who": "A",
    "cmd": "WATCH balance:7",
    "out": "OK"
   },
   {
    "who": "A",
    "cmd": "GET balance:7",
    "out": "\"150\""
   },
   {
    "who": "A",
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "who": "A",
    "cmd": "SET balance:7 120",
    "out": "QUEUED"
   },
   {
    "who": "A",
    "cmd": "EXEC",
    "out": "1) OK"
   }
  ],
  "script": [
   {
    "cmd": "EVAL \"local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v\" 1 seats:show:9 3",
    "out": "(integer) 1"
   },
   {
    "cmd": "EVAL \"local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v\" 1 seats:show:9 3",
    "out": "(integer) 2"
   },
   {
    "cmd": "EVAL \"local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v\" 1 seats:show:9 3",
    "out": "(integer) 3"
   },
   {
    "cmd": "EVAL \"local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v\" 1 seats:show:9 3",
    "out": "(integer) 0"
   }
  ],
  "scriptSource": "local v = redis.call('INCR', KEYS[1]) if v > tonumber(ARGV[1]) then redis.call('DECR', KEYS[1]) return 0 end return v",
  "scriptError": [
   {
    "cmd": "EVAL \"redis.call('SET', KEYS[1], 'written'); redis.call('INCR', KEYS[2]); return 'done'\" 2 x name",
    "out": "(error) ERR value is not an integer or out of range script: c35801e964585618cba3127b6255cd8f65085743, on @user_script:1."
   },
   {
    "cmd": "GET x",
    "out": "\"written\""
   }
  ],
  "evalsha": [
   {
    "cmd": "EVALSHA 381e261551b2398f86a9db4e1a1c4aee06a3843c 1 seats:show:10 3",
    "out": "(integer) 1"
   },
   {
    "cmd": "SCRIPT FLUSH",
    "out": "OK"
   },
   {
    "cmd": "EVALSHA 381e261551b2398f86a9db4e1a1c4aee06a3843c 1 seats:show:10 3",
    "out": "(error) NOSCRIPT No matching script. Please use EVAL."
   }
  ],
  "functionSource": "#!lua name=inventory\nredis.register_function('reserve', function(keys, args) local left = tonumber(redis.call('GET', keys[1]) or '0') local want = tonumber(args[1]) if left < want then return redis.error_reply('NOT_ENOUGH stock left: ' .. left) end return redis.call('DECRBY', keys[1], want) end)",
  "functions": [
   {
    "cmd": "FCALL reserve 1 stock:42 2",
    "out": "(integer) 3"
   },
   {
    "cmd": "FCALL reserve 1 stock:42 4",
    "out": "(error) NOT_ENOUGH stock left: 3"
   },
   {
    "cmd": "FUNCTION LIST",
    "out": "1) 1) \"library_name\"\n   2) \"inventory\"\n   3) \"engine\"\n   4) \"LUA\"\n   5) \"functions\"\n   6) 1) 1) \"name\"\n         2) \"reserve\"\n         3) \"description\"\n         4) (nil)\n         5) \"flags\"\n         6) (empty array)"
   }
  ]
 },
 "persistence": {
  "rdb": {
   "keys": 1000000,
   "usedMemory": "105.77M",
   "lastBgsaveStatus": "ok",
   "lastBgsaveSec": 2,
   "cowBytes": 1359872,
   "forkUsec": 2462,
   "fileBytes": 36777607,
   "log": [
    "Background saving started by pid 200427",
    "DB saved on disk",
    "Fork CoW for RDB: current 1 MB, peak 1 MB, average 1 MB",
    "Background saving terminated with success"
   ],
   "saveDefault": null,
   "configDefaults": {
    "save": "3600 1 300 100 60 10000",
    "appendonly": "no",
    "appendfsync": "everysec",
    "aofUseRdbPreamble": "yes",
    "autoAofRewritePercentage": "100",
    "autoAofRewriteMinSize": "67108864"
   }
  },
  "aofFilesAtStart": "appendonlydir/\n  appendonly.aof.1.base.rdb  (88 bytes)\n  appendonly.aof.1.incr.aof  (0 bytes)\n  appendonly.aof.manifest  (102 bytes)",
  "aofManifest": "file appendonly.aof.1.base.rdb seq 1 type b\nfile appendonly.aof.1.incr.aof seq 1 type i startoffset 0",
  "aofIncr": "*2\n$6\nSELECT\n$1\n0\n*3\n$3\nSET\n$6\ncart:7\n$5\napple\n*2\n$4\nINCR\n$6\nvisits\n*2\n$4\nINCR\n$6\nvisits\n*3\n$9\nPEXPIREAT\n$6\ncart:7\n$13\n1792291913154\n*2\n$3\nDEL\n$6\ncart:7",
  "aofFilesAfterRewrite": "appendonlydir/\n  appendonly.aof.2.base.rdb  (103 bytes)\n  appendonly.aof.2.incr.aof  (0 bytes)\n  appendonly.aof.manifest  (102 bytes)",
  "aofManifestAfterRewrite": "file appendonly.aof.2.base.rdb seq 2 type b\nfile appendonly.aof.2.incr.aof seq 2 type i startoffset 5",
  "aofRewriteLog": [
   "Creating AOF incr file appendonly.aof.2.incr.aof on background rewrite",
   "Successfully created the temporary AOF base file temp-rewriteaof-bg-200455.aof",
   "Fork CoW for AOF rewrite: current 0 MB, peak 0 MB, average 0 MB",
   "Background AOF rewrite terminated with success",
   "Successfully renamed the temporary AOF base file temp-rewriteaof-bg-200455.aof into appendonly.aof.2.base.rdb",
   "Removing the history file appendonly.aof.1.incr.aof in the background",
   "Removing the history file appendonly.aof.1.base.rdb in the background",
   "Background AOF rewrite finished successfully"
  ],
  "aofTruncatedLog": [
   "Configuration loaded",
   "Reading RDB base file on AOF loading...",
   "RDB is base AOF",
   "Done loading RDB, keys loaded: 1, keys expired: 0.",
   "DB loaded from base file appendonly.aof.2.base.rdb: 0.000 seconds",
   "!!! Warning: short read while loading the AOF file appendonly.aof.2.incr.aof!!!",
   "!!! Truncating the AOF appendonly.aof.2.incr.aof at offset 23 !!!",
   "AOF appendonlydir/appendonly.aof.2.incr.aof loaded anyway because aof-load-truncated is enabled",
   "DB loaded from incr file appendonly.aof.2.incr.aof: 0.000 seconds",
   "DB loaded from append only file: 0.000 seconds",
   "Opening AOF incr file appendonly.aof.2.incr.aof on server start"
  ],
  "aofTruncatedResult": {
   "visits": "2",
   "last": null
  },
  "checkAof": [
   "Start checking Old-Style AOF",
   "AOF analyzed: filename=/data/aof/appendonlydir/appendonly.aof.2.incr.aof, size=23, ok_up_to=23, ok_up_to_line=6, diff=0",
   "AOF /data/aof/appendonlydir/appendonly.aof.2.incr.aof is valid"
  ],
  "crash": [
   {
    "label": "none",
    "args": "--save  --appendonly no",
    "acknowledged": 100000,
    "survived": 0
   },
   {
    "label": "rdb",
    "args": "--save  --appendonly no",
    "acknowledged": 100000,
    "survived": 50000
   },
   {
    "label": "aof-everysec",
    "args": "--appendonly yes --appendfsync everysec",
    "acknowledged": 100000,
    "survived": 100000
   },
   {
    "label": "aof-always",
    "args": "--appendonly yes --appendfsync always",
    "acknowledged": 100000,
    "survived": 100000
   }
  ],
  "fsyncBench": [
   {
    "label": "no persistence",
    "result": "SET: 101214.58 requests per second, p50=0.111 msec"
   },
   {
    "label": "appendfsync no",
    "result": "SET: 118203.30 requests per second, p50=0.095 msec"
   },
   {
    "label": "appendfsync everysec",
    "result": "SET: 119331.74 requests per second, p50=0.095 msec"
   },
   {
    "label": "appendfsync always",
    "result": "SET: 5012.03 requests per second, p50=1.863 msec"
   }
  ]
 },
 "replication": {
  "fullSyncMaster": [
   "Replica 127.0.0.1:6380 asks for synchronization",
   "Full resync requested by replica 127.0.0.1:6380 ",
   "Replication backlog created, my new replication IDs are '601a8f747a69824e6b2807df7f04f1cd8d5ca99c' and '0000000000000000000000000000000000000000'",
   "Replica 127.0.0.1:6380 is capable of rdb channel synchronization, and partial sync isn't possible. Full sync will continue with dedicated rdb channel.",
   "Replica 127.0.0.1:6380 asks for synchronization",
   "Full resync requested by replica 127.0.0.1:6380 (rdb-channel)",
   "Delay next BGSAVE for diskless SYNC",
   "Starting BGSAVE for SYNC with target: replicas sockets (rdb-channel)",
   "Starting to deliver RDB and replication stream to replica: 127.0.0.1:6380",
   "Background RDB transfer started by pid 200696 to replica socket",
   "BGSAVE done, 100000 keys saved, 0 keys skipped, 3477998 bytes written.",
   "Connection with replica (rdbchannel) 127.0.0.1:6380 lost.",
   "Synchronization with replica 127.0.0.1:6380 succeeded"
  ],
  "fullSyncReplica": [
   "Connecting to MASTER 127.0.0.1:6379",
   "MASTER <-> REPLICA sync started",
   "Non blocking connect for SYNC fired the event.",
   "Master replied to PING, replication can continue...",
   "Partial resynchronization not possible (no cached master)",
   "PSYNC is not possible, initialize RDB channel.",
   "Starting to receive RDB and replication stream in parallel.",
   "MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk",
   "MASTER <-> REPLICA sync: Loading DB in memory",
   "MASTER <-> REPLICA sync: Flushing old data",
   "MASTER <-> REPLICA sync: Finished with success",
   "MASTER <-> REPLICA sync: Starting to stream replication buffer into the db (0 bytes).",
   "MASTER <-> REPLICA sync: Successfully streamed replication buffer into the db (0 bytes in total)"
  ],
  "infoMaster": "role:master\nconnected_slaves:1\nslave0:ip=127.0.0.1,port=6380,state=online,offset=0,lag=0,io-thread=0\nmaster_replid:601a8f747a69824e6b2807df7f04f1cd8d5ca99c\nmaster_repl_offset:0\nrepl_backlog_active:1\nrepl_backlog_size:1048576\nrepl_backlog_first_byte_offset:1\nrepl_backlog_histlen:0",
  "infoReplica": "role:slave\nmaster_host:127.0.0.1\nmaster_port:6379\nmaster_link_status:up\nmaster_last_io_seconds_ago:0\nslave_repl_offset:0\nslave_read_only:1\nmaster_replid:601a8f747a69824e6b2807df7f04f1cd8d5ca99c\nmaster_repl_offset:0",
  "readOnly": [
   {
    "who": "primary",
    "cmd": "SET order:9001 paid",
    "out": "OK"
   },
   {
    "who": "primary",
    "cmd": "WAIT 1 1000",
    "out": "(integer) 1"
   },
   {
    "who": "replica",
    "cmd": "GET order:9001",
    "out": "\"paid\""
   },
   {
    "who": "replica",
    "cmd": "SET order:9002 paid",
    "out": "(error) READONLY You can't write against a read only replica."
   }
  ],
  "partialMaster": [
   "Connection with replica 127.0.0.1:6380 lost.",
   "Replica 127.0.0.1:6380 asks for synchronization",
   "Partial resynchronization request from 127.0.0.1:6380 accepted. Sending 156 bytes of backlog starting from offset 101."
  ],
  "partialReplica": [
   "Connection with master lost.",
   "Caching the disconnected master state.",
   "Reconnecting to MASTER 127.0.0.1:6379",
   "MASTER <-> REPLICA sync started",
   "Non blocking connect for SYNC fired the event.",
   "Master replied to PING, replication can continue...",
   "Trying a partial resynchronization (request 601a8f747a69824e6b2807df7f04f1cd8d5ca99c:101).",
   "Successful partial resynchronization with master.",
   "MASTER <-> REPLICA sync: Master accepted a Partial Resynchronization."
  ],
  "backlogTooSmall": {
   "backlogBytes": 16384,
   "writtenBytes": 200000,
   "master": [
    "Connection with replica 127.0.0.1:6380 lost.",
    "Replica 127.0.0.1:6380 asks for synchronization",
    "Unable to partial resync with replica 127.0.0.1:6380 for lack of backlog (Replica request was: 4181).",
    "Replica 127.0.0.1:6380 is capable of rdb channel synchronization, and partial sync isn't possible. Full sync will continue with dedicated rdb channel.",
    "Replica 127.0.0.1:6380 asks for synchronization",
    "Full resync requested by replica 127.0.0.1:6380 (rdb-channel)",
    "Delay next BGSAVE for diskless SYNC",
    "Starting BGSAVE for SYNC with target: replicas sockets (rdb-channel)",
    "Starting to deliver RDB and replication stream to replica: 127.0.0.1:6380",
    "Background RDB transfer started by pid 200723 to replica socket",
    "BGSAVE done, 102100 keys saved, 0 keys skipped, 3528565 bytes written.",
    "Connection with replica (rdbchannel) 127.0.0.1:6380 lost.",
    "Synchronization with replica 127.0.0.1:6380 succeeded"
   ]
  },
  "waitStopped": [
   {
    "who": "primary",
    "cmd": "SET order:9003 paid",
    "out": "OK"
   },
   {
    "who": "primary",
    "cmd": "WAIT 1 500",
    "out": "(integer) 0"
   }
  ],
  "sentinelBefore": "127.0.0.1:6379",
  "failoverMs": 2275,
  "sentinelAfter": "127.0.0.1:6380",
  "sentinelLog": [
   "+slave slave 127.0.0.1:6380 127.0.0.1 6380 @ shop 127.0.0.1 6379",
   "+sdown master shop 127.0.0.1 6379",
   "+odown master shop 127.0.0.1 6379 #quorum 2/2",
   "+new-epoch 1",
   "+try-failover master shop 127.0.0.1 6379",
   "+vote-for-leader <id> 1",
   "+switch-master shop 127.0.0.1 6379 127.0.0.1 6380",
   "+slave slave 127.0.0.1:6379 127.0.0.1 6379 @ shop 127.0.0.1 6380",
   "+sdown slave 127.0.0.1:6379 127.0.0.1 6379 @ shop 127.0.0.1 6380"
  ],
  "oldPrimaryRoleOnReturn": "master",
  "convertedAfterMs": 10642,
  "oldPrimaryRole": "role:slave\nmaster_host:127.0.0.1\nmaster_port:6380\nmaster_link_status:down",
  "sentinelLogAfterReturn": [
   "-sdown slave 127.0.0.1:6379 127.0.0.1 6379 @ shop 127.0.0.1 6380"
  ]
 },
 "cluster": {
  "create": ">>> Performing hash slots allocation on 6 nodes...\nMaster[0] -> Slots 0 - 5460\nMaster[1] -> Slots 5461 - 10922\nMaster[2] -> Slots 10923 - 16383\nAdding replica 127.0.0.1:7005 to 127.0.0.1:7001\nAdding replica 127.0.0.1:7006 to 127.0.0.1:7002\nAdding replica 127.0.0.1:7004 to 127.0.0.1:7003\n>>> Trying to optimize slaves allocation for anti-affinity\n[WARNING] Some slaves are in the same host as their master\nM: 572b54f1… 127.0.0.1:7001\n   slots:[0-5460] (5461 slots) master\nM: 141773b6… 127.0.0.1:7002\n   slots:[5461-10922] (5462 slots) master\nM: 747278a2… 127.0.0.1:7003\n   slots:[10923-16383] (5461 slots) master\nS: d09f78b2… 127.0.0.1:7004\n   replicates 572b54f1…\nS: dab10b40… 127.0.0.1:7005\n   replicates 141773b6…\nS: e0eece02… 127.0.0.1:7006\n   replicates 747278a2…\n>>> Nodes configuration updated\n>>> Assign a different config epoch to each node\n>>> Sending CLUSTER MEET messages to join the cluster\nWaiting for the cluster to join\n.\n>>> Performing Cluster Check (using node 127.0.0.1:7001)\nM: 572b54f1… 127.0.0.1:7001\n   slots:[0-5460] (5461 slots) master\n   1 additional replica(s)\nS: d09f78b2… 127.0.0.1:7004\n   slots: (0 slots) slave\n   replicates 572b54f1…\nS: e0eece02… 127.0.0.1:7006\n   slots: (0 slots) slave\n   replicates 747278a2…\nM: 141773b6… 127.0.0.1:7002\n   slots:[5461-10922] (5462 slots) master\n   1 additional replica(s)\nM: 747278a2… 127.0.0.1:7003\n   slots:[10923-16383] (5461 slots) master\n   1 additional replica(s)\nS: dab10b40… 127.0.0.1:7005\n   slots: (0 slots) slave\n   replicates 141773b6…\n[OK] All nodes agree about slots configuration.\n>>> Check for open slots...\n>>> Check slots coverage...\n[OK] All 16384 slots covered.",
  "info": "cluster_state:ok\ncluster_slots_assigned:16384\ncluster_slots_ok:16384\ncluster_known_nodes:6\ncluster_size:3",
  "nodes": [
   {
    "id": "572b54f1",
    "addr": "127.0.0.1:7001",
    "flags": "myself,master",
    "master": "-",
    "slots": "0-5460"
   },
   {
    "id": "141773b6",
    "addr": "127.0.0.1:7002",
    "flags": "master",
    "master": "-",
    "slots": "5461-10922"
   },
   {
    "id": "747278a2",
    "addr": "127.0.0.1:7003",
    "flags": "master",
    "master": "-",
    "slots": "10923-16383"
   },
   {
    "id": "d09f78b2",
    "addr": "127.0.0.1:7004",
    "flags": "slave",
    "master": "572b54f1",
    "slots": ""
   },
   {
    "id": "dab10b40",
    "addr": "127.0.0.1:7005",
    "flags": "slave",
    "master": "141773b6",
    "slots": ""
   },
   {
    "id": "e0eece02",
    "addr": "127.0.0.1:7006",
    "flags": "slave",
    "master": "747278a2",
    "slots": ""
   }
  ],
  "slots": [
   {
    "key": "user:1",
    "slot": 10778
   },
   {
    "key": "user:2",
    "slot": 6777
   },
   {
    "key": "user:1000",
    "slot": 1649
   },
   {
    "key": "order:42",
    "slot": 8691
   },
   {
    "key": "cart:7",
    "slot": 9546
   },
   {
    "key": "session:3f2a",
    "slot": 14184
   },
   {
    "key": "a",
    "slot": 15495
   },
   {
    "key": "b",
    "slot": 3300
   },
   {
    "key": "foo",
    "slot": 12182
   },
   {
    "key": "bar",
    "slot": 5061
   },
   {
    "key": "hello",
    "slot": 866
   },
   {
    "key": "Hello",
    "slot": 3030
   },
   {
    "key": "",
    "slot": 0
   },
   {
    "key": "{user:1}:profile",
    "slot": 10778
   },
   {
    "key": "{user:1}:cart",
    "slot": 10778
   },
   {
    "key": "{user:1}.following",
    "slot": 10778
   },
   {
    "key": "user:{1}:x",
    "slot": 9842
   },
   {
    "key": "foo{}{bar}",
    "slot": 8363
   },
   {
    "key": "foo{{bar}}zap",
    "slot": 4015
   },
   {
    "key": "foo{bar}{zap}",
    "slot": 5061
   },
   {
    "key": "{}",
    "slot": 15257
   },
   {
    "key": "{a",
    "slot": 10276
   },
   {
    "key": "a}",
    "slot": 5921
   },
   {
    "key": "{}{user:1}",
    "slot": 3992
   },
   {
    "key": "product:12345",
    "slot": 375
   },
   {
    "key": "leaderboard:2026",
    "slot": 14822
   },
   {
    "key": "rate:user:7:10:41",
    "slot": 1374
   },
   {
    "key": "名字",
    "slot": 6576
   },
   {
    "key": "emoji:😀",
    "slot": 11626
   }
  ],
  "moved": [
   {
    "cmd": "CLUSTER KEYSLOT user:1",
    "out": "(integer) 10778"
   },
   {
    "cmd": "SET user:1 hello",
    "out": "(error) MOVED 10778 127.0.0.1:7002"
   }
  ],
  "followed": "OK",
  "followedCmd": "redis-cli -c -p 7001 SET user:1 hello",
  "multiKey": [
   {
    "cmd": "MSET user:1:profile Ann user:1:cart apple",
    "out": "(error) CROSSSLOT Keys in request don't hash to the same slot"
   },
   {
    "cmd": "CLUSTER KEYSLOT {user:1}:profile",
    "out": "(integer) 10778"
   },
   {
    "cmd": "CLUSTER KEYSLOT {user:1}:cart",
    "out": "(integer) 10778"
   },
   {
    "cmd": "MSET {user:1}:profile Ann {user:1}:cart apple",
    "out": "OK"
   },
   {
    "cmd": "MULTI",
    "out": "OK"
   },
   {
    "cmd": "INCR {user:1}:visits",
    "out": "QUEUED"
   },
   {
    "cmd": "EXPIRE {user:1}:cart 3600",
    "out": "QUEUED"
   },
   {
    "cmd": "EXEC",
    "out": "1) (integer) 1\n2) (integer) 1"
   }
  ],
  "ask": {
   "slot": 9546,
   "src": "127.0.0.1:7002",
   "dst": "127.0.0.1:7001",
   "steps": [
    {
     "who": "target",
     "cmd": "CLUSTER SETSLOT 9546 IMPORTING 141773b6…",
     "out": "OK"
    },
    {
     "who": "source",
     "cmd": "CLUSTER SETSLOT 9546 MIGRATING 572b54f1…",
     "out": "OK"
    },
    {
     "who": "source",
     "cmd": "CLUSTER COUNTKEYSINSLOT 9546",
     "out": "(integer) 3"
    },
    {
     "who": "source",
     "cmd": "MIGRATE 127.0.0.1 7001 \"\" 0 5000 KEYS {cart:7}:note",
     "out": "OK"
    },
    {
     "who": "source",
     "cmd": "GET cart:7",
     "out": "\"apple\""
    },
    {
     "who": "source",
     "cmd": "GET {cart:7}:note",
     "out": "(error) ASK 9546 127.0.0.1:7001"
    },
    {
     "who": "target",
     "cmd": "GET {cart:7}:note",
     "out": "(error) MOVED 9546 127.0.0.1:7002"
    },
    {
     "who": "target",
     "cmd": "ASKING",
     "out": "OK"
    },
    {
     "who": "target",
     "cmd": "GET {cart:7}:note",
     "out": "\"moved first\""
    },
    {
     "who": "source",
     "cmd": "GET cart:7",
     "out": "(error) MOVED 9546 127.0.0.1:7001"
    }
   ]
  },
  "disklessSyncDelay": "5",
  "failover": {
   "nodeTimeoutMs": 2000,
   "probeKey": "user:2",
   "victim": "127.0.0.1:7002",
   "timeline": [
    {
     "ms": 3,
     "state": "ok",
     "victimFlags": "master",
     "reply": "MOVED 6777"
    },
    {
     "ms": 2503,
     "state": "ok",
     "victimFlags": "master,fail?",
     "reply": "MOVED 6777"
    },
    {
     "ms": 2605,
     "state": "fail",
     "victimFlags": "master,fail",
     "reply": "CLUSTERDOWN The"
    },
    {
     "ms": 3321,
     "state": "ok",
     "victimFlags": "master,fail",
     "reply": "MOVED 6777"
    }
   ]
  },
  "failoverReplicaLog": [
   "7004: configEpoch set to 4 via CLUSTER SET-CONFIG-EPOCH",
   "7004: Cluster state changed: ok",
   "7004: Before turning into a replica, using my own master parameters to synthesize a cached master: I may be able to synchronize with the new master with just a partial transfer.",
   "7004: Connecting to MASTER 127.0.0.1:7001",
   "7004: MASTER <-> REPLICA sync started",
   "7004: Master replied to PING, replication can continue...",
   "7004: Node dab10b40353f9a5035678557963f51dca4bd1935 () is no longer master of shard f6bacf29dda5eaf5c72fa96eb1ada7fabd98efba; removed all 0 slot(s) it used to own",
   "7004: Node e0eece0266638d709ce5b27044525b9784031fa4 () is no longer master of shard 38bd48c932a58c2ffac6b14d65465c5083690341; removed all 0 slot(s) it used to own",
   "7004: MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk",
   "7004: Discarding previously cached master state.",
   "7004: MASTER <-> REPLICA sync: Loading DB in memory",
   "7004: MASTER <-> REPLICA sync: Flushing old data",
   "7004: MASTER <-> REPLICA sync: Finished with success",
   "7004: MASTER <-> REPLICA sync: Starting to stream replication buffer into the db (0 bytes).",
   "7004: MASTER <-> REPLICA sync: Successfully streamed replication buffer into the db (0 bytes in total)",
   "7004: FAIL message received from 747278a2027fc8190889c6abc995ce68407db0df () about 141773b6dce9aab31c9c9bc9164b3a53d6bc58ca ()",
   "7004: Cluster state changed: fail",
   "7004: Cluster state changed: ok",
   "7005: configEpoch set to 5 via CLUSTER SET-CONFIG-EPOCH",
   "7005: Cluster state changed: ok",
   "7005: Before turning into a replica, using my own master parameters to synthesize a cached master: I may be able to synchronize with the new master with just a partial transfer.",
   "7005: Connecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Node d09f78b2dcf0efb4050bdfda8661a0215627253f () is no longer master of shard 60565be8f5554481d0a031d31303c9e956eace88; removed all 0 slot(s) it used to own",
   "7005: Node e0eece0266638d709ce5b27044525b9784031fa4 () is no longer master of shard 38bd48c932a58c2ffac6b14d65465c5083690341; removed all 0 slot(s) it used to own",
   "7005: Master replied to PING, replication can continue...",
   "7005: MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk",
   "7005: Discarding previously cached master state.",
   "7005: MASTER <-> REPLICA sync: Loading DB in memory",
   "7005: MASTER <-> REPLICA sync: Flushing old data",
   "7005: MASTER <-> REPLICA sync: Finished with success",
   "7005: MASTER <-> REPLICA sync: Starting to stream replication buffer into the db (0 bytes).",
   "7005: MASTER <-> REPLICA sync: Successfully streamed replication buffer into the db (0 bytes in total)",
   "7005: Connection with master lost.",
   "7005: Caching the disconnected master state.",
   "7005: Reconnecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Connecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Connecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Connecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Cluster state changed: fail",
   "7005: Start of election delayed for 517 milliseconds (rank #0, offset 474).",
   "7005: Connecting to MASTER 127.0.0.1:7002",
   "7005: MASTER <-> REPLICA sync started",
   "7005: Starting a failover election for epoch 8.",
   "7005: Failover election won: I'm the new master.",
   "7005: configEpoch set to 8 after successful failover",
   "7005: Discarding previously cached master state.",
   "7005: Setting secondary replication ID to 780a6d09a1d2837717b0f4c9c36851969925eb1e, valid up to offset: 475. New replication ID is 2bdeb72b6a354394d8ffd797b9707acb470d1b26",
   "7005: Cluster state changed: ok",
   "7006: configEpoch set to 6 via CLUSTER SET-CONFIG-EPOCH",
   "7006: Cluster state changed: ok",
   "7006: Node d09f78b2dcf0efb4050bdfda8661a0215627253f () is no longer master of shard 60565be8f5554481d0a031d31303c9e956eace88; removed all 0 slot(s) it used to own",
   "7006: Before turning into a replica, using my own master parameters to synthesize a cached master: I may be able to synchronize with the new master with just a partial transfer.",
   "7006: Connecting to MASTER 127.0.0.1:7003",
   "7006: MASTER <-> REPLICA sync started",
   "7006: Node dab10b40353f9a5035678557963f51dca4bd1935 () is no longer master of shard f6bacf29dda5eaf5c72fa96eb1ada7fabd98efba; removed all 0 slot(s) it used to own",
   "7006: Master replied to PING, replication can continue...",
   "7006: MASTER <-> REPLICA sync: receiving streamed RDB from master with EOF to disk",
   "7006: Discarding previously cached master state.",
   "7006: MASTER <-> REPLICA sync: Loading DB in memory",
   "7006: MASTER <-> REPLICA sync: Flushing old data",
   "7006: MASTER <-> REPLICA sync: Finished with success",
   "7006: MASTER <-> REPLICA sync: Starting to stream replication buffer into the db (0 bytes).",
   "7006: MASTER <-> REPLICA sync: Successfully streamed replication buffer into the db (0 bytes in total)",
   "7006: FAIL message received from dab10b40353f9a5035678557963f51dca4bd1935 () about 141773b6dce9aab31c9c9bc9164b3a53d6bc58ca ()",
   "7006: Cluster state changed: fail",
   "7006: Cluster state changed: ok"
  ],
  "afterFailover": [
   {
    "addr": "127.0.0.1:7001",
    "flags": "myself,master",
    "slots": "0-5460 9546"
   },
   {
    "addr": "127.0.0.1:7002",
    "flags": "master,fail",
    "slots": ""
   },
   {
    "addr": "127.0.0.1:7003",
    "flags": "master",
    "slots": "10923-16383"
   },
   {
    "addr": "127.0.0.1:7004",
    "flags": "slave",
    "slots": ""
   },
   {
    "addr": "127.0.0.1:7005",
    "flags": "master",
    "slots": "5461-9545 9547-10922"
   },
   {
    "addr": "127.0.0.1:7006",
    "flags": "slave",
    "slots": ""
   }
  ]
 },
 "messaging": {
  "pubsub": [
   {
    "who": "sub-1",
    "cmd": "SUBSCRIBE orders",
    "out": "1) \"subscribe\"\n2) \"orders\"\n3) (integer) 1"
   },
   {
    "who": "sub-2",
    "cmd": "PSUBSCRIBE orders*",
    "out": "1) \"psubscribe\"\n2) \"orders*\"\n3) (integer) 1"
   },
   {
    "who": "publisher",
    "cmd": "PUBLISH orders \"order 1001 paid\"",
    "out": "(integer) 2"
   },
   {
    "who": "sub-1",
    "cmd": "(message arrives)",
    "out": "1) \"message\"\n2) \"orders\"\n3) \"order 1001 paid\""
   },
   {
    "who": "sub-2",
    "cmd": "(message arrives)",
    "out": "1) \"pmessage\"\n2) \"orders*\"\n3) \"orders\"\n4) \"order 1001 paid\""
   },
   {
    "note": "sub-1 disconnects (a deploy, a network blip)"
   },
   {
    "who": "publisher",
    "cmd": "PUBLISH orders \"order 1002 paid\"",
    "out": "(integer) 1"
   },
   {
    "who": "sub-2",
    "cmd": "(message arrives)",
    "out": "1) \"pmessage\"\n2) \"orders*\"\n3) \"orders\"\n4) \"order 1002 paid\""
   },
   {
    "note": "sub-2 disconnects too"
   },
   {
    "who": "publisher",
    "cmd": "PUBLISH orders \"order 1003 paid\"",
    "out": "(integer) 0"
   },
   {
    "note": "order 1003 reached nobody, and nothing kept it"
   },
   {
    "who": "publisher",
    "cmd": "PUBSUB NUMSUB orders",
    "out": "1) \"orders\"\n2) (integer) 0"
   }
  ],
  "outputBufferDefault": "normal 0 0 0 slave 268435456 67108864 60 pubsub 33554432 8388608 60",
  "slowSubscriber": {
   "publishedBytes": 100000000,
   "disconnections": 1,
   "limit": "pubsub 256kb 64kb 60",
   "subscribersAtEnd": 0,
   "log": [
    "Client id=… addr=… fd=… … sub=1 … omem=286864 … scheduled to be closed ASAP for overcoming of output buffer limits."
   ]
  },
  "listQueue": [
   {
    "who": "producer",
    "cmd": "LPUSH jobs:email job-1 job-2",
    "out": "(integer) 2"
   },
   {
    "who": "worker",
    "cmd": "BLMOVE jobs:email jobs:email:processing RIGHT LEFT 5",
    "out": "\"job-1\""
   },
   {
    "who": "worker",
    "cmd": "LRANGE jobs:email:processing 0 -1",
    "out": "1) \"job-1\""
   },
   {
    "note": "the worker sends the email, then removes the job from its processing list"
   },
   {
    "who": "worker",
    "cmd": "LREM jobs:email:processing 1 job-1",
    "out": "(integer) 1"
   },
   {
    "who": "worker",
    "cmd": "BLMOVE jobs:email jobs:email:processing RIGHT LEFT 5",
    "out": "\"job-2\""
   },
   {
    "note": "the worker crashes here; job-2 is still in jobs:email:processing, where a reaper can find it"
   },
   {
    "who": "producer",
    "cmd": "LRANGE jobs:email:processing 0 -1",
    "out": "1) \"job-2\""
   },
   {
    "who": "worker",
    "cmd": "BLPOP jobs:sms 5",
    "out": "(blocked, waiting…)"
   },
   {
    "who": "producer",
    "cmd": "RPUSH jobs:sms sms-1",
    "out": "(integer) 1"
   },
   {
    "who": "worker",
    "cmd": "(BLPOP returns)",
    "out": "1) \"jobs:sms\"\n2) \"sms-1\""
   }
  ],
  "streams": [
   {
    "who": "producer",
    "cmd": "XADD orders * order 1001 status paid",
    "out": "\"1792300000000-0\""
   },
   {
    "who": "producer",
    "cmd": "XADD orders * order 1002 status paid",
    "out": "\"1792300000007-0\""
   },
   {
    "who": "producer",
    "cmd": "XADD orders * order 1003 status paid",
    "out": "\"1792300000014-0\""
   },
   {
    "who": "producer",
    "cmd": "XADD orders * order 1004 status paid",
    "out": "\"1792300000021-0\""
   },
   {
    "who": "producer",
    "cmd": "XLEN orders",
    "out": "(integer) 4"
   },
   {
    "who": "admin",
    "cmd": "XGROUP CREATE orders billing 0",
    "out": "OK"
   },
   {
    "who": "worker-1",
    "cmd": "XREADGROUP GROUP billing worker-1 COUNT 2 STREAMS orders >",
    "out": "1) 1) \"orders\"\n   2) 1) 1) \"1792300000000-0\"\n         2) 1) \"order\"\n            2) \"1001\"\n            3) \"status\"\n            4) \"paid\"\n      2) 1) \"1792300000007-0\"\n         2) 1) \"order\"\n            2) \"1002\"\n            3) \"status\"\n            4) \"paid\""
   },
   {
    "who": "worker-2",
    "cmd": "XREADGROUP GROUP billing worker-2 COUNT 2 STREAMS orders >",
    "out": "1) 1) \"orders\"\n   2) 1) 1) \"1792300000014-0\"\n         2) 1) \"order\"\n            2) \"1003\"\n            3) \"status\"\n            4) \"paid\"\n      2) 1) \"1792300000021-0\"\n         2) 1) \"order\"\n            2) \"1004\"\n            3) \"status\"\n            4) \"paid\""
   },
   {
    "who": "worker-1",
    "cmd": "XACK orders billing 1792300000000-0 1792300000007-0",
    "out": "(integer) 2"
   },
   {
    "note": "worker-2 crashes before acknowledging its two orders"
   },
   {
    "who": "admin",
    "cmd": "XPENDING orders billing",
    "out": "1) (integer) 2\n2) \"1792300000014-0\"\n3) \"1792300000021-0\"\n4) 1) 1) \"worker-2\"\n      2) \"2\""
   },
   {
    "who": "admin",
    "cmd": "XPENDING orders billing - + 10",
    "out": "1) 1) \"1792300000014-0\"\n   2) \"worker-2\"\n   3) (integer) 1\n   4) (integer) 1\n2) 1) \"1792300000021-0\"\n   2) \"worker-2\"\n   3) (integer) 1\n   4) (integer) 1"
   },
   {
    "note": "(1.1 seconds later) worker-1 claims entries idle for more than 1000 ms"
   },
   {
    "who": "worker-1",
    "cmd": "XAUTOCLAIM orders billing worker-1 1000 0-0 COUNT 10",
    "out": "1) \"0-0\"\n2) 1) 1) \"1792300000014-0\"\n      2) 1) \"order\"\n         2) \"1003\"\n         3) \"status\"\n         4) \"paid\"\n   2) 1) \"1792300000021-0\"\n      2) 1) \"order\"\n         2) \"1004\"\n         3) \"status\"\n         4) \"paid\"\n3) (empty array)"
   },
   {
    "who": "worker-1",
    "cmd": "XACK orders billing 1792300000014-0 1792300000021-0",
    "out": "(integer) 2"
   },
   {
    "who": "admin",
    "cmd": "XINFO GROUPS orders",
    "out": "1)  1) \"name\"\n    2) \"billing\"\n    3) \"consumers\"\n    4) (integer) 2\n    5) \"pending\"\n    6) (integer) 0\n    7) \"last-delivered-id\"\n    8) \"1792300000021-0\"\n    9) \"entries-read\"\n   10) (integer) 4\n   11) \"lag\"\n   12) (integer) 0"
   },
   {
    "who": "admin",
    "cmd": "XGROUP CREATE orders analytics 0",
    "out": "OK"
   },
   {
    "who": "admin",
    "cmd": "XREADGROUP GROUP analytics a-1 COUNT 10 STREAMS orders >",
    "out": "1) 1) \"orders\"\n   2) 1) 1) \"1792300000000-0\"\n         2) 1) \"order\"\n            2) \"1001\"\n            3) \"status\"\n            4) \"paid\"\n      2) 1) \"1792300000007-0\"\n         2) 1) \"order\"\n            2) \"1002\"\n            3) \"status\"\n            4) \"paid\"\n      3) 1) \"1792300000014-0\"\n         2) 1) \"order\"\n            2) \"1003\"\n            3) \"status\"\n            4) \"paid\"\n      4) 1) \"1792300000021-0\"\n         2) 1) \"order\"\n            2) \"1004\"\n            3) \"status\"\n            4) \"paid\""
   }
  ],
  "streamsBlocking": [
   {
    "who": "worker-2",
    "cmd": "XREADGROUP GROUP billing worker-2 BLOCK 5000 STREAMS orders >",
    "out": "(blocked, waiting…)"
   },
   {
    "who": "producer",
    "cmd": "XADD orders * order 1005 status paid",
    "out": "\"1792300000028-0\""
   },
   {
    "who": "worker-2",
    "cmd": "(XREADGROUP returns)",
    "out": "1) 1) \"orders\"\n   2) 1) 1) \"1792300000028-0\"\n         2) 1) \"order\"\n            2) \"1005\"\n            3) \"status\"\n            4) \"paid\""
   }
  ],
  "streamTrim": [
   {
    "cmd": "XLEN events",
    "out": "(integer) 2000"
   },
   {
    "cmd": "XTRIM events MAXLEN ~ 1000",
    "out": "(integer) 1000"
   },
   {
    "cmd": "XLEN events",
    "out": "(integer) 1000"
   },
   {
    "cmd": "XTRIM events MAXLEN 1000",
    "out": "(integer) 0"
   },
   {
    "cmd": "XLEN events",
    "out": "(integer) 1000"
   }
  ]
 },
 "operations": {
  "infoMemory": "used_memory_human:49.34M\nused_memory_rss_human:65.56M\nused_memory_peak_human:49.34M\nused_memory_dataset_perc:83.16%\nmem_fragmentation_ratio:1.33\nmaxmemory_human:512.00M\nmaxmemory_policy:allkeys-lru\nmem_allocator:jemalloc-5.3.1",
  "infoStats": "total_connections_received:2\ntotal_commands_processed:11003\ninstantaneous_ops_per_sec:4616\nkeyspace_hits:5000\nkeyspace_misses:2000\nexpired_keys:0\nevicted_keys:0\nrejected_connections:0",
  "infoClients": "connected_clients:1\nblocked_clients:0\nmaxclients:10000",
  "infoKeyspace": "db0:keys=200002,expires=0,avg_ttl=0,subexpiry=0",
  "infoSections": [
   "Server",
   "Clients",
   "Memory",
   "Persistence",
   "Threads",
   "Stats",
   "Replication",
   "CPU",
   "Hotkeys",
   "Modules",
   "Commandstats",
   "Errorstats",
   "Latencystats",
   "Cluster",
   "Keyspace",
   "Keysizes"
  ],
  "slowlog": [
   {
    "cmd": "SLOWLOG GET 3",
    "out": "1) 1) (integer) 1\n   2) (integer) 1792288298\n   3) (integer) 11247\n   4) 1) \"HGETALL\"\n      2) \"cache:catalog\"\n   5) \"10.0.4.12:51734\"\n   6) \"\""
   },
   {
    "cmd": "SLOWLOG LEN",
    "out": "(integer) 1"
   }
  ],
  "latency": [
   {
    "cmd": "LATENCY LATEST",
    "out": "1) 1) \"command\"\n   2) (integer) 1792288305\n   3) (integer) 135\n   4) (integer) 135"
   }
  ],
  "latencyDoctor": "Dave, I have observed latency spikes in this Redis instance. You don't mind talking about it, do you Dave?\n\n1. command: 1 latency spikes (average 135ms, mean deviation 0ms, period 1.00 sec). Worst all time event 135ms.\n\nI have a few advices for you:\n\n- Check your Slow Log to understand what are the commands you are running which are too slow to execute. Please check https://redis.io/commands/slowlog for more information.\n- Deleting, expiring or evicting (because of maxmemory policy) large objects is a blocking operation. If you have very large objects that are often deleted, expired, or evicted, try to fragment those objects into multiple smaller objects.",
  "memoryDoctor": "Sam, I detected a few issues in this Redis instance memory implants:\n\n * High total RSS: This instance has a memory fragmentation and RSS overhead greater than 1.4 (this means that the Resident Set Size of the Redis process is much larger than the sum of the logical allocations Redis performed). This problem is usually due either to a large peak memory (check if there is a peak memory entry above in the report) or may result from a workload that causes the allocator to fragment memory a lot. If the problem is a large peak memory, then there is no issue. Otherwise, make sure you are using the Jemalloc allocator and not the default libc malloc. Note: The currently used allocator is \"jemalloc-5.3.1\".\n\n * High allocator RSS overhead: This instance has an RSS memory overhead is greater than 1.1 (this means that the Resident Set Size of the allocator is much larger than the sum what the allocator actually holds). This problem is usually due to a large peak memory (check if there is a peak memory entry above in the report), you can try the MEMORY PURGE command to reclaim it.\n\nI'm here to keep you safe, Sam. I want to help you.",
  "memoryUsage": [
   {
    "cmd": "MEMORY USAGE session:1",
    "out": "(integer) 160"
   },
   {
    "cmd": "MEMORY USAGE queue:emails",
    "out": "(integer) 4116525"
   },
   {
    "cmd": "MEMORY USAGE cache:catalog",
    "out": "(integer) 11861842"
   }
  ],
  "bigkeys": "# average sizes per key type.  You can use -i 0.1 to sleep 0.1 sec\n# per 100 SCAN commands (not usually needed).\n[00.00%] Biggest string found so far \"session:189146\" with 120 bytes\n[05.08%] Biggest list   found so far \"queue:emails\" with 300000 items\n[37.84%] Biggest hash   found so far \"cache:catalog\" with 100000 fields\nSampled 200002 keys in the keyspace!\nTotal key length in bytes is 2688915 (avg len 13.44)\nBiggest   list found \"queue:emails\" has 300000 items\nBiggest   hash found \"cache:catalog\" has 100000 fields\nBiggest string found \"session:189146\" has 120 bytes\n1 lists with 300000 items (00.00% of keys, avg size 300000.00)\n1 hashs with 100000 fields (00.00% of keys, avg size 100000.00)\n0 streams with 0 entries (00.00% of keys, avg size 0.00)\n200000 strings with 24000000 bytes (100.00% of keys, avg size 120.00)\n0 sets with 0 members (00.00% of keys, avg size 0.00)\n0 zsets with 0 members (00.00% of keys, avg size 0.00)",
  "memkeys": "[00.00%] Biggest string found so far \"session:189146\" with 176 bytes\n[05.08%] Biggest list   found so far \"queue:emails\" with 4116525 bytes\n[37.84%] Biggest hash   found so far \"cache:catalog\" with 11861842 bytes\nSampled 200002 keys in the keyspace!\nBiggest   list found \"queue:emails\" has 4116525 bytes\nBiggest   hash found \"cache:catalog\" has 11861842 bytes\nBiggest string found \"session:189146\" has 176 bytes",
  "clientList": [
   {
    "id": "5",
    "addr": "10.0.4.12:51730",
    "name": "",
    "age": "10",
    "idle": "0",
    "flags": "N",
    "db": "0",
    "cmd": "client|list",
    "omem": "0",
    "tot-mem": "23834"
   },
   {
    "id": "8",
    "addr": "10.0.4.13:51731",
    "name": "checkout-api",
    "age": "0",
    "idle": "0",
    "flags": "N",
    "db": "0",
    "cmd": "client|setname",
    "omem": "0",
    "tot-mem": "17664"
   },
   {
    "id": "9",
    "addr": "10.0.4.14:51732",
    "name": "",
    "age": "0",
    "idle": "0",
    "flags": "b",
    "db": "0",
    "cmd": "blpop",
    "omem": "0",
    "tot-mem": "17703"
   }
  ],
  "acl": [
   {
    "who": "admin",
    "cmd": "ACL SETUSER checkout on >s3cret-Pa55 ~checkout:* ~session:* +@read +@write +@string +@hash -@dangerous",
    "out": "OK"
   },
   {
    "who": "app",
    "cmd": "AUTH checkout wrong-password",
    "out": "(error) WRONGPASS invalid username-password pair or user is disabled."
   },
   {
    "who": "app",
    "cmd": "AUTH checkout s3cret-Pa55",
    "out": "OK"
   },
   {
    "who": "app",
    "cmd": "ACL WHOAMI",
    "out": "(error) NOPERM User checkout has no permissions to run the 'acl|whoami' command"
   },
   {
    "who": "app",
    "cmd": "SET checkout:cart:7 apple",
    "out": "OK"
   },
   {
    "who": "app",
    "cmd": "GET billing:invoice:1",
    "out": "(error) NOPERM No permissions to access a key"
   },
   {
    "who": "app",
    "cmd": "FLUSHALL",
    "out": "(error) NOPERM User checkout has no permissions to run the 'flushall' command"
   },
   {
    "who": "app",
    "cmd": "KEYS *",
    "out": "(error) NOPERM User checkout has no permissions to run the 'keys' command"
   },
   {
    "who": "admin",
    "cmd": "ACL LIST",
    "out": "1) \"user checkout on sanitize-payload #82d44b8514cf1bf8c4a8cb243b0f8a1c490181bb5cf1e5698a604b8fbf8ad9cd ~checkout:* ~session:* resetchannels -@all +@read +@write +@string +@hash -@dangerous\"\n2) \"user default on nopass sanitize-payload ~* &* +@all\""
   },
   {
    "who": "admin",
    "cmd": "ACL LOG 2",
    "out": "1)  1) \"count\"\n    2) (integer) 1\n    3) \"reason\"\n    4) \"command\"\n    5) \"context\"\n    6) \"toplevel\"\n    7) \"object\"\n    8) \"keys\"\n    9) \"username\"\n   10) \"checkout\"\n   11) \"age-seconds\"\n   12) \"0.04\"\n   13) \"client-info\"\n   14) \"id=10 addr=…\"\n   15) \"entry-id\"\n   16) (integer) 4\n   17) \"timestamp-created\"\n   18) (integer) 1792288308520\n   19) \"timestamp-last-updated\"\n   20) (integer) 1792288308520\n2)  1) \"count\"\n    2) (integer) 1\n    3) \"reason\"\n    4) \"command\"\n    5) \"context\"\n    6) \"toplevel\"\n    7) \"object\"\n    8) \"flushall\"\n    9) \"username\"\n   10) \"checkout\"\n   11) \"age-seconds\"\n   12) \"0.04\"\n   13) \"client-info\"\n   14) \"id=10 addr=…\"\n   15) \"entry-id\"\n   16) (integer) 3\n   17) \"timestamp-created\"\n   18) (integer) 1792288308520\n   19) \"timestamp-last-updated\"\n   20) (integer) 1792288308520"
   }
  ],
  "defaults": {
   "bind": "* -::*",
   "protected-mode": "yes",
   "requirepass": "",
   "maxclients": "10000",
   "timeout": "0",
   "tcp-keepalive": "300",
   "databases": "16",
   "maxmemory": "0",
   "maxmemory-policy": "noeviction",
   "maxmemory-samples": "5",
   "save": "3600 1 300 100 60 10000",
   "appendonly": "no",
   "appendfsync": "everysec",
   "aof-use-rdb-preamble": "yes",
   "lazyfree-lazy-eviction": "no",
   "lazyfree-lazy-expire": "no",
   "lazyfree-lazy-user-del": "no",
   "replica-read-only": "yes",
   "repl-backlog-size": "1048576",
   "repl-diskless-sync": "yes",
   "repl-diskless-sync-delay": "5",
   "min-replicas-to-write": "0",
   "slowlog-log-slower-than": "10000",
   "slowlog-max-len": "128",
   "latency-monitor-threshold": "0",
   "notify-keyspace-events": "",
   "io-threads": "1",
   "hz": "10",
   "busy-reply-threshold": "5000",
   "client-output-buffer-limit": "normal 0 0 0 slave 268435456 67108864 60 pubsub 33554432 8388608 60",
   "activedefrag": "no"
  },
  "startupWarnings": [
   "WARNING: Redis does not require authentication. Redis will accept connections from any local client."
  ]
 },
 "patterns": {
  "session": [
   {
    "cmd": "HSET session:9f3e2a user_id 7 role admin csrf k29fj",
    "out": "(integer) 3"
   },
   {
    "cmd": "EXPIRE session:9f3e2a 1800",
    "out": "(integer) 1"
   },
   {
    "cmd": "HGET session:9f3e2a user_id",
    "out": "\"7\""
   },
   {
    "cmd": "EXPIRE session:9f3e2a 1800",
    "out": "(integer) 1"
   },
   {
    "cmd": "TTL session:9f3e2a",
    "out": "(integer) 1800"
   },
   {
    "cmd": "DEL session:9f3e2a",
    "out": "(integer) 1"
   }
  ],
  "counters": [
   {
    "cmd": "INCR page:/pricing:views",
    "out": "(integer) 1"
   },
   {
    "cmd": "INCRBY page:/pricing:views 9",
    "out": "(integer) 10"
   },
   {
    "cmd": "HINCRBY stats:2026-10-18 signups 1",
    "out": "(integer) 1"
   },
   {
    "cmd": "HINCRBY stats:2026-10-18 orders 3",
    "out": "(integer) 3"
   },
   {
    "cmd": "HGETALL stats:2026-10-18",
    "out": "1) \"signups\"\n2) \"1\"\n3) \"orders\"\n4) \"3\""
   },
   {
    "cmd": "INCRBYFLOAT wallet:7 12.50",
    "out": "\"12.5\""
   }
  ],
  "dedupe": [
   {
    "cmd": "SADD seen:emails ann@example.com",
    "out": "(integer) 1"
   },
   {
    "cmd": "SADD seen:emails ann@example.com",
    "out": "(integer) 0"
   },
   {
    "cmd": "SISMEMBER seen:emails bob@example.com",
    "out": "(integer) 0"
   },
   {
    "cmd": "SCARD seen:emails",
    "out": "(integer) 1"
   }
  ],
  "hll": [
   {
    "distinct": 1000,
    "estimate": 1005,
    "errorPercent": 0.5,
    "bytes": 2608
   },
   {
    "distinct": 10000,
    "estimate": 10041,
    "errorPercent": 0.41,
    "bytes": 14384
   },
   {
    "distinct": 100000,
    "estimate": 98911,
    "errorPercent": 1.09,
    "bytes": 14384
   },
   {
    "distinct": 1000000,
    "estimate": 992924,
    "errorPercent": 0.71,
    "bytes": 14384
   }
  ],
  "setOfMillion": {
   "members": 1000000,
   "bytes": 48277586
  },
  "hllMerge": [
   {
    "cmd": "PFADD visitors:mon a b c d",
    "out": "(integer) 1"
   },
   {
    "cmd": "PFADD visitors:tue c d e",
    "out": "(integer) 1"
   },
   {
    "cmd": "PFMERGE visitors:week visitors:mon visitors:tue",
    "out": "OK"
   },
   {
    "cmd": "PFCOUNT visitors:week",
    "out": "(integer) 5"
   }
  ],
  "bitmaps": [
   {
    "cmd": "SETBIT active:2026-10-18 999999 1",
    "out": "(integer) 0"
   },
   {
    "cmd": "GETBIT active:2026-10-18 999999",
    "out": "(integer) 1"
   },
   {
    "cmd": "BITCOUNT active:2026-10-18",
    "out": "(integer) 1001"
   },
   {
    "cmd": "BITOP AND active:both active:2026-10-17 active:2026-10-18",
    "out": "(integer) 125000"
   },
   {
    "cmd": "BITCOUNT active:both",
    "out": "(integer) 666"
   },
   {
    "cmd": "MEMORY USAGE active:2026-10-18",
    "out": "(integer) 225328"
   }
  ],
  "geo": [
   {
    "cmd": "GEOADD stores 13.4050 52.5200 store:central 13.3777 52.5163 store:west 13.4545 52.5110 store:east 13.2846 52.5303 store:far",
    "out": "(integer) 4"
   },
   {
    "cmd": "GEOSEARCH stores FROMLONLAT 13.4000 52.5190 BYRADIUS 5 km ASC WITHDIST",
    "out": "1) 1) \"store:central\"\n   2) \"0.3563\"\n2) 1) \"store:west\"\n   2) \"1.5387\"\n3) 1) \"store:east\"\n   2) \"3.7947\""
   },
   {
    "cmd": "GEODIST stores store:central store:far km",
    "out": "\"8.2281\""
   },
   {
    "cmd": "TYPE stores",
    "out": "zset"
   },
   {
    "cmd": "ZRANGE stores 0 0 WITHSCORES",
    "out": "1) \"store:far\"\n2) \"3673960755925157\""
   }
  ],
  "sets": [
   {
    "cmd": "SADD tag:redis post:1 post:2 post:3",
    "out": "(integer) 3"
   },
   {
    "cmd": "SADD tag:cache post:2 post:3 post:4",
    "out": "(integer) 3"
   },
   {
    "cmd": "SINTER tag:redis tag:cache",
    "out": "1) \"post:2\"\n2) \"post:3\""
   },
   {
    "cmd": "SUNION tag:redis tag:cache",
    "out": "1) \"post:1\"\n2) \"post:2\"\n3) \"post:3\"\n4) \"post:4\""
   },
   {
    "cmd": "SDIFF tag:redis tag:cache",
    "out": "1) \"post:1\""
   }
  ],
  "leaderboard": [
   {
    "cmd": "ZADD leaderboard 3200 ann 2800 bob 4100 eve 2800 dan",
    "out": "(integer) 4"
   },
   {
    "cmd": "ZINCRBY leaderboard 500 bob",
    "out": "\"3300\""
   },
   {
    "cmd": "ZREVRANGE leaderboard 0 2 WITHSCORES",
    "out": "1) \"eve\"\n2) \"4100\"\n3) \"bob\"\n4) \"3300\"\n5) \"ann\"\n6) \"3200\""
   },
   {
    "cmd": "ZREVRANK leaderboard ann",
    "out": "(integer) 2"
   },
   {
    "cmd": "ZSCORE leaderboard bob",
    "out": "\"3300\""
   },
   {
    "cmd": "ZRANGE leaderboard 3000 4000 BYSCORE WITHSCORES",
    "out": "1) \"ann\"\n2) \"3200\"\n3) \"bob\"\n4) \"3300\""
   },
   {
    "cmd": "ZCOUNT leaderboard 3000 +inf",
    "out": "(integer) 3"
   }
  ]
 }
} as const
