import { Observable } from '@/shared/utils/observable'

/*
 * A producer writing into a Writable stream that a slower consumer drains.
 * Mirrors the Writable contract: write() always accepts the chunk, but returns
 * false once the buffered bytes reach highWaterMark; 'drain' fires when the
 * buffer has emptied. The strategy decides whether the producer listens.
 */

/** How the producer reacts to write() returning false. */
export interface ProducerStrategy {
  readonly id: 'ignore' | 'respect'
  readonly label: string
  /** May the producer write in this tick? */
  canWrite(state: { waitingForDrain: boolean }): boolean
}

export const IGNORE: ProducerStrategy = { id: 'ignore', label: 'ignore write() → false', canWrite: () => true }
export const RESPECT: ProducerStrategy = { id: 'respect', label: 'wait for drain', canWrite: ({ waitingForDrain }) => !waitingForDrain }

export interface StreamOptions {
  highWaterMark: number
  /** Bytes the producer writes per tick when allowed. */
  produceRate: number
  /** Bytes the consumer accepts per tick. */
  consumeRate: number
  strategy: ProducerStrategy
}

export class BackpressureSimulator extends Observable {
  options: StreamOptions
  tick = 0
  buffered = 0
  written = 0
  consumed = 0
  falseReturns = 0
  drains = 0
  waitingForDrain = false
  /** buffered bytes after each tick, for the chart */
  history: number[] = []

  constructor(options: StreamOptions) {
    super()
    this.options = options
  }

  configure(change: Partial<StreamOptions>): void {
    this.options = { ...this.options, ...change }
    this.reset()
  }

  reset(): void {
    this.tick = 0
    this.buffered = 0
    this.written = 0
    this.consumed = 0
    this.falseReturns = 0
    this.drains = 0
    this.waitingForDrain = false
    this.history = []
    this.notify()
  }

  step(): void {
    const { highWaterMark, produceRate, consumeRate, strategy } = this.options
    this.tick++
    if (strategy.canWrite(this)) {
      this.buffered += produceRate
      this.written += produceRate
      // write() returns false once the buffer is at or above highWaterMark
      if (this.buffered >= highWaterMark) {
        this.falseReturns++
        this.waitingForDrain = true
      }
    }
    const taken = Math.min(consumeRate, this.buffered)
    this.buffered -= taken
    this.consumed += taken
    if (this.waitingForDrain && this.buffered === 0) {
      this.waitingForDrain = false
      this.drains++
    }
    this.history = [...this.history, this.buffered].slice(-120)
    this.notify()
  }
}
