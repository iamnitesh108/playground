// Records lesson 5 "Large files: multipart and ranges": a multipart upload done by hand (create, parts,
// complete), resuming after a "crash", aborting, the size rules, how aws s3 cp splits and parallelises a big
// file (timed from its debug log), range reads, and checksums (Content-MD5 and x-amz-checksum-*).
//   node capture-large.mjs
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, LAB, removeContainer, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const MiB = 1024 * 1024
const SIGN = '--aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123'
const brief = (_out, r) => {
  const lines = r.stderr.split('\n').map((l) => l.replace(/\r$/, ''))
  const status = lines.find((l) => l.startsWith('< HTTP/'))?.slice(2) ?? ''
  const keep = lines.filter((l) => /^< (content-range|content-length|etag|accept-ranges):/i.test(l)).map((l) => l.slice(2))
  return [status, ...keep, ...(r.stdout ? ['', r.stdout.replace(/\s+$/, '')] : [])].join('\n')
}

const w = workspace('large')
try {
  await startServer()
  // a 20 MiB "video" (random bytes) and a 64 MiB one
  writeFileSync(join(w, 'demo.mp4'), randomBytes(20 * MiB))
  writeFileSync(join(w, 'big.mp4'), randomBytes(64 * MiB))
  writeFileSync(join(w, 'small.bin'), randomBytes(1 * MiB))
  const s = new Session({ cwd: w })
  s.run('aws s3 mb s3://catalog')
  s.take()

  // ---- multipart by hand
  s.run('split -b 8M -d demo.mp4 part-')
  s.run('ls -l part-* | awk \'{print $5, $9}\'')
  const create = s.run('aws s3api create-multipart-upload --bucket catalog --key videos/demo.mp4 --content-type video/mp4')
  const uploadId = JSON.parse(create.out).UploadId
  const parts = []
  for (const [n, file] of [[1, 'part-00'], [2, 'part-01']]) {
    const r = s.run(`aws s3api upload-part --bucket catalog --key videos/demo.mp4 --upload-id ${uploadId} --part-number ${n} --body ${file}`)
    parts.push({ ETag: JSON.parse(r.out).ETag, PartNumber: n })
  }
  const byHand = s.take()

  // ---- "the laptop crashed": what does the server still know?
  s.run('aws s3api list-multipart-uploads --bucket catalog')
  s.run(`aws s3api list-parts --bucket catalog --key videos/demo.mp4 --upload-id ${uploadId}`)
  const r3 = s.run(`aws s3api upload-part --bucket catalog --key videos/demo.mp4 --upload-id ${uploadId} --part-number 3 --body part-02`)
  parts.push({ ETag: JSON.parse(r3.out).ETag, PartNumber: 3 })
  const resume = s.take()

  writeFileSync(join(w, 'parts.json'), JSON.stringify({ Parts: parts }, null, 2) + '\n')
  s.run('cat parts.json')
  s.run(`aws s3api complete-multipart-upload --bucket catalog --key videos/demo.mp4 --upload-id ${uploadId} --multipart-upload file://parts.json`)
  s.run('aws s3api head-object --bucket catalog --key videos/demo.mp4')
  s.run('aws s3api list-multipart-uploads --bucket catalog')
  const complete = s.take()

  // ---- the multipart ETag: MD5 of the parts' binary MD5s, then -<number of parts>
  s.run('md5sum part-*')
  s.run('cat part-00 part-01 part-02 | md5sum')
  s.run('for p in part-*; do openssl md5 -binary $p; done | md5sum')
  const etag = s.take()

  // ---- abort an upload
  const create2 = s.run('aws s3api create-multipart-upload --bucket catalog --key videos/abandoned.mp4')
  const id2 = JSON.parse(create2.out).UploadId
  s.run(`aws s3api upload-part --bucket catalog --key videos/abandoned.mp4 --upload-id ${id2} --part-number 1 --body part-00`)
  s.run('aws s3api list-multipart-uploads --bucket catalog --query "Uploads[].[Key, Initiated]" --output text')
  s.run(`aws s3api abort-multipart-upload --bucket catalog --key videos/abandoned.mp4 --upload-id ${id2}`)
  s.run('aws s3api list-multipart-uploads --bucket catalog')
  s.run(`aws s3api list-parts --bucket catalog --key videos/abandoned.mp4 --upload-id ${id2}`)
  const abort = s.take()

  // ---- the size rules
  const create3 = s.run('aws s3api create-multipart-upload --bucket catalog --key tiny-parts.bin')
  const id3 = JSON.parse(create3.out).UploadId
  const t1 = s.run(`aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ${id3} --part-number 1 --body small.bin`)
  const t2 = s.run(`aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ${id3} --part-number 2 --body small.bin`)
  writeFileSync(join(w, 'tiny.json'), JSON.stringify({ Parts: [{ ETag: JSON.parse(t1.out).ETag, PartNumber: 1 }, { ETag: JSON.parse(t2.out).ETag, PartNumber: 2 }] }) + '\n')
  s.run(`aws s3api complete-multipart-upload --bucket catalog --key tiny-parts.bin --upload-id ${id3} --multipart-upload file://tiny.json`)
  s.run(`aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ${id3} --part-number 10001 --body small.bin`)
  s.run(`aws s3api abort-multipart-upload --bucket catalog --key tiny-parts.bin --upload-id ${id3}`)
  const rules = s.take()

  // ---- aws s3 cp of a 64 MiB file: which requests, on which threads, when
  const cp = s.run('aws --profile classic --debug s3 cp big.mp4 s3://catalog/videos/big.mp4', { keep: (o) => o.split('\n').filter((l) => l.startsWith('upload:')).join('\n') })
  const log = `${cp.stdout}${cp.stderr}`.split(/[\r\n]+/)
  const ts = (l) => {
    const m = l.match(/(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d),(\d{3}) - /)
    return m ? Date.parse(`${m[1].replace(' ', 'T')}.${m[2]}Z`) : null
  }
  const pending = new Map()
  const requests = []
  for (const l of log) {
    const t = ts(l)
    const thread = l.match(/\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d{3} - (\S+) - /)?.[1]
    const op = l.match(/Making request for OperationModel\(name=(\w+)\)/)?.[1]
    if (op && thread) pending.set(thread, { op, thread, start: t, part: Number(l.match(/'partNumber': '?(\d+)/)?.[1] ?? 0) || undefined })
    const done = l.match(/"(PUT|POST) (\S+) HTTP\/1\.1" (\d+)/)
    if (done && thread && pending.has(thread)) {
      const p = pending.get(thread)
      pending.delete(thread)
      const part = Number(done[2].match(/partNumber=(\d+)/)?.[1] ?? 0) || p.part
      requests.push({ op: p.op, thread, part, status: Number(done[3]), start: p.start, end: t })
    }
  }
  const t0 = Math.min(...requests.map((r) => r.start))
  const cpTimeline = requests.map((r) => ({ ...r, start: r.start - t0, end: r.end - t0 }))
  s.run('aws s3api head-object --bucket catalog --key videos/big.mp4 --query "{size: ContentLength, etag: ETag}"')
  const cpSteps = s.take()

  // ---- range reads
  s.run(`curl -s -v ${SIGN} -H "Range: bytes=0-15" -o first16.bin http://localhost:9000/catalog/videos/demo.mp4`, { keep: brief })
  s.run('od -A d -t x1 first16.bin')
  s.run('od -A d -t x1 -N 16 demo.mp4')
  s.run(`curl -s -v ${SIGN} -H "Range: bytes=-10" -o /dev/null http://localhost:9000/catalog/videos/demo.mp4`, { keep: brief })
  s.run(`curl -s -v ${SIGN} -H "Range: bytes=99999999-" http://localhost:9000/catalog/videos/demo.mp4`, { keep: brief })
  s.run('aws s3api get-object --bucket catalog --key videos/demo.mp4 --range bytes=8388608-8388623 middle.bin')
  s.run('aws s3api get-object --bucket catalog --key videos/demo.mp4 --part-number 3 part3.bin')
  s.run('aws s3api head-object --bucket catalog --key videos/demo.mp4 --part-number 3')
  const range = s.take()

  // ---- checksums
  writeFileSync(join(w, 'invoice.pdf'), Buffer.from('%PDF-1.7\nInvoice 2026-0042\n'))
  s.run('openssl md5 -binary invoice.pdf | base64')
  const md5b64 = createHash('md5').update('%PDF-1.7\nInvoice 2026-0042\n').digest('base64')
  s.run(`aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --content-md5 ${md5b64}`)
  s.run('aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --content-md5 AAAAAAAAAAAAAAAAAAAAAA==')
  const sha = createHash('sha256').update('%PDF-1.7\nInvoice 2026-0042\n').digest('base64')
  s.run(`aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --checksum-sha256 ${sha}`)
  s.run('aws s3api head-object --bucket catalog --key invoices/2026-0042.pdf --checksum-mode ENABLED')
  s.run('aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --checksum-sha256 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=')
  s.run('aws s3api head-object --bucket catalog --key videos/big.mp4 --checksum-mode ENABLED')
  const checksums = s.take()

  writeData('large.ts', 'LARGE', { version: version(), byHand, resume, complete, etag, abort, rules, cpTimeline, cpSteps, cp: cp.out, range, checksums }, { script: 'capture-large.mjs' })
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
