/*
 * Streaming replication with synchronous_commit, as a pure model.
 *
 * The primary generates WAL while clients commit. The walsender ships flushed WAL to the
 * standby (limited by bandwidth), the standby flushes it, and the startup process replays it
 * (limited by its replay speed). A synchronous standby makes commits wait for an
 * acknowledgement: written (remote_write), flushed (on) or replayed (remote_apply).
 * Simplified: one standby, constant write load, 100 ms steps, latencies added, no network jitter.
 */

export type SyncLevel = 'off' | 'local' | 'remote_write' | 'on' | 'remote_apply'

export interface LagParams {
  level: SyncLevel
  /** synchronous_standby_names lists the standby. Without it every level above local acts like local. */
  syncStandby: boolean
  /** Network round trip between primary and standby, ms. */
  rttMs: number
  /** WAL the clients want to write, MB/s. */
  writeMBps: number
  /** How fast the standby can replay, MB/s. */
  replayMBps: number
  /** The standby is unreachable between these seconds (null: always up). */
  outage: { from: number; to: number } | null
  /** fsync time on each server, ms. */
  flushMs: number
  /** Seconds simulated. */
  duration: number
}

export interface LagSample {
  t: number
  /** MB of WAL written on the primary, received + flushed by the standby, replayed by it. */
  primary: number
  flushed: number
  replayed: number
  /** True while commits are waiting for the standby. */
  blocked: boolean
}

export interface LagResult {
  samples: LagSample[]
  /** Time one COMMIT takes, ms (Infinity while blocked). */
  commitMs: number
  /** The most MB committed on the primary but not yet flushed by the standby, at any moment: lost by a failover then. */
  unflushedMB: number
  /** When that was, s. */
  unflushedAt: number
  /** Seconds a read on the standby is behind the primary. */
  replayLagS: number
  /** Seconds in which commits could not finish. */
  blockedS: number
  /** What this setting risks, in one sentence. */
  risk: string
}

const NETWORK_MBPS = 120
const STEP = 0.1

/** Which acknowledgement a commit waits for. */
export function waitsFor(level: SyncLevel, syncStandby: boolean): 'nothing' | 'local flush' | 'standby write' | 'standby flush' | 'standby replay' {
  if (level === 'off') return 'nothing'
  if (!syncStandby || level === 'local') return 'local flush'
  return level === 'remote_write' ? 'standby write' : level === 'on' ? 'standby flush' : 'standby replay'
}

const RISK: Record<ReturnType<typeof waitsFor>, string> = {
  nothing:
    'A crash of the primary can lose the last few hundred milliseconds of acknowledged commits (up to 3 × wal_writer_delay). The database stays consistent; those transactions are simply gone.',
  'local flush':
    'Nothing acknowledged is lost if the primary restarts. If the primary is destroyed and you fail over, every commit the standby had not received yet is lost.',
  'standby write':
    'Survives losing the primary: the standby has the WAL in its operating system. Lost only if both servers fail together, before the standby flushed.',
  'standby flush':
    'Every acknowledged commit is on disk on two servers. Reads on the standby can still be behind by the replay lag.',
  'standby replay':
    'Every acknowledged commit is on disk on two servers and already visible to queries on the standby — at the price of waiting for replay.',
}

export function simulateLag(p: LagParams): LagResult {
  const wait = waitsFor(p.level, p.syncStandby)
  const remote = wait === 'standby write' || wait === 'standby flush' || wait === 'standby replay'
  let primary = 0, sent = 0, replayed = 0, blockedS = 0
  const samples: LagSample[] = []
  for (let t = 0; t <= p.duration + 1e-9; t += STEP) {
    const down = !!p.outage && t >= p.outage.from && t < p.outage.to
    // a synchronous commit cannot finish while the standby is gone: clients stop producing WAL
    const blocked = remote && down
    if (blocked) blockedS += STEP
    let produce = blocked ? 0 : p.writeMBps * STEP
    // remote_apply: commits finish only as fast as the standby replays
    if (wait === 'standby replay' && !down) produce = Math.min(produce, Math.max(0, replayed + p.replayMBps * STEP - primary + 0.05))
    primary += produce
    if (!down) {
      sent += Math.min(primary - sent, NETWORK_MBPS * STEP)
      replayed += Math.min(sent - replayed, p.replayMBps * STEP)
    }
    samples.push({ t: Math.round(t * 10) / 10, primary, flushed: sent, replayed, blocked })
  }
  const last = samples[samples.length - 1]
  const worst = samples.reduce((a, x) => (x.primary - x.flushed > a.primary - a.flushed ? x : a))
  // how long ago the primary was where the standby's replay is now (steady write rate)
  const replayLagS = (last.primary - last.replayed) / Math.max(0.001, p.writeMBps)
  const local = wait === 'nothing' ? 0.05 : p.flushMs
  const commitMs = last.blocked
    ? Infinity
    : wait === 'nothing' || wait === 'local flush'
      ? local
      : wait === 'standby write'
        ? local + p.rttMs
        : wait === 'standby flush'
          ? local + p.rttMs + p.flushMs
          : local + p.rttMs + p.flushMs + ((last.flushed - last.replayed) / Math.max(0.001, p.replayMBps)) * 1000
  return { samples, commitMs, unflushedMB: worst.primary - worst.flushed, unflushedAt: worst.t, replayLagS, blockedS: Math.round(blockedS * 10) / 10, risk: RISK[wait] }
}
