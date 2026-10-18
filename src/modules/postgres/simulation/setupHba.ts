/*
 * How PostgreSQL picks a pg_hba.conf line for a new connection: rules are read top to bottom and
 * the first line whose connection type, database, user and address all match decides. Its method
 * then runs (peer, scram-sha-256, reject…); if no line matches, the connection is refused.
 * Pure TS, no React.
 */

export interface HbaRule {
  line: number
  type: 'local' | 'host' | 'hostssl' | 'hostnossl'
  databases: readonly string[]
  users: readonly string[]
  /** IPv4 or IPv6 network address, null for local (Unix socket) lines. */
  address: string | null
  netmask: string | null
  method: string
}

export interface HbaConnection {
  /** Unix socket on the server itself, or TCP from an address. */
  via: 'socket' | 'tcp'
  address: string
  database: string
  user: string
  /** A streaming-replication connection matches only lines whose database is "replication". */
  replication: boolean
}

export interface FieldCheck {
  field: 'type' | 'database' | 'user' | 'address'
  ok: boolean
}

export interface RuleResult {
  rule: HbaRule
  checks: FieldCheck[]
  matches: boolean
}

export interface HbaDecision {
  results: RuleResult[]
  /** The first matching rule, or null: the connection is rejected with "no pg_hba.conf entry". */
  chosen: HbaRule | null
}

/** Parses the text table printed by SELECT … FROM pg_hba_file_rules. */
export function parseHbaRules(table: string): HbaRule[] {
  const set = (cell: string) => cell.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
  return table
    .split('\n')
    .filter((l) => /^\s*\d+\s*\|/.test(l))
    .map((l) => {
      const [line, type, db, user, address, netmask, method] = l.split('|').map((c) => c.trim())
      return {
        line: Number(line),
        type: type as HbaRule['type'],
        databases: set(db),
        users: set(user),
        address: address || null,
        netmask: netmask || null,
        method,
      }
    })
}

function ipv4(a: string): number | null {
  const m = a.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  return m ? m.slice(1).reduce((n, p) => n * 256 + Number(p), 0) : null
}

/** IPv4 network match; IPv6 is only matched exactly (enough for ::1). */
function inNetwork(client: string, address: string, netmask: string): boolean {
  const c = ipv4(client), a = ipv4(address), m = ipv4(netmask)
  if (c === null || a === null || m === null) return client === address
  // unsigned 32-bit arithmetic without bit operators on numbers above 2^31
  const mask = (x: number) => {
    let out = 0
    for (let bit = 31; bit >= 0; bit--) {
      const v = 2 ** bit
      if (Math.floor(x / v) % 2 === 1 && Math.floor(m / v) % 2 === 1) out += v
    }
    return out
  }
  return mask(c) === mask(a)
}

function databaseMatches(rule: HbaRule, conn: HbaConnection): boolean {
  if (conn.replication) return rule.databases.includes('replication')
  return rule.databases.includes('all') || rule.databases.includes(conn.database)
}

export function decide(rules: readonly HbaRule[], conn: HbaConnection): HbaDecision {
  let chosen: HbaRule | null = null
  const results = rules.map((rule) => {
    const checks: FieldCheck[] = [
      { field: 'type', ok: conn.via === 'socket' ? rule.type === 'local' : rule.type !== 'local' },
      { field: 'database', ok: databaseMatches(rule, conn) },
      { field: 'user', ok: rule.users.includes('all') || rule.users.includes(conn.user) },
      { field: 'address', ok: rule.type === 'local' || (rule.address !== null && rule.netmask !== null && inNetwork(conn.address, rule.address, rule.netmask)) },
    ]
    const matches = chosen === null && checks.every((c) => c.ok)
    if (matches) chosen = rule
    return { rule, checks, matches }
  })
  return { results, chosen }
}

/** What the client sees next, for the methods in a default file. */
export function outcome(decision: HbaDecision, conn: HbaConnection, osUser: string): { ok: boolean | null; text: string } {
  const r = decision.chosen
  const target = conn.replication ? 'replication connection' : `database "${conn.database}"`
  if (!r) return { ok: false, text: `FATAL:  no pg_hba.conf entry for host "${conn.via === 'socket' ? '[local]' : conn.address}", user "${conn.user}", ${target}${conn.via === 'tcp' ? ', no encryption' : ''}` }
  switch (r.method) {
    case 'peer':
      return osUser === conn.user
        ? { ok: true, text: `peer: the operating-system user is "${osUser}", the same as the role — logged in without a password.` }
        : { ok: false, text: `FATAL:  Peer authentication failed for user "${conn.user}"` }
    case 'scram-sha-256':
    case 'md5':
      return { ok: null, text: `${r.method}: the server now asks for the password of role "${conn.user}". Right password → in; wrong → FATAL: password authentication failed.` }
    case 'trust':
      return { ok: true, text: 'trust: logged in with no password at all.' }
    case 'reject':
      return { ok: false, text: `FATAL:  pg_hba.conf rejects connection for host "${conn.address}", user "${conn.user}", ${target}` }
    default:
      return { ok: null, text: `${r.method} authentication runs.` }
  }
}
