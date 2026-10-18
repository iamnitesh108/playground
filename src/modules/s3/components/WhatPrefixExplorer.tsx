import { useState } from 'react'
import { Demo, Segmented, TextField } from '@/shared/ui'
import { hue } from '@/shared/figures'
import { listObjects } from '../simulation/listing'
import { HUE } from './legend'
import styles from './WhatPrefixExplorer.module.css'

interface Recorded {
  prefix: string
  delimiter: string
  folders: readonly string[] | null
  objects: readonly string[] | null
}

/** Lists a recorded set of keys with any prefix and delimiter, by the same rule the server uses. */
export function WhatPrefixExplorer({ bucket, keys, recorded }: { bucket: string; keys: readonly string[]; recorded: readonly Recorded[] }) {
  const [prefix, setPrefix] = useState('')
  const [delimiter, setDelimiter] = useState<'/' | ''>('/')
  const result = listObjects(keys, prefix, delimiter)
  const match = recorded.find((r) => r.prefix === prefix && r.delimiter === delimiter)
  const same =
    match &&
    JSON.stringify(match.folders ?? []) === JSON.stringify(result.commonPrefixes) &&
    JSON.stringify(match.objects ?? []) === JSON.stringify(result.contents)
  const crumbs = prefix.split('/').slice(0, -1)
  const query = `list-type=2${prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''}${delimiter ? `&delimiter=${encodeURIComponent(delimiter)}` : ''}`
  return (
    <Demo
      title="List a bucket like the server does"
      hint="Click a folder to go into it, or type any prefix. Turn the delimiter off to see the flat list the bucket really holds."
      controls={
        <>
          <TextField label="prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} spellCheck={false} />
          <Segmented
            label="delimiter"
            value={delimiter}
            options={[
              { value: '/', label: '“/” (folders)' },
              { value: '', label: 'none (flat)' },
            ]}
            onChange={setDelimiter}
          />
        </>
      }
    >
      <div className={styles.crumbs}>
        <button type="button" onClick={() => setPrefix('')} disabled={prefix === ''}>
          {bucket}
        </button>
        {crumbs.map((c, i) => (
          <span key={i}>
            {' / '}
            <button type="button" onClick={() => setPrefix(`${crumbs.slice(0, i + 1).join('/')}/`)}>
              {c}
            </button>
          </span>
        ))}
      </div>
      <code className={styles.request}>
        GET /{bucket}?{query}
      </code>
      <div className={styles.columns}>
        <div style={hue(HUE.server)}>
          <div className={styles.head}>CommonPrefixes (“folders”) · {result.commonPrefixes.length}</div>
          {result.commonPrefixes.length === 0 && <div className={styles.empty}>none</div>}
          {result.commonPrefixes.map((p) => (
            <button key={p} type="button" className={styles.folder} onClick={() => setPrefix(p)}>
              {p}
            </button>
          ))}
        </div>
        <div style={hue(HUE.data)}>
          <div className={styles.head}>Contents (objects) · {result.contents.length}</div>
          {result.contents.length === 0 && <div className={styles.empty}>none</div>}
          {result.contents.map((k) => (
            <div key={k} className={styles.object}>
              {k}
            </div>
          ))}
        </div>
      </div>
      <p className={styles.check} style={hue(same ? HUE.ok : HUE.network)}>
        {match ? (same ? 'Same answer as the recorded server listing for this prefix.' : 'Differs from the recording.') : 'Computed in your browser (this combination was not recorded).'}
      </p>
    </Demo>
  )
}
