// The client-side pool apps the pooling lesson was recorded with (tools/postgres-capture/operations-app),
// imported as text so the lesson always shows the code that ran.
import javaPool from '../../../../tools/postgres-capture/operations-app/src/main/java/demo/pool/OrdersPool.java?raw'
import tsPool from '../../../../tools/postgres-capture/operations-app/pool.ts?raw'

/** The text from `start` up to (not including) `end`, with the common indentation removed. */
function excerpt(source: string, start: string, end: string): string {
  const at = source.indexOf(start)
  // from the start of that line, so indentation stays consistent
  const from = source.lastIndexOf('\n', at) + 1
  const to = source.indexOf(end, at + start.length)
  if (at < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  const lines = source.slice(from, to).replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

export const CLIENT_POOLS = {
  java: {
    title: 'OrdersPool.java — the pool and one request (HikariCP 5.1, JDBC 42.7)',
    code: `${excerpt(javaPool, '    static HikariDataSource pool()', '    public static void main')}\n\n// one request: borrow, use, give back (try-with-resources closes = returns it)\n${excerpt(javaPool, 'try (Connection c = ds.getConnection();', 'return (System.nanoTime()')}`,
  },
  ts: {
    title: 'pool.ts — the pool and a transaction (node-postgres 8)',
    code: `${excerpt(tsPool, 'const pool = new pg.Pool', 'const stats =')}\n\n${excerpt(tsPool, '// 2. A transaction', 'const orderId')}`,
  },
}
