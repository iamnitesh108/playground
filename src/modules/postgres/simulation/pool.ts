import { Observable } from '@/shared/utils/observable'

/*
 * A connection pooler in front of PostgreSQL, reduced to what decides waiting:
 * N clients each loop "think, then run one transaction"; the pooler owns
 * `size` server connections and lends them out according to its mode.
 * Time advances in ticks.
 */

/** When the pooler takes a server connection back from a client. */
export interface PoolMode {
  readonly id: 'session' | 'transaction'
  readonly label: string
  /** True: returned after every transaction. False: kept until the client disconnects. */
  readonly releaseAfterTransaction: boolean
}

export const SESSION_MODE: PoolMode = { id: 'session', label: 'session', releaseAfterTransaction: false }
export const TRANSACTION_MODE: PoolMode = { id: 'transaction', label: 'transaction', releaseAfterTransaction: true }

export type ClientPhase = 'thinking' | 'waiting' | 'running'

export interface PoolClient {
  id: number
  phase: ClientPhase
  /** Ticks left in the current phase (thinking or running). */
  left: number
  server: number | null
  done: number
  waitedTicks: number
}

export interface PoolOptions {
  clients: number
  size: number
  mode: PoolMode
  /** Ticks a client spends in application code between transactions. */
  thinkTicks: number
  /** Ticks one transaction holds a server connection. */
  runTicks: number
}

export class PoolSimulator extends Observable {
  clients: PoolClient[] = []
  /** servers[i] = id of the client using server connection i, or null. */
  servers: (number | null)[] = []
  queue: number[] = []
  tick = 0
  options: PoolOptions
  private readonly handedOver = new Set<number>()

  constructor(options: PoolOptions) {
    super()
    this.options = options
    this.reset()
  }

  configure(change: Partial<PoolOptions>): void {
    this.options = { ...this.options, ...change }
    this.reset()
  }

  reset(): void {
    const { clients, size, thinkTicks } = this.options
    // Stagger start times so clients do not all ask at once.
    this.clients = Array.from({ length: clients }, (_, i) => ({ id: i + 1, phase: 'thinking', left: 1 + (i % thinkTicks), server: null, done: 0, waitedTicks: 0 }))
    this.servers = Array.from({ length: size }, () => null)
    this.queue = []
    this.tick = 0
    this.notify()
  }

  get completed(): number {
    return this.clients.reduce((sum, c) => sum + c.done, 0)
  }

  get waiting(): number {
    return this.queue.length
  }

  /** Server connections lent to a client, busy or not. */
  get assigned(): number {
    return this.servers.filter((s) => s !== null).length
  }

  /** Server connections running a transaction right now. */
  get busy(): number {
    return this.clients.filter((c) => c.phase === 'running').length
  }

  step(): void {
    this.tick++
    this.handedOver.clear()
    for (const client of this.clients) {
      if (client.phase === 'waiting') client.waitedTicks++
      // A client that got a connection from the queue this tick starts counting next tick.
      if (client.phase === 'waiting' || this.handedOver.has(client.id) || --client.left > 0) continue
      if (client.phase === 'running') this.finish(client)
      else this.request(client)
    }
    this.notify()
  }

  private request(client: PoolClient): void {
    if (client.server !== null) return this.run(client)
    const free = this.servers.indexOf(null)
    if (free === -1) {
      client.phase = 'waiting'
      this.queue.push(client.id)
      return
    }
    this.assign(client, free)
  }

  private finish(client: PoolClient): void {
    client.done++
    client.phase = 'thinking'
    client.left = this.options.thinkTicks
    if (!this.options.mode.releaseAfterTransaction || client.server === null) return
    const server = client.server
    client.server = null
    this.servers[server] = null
    const next = this.queue.shift()
    if (next === undefined) return
    this.handedOver.add(next)
    this.assign(this.clients[next - 1], server)
  }

  private assign(client: PoolClient, server: number): void {
    this.servers[server] = client.id
    client.server = server
    this.run(client)
  }

  private run(client: PoolClient): void {
    client.phase = 'running'
    client.left = this.options.runTicks
  }
}

/*
 * Pool sizing. A transaction needs `cpuMs` of CPU and spends `waitMs` waiting (disk, network,
 * locks) while its CPU core is free for others. N connections running at once can at best
 * finish N / (cpuMs + waitMs) transactions per ms — until the cores are saturated at
 * cores / cpuMs. Past that point extra connections only queue inside the database and add
 * contention (context switches, lock and buffer contention), which costs a little throughput
 * for every connection over the saturation point.
 */
export interface SizingModel {
  readonly cores: number
  readonly cpuMs: number
  readonly waitMs: number
  /** Throughput lost per connection beyond saturation (0.01 = 1 %). */
  readonly contention: number
}

export interface SizingPoint {
  readonly connections: number
  /** Transactions per second. */
  readonly tps: number
  /** Time inside PostgreSQL for one transaction (ms). */
  readonly dbMs: number
}

/** Concurrent transactions at which the cores become saturated. */
export const saturationPoint = (m: SizingModel): number => (m.cores * (m.cpuMs + m.waitMs)) / m.cpuMs

export function sizingPoint(m: SizingModel, connections: number): SizingPoint {
  const n = Math.max(1, connections)
  const ideal = Math.min(n / (m.cpuMs + m.waitMs), m.cores / m.cpuMs) * 1000
  const over = Math.max(0, n - saturationPoint(m))
  const tps = ideal / (1 + m.contention * over)
  return { connections: n, tps: Math.round(tps), dbMs: (n / tps) * 1000 }
}

/**
 * Clients sharing a pool: with more clients than connections, the rest wait in the pool's queue.
 * Every client runs one transaction after another (no think time), so by Little's law the time a
 * client waits for a whole round is clients / throughput.
 */
export function clientLatencyMs(m: SizingModel, poolSize: number, clients: number): { waitMs: number; dbMs: number } {
  const p = sizingPoint(m, Math.min(poolSize, clients))
  const total = (clients / p.tps) * 1000
  return { waitMs: Math.max(0, total - p.dbMs), dbMs: p.dbMs }
}

/** The PostgreSQL wiki's starting point: connections = cores × 2 + effective spindle count. */
export const wikiFormula = (cores: number, spindles: number): number => cores * 2 + spindles

export interface ConnectionBudget {
  readonly apps: number
  readonly bouncer: number
  readonly other: number
  readonly reserved: number
  readonly maxConnections: number
  readonly free: number
  readonly fits: boolean
}

/** Every pool that can reach the server, added up against max_connections. */
export function connectionBudget(o: { instances: number; perInstance: number; bouncerPools: number; bouncerPoolSize: number; other: number; maxConnections: number; reserved: number }): ConnectionBudget {
  const apps = o.instances * o.perInstance
  const bouncer = o.bouncerPools * o.bouncerPoolSize
  const used = apps + bouncer + o.other + o.reserved
  return { apps, bouncer, other: o.other, reserved: o.reserved, maxConnections: o.maxConnections, free: o.maxConnections - used, fits: used <= o.maxConnections }
}
