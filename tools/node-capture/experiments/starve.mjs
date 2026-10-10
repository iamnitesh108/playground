// Recursive nextTick blocks timers until the recursion stops; recursive setImmediate does not.
const result = {}
function run(kind, done) {
  let n = 0
  let firedAt = null
  let firedAfter = null
  const start = performance.now()
  setTimeout(() => { firedAt = Math.round(performance.now() - start); firedAfter = n }, 0)
  const schedule = kind === 'nextTick' ? process.nextTick : setImmediate
  const step = () => { n++; if (n < 200000) schedule(step); else setTimeout(() => done({ iterations: n, timerFiredAfterIterations: firedAfter, timerFiredAtMs: firedAt }), 5) }
  schedule(step)
}
run('nextTick', (a) => { result.nextTick = a; run('setImmediate', (b) => { result.setImmediate = b; console.log(JSON.stringify(result)) }) })
