import { useState } from 'react'
import { BarChart, hue, StatTiles } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import { formatBytes, formatSeconds, GiB, MiB, simulate } from '../simulation/multipart'
import { HUE } from './legend'
import styles from './LargeFilesSimulator.module.css'

const FILES = [100 * MiB, 2 * GiB, 20 * GiB, 200 * GiB]
const PARTS = [1 * MiB, 8 * MiB, 64 * MiB, 512 * MiB]
const PARALLEL = [1, 2, 4, 8, 16]
const LINKS = [10, 100, 1000]
const MAX_DRAWN = 240

/** Plan an upload: size, part size, parallelism and bandwidth in; parts, time and the cost of one failure out. */
export function LargeFilesSimulator() {
  const [file, setFile] = useState(2 * GiB)
  const [part, setPart] = useState(64 * MiB)
  const [parallel, setParallel] = useState(4)
  const [link, setLink] = useState(100)
  const [fail, setFail] = useState(0.6)
  const r = simulate({ fileBytes: file, partBytes: part, parallel, linkMBps: link, perConnMBps: 30, requestMs: 50, failAt: fail })
  const total = r.multipart.seconds
  const drawn = r.multipart.runs.slice(0, MAX_DRAWN)
  const workers = Math.max(...drawn.map((x) => x.worker)) + 1
  return (
    <Demo
      title="Plan a large upload"
      hint="One connection is assumed to reach 30 MB/s on its own and every request costs 50 ms; parallel parts share your bandwidth."
      controls={
        <>
          <Segmented label="file" value={file} options={FILES.map((v) => ({ value: v, label: formatBytes(v) }))} onChange={setFile} />
          <Segmented label="part size" value={part} options={PARTS.map((v) => ({ value: v, label: formatBytes(v) }))} onChange={setPart} />
          <Segmented label="parts in parallel" value={parallel} options={PARALLEL.map((v) => ({ value: v, label: String(v) }))} onChange={setParallel} />
          <Segmented label="bandwidth" value={link} options={LINKS.map((v) => ({ value: v, label: `${v} MB/s` }))} onChange={setLink} />
          <Segmented
            label="connection drops"
            value={fail}
            options={[
              { value: 0, label: 'never' },
              { value: 0.6, label: 'once, at 60 %' },
            ]}
            onChange={setFail}
          />
        </>
      }
    >
      {r.problems.length > 0 && (
        <ul className={styles.problems} style={hue(HUE.error)}>
          {r.problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <StatTiles
        stats={[
          { label: 'parts', value: r.parts.toLocaleString(), sub: r.parts > 1 ? `${formatBytes(part)} each, last ${formatBytes(r.lastPartBytes)}` : 'one part', hue: HUE.data, bar: { value: r.parts, max: 10_000 } },
          { label: 'multipart upload', value: formatSeconds(r.multipart.seconds), sub: `${Math.min(parallel, r.parts)} in flight`, hue: HUE.client },
          { label: 'single PUT', value: r.single.allowed ? formatSeconds(r.single.seconds) : 'not allowed', sub: r.single.allowed ? 'one connection' : 'over 5 GiB: must be multipart', hue: r.single.allowed ? HUE.network : HUE.error },
          { label: 'sent again after the drop', value: fail ? formatBytes(r.multipart.resentBytes) : '—', sub: fail ? `single PUT: ${formatBytes(r.single.resentBytes)}` : 'no failure', hue: HUE.error },
        ]}
      />
      <BarChart
        title="Time to upload (model)"
        bars={[
          { label: `multipart, ${Math.min(parallel, r.parts)} parallel`, value: r.multipart.seconds, display: formatSeconds(r.multipart.seconds), hue: HUE.client },
          { label: 'single PUT', value: r.single.allowed ? r.single.seconds : 0, display: r.single.allowed ? formatSeconds(r.single.seconds) : 'not allowed', hue: HUE.network },
        ]}
      />
      <figure className={styles.lanes}>
        <figcaption>
          Parts over time, one row per connection{r.multipart.runs.length > MAX_DRAWN ? ` (first ${MAX_DRAWN} of ${r.multipart.runs.length.toLocaleString()} shown)` : ''}; a striped block is a part cut off by the drop
        </figcaption>
        {Array.from({ length: workers }, (_, w) => (
          <div key={w} className={styles.lane}>
            <span className={styles.laneLabel}>conn {w + 1}</span>
            <span className={styles.track}>
              {drawn
                .filter((x) => x.worker === w)
                .map((x, i) => (
                  <span
                    key={i}
                    className={x.failed ? styles.failed : styles.part}
                    style={{ ...hue(x.failed ? HUE.error : HUE.data), left: `${(x.start / total) * 100}%`, width: `${Math.max(0.3, ((x.end - x.start) / total) * 100)}%` }}
                    title={`part ${x.part}${x.failed ? ' (failed)' : ''}: ${formatSeconds(x.start)}–${formatSeconds(x.end)}`}
                  />
                ))}
            </span>
          </div>
        ))}
        <div className={styles.axis}>
          <span>0 s</span>
          <span>{formatSeconds(total)}</span>
        </div>
      </figure>
    </Demo>
  )
}
