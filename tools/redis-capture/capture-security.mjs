// Records the security lesson: protected mode, protected configs, ACL users, rename-command and TLS.
//   node capture-security.mjs ../../src/modules/redis/data/security.ts
// Servers use ports 17200-17249. TLS certificates are made with openssl in the lab directory.
import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { networkInterfaces, userInfo, homedir } from 'node:os'
import { join } from 'node:path'
import { ROOT, Server, sleep, version } from './lib/server.mjs'
import { Transcript } from './lib/transcript.mjs'

const [, , outFile] = process.argv
if (!outFile) throw new Error('usage: node capture-security.mjs <out.ts>')

let port = 17200
const out = { version: version() }
const cli = (args, opts = {}) => {
  try {
    return execFileSync('redis-cli', args, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000, ...opts }).toString().trimEnd()
  } catch (e) {
    return ((e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '')).trimEnd()
  }
}
/** A shell step as the reader would type it (ports rewritten to 6379). */
const shell = (cmd, output) => ({ shell: true, cmd, out: output })

// A non-loopback address of this machine, to act as "a client on the network"
const lan = Object.values(networkInterfaces()).flat().find((a) => a && a.family === 'IPv4' && !a.internal)?.address

// 1. Protected mode: default user without password, no explicit bind
{
  const s = await new Server('sec-protected', port++, [], { bare: true }).start()
  out.protectedConfig = Object.fromEntries(await (async () => { const c = await s.client(); const r = [['protected-mode', (await c.call('CONFIG', 'GET', 'protected-mode'))[1]], ['bind', (await c.call('CONFIG', 'GET', 'bind'))[1]]]; c.close(); return r })())
  out.lanAvailable = Boolean(lan)
  if (lan) {
    const refused = cli(['-h', lan, '-p', String(s.port), 'PING'])
    const local = cli(['-h', '127.0.0.1', '-p', String(s.port), 'PING'])
    out.protectedMode = [shell('redis-cli -h 192.168.1.20 PING          # from another machine on the network', refused), shell('redis-cli -h 127.0.0.1 PING             # on the server itself', local)]
    // With a password the same network client is let in, after AUTH
    const c = await s.client()
    await c.call('CONFIG', 'SET', 'requirepass', 'correct-horse-battery')
    c.close()
    out.protectedWithPassword = [
      shell('redis-cli -h 192.168.1.20 PING', cli(['-h', lan, '-p', String(s.port), 'PING'])),
      shell('redis-cli -h 192.168.1.20 --user default --pass correct-horse-battery PING', cli(['-h', lan, '-p', String(s.port), '--user', 'default', '--pass', 'correct-horse-battery', '--no-auth-warning', 'PING'])),
    ]
  }
  await s.stop()
}

// 1b. An explicit bind does not switch protected mode off; only a password or protected-mode no does
if (lan) {
  const b = await new Server('sec-bind', port++, ['--bind', '0.0.0.0'], { bare: true }).start()
  const n = await new Server('sec-unprotected', port++, ['--protected-mode', 'no'], { bare: true }).start()
  out.bindOnly = shell('redis-server --bind 0.0.0.0   then from another machine: redis-cli -h 192.168.1.20 PING', cli(['-h', lan, '-p', String(b.port), 'PING']))
  out.unprotected = shell('redis-server --protected-mode no   then from another machine: redis-cli -h 192.168.1.20 PING', cli(['-h', lan, '-p', String(n.port), 'PING']))
  await b.stop(); await n.stop()
}

// 2. Dangerous commands that are off by default: protected configs, MODULE, DEBUG
{
  const s = await new Server('sec-protected-configs', port++, [], { bare: true }).start()
  const c = await s.client()
  const tr = new Transcript()
  for (const line of ['CONFIG GET enable-protected-configs', 'CONFIG GET enable-module-command', 'CONFIG GET enable-debug-command', 'CONFIG SET dir /tmp', 'CONFIG SET dbfilename authorized_keys', 'MODULE LOAD /tmp/evil.so', 'DEBUG SLEEP 1', 'CONFIG SET maxmemory 100mb']) await tr.run(c, line)
  out.offByDefault = tr.steps
  c.close(); await s.stop()
}

// 3. ACL users in depth
{
  const s = await new Server('sec-acl', port++, [], { bare: true }).start()
  const admin = await s.client()
  const app = await s.client()
  const tr = new Transcript()
  const lines = [
    ['admin', 'ACL CAT'],
    ['admin', 'ACL SETUSER orders-api on >s3cret-orders resetkeys ~orders:* %R~catalog:* resetchannels &orders.* -@all +@read +@write +@string +@hash +@list +@connection +@pubsub -@dangerous'],
    ['admin', 'ACL GETUSER orders-api'],
    ['admin', 'ACL DRYRUN orders-api SET orders:42 paid'],
    ['admin', 'ACL DRYRUN orders-api SET catalog:7 cheap'],
    ['admin', 'ACL DRYRUN orders-api GET catalog:7'],
    ['admin', 'ACL DRYRUN orders-api FLUSHDB'],
    ['app', 'AUTH orders-api wrong'],
    ['app', 'AUTH orders-api s3cret-orders'],
    ['app', 'HSET orders:42 status paid total 59.90'],
    ['app', 'GET catalog:7'],
    ['app', 'SET catalog:7 cheap'],
    ['app', 'GET users:1'],
    ['app', 'PUBLISH orders.created 42'],
    ['app', 'PUBLISH users.created 1'],
    ['app', 'KEYS *'],
    ['admin', 'ACL LOG 3'],
    ['admin', 'ACL SETUSER reporting on >r3port-only ~* +@read (~audit:* +@write)'],
    ['admin', 'ACL DRYRUN reporting SET audit:2026-10-18 ok'],
    ['admin', 'ACL DRYRUN reporting SET orders:42 refunded'],
    ['admin', 'ACL SETUSER default off'],
    ['admin', 'ACL LIST'],
  ]
  for (const [who, line] of lines) await tr.run(who === 'admin' ? admin : app, line, who)
  out.acl = tr.steps.map((st) => ({ ...st, out: st.out.replace(/"\d{13}"/g, '"1792300000000"').replace(/\(integer\) 17\d{11}/g, '(integer) 1792300000000').replace(/"age-seconds"\n(\s+\d+\)) "[\d.]+"/g, '"age-seconds"\n$1 "0.02"').replace(/addr=127\.0\.0\.1:\d+ laddr=127\.0\.0\.1:\d+/g, 'addr=10.0.4.12:51734 laddr=10.0.4.5:6379').replace(/"(id=\d+ addr=\S+ laddr=\S+) .*?(cmd=\S+ user=\S+) .*?"/g, '"$1 … $2 …"').replace(/id=\d+ /g, 'id=7 ') }))
  out.aclCategories = (await admin.call('ACL', 'CAT')).length
  admin.close(); app.close(); await s.stop()
}

// 3b. Where users are saved: aclfile + ACL SAVE, or redis.conf + CONFIG REWRITE (never both)
{
  const a = new Server('sec-aclfile', port++, [], { bare: true })
  const file = a.writeFile('users.acl', 'user default on nopass ~* &* +@all\n')
  await a.start(['--aclfile', file])
  let c = await a.client()
  const withFile = new Transcript()
  await withFile.run(c, 'ACL SETUSER metrics on >m3trics +info +ping')
  await withFile.run(c, 'ACL SAVE')
  const aclFile = execFileSync('cat', [file]).toString().trim().split('\n')
  c.close(); await a.stop()

  const b = new Server('sec-conf', port++, [], {})
  b.configFile = b.writeFile('redis.conf', 'protected-mode yes\n')
  await b.start()
  c = await b.client()
  const withConf = new Transcript()
  await withConf.run(c, 'ACL SETUSER metrics on >m3trics +info +ping')
  await withConf.run(c, 'ACL SAVE')
  await withConf.run(c, 'CONFIG REWRITE')
  const confFile = execFileSync('cat', [b.configFile]).toString().trim().split('\n').filter((l) => /^user /.test(l))
  c.close(); await b.stop()
  const short = (l) => l.replace(/#[0-9a-f]{64}/g, (m) => m.slice(0, 13) + '…')
  out.aclfile = { steps: withFile.steps, file: aclFile.map(short) }
  out.aclConf = { steps: withConf.steps, file: confFile.map(short) }
}

// 4. rename-command
{
  const s = await new Server('sec-rename', port++, ['--rename-command', 'FLUSHALL', '', '--rename-command', 'CONFIG', 'CONFIG_b9f2c1'], { bare: true }).start()
  const c = await s.client()
  const tr = new Transcript()
  for (const line of ['FLUSHALL', 'CONFIG GET maxmemory', 'CONFIG_b9f2c1 GET maxmemory']) await tr.run(c, line)
  out.rename = tr.steps
  c.close(); await s.stop()
}

// 5. TLS with a private CA (openssl), server port 0 + tls-port
{
  const dir = join(ROOT, 'sec-tls')
  execFileSync('mkdir', ['-p', dir])
  const steps = [
    ['openssl genrsa -out ca.key 4096', ['genrsa', '-out', 'ca.key', '4096']],
    ['openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -subj "/CN=Example Redis CA" -out ca.crt', ['req', '-x509', '-new', '-nodes', '-key', 'ca.key', '-sha256', '-days', '3650', '-subj', '/CN=Example Redis CA', '-out', 'ca.crt']],
    ['openssl genrsa -out redis.key 2048', ['genrsa', '-out', 'redis.key', '2048']],
    ['openssl req -new -key redis.key -subj "/CN=redis.internal" -out redis.csr', ['req', '-new', '-key', 'redis.key', '-subj', '/CN=redis.internal', '-out', 'redis.csr']],
    ['printf "subjectAltName=DNS:redis.internal,IP:127.0.0.1\\n" > san.ext', ['-c', 'printf "subjectAltName=DNS:redis.internal,IP:127.0.0.1\\n" > san.ext'], 'sh'],
    ['openssl x509 -req -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -extfile san.ext -out redis.crt', ['x509', '-req', '-in', 'redis.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '365', '-sha256', '-extfile', 'san.ext', '-out', 'redis.crt']],
    ['openssl genrsa -out client.key 2048', ['genrsa', '-out', 'client.key', '2048']],
    ['openssl req -new -key client.key -subj "/CN=orders-api" -out client.csr', ['req', '-new', '-key', 'client.key', '-subj', '/CN=orders-api', '-out', 'client.csr']],
    ['openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -out client.crt', ['x509', '-req', '-in', 'client.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-days', '365', '-sha256', '-out', 'client.crt']],
  ]
  for (const [, args, bin = 'openssl'] of steps) execFileSync(bin, args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] })
  out.tlsCerts = steps.map(([cmd]) => cmd)
  const tlsPort = port++
  const serverArgs = ['--port', '0', '--tls-port', String(tlsPort), '--tls-cert-file', 'redis.crt', '--tls-key-file', 'redis.key', '--tls-ca-cert-file', 'ca.crt', '--tls-auth-clients', 'yes', '--dir', dir, '--logfile', join(dir, 'redis.log'), '--save', '']
  out.tlsServerCommand = 'redis-server --port 0 --tls-port 6379 --tls-cert-file redis.crt --tls-key-file redis.key --tls-ca-cert-file ca.crt --tls-auth-clients yes'
  const proc = spawn('redis-server', serverArgs, { cwd: dir, stdio: 'ignore' })
  await sleep(800)
  const run = (args) => cli(args, { cwd: dir })
  out.tls = [
    shell('redis-cli -p 6379 PING                                       # plain TCP to a TLS port', run(['-p', String(tlsPort), 'PING'])),
    shell('redis-cli --tls --cacert ca.crt -p 6379 PING                 # TLS, but no client certificate', run(['--tls', '--cacert', 'ca.crt', '-p', String(tlsPort), 'PING'])),
    shell('redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -p 6379 PING', run(['--tls', '--cacert', 'ca.crt', '--cert', 'client.crt', '--key', 'client.key', '-p', String(tlsPort), 'PING'])),
    shell('redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -p 6379 INFO server | grep -E "redis_version|tcp_port"', run(['--tls', '--cacert', 'ca.crt', '--cert', 'client.crt', '--key', 'client.key', '-p', String(tlsPort), 'INFO', 'server']).split('\n').filter((l) => /redis_version|tcp_port/.test(l)).join('\n')),
  ]
  out.tlsLog = execFileSync('cat', [join(dir, 'redis.log')]).toString().split('\n').filter((l) => /TLS|tls|SSL|Error accepting|handshake/i.test(l)).map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ [*#.-] /, '').replace(/laddr=127\.0\.0\.1:\d+/, 'laddr=10.0.4.5:6379').replace(/addr=127\.0\.0\.1:\d+/, 'addr=10.0.4.12:51734')).slice(0, 4)
  proc.kill('SIGTERM')
  await new Promise((r) => proc.once('exit', r))
}

let json = JSON.stringify(out, null, 1).replaceAll(ROOT, '/data').replace(/\b17[2]\d\d\b/g, '6379')
if (lan) json = json.replaceAll(lan, '192.168.1.20')
for (const secret of [userInfo().username, homedir()]) if (json.includes(secret)) throw new Error(`recording contains "${secret}"`)
writeFileSync(outFile, `// Recorded from Redis ${out.version} by tools/redis-capture/capture-security.mjs — do not edit by hand.\n\nexport const SECURITY = ${json} as const\n`)
console.log('wrote', outFile)
process.exit(0)
