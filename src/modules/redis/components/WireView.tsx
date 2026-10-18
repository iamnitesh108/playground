import styles from './WireView.module.css'

interface WireViewProps {
  rows: readonly { readonly cmd: string; readonly sent: string; readonly received: string }[]
}

/** Shows the exact bytes; \r\n is drawn as a token so the framing is visible. */
function Bytes({ text }: { text: string }) {
  const parts = text.split('\\r\\n').filter((_, i, a) => i < a.length - 1 || a[i] !== '')
  return (
    <span className={styles.bytes}>
      {parts.map((p, i) => (
        <span key={i}>
          <span className={/^[*$:+-]/.test(p) ? styles.head : undefined}>{p}</span>
          <span className={styles.crlf}>\r\n</span>
        </span>
      ))}
    </span>
  )
}

export function WireView({ rows }: WireViewProps) {
  return (
    <div className={styles.wire}>
      {rows.map((r) => (
        <div key={r.cmd} className={styles.row}>
          <div className={styles.cmd}>{r.cmd}</div>
          <div className={styles.dir}>client → server</div>
          <Bytes text={r.sent} />
          <div className={styles.dir}>server → client</div>
          <Bytes text={r.received} />
        </div>
      ))}
    </div>
  )
}
