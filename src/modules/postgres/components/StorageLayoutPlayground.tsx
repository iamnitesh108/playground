import { useMemo, useState } from 'react'
import { ByteLayout, StatTiles, type ByteField } from '@/shared/figures'
import { Button, Demo, Segmented } from '@/shared/ui'
import { fillPage, layoutTuple, MAX_ALIGN, packColumns, SHORT, TOAST_THRESHOLD, TYPES, type Column, type TypeName } from '../simulation/storageLayout'
import { HeapPageViewMap } from './HeapPageViewMap'
import { StorageSlider } from './StorageSlider'
import styles from './StorageLayoutPlayground.module.css'

const PRESETS: Record<string, Column[]> = {
  padded: [
    { name: 'is_paid', type: 'boolean' },
    { name: 'id', type: 'bigint' },
    { name: 'is_gift', type: 'boolean' },
    { name: 'customer_id', type: 'bigint' },
    { name: 'qty', type: 'smallint' },
    { name: 'total_cents', type: 'integer' },
  ],
  users: [
    { name: 'id', type: 'integer' },
    { name: 'email', type: 'text', bytes: 24 },
    { name: 'created_at', type: 'timestamptz' },
    { name: 'active', type: 'boolean' },
    { name: 'public_id', type: 'uuid' },
    { name: 'score', type: 'double precision' },
  ],
}
const PRESET_OPTIONS = [
  { value: 'padded', label: 'orders' },
  { value: 'users', label: 'users' },
] as const

const TYPE_NAMES = Object.keys(TYPES) as TypeName[]
const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${(n / 1024).toFixed(0)} kB`)

/** Pick column types and order, see the padding, and how many rows fit in a page. */
export function StorageLayoutPlayground() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>('padded')
  const [columns, setColumns] = useState<Column[]>(PRESETS.padded)
  const [textBytes, setTextBytes] = useState(24)
  const [fillfactor, setFillfactor] = useState(100)

  const cols = useMemo(() => columns.map((c) => (TYPES[c.type].len < 0 ? { ...c, bytes: c.type === 'numeric' ? 6 : textBytes } : c)), [columns, textBytes])
  const layout = layoutTuple(cols)
  const packed = layoutTuple(packColumns(cols))
  const page = fillPage(layout.len, fillfactor)
  const rows = 1_000_000
  const pages = Math.ceil(rows / Math.max(1, page.rows))
  const pad = layout.fields.reduce((n, f) => n + f.pad, 0) + (layout.hoff - 23 - layout.bitmap)

  const data: ByteField[] = []
  for (const f of layout.fields) {
    if (f.pad) data.push({ label: 'pad', bytes: f.pad, hue: 8, content: '·' })
    data.push({ label: f.name, bytes: f.size, hue: 3, content: SHORT[f.type] })
  }
  const tail = (Math.ceil(layout.len / MAX_ALIGN) * MAX_ALIGN) - layout.len

  const move = (i: number, d: number) => setColumns((cs) => {
    const next = [...cs]
    const j = i + d
    if (j < 0 || j >= next.length) return cs
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
  })

  return (
    <Demo
      title="Column order, padding and rows per page"
      hint="Every fixed-width value starts at a multiple of its alignment (bigint, timestamptz, double: 8; integer, date: 4; smallint: 2). Reorder the columns and watch the padding — then the page."
      controls={
        <>
          <Segmented label="table" value={preset} options={PRESET_OPTIONS} onChange={(v) => { setPreset(v); setColumns(PRESETS[v]) }} />
          <Button size="sm" variant="primary" onClick={() => setColumns(packColumns(columns))}>Pack: widest first</Button>
          {/* only text columns take their length from the slider (numeric is fixed at 6 bytes here) */}
          {columns.some((c) => c.type === 'text') && <StorageSlider label="text length" value={textBytes} min={1} max={200} format={(v) => `${v} B`} onChange={setTextBytes} />}
          <StorageSlider label="fillfactor" value={fillfactor} min={10} max={100} step={5} format={(v) => `${v} %`} onChange={setFillfactor} />
        </>
      }
    >
      <ol className={styles.columns}>
        {columns.map((c, i) => (
          <li key={c.name}>
            <span className={styles.name}>{c.name}</span>
            <select
              aria-label={`type of ${c.name}`}
              value={c.type}
              onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, type: e.target.value as TypeName } : x)))}
            >
              {TYPE_NAMES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className={styles.meta}>{TYPES[c.type].len > 0 ? `${TYPES[c.type].len} B, align ${TYPES[c.type].align}` : 'variable'}</span>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`move ${c.name} up`}>↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === columns.length - 1} aria-label={`move ${c.name} down`}>↓</button>
          </li>
        ))}
      </ol>
      <ByteLayout
        title={`One row: ${layout.len} bytes (lp_len), ${pad} of them padding`}
        rows={[
          {
            label: `header: t_hoff = ${layout.hoff}`,
            fields: [
              // with long rows the 23 bytes get narrow: keep only the label then
              { label: 'tuple header', bytes: 23, hue: 7, content: layout.len - layout.hoff > 120 ? undefined : 'xmin xmax ctid…' },
              ...(layout.hoff > 23 + layout.bitmap ? [{ label: 'pad', bytes: layout.hoff - 23 - layout.bitmap, hue: 8 as const, content: '·' }] : []),
            ],
          },
          { label: 'data', fields: data },
          ...(tail ? [{ label: `+ ${tail} B to the next multiple of 8 on the page`, fields: [{ label: 'align', bytes: tail, hue: 8 as const, content: '·' }] }] : []),
        ]}
        scale={Math.max(32, layout.len - layout.hoff)}
      />
      <StatTiles
        stats={[
          { label: 'bytes per row on the page', value: layout.onPage, sub: `${Math.ceil(layout.len / 8) * 8} aligned + 4 line pointer`, hue: 3 },
          { label: 'rows per 8 kB page', value: page.rows, sub: fillfactor < 100 ? `${page.reserved} B kept free by fillfactor` : `${page.free} B left over`, hue: 3, bar: { value: page.rows, max: 291 } },
          { label: `table size, ${rows.toLocaleString()} rows`, value: kb(pages * 8192), sub: `${pages.toLocaleString()} pages`, hue: 4 },
          { label: 'packed order would be', value: `${packed.len} B`, sub: packed.len < layout.len ? `${layout.len - packed.len} B less per row` : 'already the smallest', hue: packed.len < layout.len ? 8 : 6 },
        ]}
      />
      {layout.len > TOAST_THRESHOLD && <p className={styles.warn}>Over {TOAST_THRESHOLD} bytes: the row would be compressed or have values moved to TOAST (see below).</p>}
      <HeapPageViewMap
        title={`Page 0 after inserting rows until it is full (fillfactor ${fillfactor})`}
        lower={page.lower}
        upper={page.upper}
        tuples={page.offsets.map((off, i) => ({ lp: i + 1, off, len: layout.len, hoff: layout.hoff }))}
      />
    </Demo>
  )
}
