/*
 * Asynchronous replication, by the numbers. The primary streams every write to
 * its replicas and keeps the last `backlogBytes` of that stream in a ring buffer.
 * A replica that reconnects asks to continue from its offset: if that offset is
 * still in the backlog it gets a partial resync, otherwise a full one (a new
 * snapshot). On failover, writes the replica had not received are gone.
 */

export interface ReconnectInput {
  backlogBytes: number
  writesPerSecond: number
  bytesPerWrite: number
  disconnectedSeconds: number
}

export function reconnect(i: ReconnectInput): { missedBytes: number; partial: boolean } {
  const missedBytes = Math.round(i.writesPerSecond * i.bytesPerWrite * i.disconnectedSeconds)
  return { missedBytes, partial: missedBytes <= i.backlogBytes }
}

/** Backlog size that covers a disconnection of `seconds`, with a safety factor of 2. */
export function backlogFor(writesPerSecond: number, bytesPerWrite: number, seconds: number): number {
  return Math.ceil(writesPerSecond * bytesPerWrite * seconds * 2)
}

export interface FailoverInput {
  writesPerSecond: number
  /** How far behind the replica is, in ms. */
  replicaLagMs: number
  /** WAIT 1 <timeout> after each write: the client only gets OK once a replica has it. */
  waitForReplica: boolean
}

export function lostOnFailover(i: FailoverInput): number {
  if (i.waitForReplica) return 0
  return Math.round((i.writesPerSecond * i.replicaLagMs) / 1000)
}
