// Sequential awaits vs Promise.all; all vs allSettled; forEach with async callbacks.
const sleep = (ms, value) => new Promise((r) => setTimeout(() => r(value), ms))
const fail = (ms, msg) => new Promise((_, j) => setTimeout(() => j(new Error(msg)), ms))
const t = () => performance.now()
const out = {}
let s = t()
await sleep(200); await sleep(200); await sleep(200)
out.sequentialMs = Math.round(t() - s)
s = t()
await Promise.all([sleep(200), sleep(200), sleep(200)])
out.parallelMs = Math.round(t() - s)
try { await Promise.all([sleep(100, 'a'), fail(50, 'payment service down'), sleep(300, 'c')]) } catch (e) { out.allError = e.message }
out.allSettled = (await Promise.allSettled([sleep(100, 'a'), fail(50, 'payment service down'), sleep(300, 'c')])).map((r) => (r.status === 'fulfilled' ? { status: r.status, value: r.value } : { status: r.status, reason: r.reason.message }))
const done = []
;[1, 2, 3].forEach(async (n) => { await sleep(50); done.push(n) })
out.forEachDoneRightAfter = [...done]
await sleep(100)
out.forEachDoneLater = [...done]
const seen = []
for (const n of [1, 2, 3]) { await sleep(50); seen.push(n) }
out.forOfDone = seen
console.log(JSON.stringify(out))
