import { hue, type Hue } from '@/shared/figures'
import styles from './SecurityProtocolMatrix.module.css'

interface Cell {
  protocol: string
  who: string
  wire: string
  verdict: string
  hue: Hue
}

// rows: how the client proves who it is; columns: whether the bytes are encrypted
const CELLS: readonly (readonly Cell[])[] = [
  [
    { protocol: 'PLAINTEXT', who: 'nobody is checked — every client is User:ANONYMOUS', wire: 'readable on the network', verdict: 'local development only', hue: 8 },
    { protocol: 'SSL', who: 'anonymous, or the client certificate with ssl.client.auth=required (mTLS)', wire: 'encrypted by TLS', verdict: 'good with mTLS', hue: 3 },
  ],
  [
    { protocol: 'SASL_PLAINTEXT', who: 'a user name and password (PLAIN, SCRAM) or a token', wire: 'readable — PLAIN sends the password in clear', verdict: 'trusted networks only', hue: 8 },
    { protocol: 'SASL_SSL', who: 'a user name and password (PLAIN, SCRAM) or a token', wire: 'encrypted by TLS', verdict: 'the usual production choice', hue: 3 },
  ],
]

/** The four security protocols a Kafka listener can speak, as authentication × encryption. */
export function SecurityProtocolMatrix() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>The four listener protocols: who is checked × what the network sees</figcaption>
      <div className={styles.grid}>
        <span />
        <span className={styles.colHead}>no encryption</span>
        <span className={styles.colHead}>TLS encryption</span>
        {CELLS.map((row, r) => (
          <div key={r} className={styles.row}>
            <span className={styles.rowHead}>{r === 0 ? 'no SASL' : 'SASL'}</span>
            {row.map((c) => (
              <div key={c.protocol} className={styles.cell} style={hue(c.hue)}>
                <code className={styles.protocol}>{c.protocol}</code>
                <span><strong>who:</strong> {c.who}</span>
                <span><strong>wire:</strong> {c.wire}</span>
                <span className={styles.verdict}>{c.verdict}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </figure>
  )
}
