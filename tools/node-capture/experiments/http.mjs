// An HTTP server, spoken to over a raw TCP socket so every byte is visible.
import http from 'node:http'
import net from 'node:net'
const events = []
let sockets = 0
const server = http.createServer((req, res) => {
  events.push(`request ${req.method} ${req.url} on socket ${req.socket.id}`)
  if (req.url === '/health') {
    res.end('ok')
  } else if (req.url === '/orders/42') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 42, status: 'PAID' }))
  } else if (req.url === '/report') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.write('part 1\n')
    setTimeout(() => res.end('part 2\n'), 20)
  } else if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => { chunks.push(c.length); events.push(`  data event: ${c.length} bytes`) })
    req.on('end', () => {
      events.push('  end event')
      res.writeHead(201, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ received: chunks.reduce((a, b) => a + b, 0) }))
    })
  }
})
server.on('connection', (s) => { s.id = ++sockets; events.push(`connection: socket ${s.id} opened`) })
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const { port } = server.address()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function exchange(socket, request, waitMs = 80) {
  return new Promise((resolve) => {
    let data = ''
    const onData = (d) => { data += d }
    socket.on('data', onData)
    for (const part of [].concat(request)) socket.write(part)
    setTimeout(() => { socket.off('data', onData); resolve(data) }, waitMs)
  })
}
const s = net.connect(port, '127.0.0.1')
await new Promise((r) => s.on('connect', r))
const health = 'GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n'
const r0 = await exchange(s, health)
const get = 'GET /orders/42 HTTP/1.1\r\nHost: localhost\r\n\r\n'
const r1 = await exchange(s, get)
const report = 'GET /report HTTP/1.1\r\nHost: localhost\r\n\r\n'
const r2 = await exchange(s, report)
const body = JSON.stringify({ customerId: 7, amount: '25.00', note: 'x'.repeat(40) })
const head = `POST /orders HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n`
const postDone = exchange(s, [], 200)
s.write(head + body.slice(0, 30))
await sleep(50)
s.write(body.slice(30))
const r3 = await postDone
s.end()
await sleep(50)
const defaults = { keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout, requestTimeout: server.requestTimeout, maxHeaderSize: http.maxHeaderSize }
server.close()
console.log(JSON.stringify({ defaults, events, exchanges: [{ request: health, response: r0 }, { request: get, response: r1 }, { request: report, response: r2 }, { request: head + body, response: r3 }] }))
