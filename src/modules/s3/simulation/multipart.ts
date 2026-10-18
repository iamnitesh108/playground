/*
 * A model of uploading one file, either in a single PUT or as a multipart upload with several parts in
 * flight, including what one dropped connection costs. Times are estimates from bandwidth and latency;
 * the limits are the S3 rules RustFS enforces.
 */

export const MiB = 1024 * 1024
export const GiB = 1024 * MiB
export const MIN_PART = 5 * MiB
export const MAX_PART = 5 * GiB
export const MAX_PARTS = 10_000
export const MAX_SINGLE_PUT = 5 * GiB

export interface UploadInput {
  fileBytes: number
  partBytes: number
  /** Parts in flight at once. */
  parallel: number
  /** Your total upload bandwidth, MB/s. */
  linkMBps: number
  /** What one connection reaches on its own (latency and TCP limit it), MB/s. */
  perConnMBps: number
  /** Fixed cost per request, ms. */
  requestMs: number
  /** Where in the file (0–1) the connection drops once; 0 = no failure. */
  failAt: number
}

export interface PartRun {
  part: number
  worker: number
  start: number
  end: number
  failed?: boolean
}

export interface UploadResult {
  parts: number
  lastPartBytes: number
  problems: string[]
  multipart: { seconds: number; resentBytes: number; runs: PartRun[] }
  single: { seconds: number; resentBytes: number; allowed: boolean }
}

const MB = 1_000_000

/** Splits a file into parts and checks the S3 rules. */
export function plan(fileBytes: number, partBytes: number) {
  const parts = Math.max(1, Math.ceil(fileBytes / partBytes))
  const lastPartBytes = fileBytes - (parts - 1) * partBytes
  const problems: string[] = []
  if (parts > 1 && partBytes < MIN_PART) problems.push('parts below 5 MiB (except the last) are refused: EntityTooSmall')
  if (partBytes > MAX_PART) problems.push('one part may be at most 5 GiB')
  if (parts > MAX_PARTS) problems.push(`${parts.toLocaleString()} parts: at most 10,000 are allowed — use bigger parts`)
  return { parts, lastPartBytes, problems }
}

export function simulate(input: UploadInput): UploadResult {
  const { fileBytes, partBytes, parallel, linkMBps, perConnMBps, requestMs, failAt } = input
  const { parts, lastPartBytes, problems } = plan(fileBytes, partBytes)
  const inFlight = Math.max(1, Math.min(parallel, parts))
  const rate = Math.min(perConnMBps, linkMBps / inFlight) * MB // bytes per second, per part
  const sizeOf = (p: number) => (p === parts ? lastPartBytes : partBytes)
  const failingPart = failAt > 0 ? Math.min(parts, Math.floor((failAt * fileBytes) / partBytes) + 1) : 0

  // workers take the next part as soon as they are free
  const free = Array.from({ length: inFlight }, () => requestMs / 1000) // the create request first
  const runs: PartRun[] = []
  let resentBytes = 0
  for (let p = 1; p <= parts; p++) {
    const worker = free.indexOf(Math.min(...free))
    let start = free[worker]
    const full = requestMs / 1000 + sizeOf(p) / rate
    if (p === failingPart) {
      // the connection drops half-way through this part; only this part is sent again
      const half = full / 2
      runs.push({ part: p, worker, start, end: start + half, failed: true })
      resentBytes += sizeOf(p) / 2
      start += half
    }
    runs.push({ part: p, worker, start, end: start + full })
    free[worker] = start + full
  }
  const seconds = Math.max(...free) + requestMs / 1000 // the complete request last

  const singleRate = Math.min(perConnMBps, linkMBps) * MB
  const once = requestMs / 1000 + fileBytes / singleRate
  const singleWasted = failAt > 0 ? failAt * fileBytes : 0
  return {
    parts,
    lastPartBytes,
    problems,
    multipart: { seconds, resentBytes, runs },
    single: { seconds: once + (failAt > 0 ? requestMs / 1000 + singleWasted / singleRate : 0), resentBytes: singleWasted, allowed: fileBytes <= MAX_SINGLE_PUT },
  }
}

export function formatBytes(n: number): string {
  if (n >= GiB) return `${(n / GiB).toFixed(n % GiB ? 1 : 0)} GiB`
  if (n >= MiB) return `${(n / MiB).toFixed(n % MiB ? 1 : 0)} MiB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KiB`
  return `${n} B`
}

export function formatSeconds(s: number): string {
  if (s < 1) return `${Math.round(s * 1000)} ms`
  if (s < 120) return `${s.toFixed(1)} s`
  if (s < 7200) return `${(s / 60).toFixed(1)} min`
  return `${(s / 3600).toFixed(1)} h`
}
