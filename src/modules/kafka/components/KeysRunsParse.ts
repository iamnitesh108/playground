export interface Run {
  from: number
  to: number
  partition: number
}

/** "records   1- 16 -> partition 3" lines → runs. */
export function parseRuns(out: string): Run[] {
  return [...out.matchAll(/records\s+(\d+)-\s*(\d+) -> partition (\d+)/g)].map((m) => ({ from: Number(m[1]), to: Number(m[2]), partition: Number(m[3]) }))
}
