// Records lesson 6 "Access, policies and sharing": users and policies made with rc, allowed and denied
// requests per identity, an explicit deny, an access key with a narrower policy, a public-read bucket policy
// and the block that stops it, presigned GET/PUT links (working, expired, signed by someone not allowed),
// and CORS for uploads from a browser.
//   (cd ts-app && npm install)   # once
//   node capture-access.mjs
import { copyFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, HERE, LAB, removeContainer, sleep, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const w = workspace('access')
const status = (_out, r) => {
  const lines = r.stdout.split('\n').map((l) => l.replace(/\r$/, ''))
  const keep = lines.filter((l, i) => i === 0 || /^(access-control-[\w-]+|vary|etag|content-length):/i.test(l))
  const body = r.stdout.slice(r.stdout.search(/\r?\n\r?\n/) + 1).trim()
  return [...keep, ...(body ? ['', body] : [])].join('\n')
}
try {
  await startServer()
  for (const f of ['catalog-read.json', 'uploads-write.json', 'catalog-app.json', 'invoices-read.json', 'public-read.json', 'cors.json']) copyFileSync(join(HERE, 'policies', f), join(w, f))
  writeFileSync(join(w, 'logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>\n')
  writeFileSync(join(w, 'invoice.pdf'), '%PDF-1.7\nInvoice 2026-0042\n')
  writeFileSync(join(w, 'photo.jpg'), Buffer.alloc(2048, 0xd8))
  writeFileSync(join(w, 'note.txt'), 'hello\n')

  const s = new Session({ cwd: w, awsDir: join(HERE, 'aws-access') })
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 cp logo.svg s3://catalog/public/logo.svg')
  s.run('aws s3 cp invoice.pdf s3://catalog/invoices/2026-0042.pdf')
  const setup = s.take()

  // ---- users and policies
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc admin policy ls lab')
  s.run('rc admin policy info lab readonly')
  const builtIn = s.take()
  s.run('rc admin user add lab catalog-reader readersecret123')
  s.run('rc admin policy create lab catalog-read catalog-read.json')
  s.run('rc admin policy attach lab catalog-read --user catalog-reader')
  s.run('rc admin user add lab catalog-uploader uploadersecret123')
  s.run('rc admin policy create lab uploads-write uploads-write.json')
  s.run('rc admin policy attach lab uploads-write --user catalog-uploader')
  s.run('rc admin user add lab catalog-app appsecret12345')
  s.run('rc admin policy create lab catalog-app catalog-app.json')
  s.run('rc admin policy attach lab catalog-app --user catalog-app')
  s.run('rc admin user ls lab')
  const users = s.take()

  // ---- what each identity may do
  s.run('aws --profile reader s3 ls s3://catalog/ --recursive')
  s.run('aws --profile reader s3 cp s3://catalog/invoices/2026-0042.pdf -')
  s.run('aws --profile reader s3 cp note.txt s3://catalog/note.txt')
  s.run('aws --profile reader s3 ls')
  const reader = s.take()
  s.run('aws --profile uploader s3 cp photo.jpg s3://catalog/uploads/photo.jpg')
  s.run('aws --profile uploader s3 cp photo.jpg s3://catalog/images/photo.jpg')
  s.run('aws --profile uploader s3 ls s3://catalog/uploads/')
  s.run('aws --profile uploader s3 ls s3://catalog/')
  s.run('aws --profile uploader s3 cp s3://catalog/uploads/photo.jpg -')
  const uploader = s.take()
  s.run('aws --profile app s3 cp invoice.pdf s3://catalog/invoices/2026-0043.pdf')
  s.run('aws --profile app s3 rm s3://catalog/uploads/photo.jpg')
  s.run('aws --profile app s3 rm s3://catalog/invoices/2026-0043.pdf')
  const app = s.take()

  // ---- an access key with a narrower policy than its user
  s.run('rc admin service-account create lab catalog-app-invoices appkeysecret12345 --user catalog-app --name invoice-reader --policy invoices-read.json')
  s.run('aws --profile app-key s3 cp s3://catalog/invoices/2026-0042.pdf -')
  s.run('aws --profile app-key s3 cp note.txt s3://catalog/invoices/note.txt')
  s.run('rc admin service-account ls lab --user catalog-app')
  const accessKey = s.take()

  // ---- a bucket policy for anonymous readers
  s.run('curl -s http://localhost:9000/catalog/public/logo.svg')
  s.run('aws s3api put-bucket-policy --bucket catalog --policy file://public-read.json')
  s.run('aws s3api get-bucket-policy --bucket catalog --query Policy --output text')
  s.run('curl -s http://localhost:9000/catalog/public/logo.svg')
  s.run('curl -s http://localhost:9000/catalog/invoices/2026-0042.pdf')
  s.run('curl -s "http://localhost:9000/catalog?list-type=2"')
  const bucketPolicy = s.take()
  s.run('aws s3api put-public-access-block --bucket catalog --public-access-block-configuration BlockPublicPolicy=true,RestrictPublicBuckets=true')
  s.run('curl -s http://localhost:9000/catalog/public/logo.svg')
  s.run('aws s3api put-bucket-policy --bucket catalog --policy file://public-read.json')
  s.run('aws s3api delete-public-access-block --bucket catalog')
  s.run('aws s3api delete-bucket-policy --bucket catalog')
  s.run('curl -s http://localhost:9000/catalog/public/logo.svg')
  const publicBlock = s.take()
  s.run('rc bucket anonymous set download lab/catalog/public')
  s.run('rc bucket anonymous list lab/catalog')
  s.run('curl -s http://localhost:9000/catalog/public/logo.svg')
  s.run('rc bucket anonymous set private lab/catalog/public')
  const anonymous = s.take()

  // ---- presigned links
  const get = s.run('aws s3 presign s3://catalog/invoices/2026-0042.pdf --expires-in 10')
  const getUrl = get.out.trim()
  s.run(`curl -s "${getUrl}"`)
  await sleep(12_000)
  s.note('12 seconds later')
  s.run(`curl -s "${getUrl}"`)
  const presignGet = s.take()

  const ts = new Session({ cwd: join(HERE, 'ts-app') })
  const put = ts.run('node presign.ts PUT catalog uploads/from-browser.jpg 300 image/jpeg')
  const putUrl = put.out.trim()
  const presignPutUrl = ts.take()
  s.run(`curl -s -i -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "${putUrl}"`, { keep: status })
  s.run(`curl -s -i -X PUT -H "Content-Type: text/html" --data-binary @photo.jpg "${putUrl}"`, { keep: status })
  s.run('aws s3 ls s3://catalog/uploads/')
  const presignPut = s.take()
  const badPut = ts.run('S3_ACCESS_KEY=catalog-reader S3_SECRET_KEY=readersecret123 node presign.ts PUT catalog uploads/by-reader.jpg 300 image/jpeg')
  const presignBadUrl = ts.take()
  s.run(`curl -s -i -X PUT -H "Content-Type: image/jpeg" --data-binary @photo.jpg "${badPut.out.trim()}"`, { keep: status })
  const presignBad = s.take()

  // ---- CORS for uploads straight from a web page
  const preflight = (origin) => `curl -s -i -X OPTIONS -H "Origin: ${origin}" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: content-type" http://localhost:9000/catalog/uploads/photo.jpg`
  s.run(preflight('http://localhost:5173'), { keep: status })
  s.run('aws s3api put-bucket-cors --bucket catalog --cors-configuration file://cors.json')
  s.run('aws s3api get-bucket-cors --bucket catalog')
  s.run(preflight('http://localhost:5173'), { keep: status })
  s.run(preflight('https://other-site.example'), { keep: status })
  s.run(`curl -s -i -X PUT -H "Origin: http://localhost:5173" -H "Content-Type: image/jpeg" --data-binary @photo.jpg "${putUrl}"`, { keep: status })
  const cors = s.take()

  writeData(
    'access.ts',
    'ACCESS',
    { version: version(), setup, builtIn, users, reader, uploader, app, accessKey, bucketPolicy, publicBlock, anonymous, presignGet, presignPutUrl, presignPut, presignBadUrl, presignBad, cors },
    { script: 'capture-access.mjs' },
  )
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
