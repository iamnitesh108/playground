import { useEffect, useState } from 'react'
import { hue } from '@/shared/figures'
import { Button, Demo, Segmented, TextField } from '@/shared/ui'
import { buildCanonical, parseCanonical, signSteps, type SigningSteps } from '../simulation/sigv4'
import { HUE } from './legend'
import styles from './RequestsSigner.module.css'

interface Recorded {
  canonicalRequest: string
  stringToSign: string
  signature: string
  amzDate: string
  region: string
  service: string
  secretKey: string
  accessKey: string
  status: number
}

type Change = 'none' | 'path' | 'date'

const STEPS = ['The request', 'Canonical request', 'Hash it', 'String to sign', 'Signing key', 'Signature']

const nextSecond = (amz: string) => {
  const d = new Date(`${amz.slice(0, 4)}-${amz.slice(4, 6)}-${amz.slice(6, 8)}T${amz.slice(9, 11)}:${amz.slice(11, 13)}:${amz.slice(13, 15)}Z`)
  return new Date(d.getTime() + 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Recomputes the signature of a recorded request in the browser, step by step, and compares it with what was sent. */
export function RequestsSigner({ recorded }: { recorded: Recorded }) {
  const [step, setStep] = useState(0)
  const [secret, setSecret] = useState(recorded.secretKey)
  const [change, setChange] = useState<Change>('none')
  const [result, setResult] = useState<SigningSteps | null>(null)

  const parts = parseCanonical(recorded.canonicalRequest)
  const amzDate = change === 'date' ? nextSecond(recorded.amzDate) : recorded.amzDate
  if (change === 'path') parts.path = parts.path.replace('readme.txt', 'secret.txt')
  parts.headers = parts.headers.map(([n, v]) => [n, n === 'x-amz-date' ? amzDate : v])
  const canonical = buildCanonical(parts)

  useEffect(() => {
    let live = true
    signSteps({ canonicalRequest: canonical, amzDate, region: recorded.region, service: recorded.service, secretKey: secret }).then((r) => live && setResult(r))
    return () => {
      live = false
    }
  }, [canonical, amzDate, secret, recorded.region, recorded.service])

  const same = result?.signature === recorded.signature
  const labels = ['method', 'path', 'query', ...parts.headers.map(() => 'header'), '', 'signed headers', 'payload hash']

  return (
    <Demo
      title="Sign a recorded request yourself"
      hint="Your browser recomputes, with Web Crypto, the signature the aws CLI sent for GET /catalog/readme.txt. Change the secret, the path or the time and watch it break."
      controls={
        <>
          <TextField label="secret key" value={secret} onChange={(e) => setSecret(e.target.value)} spellCheck={false} />
          <Segmented
            label="the request"
            value={change}
            options={[
              { value: 'none', label: 'as recorded' },
              { value: 'path', label: 'key changed' },
              { value: 'date', label: '1 s later' },
            ]}
            onChange={setChange}
          />
        </>
      }
    >
      <ol className={styles.progress}>
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? styles.current : i < step ? styles.done : undefined}>
            <button type="button" onClick={() => setStep(i)} disabled={i === step}>
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.stage} aria-live="polite">
        {step === 0 && (
          <>
            <p>
              A <code>{parts.method}</code> of <code>{parts.path}</code> with these headers. Only the headers named in <code>SignedHeaders</code>{' '}
              are signed; anything else (User-Agent, for one) can change on the way without breaking the signature.
            </p>
            <table className={styles.table}>
              <tbody>
                {parts.headers.map(([n, v]) => (
                  <tr key={n}>
                    <th>{n}</th>
                    <td>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <code>x-amz-content-sha256</code> is the SHA-256 of the body; a GET has no body, so it is the hash of nothing (<code>e3b0…b855</code>).
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p>The request is written in one exact, agreed form — one item per line — so both sides hash the very same text:</p>
            <div className={styles.canonical}>
              {canonical.split('\n').map((l, i) => (
                <div key={i}>
                  <span className={styles.lineLabel}>{labels[i]}</span>
                  <code>{l || '(empty line)'}</code>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <p>SHA-256 turns the whole canonical request into 64 hex characters. Change one character anywhere and this changes completely.</p>
            <div className={styles.result} style={hue(HUE.network)}>
              <span>SHA-256(canonical request)</span>
              <code>{result?.canonicalHash ?? '…'}</code>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <p>The string to sign adds what the signature is for: the algorithm, the time, and the scope (day / region / service).</p>
            <div className={styles.canonical}>
              {(result?.stringToSign ?? '').split('\n').map((l, i) => (
                <div key={i}>
                  <span className={styles.lineLabel}>{['algorithm', 'time', 'scope', 'request hash'][i]}</span>
                  <code>{l}</code>
                </div>
              ))}
            </div>
          </>
        )}
        {step === 4 && (
          <>
            <p>
              The secret key is never sent. Instead it is turned into a <strong>signing key</strong> that only works for this day, region and
              service — four HMAC-SHA256 steps:
            </p>
            <ol className={styles.chain}>
              <li style={hue(HUE.identity)}>
                <span>
                  start: <code>"AWS4" + secret key</code>
                </span>
              </li>
              {(
                [
                  ['date', amzDate.slice(0, 8), result?.kDate],
                  ['region', recorded.region, result?.kRegion],
                  ['service', recorded.service, result?.kService],
                  ['terminator', 'aws4_request', result?.kSigning],
                ] as const
              ).map(([what, value, key]) => (
                <li key={what} style={hue(HUE.network)}>
                  <span>
                    HMAC with the {what} <code>{value}</code>
                  </span>
                  <code className={styles.hex}>{key ?? '…'}</code>
                </li>
              ))}
            </ol>
          </>
        )}
        {step === 5 && (
          <>
            <p>Finally: HMAC-SHA256(signing key, string to sign). This hex string goes into the Authorization header.</p>
            <div className={styles.result} style={hue(same ? HUE.ok : HUE.error)}>
              <span>computed in your browser</span>
              <code>{result?.signature ?? '…'}</code>
              <span>recorded, sent by the aws CLI (server answered HTTP {recorded.status})</span>
              <code>{recorded.signature}</code>
              <strong>{same ? 'Identical: the server computes the same value from its copy of the key, so the request is accepted.' : 'Different: the server would refuse the request with 403 SignatureDoesNotMatch (recorded below).'}</strong>
            </div>
            <code className={styles.auth}>
              Authorization: AWS4-HMAC-SHA256 Credential={recorded.accessKey}/{result?.scope ?? '…'}, SignedHeaders={parts.signedHeaders}, Signature=
              {result?.signature ?? '…'}
            </code>
          </>
        )}
      </div>
      <div className={styles.buttons}>
        <Button size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          Back
        </Button>
        <Button size="sm" variant="primary" onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))} disabled={step === STEPS.length - 1}>
          Next
        </Button>
      </div>
    </Demo>
  )
}
