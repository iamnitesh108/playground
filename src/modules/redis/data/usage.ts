// Recorded from Redis 8.8.3 by tools/redis-capture/capture-usage.mjs — do not edit by hand.

export const USAGE = {
 "version": "8.8.3",
 "connect": [
  {
   "shell": true,
   "cmd": "redis-cli PING                                   # localhost:6379, no password",
   "out": "NOAUTH Authentication required."
  },
  {
   "shell": true,
   "cmd": "redis-cli -h localhost -p 6379 -a app-secret PING",
   "out": "PONG"
  },
  {
   "shell": true,
   "cmd": "redis-cli -u redis://default:app-secret@localhost:6379/0 PING",
   "out": "PONG"
  },
  {
   "shell": true,
   "cmd": "redis-cli -u redis://default:app-secret@localhost:6379/0 --no-auth-warning DBSIZE",
   "out": "0"
  }
 ],
 "strings": [
  {
   "cmd": "SET user:1:name Ann",
   "out": "OK"
  },
  {
   "cmd": "GET user:1:name",
   "out": "\"Ann\""
  },
  {
   "cmd": "GET user:2:name",
   "out": "(nil)"
  },
  {
   "cmd": "SET lock:report worker-1 NX EX 30",
   "out": "OK"
  },
  {
   "cmd": "SET lock:report worker-2 NX EX 30",
   "out": "(nil)"
  },
  {
   "cmd": "MGET user:1:name user:2:name",
   "out": "1) \"Ann\"\n2) (nil)"
  },
  {
   "cmd": "EXISTS user:1:name",
   "out": "(integer) 1"
  },
  {
   "cmd": "DEL user:1:name",
   "out": "(integer) 1"
  },
  {
   "cmd": "EXISTS user:1:name",
   "out": "(integer) 0"
  }
 ],
 "counters": [
  {
   "cmd": "INCR page:home:views",
   "out": "(integer) 1"
  },
  {
   "cmd": "INCR page:home:views",
   "out": "(integer) 2"
  },
  {
   "cmd": "INCRBY page:home:views 10",
   "out": "(integer) 12"
  },
  {
   "cmd": "DECR page:home:views",
   "out": "(integer) 11"
  },
  {
   "cmd": "SET price 9.5",
   "out": "OK"
  },
  {
   "cmd": "INCRBYFLOAT price 0.25",
   "out": "\"9.75\""
  },
  {
   "cmd": "SET name Ann",
   "out": "OK"
  },
  {
   "cmd": "INCR name",
   "out": "(error) ERR value is not an integer or out of range"
  }
 ],
 "expiry": [
  {
   "cmd": "SET otp:7 381920 EX 300",
   "out": "OK"
  },
  {
   "cmd": "TTL otp:7",
   "out": "(integer) 300"
  },
  {
   "cmd": "PERSIST otp:7",
   "out": "(integer) 1"
  },
  {
   "cmd": "TTL otp:7",
   "out": "(integer) -1"
  },
  {
   "cmd": "TTL no:such:key",
   "out": "(integer) -2"
  },
  {
   "cmd": "SET session:9 abc PX 1500",
   "out": "OK"
  },
  {
   "cmd": "PTTL session:9",
   "out": "(integer) 1500"
  },
  {
   "note": "(2 seconds later)"
  },
  {
   "cmd": "GET session:9",
   "out": "(nil)"
  },
  {
   "cmd": "TTL session:9",
   "out": "(integer) -2"
  },
  {
   "cmd": "SET cart:3 \"2 items\" EX 600",
   "out": "OK"
  },
  {
   "cmd": "SET cart:3 \"3 items\"",
   "out": "OK"
  },
  {
   "cmd": "TTL cart:3",
   "out": "(integer) -1"
  },
  {
   "cmd": "SET cart:3 \"4 items\" KEEPTTL EX 600",
   "out": "(error) ERR syntax error"
  },
  {
   "cmd": "SET cart:3 \"4 items\" EX 600",
   "out": "OK"
  },
  {
   "cmd": "SET cart:3 \"5 items\" KEEPTTL",
   "out": "OK"
  },
  {
   "cmd": "TTL cart:3",
   "out": "(integer) 600"
  }
 ],
 "hashes": [
  {
   "cmd": "HSET user:1 name Ann email ann@example.com plan pro",
   "out": "(integer) 3"
  },
  {
   "cmd": "HGET user:1 plan",
   "out": "\"pro\""
  },
  {
   "cmd": "HMGET user:1 name email phone",
   "out": "1) \"Ann\"\n2) \"ann@example.com\"\n3) (nil)"
  },
  {
   "cmd": "HINCRBY user:1 logins 1",
   "out": "(integer) 1"
  },
  {
   "cmd": "HSET user:1 plan team",
   "out": "(integer) 0"
  },
  {
   "cmd": "HGETALL user:1",
   "out": "1) \"name\"\n2) \"Ann\"\n3) \"email\"\n4) \"ann@example.com\"\n5) \"plan\"\n6) \"team\"\n7) \"logins\"\n8) \"1\""
  },
  {
   "cmd": "HDEL user:1 email",
   "out": "(integer) 1"
  },
  {
   "cmd": "HEXISTS user:1 email",
   "out": "(integer) 0"
  },
  {
   "cmd": "HLEN user:1",
   "out": "(integer) 3"
  }
 ],
 "lists": [
  {
   "who": "worker",
   "cmd": "LPUSH jobs:email job-1 job-2 job-3",
   "out": "(integer) 3"
  },
  {
   "who": "worker",
   "cmd": "LRANGE jobs:email 0 -1",
   "out": "1) \"job-3\"\n2) \"job-2\"\n3) \"job-1\""
  },
  {
   "who": "worker",
   "cmd": "RPOP jobs:email",
   "out": "\"job-1\""
  },
  {
   "who": "worker",
   "cmd": "LLEN jobs:email",
   "out": "(integer) 2"
  },
  {
   "who": "worker",
   "cmd": "RPOP jobs:email",
   "out": "\"job-2\""
  },
  {
   "who": "worker",
   "cmd": "RPOP jobs:email",
   "out": "\"job-3\""
  },
  {
   "who": "worker",
   "cmd": "RPOP jobs:email",
   "out": "(nil)"
  },
  {
   "who": "worker",
   "cmd": "BRPOP jobs:email 5",
   "out": "(blocked, waiting…)"
  },
  {
   "note": "(1 second later, from the web app)"
  },
  {
   "who": "web app",
   "cmd": "LPUSH jobs:email job-4",
   "out": "(integer) 1"
  },
  {
   "who": "worker",
   "cmd": "(BRPOP returns)",
   "out": "1) \"jobs:email\"\n2) \"job-4\""
  }
 ],
 "sets": [
  {
   "cmd": "SADD tags:post:9 redis cache redis",
   "out": "(integer) 2"
  },
  {
   "cmd": "SADD tags:post:10 redis queue",
   "out": "(integer) 2"
  },
  {
   "cmd": "SISMEMBER tags:post:9 cache",
   "out": "(integer) 1"
  },
  {
   "cmd": "SMEMBERS tags:post:9",
   "out": "1) \"redis\"\n2) \"cache\""
  },
  {
   "cmd": "SCARD tags:post:9",
   "out": "(integer) 2"
  },
  {
   "cmd": "SINTER tags:post:9 tags:post:10",
   "out": "1) \"redis\""
  },
  {
   "cmd": "SREM tags:post:9 cache",
   "out": "(integer) 1"
  }
 ],
 "sortedSets": [
  {
   "cmd": "ZADD leaderboard 3200 ann 2800 bob 4100 eve",
   "out": "(integer) 3"
  },
  {
   "cmd": "ZINCRBY leaderboard 500 bob",
   "out": "\"3300\""
  },
  {
   "cmd": "ZRANGE leaderboard 0 2 REV WITHSCORES",
   "out": "1) \"eve\"\n2) \"4100\"\n3) \"bob\"\n4) \"3300\"\n5) \"ann\"\n6) \"3200\""
  },
  {
   "cmd": "ZRANK leaderboard ann",
   "out": "(integer) 0"
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
   "cmd": "ZRANGE leaderboard 3000 +inf BYSCORE WITHSCORES",
   "out": "1) \"ann\"\n2) \"3200\"\n3) \"bob\"\n4) \"3300\"\n5) \"eve\"\n6) \"4100\""
  },
  {
   "cmd": "ZCARD leaderboard",
   "out": "(integer) 3"
  }
 ],
 "pubsub": [
  {
   "who": "subscriber",
   "cmd": "SUBSCRIBE orders",
   "out": "1) \"subscribe\"\n2) \"orders\"\n3) (integer) 1"
  },
  {
   "who": "publisher",
   "cmd": "PUBLISH orders \"order 1001 paid\"",
   "out": "(integer) 1"
  },
  {
   "who": "subscriber",
   "cmd": "(message arrives)",
   "out": "1) \"message\"\n2) \"orders\"\n3) \"order 1001 paid\""
  },
  {
   "who": "publisher",
   "cmd": "PUBLISH payments \"refund 77\"",
   "out": "(integer) 0"
  },
  {
   "who": "publisher",
   "cmd": "PUBLISH orders \"order 1002 paid\"",
   "out": "(integer) 0"
  }
 ],
 "scanTotals": {
  "calls": 4,
  "keys": 40
 },
 "scan": [
  {
   "cmd": "DBSIZE",
   "out": "(integer) 70"
  },
  {
   "cmd": "SCAN 0 MATCH session:* COUNT 20",
   "out": "1) \"42\"\n2)  1) \"session:7\"\n    2) \"session:26\"\n    3) \"session:36\"\n    4) \"session:31\"\n    5) \"session:4\"\n    6) \"session:19\"\n    7) \"session:22\"\n    8) \"session:3\"\n    9) \"session:24\"\n   10) \"session:8\"\n   11) \"session:1\"\n   12) \"session:11\"\n   13) \"session:39\"\n   14) \"session:10\""
  }
 ],
 "scanCli": {
  "shell": true,
  "cmd": "redis-cli --scan --pattern \"session:*\" | head -3",
  "out": "session:7\nsession:26\nsession:36"
 },
 "typeErrors": [
  {
   "cmd": "TYPE leaderboard",
   "out": "zset"
  },
  {
   "cmd": "TYPE user:1",
   "out": "hash"
  },
  {
   "cmd": "GET leaderboard",
   "out": "(error) WRONGTYPE Operation against a key holding the wrong kind of value"
  },
  {
   "cmd": "OBJECT ENCODING user:1",
   "out": "\"listpack\""
  }
 ],
 "multi": [
  {
   "cmd": "SET stock:42 10",
   "out": "OK"
  },
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
  }
 ],
 "pipeCli": {
  "shell": true,
  "cmd": "for i in $(seq 1 10000); do printf 'INCR hits\\r\\n'; done | redis-cli --pipe",
  "out": "All data transferred. Waiting for the last reply...\nLast reply received from server.\nerrors: 0, replies: 10000"
 },
 "appUsage": [
  "# strings",
  "set(\"user:1:name\", \"Ann\")  ->  OK",
  "get(\"user:1:name\")  ->  Ann",
  "get(\"user:2:name\")  ->  null",
  "set(\"lock:report\", \"worker-1\", nx().ex(30))  ->  OK",
  "set(\"lock:report\", \"worker-2\", nx().ex(30))  ->  null",
  "mget(\"user:1:name\", \"user:2:name\")  ->  [KeyValue[user:1:name, Ann], KeyValue[user:2:name].empty]",
  "exists(\"user:1:name\")  ->  1",
  "del(\"user:1:name\")  ->  1",
  "# counters",
  "incr(\"page:home:views\")  ->  1",
  "incrby(\"page:home:views\", 10)  ->  11",
  "# expiry",
  "setex(\"otp:7\", 300, \"381920\")  ->  OK",
  "ttl(\"otp:7\")  ->  300",
  "persist(\"otp:7\")  ->  true",
  "ttl(\"otp:7\")  ->  -1",
  "# hashes",
  "hset(\"user:1\", {name, email, plan})  ->  3",
  "hget(\"user:1\", \"plan\")  ->  pro",
  "hincrby(\"user:1\", \"logins\", 1)  ->  1",
  "hgetall(\"user:1\")  ->  {email=ann@example.com, plan=pro, name=Ann, logins=1}",
  "# lists as a queue",
  "lpush(\"jobs:email\", \"job-1\", \"job-2\")  ->  2",
  "lrange(\"jobs:email\", 0, -1)  ->  [job-2, job-1]",
  "rpop(\"jobs:email\")  ->  job-1",
  "brpop(1, \"jobs:email\")  ->  KeyValue[jobs:email, job-2]",
  "brpop(1, \"jobs:email\")  (empty: waits 1 s)  ->  null",
  "# sets",
  "sadd(\"tags:post:9\", \"redis\", \"cache\", \"redis\")  ->  2",
  "sismember(\"tags:post:9\", \"cache\")  ->  true",
  "scard(\"tags:post:9\")  ->  2",
  "# sorted sets",
  "zadd(\"leaderboard\", 3200, \"ann\")  ->  1",
  "zadd(\"leaderboard\", 2800, \"bob\")  ->  1",
  "zadd(\"leaderboard\", 4100, \"eve\")  ->  1",
  "zincrby(\"leaderboard\", 500, \"bob\")  ->  3300.0",
  "zrevrangeWithScores(\"leaderboard\", 0, 2)  ->  [ScoredValue[4100.000000, eve], ScoredValue[3300.000000, bob], ScoredValue[3200.000000, ann]]",
  "zrevrank(\"leaderboard\", \"ann\")  ->  2",
  "# SCAN instead of KEYS",
  "scan(match \"session:*\", count 2) until finished  ->  [session:1, session:2, session:3, session:4, session:5] in 5 calls"
 ],
 "appAsync": [
  "# async: the call returns at once, the reply completes the future later",
  "async.set(\"greeting\", \"hello\").get()  ->  OK",
  "async.get(\"greeting\").get()  ->  hello",
  "# reactive: build a pipeline of operations, nothing runs until subscribed",
  "Flux(a, b, c).flatMap(reactive.incr(\"counter:\" + item))  ->  [1, 1, 1]"
 ],
 "appPubsub": [
  "# subscribed to orders",
  "publish(\"orders\", \"order 1001 paid\")  ->  1",
  "listener got  ->  orders: order 1001 paid",
  "publish(\"orders\", \"order 1002 paid\")  ->  1",
  "listener got  ->  orders: order 1002 paid",
  "publish(\"orders\", \"order 1003 paid\") after unsubscribing  ->  0"
 ],
 "appPipeline": [
  "# 10000 INCRs one by one: each call waits for its reply",
  "sync loop  ->  737.9 ms",
  "# 10000 INCRs as one pipeline: queue them all, send once, then wait",
  "pipeline  ->  72.3 ms",
  "get(\"hits\")  ->  20000",
  "# a transaction: queued, then executed as one unit",
  "multi()  ->  OK",
  "decrby(\"stock:42\", 3)  ->  null",
  "rpush(\"orders:42\", \"order-1001\")  ->  null",
  "exec()  ->  DefaultTransactionResult [wasRolledBack=false, responses=2]",
  "exec().wasDiscarded()  ->  false"
 ],
 "appWatch": [
  "# meanwhile another client changes the balance",
  "other.incrby(\"balance:7\", 50)  ->  150",
  "attempt 1: read 100, exec()  ->  discarded (balance changed) - retry",
  "attempt 2: read 150, exec()  ->  committed DefaultTransactionResult [wasRolledBack=false, responses=1]",
  "get(\"balance:7\")  ->  120"
 ],
 "appConfig": [
  "connection.getTimeout()  ->  PT1M",
  "connection.getTimeout()  ->  PT0.5S"
 ],
 "appTimeout": [
  "timeout for every command  ->  PT0.5S",
  "# ready",
  "get(\"user:1:name\") after 501 ms  ->  RedisCommandTimeoutException: Command timed out after 500 millisecond(s)",
  "get(\"user:1:name\") again, after 0 ms (connection still usable)  ->  Ann"
 ],
 "timeoutBusy": "DEBUG SLEEP 2",
 "appReconnect": [
  "    0 ms  incr(\"visits\")  ->  1",
  "  251 ms  incr(\"visits\")  ->  2",
  "  502 ms  incr(\"visits\")  ->  3",
  "  753 ms  incr(\"visits\")  ->  4",
  " 1004 ms  incr(\"visits\")  ->  5",
  " 1255 ms  incr(\"visits\")  ->  6",
  " 1506 ms  incr(\"visits\")  ->  7",
  "Reconnecting, last destination was localhost/127.0.0.1:6379",
  "Cannot reconnect to [localhost/<unresolved>:6379]: Connection refused: localhost/127.0.0.1:6379",
  " 1757 ms  incr(\"visits\")  ->  1  (waited 1576 ms)",
  " 3584 ms  incr(\"visits\")  ->  2",
  " 3835 ms  incr(\"visits\")  ->  3",
  " 4086 ms  incr(\"visits\")  ->  4",
  " 4337 ms  incr(\"visits\")  ->  5",
  " 4588 ms  incr(\"visits\")  ->  6",
  " 4839 ms  incr(\"visits\")  ->  7",
  " 5090 ms  incr(\"visits\")  ->  8",
  " 5341 ms  incr(\"visits\")  ->  9",
  " 5592 ms  incr(\"visits\")  ->  10",
  " 5843 ms  incr(\"visits\")  ->  11",
  " 6094 ms  incr(\"visits\")  ->  12",
  " 6345 ms  incr(\"visits\")  ->  13",
  " 6596 ms  incr(\"visits\")  ->  14",
  " 6848 ms  incr(\"visits\")  ->  15",
  " 7099 ms  incr(\"visits\")  ->  16",
  " 7349 ms  incr(\"visits\")  ->  17",
  "# done"
 ],
 "downMs": 1589,
 "tracking": [
  {
   "who": "app (listener)",
   "cmd": "SUBSCRIBE __redis__:invalidate",
   "out": "1) \"subscribe\"\n2) \"__redis__:invalidate\"\n3) (integer) 1"
  },
  {
   "who": "app",
   "cmd": "CLIENT TRACKING ON REDIRECT 8",
   "out": "OK"
  },
  {
   "who": "app",
   "cmd": "GET product:5",
   "out": "(nil)"
  },
  {
   "who": "admin",
   "cmd": "SET product:5 \"new price\"",
   "out": "OK"
  },
  {
   "who": "app (listener)",
   "cmd": "(message arrives)",
   "out": "1) \"message\"\n2) \"__redis__:invalidate\"\n3) 1) \"product:5\""
  }
 ],
 "health": [
  {
   "cmd": "PING",
   "out": "PONG"
  },
  {
   "cmd": "CLIENT SETNAME orders-api",
   "out": "OK"
  }
 ],
 "clientList": "id=9 addr=10.0.4.12:51734 name=orders-api age=0 idle=0 flags=N db=0 cmd=client|list",
 "moved": [
  {
   "shell": true,
   "cmd": "redis-cli -p 7000 SET user:1:name Ann",
   "out": "MOVED 12440 127.0.0.1:7002"
  },
  {
   "shell": true,
   "cmd": "redis-cli -p 7000 CLUSTER KEYSLOT user:1:name",
   "out": "12440"
  },
  {
   "shell": true,
   "cmd": "redis-cli -c -p 7000 SET user:1:name Ann    # -c: follow MOVED",
   "out": "OK"
  }
 ]
} as const
