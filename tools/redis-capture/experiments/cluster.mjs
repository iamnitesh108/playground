// Redis Cluster: slots, hash tags, MOVED, ASK during a migration, and a primary failing.
import { execFileSync } from 'node:child_process'

// terminal colour codes in redis-cli output (ESC [ … m)
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g')

export const SLOT_KEYS = [
  'user:1', 'user:2', 'user:1000', 'order:42', 'cart:7', 'session:3f2a', 'a', 'b', 'foo', 'bar', 'hello', 'Hello', '',
  '{user:1}:profile', '{user:1}:cart', '{user:1}.following', 'user:{1}:x', 'foo{}{bar}', 'foo{{bar}}zap', 'foo{bar}{zap}', '{}', '{a', 'a}', '{}{user:1}',
  'product:12345', 'leaderboard:2026', 'rate:user:7:10:41', '名字', 'emoji:😀',
]

export async function run(lab) {
  const out = {}
  const nodes = []
  for (let i = 0; i < 6; i++) nodes.push(await lab.server(`cluster-${i + 1}`, ['--cluster-enabled', 'yes', '--cluster-config-file', 'nodes.conf', '--cluster-node-timeout', '2000'], { bare: true }))
  const ports = nodes.map((n) => n.port)
  const pname = (s) => { let r = String(s); ports.forEach((p, i) => { r = r.replaceAll(String(p), String(7001 + i)) }); return r }

  const create = execFileSync('redis-cli', ['--cluster', 'create', ...ports.map((p) => `127.0.0.1:${p}`), '--cluster-replicas', '1', '--cluster-yes'], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
  out.create = pname(create).replace(ANSI, '').replace(/[0-9a-f]{40}/g, (id) => id.slice(0, 8) + '…').trim()
  const c1 = await nodes[0].client()
  for (let i = 0; i < 100; i++) { if (/cluster_state:ok/.test(await c1.call('CLUSTER', 'INFO'))) break; await lab.sleep(100) }
  await lab.sleep(1500)
  out.info = (await c1.call('CLUSTER', 'INFO')).split('\r\n').filter((l) => /cluster_state|slots_assigned|slots_ok|known_nodes|cluster_size/.test(l)).join('\n')
  out.nodes = pname(await c1.call('CLUSTER', 'NODES')).trim().split('\n').map((l) => { const f = l.split(' '); return { id: f[0].slice(0, 8), addr: f[1].split('@')[0], flags: f[2], master: f[3] === '-' ? '-' : f[3].slice(0, 8), slots: f.slice(8).join(' ') } }).sort((a, b) => a.addr.localeCompare(b.addr))

  // Slots of many keys (the simulator's CRC16 is checked against these)
  out.slots = []
  for (const k of SLOT_KEYS) out.slots.push({ key: k, slot: await c1.call('CLUSTER', 'KEYSLOT', k) })

  // Which node owns which slot
  const owner = (slot) => out.nodes.find((n) => n.flags.includes('master') && n.slots.split(' ').some((r) => { const [a, b] = r.split('-').map(Number); return slot >= a && slot <= (b ?? a) }))

  // MOVED: a plain client asking the wrong node
  const k1 = out.slots.find((s) => owner(s.slot)?.addr !== '127.0.0.1:7001')
  {
    const tr = new lab.Transcript()
    await tr.run(c1, `CLUSTER KEYSLOT ${k1.key}`)
    await tr.run(c1, `SET ${k1.key} hello`)
    out.moved = tr.steps.map((s) => ({ ...s, out: pname(s.out) }))
  }
  // redis-cli -c follows redirects
  out.followed = pname(execFileSync('redis-cli', ['-c', '-p', String(ports[0]), 'SET', k1.key, 'hello']).toString().trim())
  out.followedCmd = `redis-cli -c -p 7001 SET ${k1.key} hello`

  // Multi-key commands across slots, and hash tags
  {
    const target = nodes[ports.indexOf(Number(owner((await c1.call('CLUSTER', 'KEYSLOT', '{user:1}:profile'))).addr.split(':')[1]) - 7001 + ports[0])]
    const ct = await target.client()
    const tr = new lab.Transcript()
    await tr.run(ct, 'MSET user:1:profile Ann user:1:cart apple')
    await tr.run(ct, 'CLUSTER KEYSLOT {user:1}:profile')
    await tr.run(ct, 'CLUSTER KEYSLOT {user:1}:cart')
    await tr.run(ct, 'MSET {user:1}:profile Ann {user:1}:cart apple')
    await tr.run(ct, 'MULTI')
    await tr.run(ct, 'INCR {user:1}:visits')
    await tr.run(ct, 'EXPIRE {user:1}:cart 3600')
    await tr.run(ct, 'EXEC')
    out.multiKey = tr.steps.map((s) => ({ ...s, out: pname(s.out) }))
    ct.close()
  }

  // ASK: move one slot by hand, with a key half-way
  {
    const key = 'cart:7'
    const slot = await c1.call('CLUSTER', 'KEYSLOT', key)
    const src = owner(slot)
    const dst = out.nodes.find((n) => n.flags.includes('master') && n.addr !== src.addr)
    const real = (addr) => nodes[Number(addr.split(':')[1]) - 7001]
    const S = await real(src.addr).client(), D = await real(dst.addr).client()
    const fullId = async (c) => (await c.call('CLUSTER', 'MYID'))
    const srcId = await fullId(S), dstId = await fullId(D)
    await S.call('SET', key, 'apple')
    await S.call('SET', 'cart:7:{cart:7}', 'unused')
    // a second key in the same slot that we will move first
    const tag = `{${key}}:note`
    await S.call('SET', tag, 'moved first')
    const tr = new lab.Transcript()
    await tr.run(D, `CLUSTER SETSLOT ${slot} IMPORTING ${srcId}`, 'target')
    await tr.run(S, `CLUSTER SETSLOT ${slot} MIGRATING ${dstId}`, 'source')
    await tr.run(S, `CLUSTER COUNTKEYSINSLOT ${slot}`, 'source')
    await tr.run(S, `MIGRATE 127.0.0.1 ${real(dst.addr).port} "" 0 5000 KEYS ${tag}`, 'source')
    await tr.run(S, `GET ${key}`, 'source')
    await tr.run(S, `GET ${tag}`, 'source')
    await tr.run(D, `GET ${tag}`, 'target')
    await tr.run(D, 'ASKING', 'target')
    await tr.run(D, `GET ${tag}`, 'target')
    await S.call('MIGRATE', '127.0.0.1', real(dst.addr).port, '', 0, 5000, 'KEYS', key, 'cart:7:{cart:7}')
    for (const n of nodes.filter((_, i) => i < 3)) { const c = await n.client(); await c.call('CLUSTER', 'SETSLOT', slot, 'NODE', dstId); c.close() }
    await tr.run(S, `GET ${key}`, 'source')
    out.ask = { slot, src: src.addr, dst: dst.addr, steps: tr.steps.map((s) => ({ ...s, cmd: pname(s.cmd.replace(srcId, srcId.slice(0, 8) + '…').replace(dstId, dstId.slice(0, 8) + '…')), out: pname(s.out) })) }
    S.close(); D.close()
  }

  // A primary dies: poll the cluster state and a key it owned, from another node.
  // First wait until every replica has finished its first sync (diskless sync waits
  // repl-diskless-sync-delay seconds to batch replicas; an unsynced replica is never promoted).
  out.disklessSyncDelay = (await c1.call('CONFIG', 'GET', 'repl-diskless-sync-delay'))[1]
  for (const n of nodes.slice(3)) {
    const rc = await n.client()
    for (let i = 0; i < 200 && !/master_link_status:up/.test(await rc.call('INFO', 'replication')); i++) await lab.sleep(100)
    rc.close()
  }
  {
    await lab.sleep(1000)
    const victimIdx = 1
    const victim = nodes[victimIdx]
    const vc = await victim.client()
    const vslots = (await vc.call('CLUSTER', 'NODES')).split('\n').find((l) => l.includes('myself')).split(' ').slice(8)
    vc.close()
    const victimSlot = Number(vslots[0].split('-')[0])
    const probeKey = out.slots.find((s) => s.slot >= victimSlot && s.slot <= Number(vslots[0].split('-')[1]))?.key ?? 'user:1'
    const watcher = await nodes[0].client()
    const t0 = Date.now()
    await victim.kill('SIGKILL')
    const timeline = []
    let last = ''
    while (Date.now() - t0 < 40000) {
      const state = (await watcher.call('CLUSTER', 'INFO')).match(/cluster_state:(\w+)/)[1]
      const r = await watcher.send('GET', probeKey)
      const reply = r.type === 'error' ? r.value.split(' ').slice(0, 2).join(' ').replace(/:\d+$/, '') : r.type
      const flags = (await watcher.call('CLUSTER', 'NODES')).split('\n').find((l) => l.includes(`:${victim.port}@`))?.split(' ')[2] ?? '?'
      const line = `${state} | ${flags} | ${reply}`
      if (line !== last) { timeline.push({ ms: Date.now() - t0, state, victimFlags: flags, reply: pname(reply) }); last = line }
      if (state === 'ok' && flags.includes('fail') && !reply.includes('CLUSTERDOWN') && timeline.length > 2) break
      await lab.sleep(50)
    }
    out.failover = { nodeTimeoutMs: 2000, probeKey, victim: pname(`127.0.0.1:${victim.port}`), timeline }
    out.failoverReplicaLog = nodes.slice(3).flatMap((n) => n.messages().filter((l) => /election|failover|Failover|vote|promot|FAIL message|Cluster state|configEpoch|I am now|Setting secondary|master/i.test(l)).map((l) => pname(`${n.port}: ${l}`)))
    out.afterFailover = pname(await watcher.call('CLUSTER', 'NODES')).trim().split('\n').map((l) => { const f = l.split(' '); return { addr: f[1].split('@')[0], flags: f[2], slots: f.slice(8).join(' ') } }).sort((a, b) => a.addr.localeCompare(b.addr))
    watcher.close()
  }
  c1.close()
  for (const n of nodes) await n.kill('SIGKILL')
  return out
}
