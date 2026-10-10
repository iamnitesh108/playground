// Sends a slow request, then SIGTERM 200 ms later — without and with a handler.
import { spawn } from 'node:child_process'
import http from 'node:http'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function run(graceful, port) {
  const args = [new URL('./shutdown-server.mjs', import.meta.url).pathname, String(port)]
  if (graceful) args.push('--graceful')
  const child = spawn(process.execPath, args)
  let out = ''
  child.stdout.on('data', (d) => (out += d))
  const exit = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })))
  await sleep(300)
  const response = new Promise((resolve) => {
    http.get({ port, host: '127.0.0.1', path: '/checkout', agent: false }, (res) => {
      let body = ''
      res.on('data', (d) => (body += d)).on('end', () => resolve(`${res.statusCode} ${body.trim()}`))
    }).on('error', (e) => resolve(`error: ${e.message} (${e.code})`))
  })
  await sleep(200)
  child.kill('SIGTERM')
  const [result, client] = await Promise.all([exit, response])
  return { log: out.trimEnd(), exit: result, client }
}
console.log(JSON.stringify({ abrupt: await run(false, 47101), graceful: await run(true, 47102) }))
