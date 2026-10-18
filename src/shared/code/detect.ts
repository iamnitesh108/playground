/** A language guessed from the first line of a snippet, before falling back to highlight.js's own detection. */
interface Rule {
  language: string
  test: RegExp
}

const PROGRAMS = 'redis-cli|redis-server|redis-benchmark|redis-check-\\w+|kafka-[\\w-]+(?:\\.sh)?|podman|docker|kubectl|helm|curl|git|npm|npx|node|java|javac|\\./gradlew|gradle|mvn|psql|pg_\\w+|openssl|keytool|cd|ls|cat|echo|export|sudo|mkdir|rm|cp|mv|tail|grep|watch|time|bin/[\\w./-]+'

const REDIS_COMMANDS = 'SET|GET|DEL|EXISTS|EXPIRE|TTL|PERSIST|INCR|INCRBY|DECR|MGET|MSET|HSET|HGET|HGETALL|HINCRBY|HDEL|LPUSH|RPUSH|LPOP|RPOP|BLPOP|BRPOP|LRANGE|LMOVE|BLMOVE|SADD|SREM|SMEMBERS|SISMEMBER|SCARD|ZADD|ZINCRBY|ZRANGE|ZRANK|ZREM|ZSCORE|XADD|XREAD|XREADGROUP|XACK|XGROUP|XPENDING|XCLAIM|XAUTOCLAIM|PUBLISH|SUBSCRIBE|PSUBSCRIBE|SCAN|KEYS|TYPE|OBJECT|MULTI|EXEC|WATCH|DISCARD|EVAL|EVALSHA|FCALL|SCRIPT|FUNCTION|CONFIG|INFO|CLIENT|ACL|AUTH|HELLO|PING|SELECT|FLUSHALL|FLUSHDB|BGSAVE|BGREWRITEAOF|SAVE|DEBUG|MEMORY|LATENCY|SLOWLOG|CLUSTER|REPLICAOF|WAIT|SETBIT|GETBIT|BITCOUNT|PFADD|PFCOUNT|GEOADD|GEOSEARCH|JSON\\.\\w+|FT\\.\\w+|BF\\.\\w+|TS\\.\\w+|VADD|VSIM'

// first match wins; each rule looks only at the first non-empty, non-comment line unless it says otherwise
const RULES: Rule[] = [
  { language: 'cli', test: new RegExp(`^(?:\\$\\s+)?(?:sudo\\s+)?(?:${PROGRAMS})(?:\\s|$)`) },
  // SQL before Redis: both have SELECT, so SQL needs its own shape (FROM, INTO, TABLE…)
  { language: 'sql', test: /^(?:SELECT\s.+\bFROM\b|SELECT\s+(?:\*|[\w(]+.*[,(])|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s|ALTER\s|DROP\s|BEGIN\b|COMMIT\b|ROLLBACK\b|WITH\s|EXPLAIN\s|VACUUM\b|GRANT\s|SHOW\s|TRUNCATE\s|LOCK\s|SET\s+(?:LOCAL\s+|SESSION\s+)?[\w.]+\s*(?:=|TO\s))/i },
  { language: 'redis', test: new RegExp(`^(?:${REDIS_COMMANDS})(?:\\s|$)`) },
  { language: 'java', test: /^(?:package|import\s+[\w.]+;|public|private|protected|@\w+|class\s|record\s|var\s|final\s)/ },
  // a Java method or a typed declaration: `void onMessage(…) {`, `List<Order> orders = …`, `static int max(…)`
  { language: 'java', test: /^(?:void\s+\w+\s*\(|static\s|(?:[A-Z]\w*(?:<[^>]*>)?(?:\[\])?)\s+\w+\s*(?:\(|=[^=>]))/ },
  { language: 'lua', test: /^(?:local\s|redis\.(?:call|pcall)|return\s+redis|if\s.+\sthen\b)/ },
  { language: 'typescript', test: /^(?:const|let|function|export|import\s.+from|async\s|await\s|interface\s|type\s)/ },
  // a single JS/TS statement: a call or an assignment, often with a // comment
  { language: 'typescript', test: /^[\w$]+(?:\.[\w$]+|\[[^\]]*\])*\s*(?:\(.*\)|=[^=].*)\s*;?\s*(?:\/\/.*)?$/ },
  { language: 'json', test: /^[{[]\s*("|$|\{|\[)/ },
  { language: 'yaml', test: /^(?:---|apiVersion:|kind:|[\w.-]+:\s*$|- [\w.-]+:)/ },
  { language: 'properties', test: /^[a-z][\w.-]*\.[\w.-]+\s*=/ },
  { language: 'conf', test: /^[a-z][\w-]*\s+\S/ },
]

export function detect(code: string): string | undefined {
  const first = code.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !l.startsWith('//'))
  if (!first) return code.trim().startsWith('#') ? 'output' : undefined
  return RULES.find((r) => r.test.test(first))?.language
}
