import { useState } from 'react'
import { hue } from '@/shared/figures'
import { Demo, Segmented } from '@/shared/ui'
import styles from './SchemaDesignFigures.module.css'

export interface TimeRow {
  readIn: string
  written_in: string
  ts: string
  tstz: string
}

/** The same two rows read back under different session time zones (recorded). */
export function SchemaDesignTimeZones({ rows }: { rows: readonly TimeRow[] }) {
  const zones = [...new Set(rows.map((r) => r.readIn))]
  const [zone, setZone] = useState(zones[0])
  const shown = rows.filter((r) => r.readIn === zone)
  return (
    <Demo
      title="Two rows, typed as the same wall-clock time"
      hint="Both rows were inserted with '2026-03-29 09:00' — once by a session in UTC, once by a session in Tokyo. Change the reading session’s time zone."
      controls={<Segmented label="SET TIME ZONE" value={zone} onChange={setZone} options={zones.map((z) => ({ value: z, label: z }))} />}
    >
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>written by a session in</th>
              <th style={hue(4)}>timestamp</th>
              <th style={hue(6)}>timestamptz</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.written_in}>
                <td>{r.written_in}</td>
                <td>{r.ts}</td>
                <td>{r.tstz}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>
        <strong>timestamp</strong> shows 09:00 for both rows in every zone: it stored the digits and forgot which zone they meant, so these two
        events nine hours apart look simultaneous. <strong>timestamptz</strong> stored two different instants (UTC internally) and shows each in
        the reader’s zone, with the offset.
      </p>
    </Demo>
  )
}
