/**
 * Which pages each scan type touches, and in what order, for one query on a
 * small table: a schematic of the four access paths.
 */
export type ScanType = 'seq' | 'index' | 'indexOnly' | 'bitmap'

export interface PageVisit {
  kind: 'index' | 'heap' | 'vm'
  /** Heap page number, or index level name. */
  page: number | string
}

export const HEAP_PAGES = 20
/** The heap pages holding the matching rows, in the order the index lists them (key order). */
export const MATCHES_IN_KEY_ORDER = [13, 4, 17, 4, 9, 13, 2] as const
/** Pages the visibility map does NOT mark all-visible (changed since the last vacuum). */
export const NOT_ALL_VISIBLE = new Set([9, 17])

export function visits(scan: ScanType): PageVisit[] {
  const tree: PageVisit[] = [
    { kind: 'index', page: 'root' },
    { kind: 'index', page: 'leaf' },
  ]
  switch (scan) {
    case 'seq':
      return Array.from({ length: HEAP_PAGES }, (_, p) => ({ kind: 'heap', page: p }))
    case 'index':
      // one heap visit per matching entry, in key order: pages are revisited and jumped between
      return [...tree, ...MATCHES_IN_KEY_ORDER.map((p) => ({ kind: 'heap' as const, page: p }))]
    case 'bitmap': {
      // collect page numbers first, then read each page once, in physical order
      const pages = [...new Set(MATCHES_IN_KEY_ORDER)].sort((a, b) => a - b)
      return [...tree, ...pages.map((p) => ({ kind: 'heap' as const, page: p }))]
    }
    case 'indexOnly': {
      const out: PageVisit[] = [...tree]
      for (const p of MATCHES_IN_KEY_ORDER) {
        out.push({ kind: 'vm', page: p })
        if (NOT_ALL_VISIBLE.has(p)) out.push({ kind: 'heap', page: p })
      }
      return out
    }
  }
}

export function summarise(v: readonly PageVisit[]) {
  const heap = v.filter((x) => x.kind === 'heap')
  return {
    indexPages: v.filter((x) => x.kind === 'index').length,
    heapVisits: heap.length,
    distinctHeapPages: new Set(heap.map((x) => x.page)).size,
    vmChecks: v.filter((x) => x.kind === 'vm').length,
  }
}
