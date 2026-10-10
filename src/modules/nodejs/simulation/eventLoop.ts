/*
 * The Node.js event loop as a deterministic model, precise enough to reproduce
 * the order in which real Node.js runs callbacks (tested against recordings).
 *
 * Model:
 *  - The main module runs to completion first.
 *  - After every callback, Node drains the nextTick queue, then the microtask
 *    queue (promises, queueMicrotask), and repeats until both are empty.
 *    In an ES module the main module itself runs inside a microtask, so after
 *    it the microtask queue is drained before the nextTick queue.
 *  - Then the loop runs phases in order: timers → poll (I/O callbacks) → check
 *    (setImmediate). (Pending and close phases are left out: nothing here uses them.)
 *  - A 0 ms timer is really 1 ms. Whether it has expired when the loop first
 *    looks depends on how fast startup was — a real race, exposed as an option.
 */

export type Op =
  | { op: 'log'; text: string }
  | { op: 'setTimeout'; label: string; body: Op[] }
  | { op: 'setImmediate'; label: string; body: Op[] }
  | { op: 'nextTick'; label: string; body: Op[] }
  | { op: 'promise'; label: string; body: Op[] }
  | { op: 'readFile'; label: string; body: Op[] }
  /** Calls an async function: `before` runs now; `after` runs after `await`; then the returned promise's .then callbacks. */
  | { op: 'async'; label: string; before: Op[]; after: Op[]; then: { label: string; body: Op[] } }

export type QueueName = 'nextTick' | 'microtask' | 'timers' | 'poll' | 'check'
export type Phase = 'main' | 'ticks' | 'timers' | 'poll' | 'check' | 'done'
export type ModuleKind = 'esm' | 'cjs'

export interface Task {
  id: number
  label: string
  body: Op[]
}

export interface Frame {
  phase: Phase
  /** What happened in this step, in words. */
  action: string
  /** The callback running, or null between callbacks. */
  running: string | null
  queues: Record<QueueName, string[]>
  output: string[]
  /** Index of the line added to `output` in this step, if any. */
  printed: number | null
  iteration: number
}

export interface Options {
  kind: ModuleKind
  /** True: the 1 ms timer has already expired the first time the loop checks timers. */
  timerDueAtStart: boolean
}

const QUEUE_OF: Record<'setTimeout' | 'setImmediate' | 'nextTick' | 'promise' | 'readFile', QueueName> = {
  setTimeout: 'timers',
  setImmediate: 'check',
  nextTick: 'nextTick',
  promise: 'microtask',
  readFile: 'poll',
}

const ADDED: Record<QueueName, string> = {
  nextTick: 'to the nextTick queue',
  microtask: 'to the microtask queue',
  timers: 'as a timer (fires after ≥ 1 ms)',
  poll: 'as I/O: the file is read on the thread pool; the callback waits for the poll phase',
  check: 'to the check queue (setImmediate)',
}

class Machine {
  private readonly queues: Record<QueueName, Task[]> = { nextTick: [], microtask: [], timers: [], poll: [], check: [] }
  /** Timers that may fire in the current/next timers phase. */
  private readonly due = new Set<number>()
  private readonly output: string[] = []
  readonly frames: Frame[] = []
  private phase: Phase = 'main'
  private iteration = 0
  private seq = 0
  private readonly options: Options

  constructor(options: Options) {
    this.options = options
  }

  run(program: Op[]): Frame[] {
    this.snapshot(`Run the main ${this.options.kind === 'esm' ? 'ES module' : 'CommonJS'} script, top to bottom.`, 'main script')
    this.execute(program, 'main script')
    this.snapshot('The main script has finished. The call stack is empty.', null)
    if (this.options.timerDueAtStart) this.expireTimers()
    this.drain(this.options.kind === 'esm')

    while (this.queues.timers.length || this.queues.poll.length || this.queues.check.length) {
      this.iteration++
      this.phase = 'timers'
      const expired = this.queues.timers.filter((t) => this.due.has(t.id))
      this.snapshot(expired.length ? `Timers phase: ${expired.length} expired timer(s).` : 'Timers phase: no timer has expired yet.', null)
      for (const task of expired) this.runTask('timers', task)
      this.phase = 'poll'
      const ready = [...this.queues.poll]
      this.snapshot(ready.length ? 'Poll phase: completed I/O is waiting.' : 'Poll phase: no I/O callbacks.', null)
      for (const task of ready) this.runTask('poll', task)
      this.phase = 'check'
      const immediates = [...this.queues.check]
      this.snapshot(immediates.length ? 'Check phase: run the setImmediate callbacks queued so far.' : 'Check phase: nothing queued.', null)
      for (const task of immediates) this.runTask('check', task)
      // By the next iteration every remaining timer has expired (they are all 0 ms here).
      this.expireTimers()
    }
    this.phase = 'done'
    this.snapshot('Nothing is left to do: no timers, no I/O, no immediates. The process exits.', null)
    return this.frames
  }

  private expireTimers(): void {
    for (const t of this.queues.timers) this.due.add(t.id)
  }

  private runTask(queue: QueueName, task: Task): void {
    this.queues[queue] = this.queues[queue].filter((t) => t !== task)
    this.snapshot(`Run ${task.label}.`, task.label)
    this.execute(task.body, task.label)
    this.drain(false)
  }

  /** After a callback: nextTick queue, then microtasks, until both are empty. */
  private drain(microtasksFirst: boolean): void {
    const before = this.phase
    let first = microtasksFirst
    while (this.queues.nextTick.length || this.queues.microtask.length) {
      if (first) {
        this.drainQueue('microtask')
        first = false
        continue
      }
      this.drainQueue('nextTick')
      this.drainQueue('microtask')
    }
    this.phase = before
  }

  private drainQueue(queue: 'nextTick' | 'microtask'): void {
    while (this.queues[queue].length) {
      this.phase = 'ticks'
      const task = this.queues[queue].shift()!
      this.snapshot(`Run ${task.label} from the ${queue} queue.`, task.label)
      this.execute(task.body, task.label)
    }
  }

  private execute(ops: Op[], running: string): void {
    for (const op of ops) {
      if (op.op === 'log') {
        this.output.push(op.text)
        this.snapshot(`console.log('${op.text}')`, running, this.output.length - 1)
      } else if (op.op === 'async') {
        this.snapshot(`Call ${op.label}: it runs synchronously until its first await.`, op.label)
        this.execute(op.before, op.label)
        this.enqueue('microtask', `${op.label} (after await)`, [...op.after, { op: 'promise', label: op.then.label, body: op.then.body }], running, `await suspends ${op.label}; its continuation is queued as a microtask`)
      } else {
        this.enqueue(QUEUE_OF[op.op], op.label, op.body, running)
      }
    }
  }

  private enqueue(queue: QueueName, label: string, body: Op[], running: string, action?: string): void {
    this.queues[queue].push({ id: ++this.seq, label, body })
    this.snapshot(action ?? `${label} added ${ADDED[queue]}.`, running)
  }

  private snapshot(action: string, running: string | null, printed: number | null = null): void {
    this.frames.push({
      phase: this.phase,
      action,
      running,
      queues: {
        nextTick: this.queues.nextTick.map((t) => t.label),
        microtask: this.queues.microtask.map((t) => t.label),
        timers: this.queues.timers.map((t) => (this.due.has(t.id) ? `${t.label} ✓` : t.label)),
        poll: this.queues.poll.map((t) => t.label),
        check: this.queues.check.map((t) => t.label),
      },
      output: [...this.output],
      printed,
      iteration: this.iteration,
    })
  }
}

/** Runs a program through the model and returns one frame per step. */
export function simulate(program: Op[], options: Options): Frame[] {
  return new Machine(options).run(program)
}

/** The console output only. */
export function outputOf(program: Op[], options: Options): string[] {
  const frames = simulate(program, options)
  return frames[frames.length - 1].output
}
