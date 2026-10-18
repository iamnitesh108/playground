import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './WhatStorageKinds.module.css'

const TREE = [
  { depth: 0, name: 'shop/', dir: true },
  { depth: 1, name: 'images/', dir: true },
  { depth: 2, name: 'mug-front.jpg', dir: false },
  { depth: 2, name: 'lamp-front.jpg', dir: false },
  { depth: 1, name: 'readme.txt', dir: false },
]
// which numbered blocks a file system happens to use for one file (schematic)
const USED = new Set([2, 3, 4, 9, 10, 17])
const OBJECTS = [
  { key: 'images/mug/front.jpg', meta: 'image/jpeg · 48 KB' },
  { key: 'images/lamp/front.jpg', meta: 'image/jpeg · 39 KB' },
  { key: 'readme.txt', meta: 'text/plain · 28 B' },
]

/** File, block and object storage side by side: what each one addresses and how you change data. */
export function WhatStorageKinds() {
  return (
    <figure className={styles.figure}>
      <figcaption className={styles.title}>Three ways to store bytes (schematic)</figcaption>
      <div className={styles.grid}>
        <section className={styles.panel} style={hue(HUE.client)}>
          <h4>File storage</h4>
          <ul className={styles.tree}>
            {TREE.map((t) => (
              <li key={t.name} style={{ paddingLeft: `${t.depth * 14}px` }}>
                <span className={t.dir ? styles.folder : styles.file} aria-hidden="true" />
                {t.name}
              </li>
            ))}
          </ul>
          <dl className={styles.facts}>
            <dt>you ask for</dt>
            <dd>a path: shop/images/mug-front.jpg</dd>
            <dt>you can</dt>
            <dd>change any byte, append, rename, lock</dd>
            <dt>examples</dt>
            <dd>your laptop’s disk, a shared network drive (NFS, SMB)</dd>
          </dl>
        </section>
        <section className={styles.panel} style={hue(HUE.disk)}>
          <h4>Block storage</h4>
          <div className={styles.blocks} role="img" aria-label="24 numbered blocks, six of them used by one file">
            {Array.from({ length: 24 }, (_, i) => (
              <span key={i} className={USED.has(i) ? styles.used : styles.block}>
                {i}
              </span>
            ))}
          </div>
          <dl className={styles.facts}>
            <dt>you ask for</dt>
            <dd>block number 9 (a few KB)</dd>
            <dt>you can</dt>
            <dd>read or overwrite any block; a file system or database decides what they mean</dd>
            <dt>examples</dt>
            <dd>a disk, a cloud volume under a database or a virtual machine</dd>
          </dl>
        </section>
        <section className={styles.panel} style={hue(HUE.data)}>
          <h4>Object storage</h4>
          <div className={styles.bucket}>
            <span className={styles.bucketName}>bucket: catalog</span>
            {OBJECTS.map((o) => (
              <div key={o.key} className={styles.object}>
                <code>{o.key}</code>
                <span>{o.meta}</span>
              </div>
            ))}
          </div>
          <dl className={styles.facts}>
            <dt>you ask for</dt>
            <dd>a bucket and a key, over HTTP</dd>
            <dt>you can</dt>
            <dd>put a whole object, get it (or a byte range), delete it, list keys</dd>
            <dt>examples</dt>
            <dd>AWS S3, RustFS, MinIO, Ceph, Garage</dd>
          </dl>
        </section>
      </div>
    </figure>
  )
}
