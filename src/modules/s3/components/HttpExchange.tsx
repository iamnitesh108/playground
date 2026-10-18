import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './HttpExchange.module.css'
import { parseWire } from './wire'

const SIGNING = new Set(['authorization', 'x-amz-date', 'x-amz-content-sha256'])
const TAGS: Record<string, string> = { authorization: 'signature', 'x-amz-date': 'signed time', 'x-amz-content-sha256': 'payload hash', etag: 'fingerprint', 'content-type': 'type', 'content-length': 'size' }

function Headers({ lines }: { lines: readonly string[] }) {
  return (
    <dl className={styles.headers}>
      {lines.map((l, i) => {
        const name = l.slice(0, l.indexOf(':'))
        const lower = name.toLowerCase()
        return (
          <div key={i} className={SIGNING.has(lower) ? styles.signing : lower === 'etag' ? styles.etag : undefined}>
            <dt>
              {name}
              {TAGS[lower] && <span className={styles.tag}>{TAGS[lower]}</span>}
            </dt>
            <dd>{l.slice(name.length + 1).trim()}</dd>
          </div>
        )
      })}
    </dl>
  )
}

/** One recorded HTTP exchange: what the client sent, what the server answered. */
export function HttpExchange({ wire, title }: { wire: string; title: string }) {
  const { request, response, body } = parseWire(wire)
  const [method, target] = request[0].split(' ')
  const status = response[0].replace('HTTP/1.1 ', '')
  const ok = /^[23]/.test(status)
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>{title}</figcaption>
      <div className={styles.grid}>
        <section className={styles.side} style={hue(HUE.client)}>
          <div className={styles.label}>request (client → server)</div>
          <div className={styles.line}>
            <span className={styles.chip}>{method}</span> <code>{target}</code>
          </div>
          <Headers lines={request.slice(1)} />
        </section>
        <section className={styles.side} style={hue(ok ? HUE.ok : HUE.error)}>
          <div className={styles.label}>response (server → client)</div>
          <div className={styles.line}>
            <span className={styles.chip}>{status}</span>
          </div>
          <Headers lines={response.slice(1)} />
          {body && (
            <>
              <div className={styles.label}>body</div>
              <pre className={styles.body}>{body}</pre>
            </>
          )}
        </section>
      </div>
    </figure>
  )
}
