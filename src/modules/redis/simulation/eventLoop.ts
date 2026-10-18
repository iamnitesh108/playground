/*
 * One thread runs every command, one at a time, in the order they arrive.
 * Given arriving commands and how long each takes on the server, this works out
 * when each one starts and finishes — and so how long each client waited.
 */

export interface Arrival {
  readonly id: number
  readonly client: string
  readonly command: string
  /** When the command reaches the server (ms). */
  readonly at: number
  /** Time the server spends executing it (ms). */
  readonly cost: number
}

export interface Scheduled extends Arrival {
  readonly start: number
  readonly end: number
  /** end - at: what the client experiences (without network). */
  readonly latency: number
}

export function schedule(arrivals: readonly Arrival[]): Scheduled[] {
  let free = 0
  return [...arrivals]
    .sort((a, b) => a.at - b.at || a.id - b.id)
    .map((a) => {
      const start = Math.max(free, a.at)
      const end = start + a.cost
      free = end
      return { ...a, start, end, latency: end - a.at }
    })
}

/** Fast commands from several clients every `every` ms, plus one slow command at `slowAt`. */
export function workload(clients: readonly string[], every: number, until: number, slow: { command: string; at: number; cost: number } | null, fastCost = 0.05): Arrival[] {
  const out: Arrival[] = []
  let id = 0
  for (let t = 0; t < until; t += every) clients.forEach((c, i) => out.push({ id: id++, client: c, command: 'GET', at: t + (i * every) / clients.length, cost: fastCost }))
  if (slow) out.push({ id: id++, client: 'batch-job', command: slow.command, at: slow.at, cost: slow.cost })
  return out
}
