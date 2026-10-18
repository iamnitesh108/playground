// Records lesson 3 "Using S3 day to day": the same everyday tasks with the aws CLI, with rc, and from three
// small programs (Micronaut, TypeScript, Rust) that run against the lab server.
//   (cd java-app && gradle installDist); (cd ts-app && npm install); (cd rust-app && cargo build --release)   # once
//   node capture-using.mjs
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, HERE, LAB, removeContainer, startServer, version, workspace } from './lib/lab.mjs'
import { Session, terminal, writeData } from './lib/record.mjs'

const APPS = {
  java: { cmd: join(HERE, 'java-app/build/install/s3-java-app/bin/s3-java-app'), args: [], cwd: join(HERE, 'java-app') },
  ts: { cmd: 'node', args: ['usage.ts'], cwd: join(HERE, 'ts-app') },
  rust: { cmd: join(HERE, 'rust-app/target/release/s3-rust-app'), args: [], cwd: join(HERE, 'rust-app') },
}
for (const [name, app] of Object.entries(APPS)) if (app.cmd !== 'node' && !existsSync(app.cmd)) throw new Error(`build the ${name} app first`)
if (!existsSync(join(HERE, 'ts-app/node_modules'))) throw new Error('npm install in ts-app first')

function runApp({ cmd, args, cwd }) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', env: { ...process.env, S3_ENDPOINT: `http://localhost:${LAB.api}` }, timeout: 180000 })
  if (r.status !== 0) throw new Error(`${cmd} failed:\n${r.stdout}${r.stderr}`)
  return terminal(r.stdout).split('\n')
}

const w = workspace('using')
try {
  await startServer()
  // a few files on "your laptop"
  const put = (path, body) => {
    mkdirSync(join(w, path, '..'), { recursive: true })
    writeFileSync(join(w, path), body)
  }
  put('mug-front.jpg', Buffer.alloc(48213, 0xd8))
  put('photos/lamp-front.jpg', Buffer.alloc(39552, 0xda))
  put('photos/lamp-side.jpg', Buffer.alloc(41210, 0xdb))
  put('photos/vase.jpg', Buffer.alloc(36004, 0xdc))
  put('readme.txt', 'Product photos and manuals.\n')
  put('site/index.html', '<h1>Catalog</h1>\n')
  put('site/style.css', 'h1 { color: teal; }\n')
  put('site/about.html', '<p>About us</p>\n')

  const s = new Session({ cwd: w })
  const cli = {}
  const rc = {}

  // ---------------------------------------------------------------- aws CLI
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 ls')
  cli.bucket = s.take()

  s.run('aws s3 cp mug-front.jpg s3://catalog/images/mug/front.jpg --content-type image/jpeg --metadata color=blue,sku=MUG-350')
  s.run('aws s3 cp readme.txt s3://catalog/docs/readme.txt')
  s.run('aws s3 cp photos s3://catalog/images/ --recursive')
  cli.upload = s.take()

  s.run('aws s3 ls s3://catalog/')
  s.run('aws s3 ls s3://catalog/images/')
  s.run('aws s3 ls s3://catalog/ --recursive --human-readable --summarize')
  s.run('aws s3api list-objects-v2 --bucket catalog --prefix images/ --delimiter / --query "CommonPrefixes[].Prefix"')
  cli.list = s.take()

  s.run('aws s3 cp s3://catalog/images/mug/front.jpg downloads/front.jpg')
  s.run('aws s3 cp s3://catalog/docs/readme.txt -')
  s.run('wc -c downloads/front.jpg')
  cli.download = s.take()

  s.run('aws s3api head-object --bucket catalog --key images/mug/front.jpg')
  s.run('aws s3api head-object --bucket catalog --key docs/readme.txt --query ContentType')
  cli.metadata = s.take()

  s.run('aws s3 cp s3://catalog/images/mug/front.jpg s3://catalog/images/mug/front-copy.jpg')
  cli.copy = s.take()
  s.run('aws s3 mv s3://catalog/images/vase.jpg s3://catalog/archive/vase.jpg')
  s.run('aws s3 mv s3://catalog/images/lamp-front.jpg s3://catalog/images/lamp/front.jpg')
  s.run('aws s3 mv s3://catalog/images/lamp-side.jpg s3://catalog/images/lamp/side.jpg')
  cli.move = s.take()
  s.run('aws s3 rm s3://catalog/images/mug/front-copy.jpg')
  s.run('aws s3 rm s3://catalog/archive/ --recursive')
  s.run('aws s3 ls s3://catalog/ --recursive')
  cli.delete = s.take()

  s.run('aws s3 sync site s3://catalog/site/')
  s.run('aws s3 sync site s3://catalog/site/')
  writeFileSync(join(w, 'site/style.css'), 'h1 { color: navy; }\n')
  s.note('style.css changed on the laptop; about.html is deleted')
  spawnSync('rm', [join(w, 'site/about.html')])
  s.run('aws s3 sync site s3://catalog/site/ --dryrun')
  s.run('aws s3 sync site s3://catalog/site/ --delete')
  s.run('aws s3 ls s3://catalog/site/')
  cli.sync = s.take()

  const presign = s.run('aws s3 presign s3://catalog/docs/readme.txt --expires-in 600')
  s.run(`curl -s "${presign.out.trim()}"`)
  s.run('curl -s http://localhost:9000/catalog/docs/readme.txt')
  cli.presign = s.take()

  // ---------------------------------------------------------------- rc (RustFS's own client)
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc bucket create lab/products')
  s.run('rc bucket list lab')
  rc.bucket = s.take()
  s.run('rc put mug-front.jpg lab/products/images/mug/front.jpg --content-type image/jpeg --metadata color=blue --metadata sku=MUG-350')
  s.run('rc object copy --recursive ./photos/ lab/products/images/')
  rc.upload = s.take()
  s.run('rc object list lab/products/')
  s.run('rc object list --recursive lab/products/')
  rc.list = s.take()
  s.run('rc get lab/products/images/mug/front.jpg downloads/front-rc.jpg')
  s.run('rc object stat lab/products/images/mug/front.jpg')
  rc.download = s.take()
  s.run('rc object copy lab/products/images/vase.jpg lab/products/archive/vase.jpg')
  s.run('rc object move lab/products/images/lamp-front.jpg lab/products/images/lamp/front.jpg')
  s.run('rc object remove --recursive --force lab/products/archive/')
  s.run('rc object list --recursive lab/products/')
  rc.change = s.take()
  s.run('rc mirror ./site/ lab/products/site/')
  s.run('rc object share lab/products/images/vase.jpg --expire 10m')
  rc.mirror = s.take()

  // ---------------------------------------------------------------- the three apps
  const apps = Object.fromEntries(Object.entries(APPS).map(([name, app]) => [name, runApp(app)]))

  const cargoLock = readFileSync(join(HERE, 'rust-app/Cargo.lock'), 'utf8')
  const crate = (name) => cargoLock.match(new RegExp(`name = "${name}"\\nversion = "([^"]+)"`))?.[1]
  const lib = readdirSync(join(HERE, 'java-app/build/install/s3-java-app/lib'))
  const jar = (name) => lib.map((f) => f.match(new RegExp(`^${name}-([\\d.]+)\\.jar$`))?.[1]).find(Boolean)
  const versions = {
    micronaut: '4.5.0',
    objectStorage: jar('micronaut-object-storage-aws'),
    javaSdk: jar('s3'),
    clientS3: JSON.parse(readFileSync(join(HERE, 'ts-app/node_modules/@aws-sdk/client-s3/package.json'), 'utf8')).version,
    node: process.versions.node,
    rustSdk: crate('aws-sdk-s3'),
    awsCli: s.run('aws --version').out.split(' ')[0].replace('aws-cli/', ''),
    rc: s.run('rc --version').out.replace('rc ', '').trim(),
  }
  s.take()

  writeData('using.ts', 'USING', { version: version(), cli, rc, apps, versions }, { script: 'capture-using.mjs' })
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
