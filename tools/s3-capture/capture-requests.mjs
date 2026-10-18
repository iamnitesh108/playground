// Records lesson 4 "The S3 API on the wire": raw HTTP requests and responses (curl -v with SigV4 signing),
// the aws CLI's own signing steps for one request, error responses, a clock that is wrong, conditional
// requests, read-after-write checks and virtual-hosted-style addressing.
//   node capture-requests.mjs
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, LAB, removeContainer, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'
import { send, sign } from './lib/sigv4.mjs'

const SIGN = '--aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123'

/** curl -v output as it went over the wire: request lines (>), response lines (<), then the body. */
const wire = (_out, r) => {
  const lines = r.stderr.split('\n').map((l) => l.replace(/\r$/, ''))
  const req = lines.filter((l) => l.startsWith('> ')).map((l) => l.slice(2))
  const res = lines.filter((l) => l.startsWith('< ')).map((l) => l.slice(2))
  const body = r.stdout.startsWith('HTTP/') ? '' : r.stdout.replace(/\s+$/, '')
  return [...req, '', ...res, ...(body ? ['', body] : [])].join('\n')
}
/** Only the status line and the body. */
const brief = (_out, r) => {
  const status = r.stderr.split('\n').find((l) => l.startsWith('< HTTP/'))?.slice(2).trim() ?? ''
  return [status, r.stdout.replace(/\s+$/, '')].filter(Boolean).join('\n')
}

const w = workspace('requests')
try {
  await startServer()
  writeFileSync(join(w, 'readme.txt'), 'Product photos and manuals.\n')
  const s = new Session({ cwd: w })

  // ---- every operation is an HTTP request
  s.run(`curl -s -v ${SIGN} -X PUT http://localhost:9000/catalog`, { keep: wire })
  s.run(`curl -s -v ${SIGN} -T readme.txt -H "Content-Type: text/plain" http://localhost:9000/catalog/readme.txt`, { keep: wire })
  s.run(`curl -s -v ${SIGN} http://localhost:9000/catalog/readme.txt`, { keep: wire })
  s.run(`curl -s -v ${SIGN} -I http://localhost:9000/catalog/readme.txt`, { keep: wire })
  s.run(`curl -s -v ${SIGN} "http://localhost:9000/catalog?list-type=2&delimiter=/"`, { keep: wire })
  s.run(`curl -s -v ${SIGN} -X DELETE http://localhost:9000/catalog/readme.txt`, { keep: wire })
  const verbs = s.take()

  // ---- the ETag of a simple upload is the MD5 of the bytes
  s.run(`curl -s -v ${SIGN} -T readme.txt http://localhost:9000/catalog/readme.txt`, { keep: (_o, r) => r.stderr.split('\n').find((l) => /^< etag/i.test(l))?.slice(2).trim() ?? '' })
  s.run('md5sum readme.txt')
  const etag = s.take()

  // ---- signing, as the aws CLI logged it
  const dbg = s.run('aws --debug s3api get-object --bucket catalog --key readme.txt copy.txt', { keep: (o) => o.split('\n').filter((l) => !l.includes(' - ')).join('\n') })
  const log = `${dbg.stdout}${dbg.stderr}`
  const block = (name) => {
    const m = log.match(new RegExp(`botocore\\.auth - DEBUG - ${name}:\\n([\\s\\S]*?)\\n\\d{4}-\\d\\d-\\d\\d \\d\\d:`))
    if (!m) throw new Error(`no ${name} in the debug log`)
    return m[1]
  }
  const sent = log.match(/Sending http request: <AWSPreparedRequest stream_output=\w+, method=(\w+), url=(\S+), headers=\{(.*)\}>/)
  const headers = Object.fromEntries([...sent[3].matchAll(/'([^']+)': b'([^']*)'/g)].map((m) => [m[1], m[2]]))
  const status = log.match(/"GET \/catalog\/readme\.txt HTTP\/1\.1" (\d+)/)?.[1]
  const sigv4 = {
    method: sent[1],
    url: sent[2],
    accessKey: LAB.access,
    secretKey: LAB.secret,
    region: 'us-east-1',
    service: 's3',
    canonicalRequest: block('CanonicalRequest'),
    stringToSign: block('StringToSign'),
    signature: block('Signature').trim(),
    authorization: headers.Authorization,
    amzDate: headers['X-Amz-Date'],
    status: Number(status),
  }
  s.take()

  // ---- errors
  s.run(`curl -s -v ${SIGN} http://localhost:9000/catalog/nope.txt`, { keep: brief })
  s.run(`curl -s -v ${SIGN} http://localhost:9000/no-such-bucket/readme.txt`, { keep: brief })
  s.run('curl -s -v http://localhost:9000/catalog/readme.txt', { keep: brief })
  s.run('curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:wrong-secret http://localhost:9000/catalog/readme.txt', { keep: brief })
  s.run('curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user nobody:labsecret123 http://localhost:9000/catalog/readme.txt', { keep: brief })
  s.run('curl -s -v --aws-sigv4 aws:amz:eu-west-1:s3 --user labadmin:labsecret123 http://localhost:9000/catalog/readme.txt', { keep: brief })
  const errors = s.take()

  // ---- a wrong clock: the same GET signed as if the time were off by some minutes
  const skew = []
  for (const minutes of [-20, -16, -14, -5, 0, 5, 14, 16, 20]) {
    const date = new Date(Date.now() + minutes * 60_000)
    const signed = sign({ method: 'GET', path: '/catalog/readme.txt', headers: { host: 'localhost:9000' }, accessKey: LAB.access, secretKey: LAB.secret, date })
    const res = await send({ port: LAB.api, method: 'GET', path: '/catalog/readme.txt', headers: signed.headers })
    skew.push({ minutes, status: res.status, code: res.body.match(/<Code>(\w+)<\/Code>/)?.[1] ?? 'OK', message: res.body.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? '', amzDate: signed.headers['x-amz-date'] })
  }
  const skewed = skew.find((x) => x.minutes === -20)
  const skewRequest = sign({ method: 'GET', path: '/catalog/readme.txt', headers: { host: 'localhost:9000' }, accessKey: LAB.access, secretKey: LAB.secret, date: new Date(Date.now() - 20 * 60_000) })
  const skewResponse = await send({ port: LAB.api, method: 'GET', path: '/catalog/readme.txt', headers: skewRequest.headers })

  // ---- conditional requests
  const md5 = createHash('md5').update('Product photos and manuals.\n').digest('hex')
  s.run(`curl -s -v ${SIGN} -T readme.txt -H "If-None-Match: *" http://localhost:9000/catalog/readme.txt`, { keep: brief })
  s.run(`curl -s -v ${SIGN} -H 'If-None-Match: "${md5}"' http://localhost:9000/catalog/readme.txt`, { keep: brief })
  s.run(`curl -s -v ${SIGN} -H 'If-Match: "0123456789abcdef0123456789abcdef"' http://localhost:9000/catalog/readme.txt`, { keep: brief })
  s.run(`curl -s -v ${SIGN} -T readme.txt -H "If-None-Match: *" http://localhost:9000/catalog/new-file.txt`, { keep: brief })
  const conditional = s.take()

  // ---- read-after-write: write, then read straight back, many times
  const signedSend = async (method, path, { body = '', query } = {}) => {
    const q = query ? Object.fromEntries(new URLSearchParams(query)) : {}
    const signed = sign({ method, path, query: q, headers: { host: 'localhost:9000' }, body, accessKey: LAB.access, secretKey: LAB.secret })
    return send({ port: LAB.api, method, path, query: signed.query, headers: signed.headers, body })
  }
  const N = 300
  let overwriteStale = 0
  let listMissing = 0
  let deleteVisible = 0
  const t0 = performance.now()
  for (let i = 0; i < N; i++) {
    await signedSend('PUT', '/catalog/consistency/counter.txt', { body: `version ${i}` })
    const got = await signedSend('GET', '/catalog/consistency/counter.txt')
    if (got.body !== `version ${i}`) overwriteStale++
    await signedSend('PUT', `/catalog/consistency/new-${i}.txt`, { body: 'x' })
    const list = await signedSend('GET', '/catalog', { query: `list-type=2&prefix=consistency/new-${i}.txt` })
    if (!list.body.includes(`<Key>consistency/new-${i}.txt</Key>`)) listMissing++
    await signedSend('DELETE', `/catalog/consistency/new-${i}.txt`)
    const gone = await signedSend('GET', `/catalog/consistency/new-${i}.txt`)
    if (gone.status !== 404) deleteVisible++
  }
  const consistency = { rounds: N, overwriteStale, listMissing, deleteVisible, ms: Math.round(performance.now() - t0) }

  // ---- two writers race to create the same key with If-None-Match: *
  const race = { trials: 50, outcomes: {} }
  for (let i = 0; i < race.trials; i++) {
    const put = (who) => {
      const body = `written by ${who}`
      const signed = sign({ method: 'PUT', path: `/catalog/race/${i}.txt`, headers: { host: 'localhost:9000', 'if-none-match': '*' }, body, accessKey: LAB.access, secretKey: LAB.secret })
      return send({ port: LAB.api, method: 'PUT', path: `/catalog/race/${i}.txt`, headers: signed.headers, body })
    }
    const [a, b] = await Promise.all([put('A'), put('B')])
    const key = [a.status, b.status].sort().join('+')
    race.outcomes[key] = (race.outcomes[key] ?? 0) + 1
  }

  removeContainer(LAB.name)

  // ---- virtual-hosted style, once the server knows its domain
  await startServer({ env: { RUSTFS_SERVER_DOMAINS: 's3.lab.test:9000' } })
  s.run(`curl -s -v ${SIGN} -X PUT http://localhost:9000/catalog`, { keep: brief })
  s.run(`curl -s -v ${SIGN} -T readme.txt http://localhost:9000/catalog/readme.txt`, { keep: brief })
  s.run(`curl -s -v ${SIGN} --resolve catalog.s3.lab.test:9000:127.0.0.1 http://catalog.s3.lab.test:9000/readme.txt`, { keep: wire })
  const virtual = s.take()

  writeData(
    'requests.ts',
    'REQUESTS',
    {
      version: version(),
      verbs,
      etag,
      sigv4,
      errors,
      skew,
      skewed,
      skewWire: { headers: skewRequest.headers, status: skewResponse.status, body: skewResponse.body },
      conditional,
      consistency,
      race,
      virtual,
    },
    { script: 'capture-requests.mjs' },
  )
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
