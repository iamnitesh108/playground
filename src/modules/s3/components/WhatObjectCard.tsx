import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './WhatObjectCard.module.css'

interface Head {
  readonly ContentLength: number
  readonly ContentType: string
  readonly ETag: string
  readonly LastModified: string
  readonly Metadata: Readonly<Record<string, string>>
}

/** One recorded object taken apart: its key, the metadata the server keeps, your own metadata, and the bytes. */
export function WhatObjectCard({ bucket, objectKey, head }: { bucket: string; objectKey: string; head: Head }) {
  const system = [
    ['Content-Type', head.ContentType],
    ['Content-Length', `${head.ContentLength.toLocaleString()} bytes`],
    ['ETag', head.ETag.replace(/"/g, '')],
    ['Last-Modified', head.LastModified],
  ]
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Recorded: one object in bucket “{bucket}”, taken apart</figcaption>
      <div className={styles.card}>
        <div className={styles.part} style={hue(HUE.data)}>
          <span className={styles.tag}>key (its full name)</span>
          <code className={styles.key}>{objectKey}</code>
        </div>
        <div className={styles.part} style={hue(HUE.server)}>
          <span className={styles.tag}>system metadata (the server keeps it)</span>
          <dl className={styles.pairs}>
            {system.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.part} style={hue(HUE.client)}>
          <span className={styles.tag}>user metadata (you chose it, sent as x-amz-meta-*)</span>
          <dl className={styles.pairs}>
            {Object.entries(head.Metadata).map(([k, v]) => (
              <div key={k}>
                <dt>x-amz-meta-{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className={styles.part} style={hue(HUE.data)}>
          <span className={styles.tag}>data (the bytes, stored and returned whole)</span>
          <div className={styles.bytes} aria-hidden="true">
            {Array.from({ length: 48 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <span className={styles.size}>{head.ContentLength.toLocaleString()} bytes of JPEG image</span>
        </div>
      </div>
    </figure>
  )
}
