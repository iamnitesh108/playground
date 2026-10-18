import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './RunDiskLayout.module.css'

const MiB = 1024 * 1024
/** RustFS writes data in 1 MiB blocks and stores a 32-byte HighwayHash checksum with every block. */
const BLOCK = MiB
const HASH = 32

interface DiskFile {
  path: string
  bytes: number
}

const fmt = (n: number) => (n >= MiB ? `${(n / MiB).toFixed(n % MiB ? 2 : 0)} MiB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KiB` : `${n} B`)

/**
 * Objects next to the files RustFS made for them on its drive, from a recorded `du -b` and listing:
 * one folder per key, an xl.meta file, and (for larger objects) part files with a checksum per block.
 */
export function RunDiskLayout({ objects, files }: { objects: readonly { key: string; size: number }[]; files: readonly DiskFile[] }) {
  const largest = Math.max(...files.map((f) => f.bytes))
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Recorded: three objects and the files on the drive (bucket catalog, /data/catalog/…)</figcaption>
      <div className={styles.objects}>
        {objects.map((o) => {
          const mine = files.filter((f) => f.path.includes(`/catalog/${o.key}/`))
          const parts = mine.filter((f) => /\/part\.\d+$/.test(f.path))
          const meta = mine.find((f) => f.path.endsWith('xl.meta'))
          const partBytes = parts.reduce((n, p) => n + p.bytes, 0)
          const blocks = parts.reduce((n, p) => n + Math.ceil((p.bytes - HASH) / (BLOCK + HASH)), 0)
          return (
            <section key={o.key} className={styles.object}>
              <div className={styles.head} style={hue(HUE.data)}>
                <code>{o.key}</code>
                <span>{fmt(o.size)} object</span>
              </div>
              <ul className={styles.files}>
                {meta && (
                  <li style={hue(HUE.server)}>
                    <code>xl.meta</code>
                    <span className={styles.bar} style={{ width: `${Math.max(1.5, (meta.bytes / largest) * 100)}%` }} />
                    <span className={styles.size}>{meta.bytes} B</span>
                    <span className={styles.what}>{parts.length ? 'metadata: size, type, ETag, where the parts are' : `metadata, with the ${o.size} bytes of data stored inline`}</span>
                  </li>
                )}
                {parts.map((p) => (
                  <li key={p.path} style={hue(HUE.disk)}>
                    <code>{`…/${p.path.split('/').pop()}`}</code>
                    <span className={styles.bar} style={{ width: `${Math.max(1.5, (p.bytes / largest) * 100)}%` }} />
                    <span className={styles.size}>{p.bytes.toLocaleString()} B</span>
                  </li>
                ))}
              </ul>
              {parts.length > 0 && (
                <p className={styles.note}>
                  {parts.length} part file{parts.length > 1 ? 's' : ''}: {partBytes.toLocaleString()} bytes on disk for {o.size.toLocaleString()} bytes of data. The{' '}
                  {(partBytes - o.size).toLocaleString()} extra bytes are {blocks} {blocks === 1 ? "block" : "blocks"} × {HASH}-byte checksums.
                </p>
              )}
            </section>
          )
        })}
      </div>
    </figure>
  )
}
