/*
 * How an S3 server decides whether a request is allowed, for IAM-style JSON policies:
 * every statement whose Action, Resource (and Condition) match is collected; any matching Deny wins,
 * otherwise any matching Allow allows, otherwise the answer is the default: deny.
 */

export type Effect = 'Allow' | 'Deny'

export interface Statement {
  Sid?: string
  Effect: Effect
  Principal?: string | Record<string, string | string[]>
  Action: string | string[]
  Resource: string | string[]
  Condition?: Record<string, Record<string, string | string[]>>
}

export interface Policy {
  Version: string
  Statement: Statement[]
}

/** A policy and where it is attached: to the user making the request, or to the bucket. */
export interface AttachedPolicy {
  name: string
  kind: 'user' | 'bucket'
  policy: Policy
}

export interface AccessRequest {
  /** null for an anonymous (unsigned) request */
  user: string | null
  action: string
  resource: string
  /** request context, e.g. s3:prefix for ListBucket */
  context?: Record<string, string>
}

export interface StatementCheck {
  policy: string
  kind: AttachedPolicy['kind']
  sid: string
  effect: Effect
  principal: boolean
  action: boolean
  resource: boolean
  condition: boolean
  matches: boolean
}

export type Decision = 'explicit-deny' | 'allow' | 'implicit-deny'

const list = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v])

/** Glob match with * (any run of characters) and ? (one character). */
export function glob(pattern: string, value: string, ignoreCase = false): boolean {
  const re = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`, ignoreCase ? 'i' : '')
  return re.test(value)
}

function conditionHolds(condition: Statement['Condition'], context: Record<string, string>): boolean {
  if (!condition) return true
  return Object.entries(condition).every(([operator, keys]) =>
    Object.entries(keys).every(([key, expected]) => {
      const actual = context[key]
      if (actual === undefined) return false
      const values = list(expected)
      if (operator === 'StringEquals') return values.includes(actual)
      if (operator === 'StringLike') return values.some((v) => glob(v, actual))
      if (operator === 'StringNotLike') return values.every((v) => !glob(v, actual))
      return false
    }),
  )
}

function principalMatches(s: Statement, kind: AttachedPolicy['kind'], user: string | null): boolean {
  // a user's own policy always speaks about that user; anonymous requests have no user policies
  if (kind === 'user') return user !== null
  const p = s.Principal
  if (p === '*') return true
  if (p && typeof p === 'object') return list(p.AWS).some((a) => a === '*' || (user !== null && a.endsWith(user)))
  return false
}

export function evaluate(policies: readonly AttachedPolicy[], req: AccessRequest): { decision: Decision; checks: StatementCheck[] } {
  const checks: StatementCheck[] = []
  for (const a of policies) {
    a.policy.Statement.forEach((s, i) => {
      const principal = principalMatches(s, a.kind, req.user)
      const action = list(s.Action).some((p) => glob(p, req.action, true))
      const resource = list(s.Resource).some((p) => glob(p, req.resource))
      const condition = conditionHolds(s.Condition, req.context ?? {})
      checks.push({ policy: a.name, kind: a.kind, sid: s.Sid ?? `statement ${i + 1}`, effect: s.Effect, principal, action, resource, condition, matches: principal && action && resource && condition })
    })
  }
  const matching = checks.filter((c) => c.matches)
  const decision: Decision = matching.some((c) => c.effect === 'Deny') ? 'explicit-deny' : matching.some((c) => c.effect === 'Allow') ? 'allow' : 'implicit-deny'
  return { decision, checks }
}
