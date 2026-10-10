import type { Op } from './eventLoop'

export interface Program {
  id: 'basics' | 'nested' | 'io' | 'async' | 'timers'
  title: string
  /** The JavaScript, exactly as recorded (tools/node-capture/experiments/order.mjs). */
  source: string
  ops: Op[]
  /** True when the output depends on the setTimeout(0) / setImmediate race. */
  racy: boolean
}

const log = (text: string): Op => ({ op: 'log', text })

export const PROGRAMS: readonly Program[] = [
  {
    id: 'basics',
    title: 'Every kind of callback',
    racy: true,
    source: `console.log('sync 1')
setTimeout(() => console.log('setTimeout 0'), 0)
setImmediate(() => console.log('setImmediate'))
Promise.resolve().then(() => console.log('promise.then'))
process.nextTick(() => console.log('nextTick'))
queueMicrotask(() => console.log('queueMicrotask'))
console.log('sync 2')`,
    ops: [
      log('sync 1'),
      { op: 'setTimeout', label: 'setTimeout cb', body: [log('setTimeout 0')] },
      { op: 'setImmediate', label: 'setImmediate cb', body: [log('setImmediate')] },
      { op: 'promise', label: 'then cb', body: [log('promise.then')] },
      { op: 'nextTick', label: 'nextTick cb', body: [log('nextTick')] },
      { op: 'promise', label: 'queueMicrotask cb', body: [log('queueMicrotask')] },
      log('sync 2'),
    ],
  },
  {
    id: 'nested',
    title: 'Ticks and promises queued from each other',
    racy: false,
    source: `Promise.resolve().then(() => {
  console.log('promise 1')
  process.nextTick(() => console.log('nextTick inside promise'))
  Promise.resolve().then(() => console.log('promise inside promise'))
})
process.nextTick(() => {
  console.log('nextTick 1')
  process.nextTick(() => console.log('nextTick inside nextTick'))
  Promise.resolve().then(() => console.log('promise inside nextTick'))
})`,
    ops: [
      {
        op: 'promise',
        label: 'promise 1 cb',
        body: [
          log('promise 1'),
          { op: 'nextTick', label: 'tick-in-promise cb', body: [log('nextTick inside promise')] },
          { op: 'promise', label: 'promise-in-promise cb', body: [log('promise inside promise')] },
        ],
      },
      {
        op: 'nextTick',
        label: 'nextTick 1 cb',
        body: [
          log('nextTick 1'),
          { op: 'nextTick', label: 'tick-in-tick cb', body: [log('nextTick inside nextTick')] },
          { op: 'promise', label: 'promise-in-tick cb', body: [log('promise inside nextTick')] },
        ],
      },
    ],
  },
  {
    id: 'io',
    title: 'Inside an I/O callback',
    racy: false,
    source: `readFile(__filename, () => {
  console.log('readFile callback')
  setTimeout(() => console.log('setTimeout 0'), 0)
  setImmediate(() => console.log('setImmediate'))
  process.nextTick(() => console.log('nextTick'))
})`,
    ops: [
      {
        op: 'readFile',
        label: 'readFile cb',
        body: [
          log('readFile callback'),
          { op: 'setTimeout', label: 'setTimeout cb', body: [log('setTimeout 0')] },
          { op: 'setImmediate', label: 'setImmediate cb', body: [log('setImmediate')] },
          { op: 'nextTick', label: 'nextTick cb', body: [log('nextTick')] },
        ],
      },
    ],
  },
  {
    id: 'async',
    title: 'async / await',
    racy: false,
    source: `async function work() {
  console.log('work: start')
  await null
  console.log('work: after await')
}
console.log('main: before')
work().then(() => console.log('work: resolved'))
console.log('main: after')`,
    ops: [
      log('main: before'),
      { op: 'async', label: 'work()', before: [log('work: start')], after: [log('work: after await')], then: { label: '.then cb', body: [log('work: resolved')] } },
      log('main: after'),
    ],
  },
  {
    id: 'timers',
    title: 'Timers, immediates and what runs between them',
    racy: true,
    source: `setTimeout(() => {
  console.log('timeout A')
  Promise.resolve().then(() => console.log('promise from A'))
  process.nextTick(() => console.log('nextTick from A'))
}, 0)
setTimeout(() => console.log('timeout B'), 0)
setImmediate(() => console.log('immediate 1'))
setImmediate(() => console.log('immediate 2'))`,
    ops: [
      {
        op: 'setTimeout',
        label: 'timeout A cb',
        body: [log('timeout A'), { op: 'promise', label: 'promise-from-A cb', body: [log('promise from A')] }, { op: 'nextTick', label: 'tick-from-A cb', body: [log('nextTick from A')] }],
      },
      { op: 'setTimeout', label: 'timeout B cb', body: [log('timeout B')] },
      { op: 'setImmediate', label: 'immediate 1 cb', body: [log('immediate 1')] },
      { op: 'setImmediate', label: 'immediate 2 cb', body: [log('immediate 2')] },
    ],
  },
]
