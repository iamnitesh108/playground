import { hue, type Hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './UrlStyles.module.css'

interface Piece {
  text: string
  label: string
  hue?: Hue
}

const STYLES: { name: string; pieces: Piece[]; note: string }[] = [
  {
    name: 'path-style',
    pieces: [
      { text: 'http://', label: 'scheme' },
      { text: 'localhost:9000', label: 'server', hue: HUE.server },
      { text: '/catalog', label: 'bucket', hue: HUE.data },
      { text: '/images/mug/front.jpg', label: 'key', hue: HUE.client },
    ],
    note: 'The bucket is the first part of the path. Works with any host name or IP address; what RustFS answers by default.',
  },
  {
    name: 'virtual-hosted-style',
    pieces: [
      { text: 'http://', label: 'scheme' },
      { text: 'catalog.', label: 'bucket', hue: HUE.data },
      { text: 'localhost:9000', label: 'server', hue: HUE.server },
      { text: '/images/mug/front.jpg', label: 'key', hue: HUE.client },
    ],
    note: 'The bucket is part of the host name, so DNS must resolve catalog.<your domain>. The AWS default; RustFS needs RUSTFS_SERVER_DOMAINS for it.',
  },
]

/** The same object addressed in the two URL styles S3 clients use. */
export function UrlStyles() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>One object, two ways to write its address</figcaption>
      {STYLES.map((s) => (
        <div key={s.name} className={styles.row}>
          <div className={styles.name}>{s.name}</div>
          <div className={styles.url}>
            {s.pieces.map((p, i) => (
              <span key={i} className={p.hue ? styles.piece : styles.plain} style={hue(p.hue)}>
                <code>{p.text}</code>
                <span className={styles.label}>{p.label}</span>
              </span>
            ))}
          </div>
          <p className={styles.note}>{s.note}</p>
        </div>
      ))}
    </figure>
  )
}
