// A server with one slow endpoint. With --graceful it handles SIGTERM.
import http from 'node:http'
const t0 = performance.now()
const log = (m) => console.log(`${String(Math.round(performance.now() - t0)).padStart(5)} ms  ${m}`)
const server = http.createServer((req, res) => {
  log(`request ${req.url} started`)
  setTimeout(() => { res.end('done\n'); log(`request ${req.url} finished`) }, 1000)
})
server.listen(Number(process.argv[2]), '127.0.0.1', () => log('listening'))
if (process.argv.includes('--graceful')) {
  process.on('SIGTERM', () => {
    log('SIGTERM received: stop accepting, finish in-flight requests')
    server.close(() => { log('all connections closed, exiting'); process.exit(0) })
    setTimeout(() => { log('still busy after 10 s, forcing exit'); process.exit(1) }, 10_000).unref()
  })
}
