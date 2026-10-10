// Prints the order in which callbacks run. Program chosen by argv[2]; each prints one line per callback.
import { readFile } from 'node:fs'
const log = (s) => console.log(s)
const programs = {
  basics() {
    log('sync 1')
    setTimeout(() => log('setTimeout 0'), 0)
    setImmediate(() => log('setImmediate'))
    Promise.resolve().then(() => log('promise.then'))
    process.nextTick(() => log('nextTick'))
    queueMicrotask(() => log('queueMicrotask'))
    log('sync 2')
  },
  nested() {
    Promise.resolve().then(() => {
      log('promise 1')
      process.nextTick(() => log('nextTick inside promise'))
      Promise.resolve().then(() => log('promise inside promise'))
    })
    process.nextTick(() => {
      log('nextTick 1')
      process.nextTick(() => log('nextTick inside nextTick'))
      Promise.resolve().then(() => log('promise inside nextTick'))
    })
  },
  io() {
    readFile(import.meta.filename, () => {
      log('readFile callback')
      setTimeout(() => log('setTimeout 0'), 0)
      setImmediate(() => log('setImmediate'))
      process.nextTick(() => log('nextTick'))
    })
  },
  async() {
    async function work() {
      log('work: start')
      await null
      log('work: after await')
    }
    log('main: before')
    work().then(() => log('work: resolved'))
    log('main: after')
  },
  timers() {
    setTimeout(() => {
      log('timeout A')
      Promise.resolve().then(() => log('promise from A'))
      process.nextTick(() => log('nextTick from A'))
    }, 0)
    setTimeout(() => log('timeout B'), 0)
    setImmediate(() => log('immediate 1'))
    setImmediate(() => log('immediate 2'))
  },
}
programs[process.argv[2]]()
