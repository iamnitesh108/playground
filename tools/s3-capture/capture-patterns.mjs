// Records lesson 9 "Patterns and operations": uploads that bypass the application (presigned PUT and POST),
// private downloads with a file name, date-based keys, paging through thousands of keys, bucket events sent
// to a webhook, metrics, server-side encryption without a KMS, and moving a bucket to a second RustFS server
// with rclone and rc mirror.
//   (cd ts-app && npm install)   # once
//   node capture-patterns.mjs
import { randomBytes } from 'node:crypto'
import { copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, exec, HERE, IMAGES, LAB, podman, removeContainer, sleep, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'
import { send, sign } from './lib/sigv4.mjs'

const NET = 's3-net'
const HOOK = 's3-hook'
const TARGET = 's3-node-b'
const w = workspace('patterns')
const head = (_out, r) => {
  const lines = r.stdout.split('\n').map((l) => l.replace(/\r$/, ''))
  const keep = lines.filter((l, i) => i === 0 || /^(content-type|content-length|content-disposition|etag|location):/i.test(l))
  const body = r.stdout.slice(r.stdout.search(/\r?\n\r?\n/) + 1).trim()
  return [...keep, ...(body ? ['', body] : [])].join('\n')
}

async function ready(name) {
  for (let i = 0; i < 90; i++) {
    if (exec(name, 'curl -sf http://127.0.0.1:9000/health/ready >/dev/null && echo ok').stdout.includes('ok')) return
    await sleep(1000)
  }
  throw new Error(`${name} not ready`)
}

function cleanup() {
  removeContainer(LAB.name, HOOK, TARGET)
  podman(['network', 'rm', '-f', NET])
}

try {
  cleanup()
  podman(['network', 'create', NET], { check: true })
  // the webhook receiver first, so RustFS can reach it when it starts
  podman(['run', '-d', '--rm', '--name', HOOK, '--network', NET, '-v', `${join(HERE, 'webhook')}:/app:ro`, 'docker.io/library/node:24-alpine', 'node', '/app/receiver.mjs'], { check: true })
  const notifyEnv = {
    RUSTFS_NOTIFY_ENABLE: 'true',
    RUSTFS_NOTIFY_WEBHOOK_ENABLE_PRIMARY: 'on',
    RUSTFS_NOTIFY_WEBHOOK_ENDPOINT_PRIMARY: `http://${HOOK}:3020/webhook`,
    RUSTFS_NOTIFY_WEBHOOK_QUEUE_DIR_PRIMARY: '/tmp/rustfs-events',
    RUSTFS_OUTBOUND_ALLOW_ORIGINS: `http://${HOOK}:3020`,
  }
  await startServer({ network: NET, env: notifyEnv })
  writeFileSync(join(w, 'photo.jpg'), Buffer.alloc(2048, 0xd8))
  writeFileSync(join(w, 'big.jpg'), Buffer.alloc(200 * 1024, 0xd8))
  writeFileSync(join(w, 'invoice.pdf'), '%PDF-1.7\nInvoice 2026-0042\n')
  writeFileSync(join(w, 'note.txt'), 'hello\n')
  const s = new Session({ cwd: w })
  const ts = new Session({ cwd: join(HERE, 'ts-app') })
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 cp invoice.pdf s3://catalog/invoices/2026/0042.pdf')
  s.take()

  // ---- events: tell RustFS to send uploads and deletes under uploads/ to the webhook
  const notification = {
    QueueConfigurations: [{ Id: 'uploads-to-webhook', QueueArn: 'arn:rustfs:sqs::primary:webhook', Events: ['s3:ObjectCreated:*', 's3:ObjectRemoved:*'], Filter: { Key: { FilterRules: [{ Name: 'prefix', Value: 'uploads/' }] } } }],
  }
  writeFileSync(join(w, 'notification.json'), JSON.stringify(notification, null, 2) + '\n')
  writeFileSync(join(HERE, 'policies/notification.json'), JSON.stringify(notification, null, 2) + '\n')
  s.run('aws s3api put-bucket-notification-configuration --bucket catalog --notification-configuration file://notification.json')
  s.run('aws s3api get-bucket-notification-configuration --bucket catalog')
  const eventsSetup = s.take()

  // ---- browser upload with a presigned PUT
  const key = 'uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg'
  const put = ts.run(`node presign.ts PUT catalog ${key} 300 image/jpeg`)
  const presignPut = ts.take()
  s.run(`curl -s -i -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "${put.out.trim()}"`, { keep: head })
  s.run(`aws s3api head-object --bucket catalog --key ${key} --query "{size: ContentLength, type: ContentType}"`)
  const putUpload = s.take()

  // ---- browser upload with a presigned POST (an HTML form) and its conditions
  const key2 = 'uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg'
  const form = ts.run(`node upload-form.ts catalog ${key2} 100000`)
  const presignPost = ts.take()
  const post = JSON.parse(form.out)
  const fields = Object.entries(post.fields).map(([k, v]) => `-F "${k}=${v}"`).join(' ')
  const postCmd = (file, type = 'image/jpeg') => `curl -s -i ${fields.replace('-F "Content-Type=image/jpeg"', `-F "Content-Type=${type}"`)} -F file=@${file} ${post.url}`
  s.run(postCmd('photo.jpg'), { keep: head })
  s.run(postCmd('big.jpg'), { keep: head })
  s.run(postCmd('photo.jpg', 'text/html'), { keep: head })
  const postUpload = s.take()

  // ---- a private download with a file name
  const share = ts.run('node share.ts catalog invoices/2026/0042.pdf 600 invoice-0042.pdf')
  const shareCmd = ts.take()
  s.run(`curl -s -i "${share.out.trim()}"`, { keep: head })
  const download = s.take()

  // ---- what the webhook received
  s.run(`aws s3 rm s3://catalog/${key}`)
  await sleep(3000)
  const logs = podman(['logs', HOOK]).stdout.split('\n').filter((l) => l.startsWith('{'))
  const events = logs.map((l) => JSON.parse(l)).flatMap((e) => e.event.Records ?? [e.event])
  const eventsSummary = events.map((r) => ({ eventName: r.eventName, key: decodeURIComponent(r.s3?.object?.key ?? ''), size: r.s3?.object?.size, eTag: r.s3?.object?.eTag, time: r.eventTime }))
  const firstEvent = events[0] ?? null
  const eventsAfter = s.take()

  // ---- keys by date
  for (const day of ['16', '17', '18']) s.run(`aws s3 cp note.txt s3://catalog/exports/2026/10/${day}/orders.csv`)
  s.take()
  s.run('aws s3 ls s3://catalog/exports/2026/10/')
  s.run('aws s3 ls s3://catalog/exports/2026/10/18/')
  const byDate = s.take()

  // ---- thousands of keys: paging
  const N = 2500
  const signedSend = (method, path, { body = '', query } = {}) => {
    const q = query ? Object.fromEntries(new URLSearchParams(query)) : {}
    const signed = sign({ method, path, query: q, headers: { host: 'localhost:9000' }, body, accessKey: LAB.access, secretKey: LAB.secret })
    return send({ port: LAB.api, method, path, query: signed.query, headers: signed.headers, body })
  }
  for (let i = 0; i < N; i += 50) await Promise.all(Array.from({ length: 50 }, (_, j) => signedSend('PUT', `/catalog/logs/2026-10-18/${String(i + j).padStart(5, '0')}.log`, { body: 'line\n' })))
  const pages = []
  let token = null
  const t0 = performance.now()
  do {
    const q = `list-type=2&prefix=logs/${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const res = await signedSend('GET', '/catalog', { query: q })
    const keys = [...res.body.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1])
    token = res.body.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1] ?? null
    pages.push({ keys: keys.length, first: keys[0], last: keys[keys.length - 1], truncated: res.body.includes('<IsTruncated>true</IsTruncated>'), token: token ? `${token.slice(0, 12)}…` : null })
  } while (token)
  const listMs = Math.round(performance.now() - t0)
  s.run('aws s3api list-objects-v2 --bucket catalog --prefix logs/ --max-items 3 --query "{keys: Contents[].Key, next: NextToken}"')
  const tok = JSON.parse(s.steps[s.steps.length - 1].out).next
  s.run(`aws s3api list-objects-v2 --bucket catalog --prefix logs/ --max-items 3 --starting-token ${tok} --query "Contents[].Key"`)
  s.run('aws s3 rm s3://catalog/logs/ --recursive --only-show-errors')
  s.run('aws s3 ls s3://catalog/logs/')
  const paging = s.take()

  // ---- encryption at rest without a key service
  s.run('aws s3api put-object --bucket catalog --key secret.txt --body note.txt --server-side-encryption AES256')
  const sse = s.take()

  // ---- metrics
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc admin metrics lab --scope disk')
  const metrics = s.take()

  // ---- move the bucket to another server
  const sseKey = randomBytes(32).toString('base64')
  podman(['run', '-d', '--name', TARGET, '--network', NET, '-e', `RUSTFS_ACCESS_KEY=${LAB.access}`, '-e', `RUSTFS_SECRET_KEY=${LAB.secret}`, '-e', `RUSTFS_SSE_S3_MASTER_KEY=${sseKey}`, IMAGES.rustfs], { check: true })
  await ready(TARGET)
  copyFileSync(join(HERE, 'rclone/rclone.conf'), join(w, 'rclone.conf'))
  s.run('rclone lsd source:')
  s.run('rclone mkdir target:catalog')
  s.run('rclone sync source:catalog target:catalog --stats-log-level NOTICE --stats 0 -v', { keep: (o) => o.replace(/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d /gm, '') })
  s.run('rclone check source:catalog target:catalog', { keep: (o) => o.replace(/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d /gm, '') })
  writeFileSync(join(w, 'orders.csv'), 'id,total\n1,12.00\n2,8.50\n')
  s.run('aws s3 cp orders.csv s3://catalog/exports/2026/10/18/orders.csv')
  s.run('rclone sync source:catalog target:catalog -v', { keep: (o) => o.replace(/^\d{4}\/\d\d\/\d\d \d\d:\d\d:\d\d /gm, '') })
  s.run('rclone size target:catalog')
  const rclone = s.take()
  s.run('rc alias set backup http://s3-node-b:9000 labadmin labsecret123')
  s.run('rc bucket create backup/catalog-mirror')
  s.run('rc mirror lab/catalog backup/catalog-mirror')
  s.run('rc object list --recursive backup/catalog-mirror/')
  const mirror = s.take()

  // ---- encryption at rest on a server that has a master key (RUSTFS_SSE_S3_MASTER_KEY)
  const t = new Session({ cwd: w, server: TARGET })
  t.run('aws s3 mb s3://vault')
  t.run('aws s3api put-object --bucket vault --key secret.txt --body invoice.pdf --server-side-encryption AES256')
  t.run('aws s3api head-object --bucket vault --key secret.txt')
  t.run('aws s3 cp s3://vault/secret.txt -')
  t.run('aws s3 cp invoice.pdf s3://vault/plain.txt')
  t.run('podman exec s3-node-b sh -c "strings /data/vault/plain.txt/xl.meta | tail -2; echo ---; strings /data/vault/secret.txt/xl.meta | tail -2"')
  const sseOn = t.take()

  writeData(
    'patterns.ts',
    'PATTERNS',
    {
      version: version(),
      rclone: podman(['run', '--rm', IMAGES.rclone, 'version']).stdout.split('\n')[0],
      notifyEnv,
      eventsSetup,
      presignPut,
      putUpload,
      presignPost,
      postUpload,
      shareCmd,
      download,
      eventsAfter,
      events: eventsSummary,
      firstEvent,
      byDate,
      pages,
      listMs,
      objects: N,
      paging,
      sse,
      sseOn,
      metrics,
      rcloneSteps: rclone,
      mirror,
    },
    { script: 'capture-patterns.mjs' },
  )
} finally {
  cleanup()
  dropWorkspace(w)
}
