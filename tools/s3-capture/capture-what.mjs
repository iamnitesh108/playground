// Records lesson 1 "What object storage is": objects with metadata, a flat namespace listed with and without
// a delimiter, "folders" that vanish with their last object, whole-object overwrites, and a "rename"
// that is really a copy plus a delete.
//   node capture-what.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, LAB, removeContainer, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const w = workspace('what')
try {
  await startServer()
  // the files on "your laptop": made here, shown with find in the recording
  const files = {
    'mug-front.jpg': Buffer.alloc(48213, 0xd8),
    'mug-side.jpg': Buffer.alloc(51870, 0xd9),
    'lamp-front.jpg': Buffer.alloc(39552, 0xda),
    'lamp-manual.pdf': Buffer.alloc(120334, 0x25),
    'readme.txt': 'Product photos and manuals.\n',
  }
  mkdirSync(join(w, 'shop'))
  for (const [name, body] of Object.entries(files)) writeFileSync(join(w, 'shop', name), body)

  const s = new Session({ cwd: join(w, 'shop') })
  s.run('find . -type f -printf "%P  %s bytes\\n" | sort')
  const laptop = s.take()

  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 cp mug-front.jpg s3://catalog/images/mug/front.jpg --content-type image/jpeg --metadata color=blue,sku=MUG-350')
  s.run('aws s3 cp mug-side.jpg s3://catalog/images/mug/side.jpg --content-type image/jpeg')
  s.run('aws s3 cp lamp-front.jpg s3://catalog/images/lamp/front.jpg --content-type image/jpeg')
  s.run('aws s3 cp lamp-manual.pdf s3://catalog/manuals/lamp.pdf --content-type application/pdf')
  s.run('aws s3 cp readme.txt s3://catalog/readme.txt --content-type text/plain')
  const upload = s.take()

  s.run('aws s3 mb s3://Product_Photos')
  s.run('aws s3 mb s3://catalog')
  const bucketNames = s.take()

  const head = s.run('aws s3api head-object --bucket catalog --key images/mug/front.jpg')
  const headObject = JSON.parse(head.out)
  const anatomy = s.take()

  s.run('aws s3api list-objects-v2 --bucket catalog --query "Contents[].[Key, Size]" --output text')
  const flat = s.take()

  s.run('aws s3api list-objects-v2 --bucket catalog --delimiter / --query "{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}"')
  s.run('aws s3api list-objects-v2 --bucket catalog --prefix images/ --delimiter / --query "{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}"')
  s.run('aws s3api list-objects-v2 --bucket catalog --prefix images/mug/ --delimiter / --query "{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}"')
  const delimiter = s.take()

  s.run('aws s3 ls s3://catalog/')
  s.run('aws s3 ls s3://catalog/images/')
  s.run('aws s3 ls s3://catalog/ --recursive')
  const ls = s.take()

  s.run('aws s3 rm s3://catalog/manuals/lamp.pdf')
  s.run('aws s3 ls s3://catalog/')
  const vanish = s.take()

  // a whole-object overwrite: there is no "append" or "change bytes 10-20"
  s.run('aws s3 cp s3://catalog/readme.txt -')
  s.run('aws s3api head-object --bucket catalog --key readme.txt --query "{size: ContentLength, etag: ETag}"')
  writeFileSync(join(w, 'shop', 'readme.txt'), 'Product photos and manuals.\nLamp manual moved to the support site.\n')
  s.run('aws s3 cp readme.txt s3://catalog/readme.txt --content-type text/plain')
  s.run('aws s3 cp s3://catalog/readme.txt -')
  s.run('aws s3api head-object --bucket catalog --key readme.txt --query "{size: ContentLength, etag: ETag}"')
  const overwrite = s.take()

  // "rename": the CLI's mv, with the HTTP requests it sent
  const mv = s.run('aws --debug s3 mv s3://catalog/readme.txt s3://catalog/docs/readme.txt', {
    keep: (out) => out.split('\n').filter((l) => l.startsWith('move:')).join('\n'),
  })
  const debugLines = `${mv.stdout}${mv.stderr}`.split('\n')
  const requests = []
  let op = null
  for (const l of debugLines) {
    const m = l.match(/Making request for OperationModel\(name=(\w+)\)/)
    if (m) op = m[1]
    const h = l.match(/"(GET|PUT|HEAD|DELETE|POST) (\S+) HTTP\/1\.1" (\d+)/)
    if (h && op) {
      requests.push({ op, method: h[1], path: h[2], status: Number(h[3]) })
      op = null
    }
  }
  s.run('aws s3 ls s3://catalog/ --recursive')
  const rename = s.take()

  // key rules RustFS enforces because keys become paths on its drives
  s.run('aws s3api put-object --bucket catalog --key images/../secret.txt --body readme.txt')
  s.run('aws s3api put-object --bucket catalog --key images//double-slash.jpg --body readme.txt')
  s.run('aws s3api put-object --bucket catalog --key "images/mug/front (copy).jpg" --body readme.txt --query ETag')
  const keyRules = s.take()

  writeData('what.ts', 'WHAT', { version: version(), laptop, upload, bucketNames, anatomy, headObject, flat, delimiter, ls, vanish, overwrite, rename, requests, keyRules }, { script: 'capture-what.mjs' })
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
