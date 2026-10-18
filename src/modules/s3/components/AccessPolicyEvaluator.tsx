import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { evaluate, type AttachedPolicy, type Policy } from '../simulation/policy'
import { HUE } from './legend'
import styles from './AccessPolicyEvaluator.module.css'

export interface Identity {
  user: string | null
  label: string
  policy?: string
}

export interface RecordedCase {
  user: string | null
  action: string
  target: string
  allowed: boolean
  how: string
}

interface Props {
  identities: readonly Identity[]
  userPolicies: Readonly<Record<string, Policy>>
  bucketPolicy: { name: string; policy: Policy }
  keys: readonly string[]
  prefixes: readonly string[]
  recorded: readonly RecordedCase[]
}

const ACTIONS = ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket']
const DECISION = {
  allow: { text: 'Allowed', hue: HUE.ok, why: 'a statement allows it and none denies it' },
  'explicit-deny': { text: 'Denied — explicit deny', hue: HUE.error, why: 'a Deny statement matches; a Deny always wins over any Allow' },
  'implicit-deny': { text: 'Denied — nothing allows it', hue: HUE.error, why: 'no statement allows it, and the default is deny' },
} as const

/** Pick who asks for what; see every statement checked and the decision, next to what RustFS answered. */
export function AccessPolicyEvaluator({ identities, userPolicies, bucketPolicy, keys, prefixes, recorded }: Props) {
  const [who, setWho] = useState(0)
  const [action, setAction] = useState('s3:GetObject')
  const [key, setKey] = useState(keys[0])
  const [prefix, setPrefix] = useState(prefixes[0])
  const [bucketOn, setBucketOn] = useState(true)
  const id = identities[who]
  const isList = action === 's3:ListBucket'
  const resource = isList ? 'arn:aws:s3:::catalog' : `arn:aws:s3:::catalog/${key}`
  const attached: AttachedPolicy[] = [
    ...(id.policy && userPolicies[id.policy] ? [{ name: id.policy, kind: 'user' as const, policy: userPolicies[id.policy] }] : []),
    ...(bucketOn ? [{ name: bucketPolicy.name, kind: 'bucket' as const, policy: bucketPolicy.policy }] : []),
  ]
  const { decision, checks } = evaluate(attached, { user: id.user, action, resource, context: isList ? { 's3:prefix': prefix } : {} })
  const d = DECISION[decision]
  const target = isList ? prefix : key
  const rec = recorded.find((r) => r.user === id.user && r.action === action && r.target === target)
  const tick = (ok: boolean) => (ok ? '✓' : '✗')
  return (
    <Demo
      title="Who may do what? A policy evaluator"
      hint="The policies are the ones the lesson attached on RustFS. Where the same request was recorded, the real answer is shown next to the model’s."
      controls={
        <>
          <Segmented label="who" value={who} options={identities.map((i, n) => ({ value: n, label: i.label }))} onChange={setWho} />
          <Segmented label="action" value={action} options={ACTIONS.map((a) => ({ value: a, label: a.replace('s3:', '') }))} onChange={setAction} />
          {isList ? (
            <Segmented label="prefix" value={prefix} options={prefixes.map((p) => ({ value: p, label: p || '(whole bucket)' }))} onChange={setPrefix} />
          ) : (
            <Segmented label="key" value={key} options={keys.map((k) => ({ value: k, label: k }))} onChange={setKey} />
          )}
          <Segmented
            label="bucket policy public-read"
            value={bucketOn ? 'on' : 'off'}
            options={[
              { value: 'on', label: 'attached' },
              { value: 'off', label: 'none' },
            ]}
            onChange={(v) => setBucketOn(v === 'on')}
          />
        </>
      }
    >
      <code className={styles.request}>
        {id.user ?? 'anonymous'} → {action} on {resource}
        {isList ? ` with s3:prefix = "${prefix}"` : ''}
      </code>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>policy · statement</th>
            <th>effect</th>
            <th>who</th>
            <th>action</th>
            <th>resource</th>
            <th>condition</th>
            <th>matches</th>
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <tr key={`${c.policy}-${c.sid}`} className={c.matches ? styles.hit : undefined} style={hue(c.matches ? (c.effect === 'Deny' ? HUE.error : HUE.ok) : undefined)}>
              <td>
                {c.policy} ({c.kind}) · {c.sid}
              </td>
              <td>{c.effect}</td>
              <td>{tick(c.principal)}</td>
              <td>{tick(c.action)}</td>
              <td>{tick(c.resource)}</td>
              <td>{tick(c.condition)}</td>
              <td>{c.matches ? 'yes' : 'no'}</td>
            </tr>
          ))}
          {checks.length === 0 && (
            <tr>
              <td colSpan={7}>no policies apply to this identity</td>
            </tr>
          )}
        </tbody>
      </table>
      <div className={styles.verdicts}>
        <div className={styles.verdict} style={hue(d.hue)}>
          <span>model</span>
          <strong>{d.text}</strong>
          <small>{d.why}</small>
        </div>
        <div className={styles.verdict} style={hue(rec ? (rec.allowed ? HUE.ok : HUE.error) : undefined)}>
          <span>recorded on RustFS</span>
          {rec ? (
            <>
              <strong>{rec.allowed ? 'Allowed' : 'Denied (AccessDenied)'}</strong>
              <small>{rec.how}</small>
            </>
          ) : (
            <small>this combination was not recorded</small>
          )}
        </div>
      </div>
    </Demo>
  )
}
