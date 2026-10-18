/*
 * What a crash keeps. Writes arrive over time; each persistence setting decides
 * when a write is in the kernel (written) and when it is on disk (fsync'd).
 * A process crash (kill -9, out of memory) loses what was not yet written to the
 * kernel; a power or kernel failure also loses what was not yet fsync'd.
 *
 * Redis normally writes the AOF buffer to the file before it sends replies, so
 * every acknowledged write is in the kernel — the recorded kill -9 kept all of
 * them. With everysec on a disk that cannot keep up (the previous fsync still
 * running) Redis postpones that write() for up to 2 s while it keeps replying;
 * this model leaves that case out and assumes a disk that keeps up.
 */

export type Setting = 'none' | 'rdb' | 'aof-no' | 'aof-everysec' | 'aof-always'
export type Crash = 'process' | 'power'

export interface DurabilityInput {
  setting: Setting
  crash: Crash
  /** Seconds between RDB snapshots (rdb only). */
  snapshotEvery: number
  /** Seconds the kernel keeps dirty pages before writing them back (aof-no). */
  kernelFlushEvery: number
  /** Writes per second, the crash happens at `crashAt` seconds. */
  writesPerSecond: number
  crashAt: number
}

export interface DurabilityResult {
  acknowledged: number
  survived: number
  /** Seconds of acknowledged writes lost. */
  lostSeconds: number
  /** Up to which second writes survived. */
  safeUntil: number
}

export function survivors(i: DurabilityInput): DurabilityResult {
  const acknowledged = Math.floor(i.writesPerSecond * i.crashAt)
  let safeUntil: number
  switch (i.setting) {
    case 'none':
      safeUntil = 0
      break
    case 'rdb':
      // a snapshot holds the data as of the moment it started (the fork)
      safeUntil = Math.floor(i.crashAt / i.snapshotEvery) * i.snapshotEvery
      break
    case 'aof-always':
      safeUntil = i.crashAt
      break
    case 'aof-everysec':
      // fsync once per second in a background thread: up to ~1 s (worst case 2 s) is only in the kernel
      safeUntil = i.crash === 'process' ? i.crashAt : Math.max(0, Math.floor(i.crashAt) - 1)
      break
    case 'aof-no':
      safeUntil = i.crash === 'process' ? i.crashAt : Math.floor(i.crashAt / i.kernelFlushEvery) * i.kernelFlushEvery
      break
  }
  const survived = Math.min(acknowledged, Math.floor(i.writesPerSecond * safeUntil))
  return { acknowledged, survived, lostSeconds: Math.max(0, i.crashAt - safeUntil), safeUntil }
}
