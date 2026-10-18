/*
 * How PostgreSQL lays out one heap tuple and fills an 8 kB page.
 * Checked against real lp_len values recorded with pageinspect (see the Storage lesson).
 */

export const PAGE_SIZE = 8192
export const PAGE_HEADER = 24
export const LINE_POINTER = 4
export const TUPLE_HEADER = 23
export const MAX_ALIGN = 8
/** A tuple larger than this is compressed and/or moved to TOAST (BLCKSZ / 4, minus overhead). */
export const TOAST_THRESHOLD = 2032
/** MaxHeapTuplesPerPage for 8 kB pages. */
export const MAX_TUPLES_PER_PAGE = 291

export type TypeName = 'boolean' | 'smallint' | 'integer' | 'bigint' | 'real' | 'double precision' | 'date' | 'timestamptz' | 'uuid' | 'text' | 'numeric'

interface TypeInfo {
  /** Fixed length in bytes, or -1 for variable length (varlena). */
  len: number
  align: 1 | 2 | 4 | 8
}

export const TYPES: Record<TypeName, TypeInfo> = {
  boolean: { len: 1, align: 1 },
  smallint: { len: 2, align: 2 },
  integer: { len: 4, align: 4 },
  bigint: { len: 8, align: 8 },
  real: { len: 4, align: 4 },
  'double precision': { len: 8, align: 8 },
  date: { len: 4, align: 4 },
  timestamptz: { len: 8, align: 8 },
  uuid: { len: 16, align: 1 },
  text: { len: -1, align: 4 },
  numeric: { len: -1, align: 4 },
}

export interface Column {
  name: string
  type: TypeName
  /** For text / numeric: bytes of the value itself (without the length header). */
  bytes?: number
  isNull?: boolean
}

export interface Field {
  name: string
  type: TypeName
  offset: number
  /** Padding inserted before this field to align it. */
  pad: number
  size: number
}

export interface TupleLayout {
  /** Header size incl. null bitmap, rounded up to 8: t_hoff. */
  hoff: number
  bitmap: number
  fields: Field[]
  /** Bytes of the tuple: lp_len. */
  len: number
  /** Bytes it takes on a page: aligned length plus its line pointer. */
  onPage: number
}

export const alignUp = (n: number, a: number) => Math.ceil(n / a) * a

/** Stored size of a variable-length value: short (1-byte) header up to 126 bytes, else 4-byte header. */
const varlenaSize = (bytes: number) => (bytes + 1 <= 127 ? bytes + 1 : bytes + 4)

/** Lays out one tuple the way heap_fill_tuple does. */
export function layoutTuple(columns: readonly Column[]): TupleLayout {
  const hasNull = columns.some((c) => c.isNull)
  const bitmap = hasNull ? Math.ceil(columns.length / 8) : 0
  const hoff = alignUp(TUPLE_HEADER + bitmap, MAX_ALIGN)
  let at = hoff
  const fields: Field[] = []
  for (const c of columns) {
    if (c.isNull) continue // a NULL takes no space at all, only its bit
    const t = TYPES[c.type]
    let size: number
    let start: number
    if (t.len > 0) {
      start = alignUp(at, t.align)
      size = t.len
    } else {
      size = varlenaSize(c.bytes ?? 4)
      // short varlenas are stored unaligned; long ones are aligned like int
      start = size <= 127 ? at : alignUp(at, t.align)
    }
    fields.push({ name: c.name, type: c.type, offset: start, pad: start - at, size })
    at = start + size
  }
  return { hoff, bitmap, fields, len: at, onPage: alignUp(at, MAX_ALIGN) + LINE_POINTER }
}

/** Columns sorted the way that wastes least padding: widest alignment first, variable-length last. */
export function packColumns(columns: readonly Column[]): Column[] {
  const rank = (c: Column) => {
    const t = TYPES[c.type]
    return t.len < 0 ? 0 : t.align * 100 + t.len
  }
  return [...columns].sort((a, b) => rank(b) - rank(a))
}

export interface PageFill {
  rows: number
  /** Bytes between the line pointers and the tuples after the last insert. */
  free: number
  lower: number
  upper: number
  /** Free space kept back by fillfactor. */
  reserved: number
  /** Tuple offsets (lp_off) in insertion order. */
  offsets: number[]
}

/** How many tuples of `len` bytes one INSERT-filled page takes, given a fillfactor (10–100). */
export function fillPage(len: number, fillfactor = 100, limit = Infinity): PageFill {
  const reserved = Math.floor((PAGE_SIZE * (100 - fillfactor)) / 100)
  const aligned = alignUp(len, MAX_ALIGN)
  let lower = PAGE_HEADER
  let upper = PAGE_SIZE
  const offsets: number[] = []
  // RelationGetBufferForTuple: the page must keep `reserved` free after the new tuple and its pointer
  while (offsets.length < Math.min(limit, MAX_TUPLES_PER_PAGE) && upper - lower - LINE_POINTER >= aligned + reserved) {
    upper -= aligned
    lower += LINE_POINTER
    offsets.push(upper)
  }
  return { rows: offsets.length, free: upper - lower, lower, upper, reserved, offsets }
}

/** The internal short names (pg_type.typname) — compact labels for figures. */
export const SHORT: Record<TypeName, string> = {
  boolean: 'bool',
  smallint: 'int2',
  integer: 'int4',
  bigint: 'int8',
  real: 'float4',
  'double precision': 'float8',
  date: 'date',
  timestamptz: 'tstz',
  uuid: 'uuid',
  text: 'text',
  numeric: 'num',
}
