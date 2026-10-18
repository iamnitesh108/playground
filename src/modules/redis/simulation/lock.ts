/*
 * A lock with a TTL and a worker that may pause for longer than the TTL.
 * Builds the timeline of who holds the lock and what reaches the shared resource,
 * for a plain DEL or a compare-and-delete release, with or without fencing tokens.
 */

export interface LockInput {
  ttl: number
  /** How long A works (including a pause) before writing and releasing. */
  workA: number
  /** When B tries to take the lock, and how long B works. */
  bTriesAt: number
  workB: number
  /** When C tries to take the lock. */
  cTriesAt: number
  safeRelease: boolean
  fencing: boolean
}

export interface LockEvent {
  at: number
  who: 'A' | 'B' | 'C'
  what: string
  outcome: 'ok' | 'denied' | 'danger' | 'info'
}

export interface Hold {
  who: 'A' | 'B' | 'C'
  from: number
  to: number
  token: number
  /** The lock key really belongs to this client (false after it expired). */
  validUntil: number
}

export function lockTimeline(i: LockInput): { events: LockEvent[]; holds: Hold[]; overlap: boolean; staleWriteAccepted: boolean } {
  const events: LockEvent[] = []
  const holds: Hold[] = []
  let owner: { who: 'A' | 'B' | 'C'; expires: number; token: number } | null = null
  let fence = 0
  let lastWrittenToken = 0
  let staleWriteAccepted = false

  const ownerAt = (t: number) => (owner && owner.expires > t ? owner : null)
  const acquire = (who: 'A' | 'B' | 'C', at: number, work: number) => {
    if (ownerAt(at)) {
      events.push({ at, who, what: `SET lock NX PX ${i.ttl} → (nil): held by ${owner!.who}`, outcome: 'denied' })
      return null
    }
    if (owner && owner.expires <= at) events.push({ at: owner.expires, who: owner.who, what: `lock expired after ${i.ttl} ms`, outcome: 'info' })
    fence++
    owner = { who, expires: at + i.ttl, token: fence }
    events.push({ at, who, what: `SET lock NX PX ${i.ttl} → OK${i.fencing ? ` (token ${fence})` : ''}`, outcome: 'ok' })
    const hold: Hold = { who, from: at, to: at + work, token: fence, validUntil: at + i.ttl }
    holds.push(hold)
    return hold
  }
  const finish = (hold: Hold) => {
    const at = hold.to
    // the write to the shared resource
    if (i.fencing && hold.token < lastWrittenToken) {
      events.push({ at, who: hold.who, what: `write with token ${hold.token} → rejected (token ${lastWrittenToken} already wrote)`, outcome: 'denied' })
    } else {
      const stale = ownerAt(at)?.who !== hold.who
      if (stale) staleWriteAccepted = true
      lastWrittenToken = Math.max(lastWrittenToken, hold.token)
      events.push({ at, who: hold.who, what: stale ? 'writes — but no longer holds the lock' : 'writes while holding the lock', outcome: stale ? 'danger' : 'ok' })
    }
    // the release
    const current = ownerAt(at)
    if (!current) {
      events.push({ at, who: hold.who, what: 'release → nothing to delete', outcome: 'info' })
    } else if (current.who === hold.who) {
      owner = null
      events.push({ at, who: hold.who, what: 'release → deleted its own lock', outcome: 'ok' })
    } else if (i.safeRelease) {
      events.push({ at, who: hold.who, what: `compare-and-delete → 0 (the lock is ${current.who}'s)`, outcome: 'ok' })
    } else {
      events.push({ at, who: hold.who, what: `DEL lock → 1: deleted ${current.who}'s lock!`, outcome: 'danger' })
      owner = null
    }
  }

  const a = acquire('A', 0, i.workA)
  const timeline: { at: number; run: () => void }[] = [
    { at: i.bTriesAt, run: () => { const b = acquire('B', i.bTriesAt, i.workB); if (b) timeline.push({ at: b.to, run: () => finish(b) }) } },
    { at: i.cTriesAt, run: () => { const c = acquire('C', i.cTriesAt, i.workB); if (c) timeline.push({ at: c.to, run: () => finish(c) }) } },
  ]
  if (a) timeline.push({ at: a.to, run: () => finish(a) })
  while (timeline.length) {
    timeline.sort((x, y) => x.at - y.at)
    timeline.shift()!.run()
  }
  events.sort((x, y) => x.at - y.at)
  // two clients inside their critical section at the same time
  const overlap = holds.some((h, n) => holds.some((g, m) => m !== n && h.from < g.to && g.from < h.to))
  return { events, holds, overlap, staleWriteAccepted }
}
