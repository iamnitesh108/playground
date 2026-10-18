// A webhook receiver for bucket notifications: prints every event it gets, one JSON document per line.
import { createServer } from 'node:http'

createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    if (body) console.log(JSON.stringify({ method: req.method, path: req.url, event: JSON.parse(body) }))
    res.writeHead(200).end()
  })
}).listen(3020, () => console.log('listening on :3020'))
