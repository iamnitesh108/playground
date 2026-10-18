// Replication (full and partial resync, the backlog, WAIT) and Sentinel failover.
const stat = (info, k) => info.match(new RegExp(`^${k}:(.*)$`, 'm'))?.[1]?.trim()
const REPL_LOG = /sync|Synchronization|replica|MASTER|backlog|PSYNC|Partial|Full|BGSAVE|connecting|Connecting|Master replied|replication ID|Discarding/i

export async function run(lab) {
  const out = {}
  const master = await lab.server('master', ['--repl-backlog-size', '1mb'])
  const m = await master.client()
  await m.call('DEBUG', 'POPULATE', 100_000, 'order', 50)
  const replica = await lab.server('replica', ['--replicaof', '127.0.0.1', String(master.port)])
  const r = await replica.client()
  while (stat(await r.call('INFO', 'replication'), 'master_link_status') !== 'up') await lab.sleep(50)
  await lab.sleep(300)
  out.fullSyncMaster = master.messages().filter((l) => REPL_LOG.test(l)).map((l) => l.replaceAll(String(replica.port), '6380').replaceAll(String(master.port), '6379'))
  out.fullSyncReplica = replica.messages().filter((l) => REPL_LOG.test(l)).map((l) => l.replaceAll(String(replica.port), '6380').replaceAll(String(master.port), '6379'))

  const mi = await m.call('INFO', 'replication'), ri = await r.call('INFO', 'replication')
  const pick = (info, keys) => keys.map((k) => `${k}:${stat(info, k)}`).join('\n').replaceAll(String(replica.port), '6380').replaceAll(String(master.port), '6379')
  out.infoMaster = pick(mi, ['role', 'connected_slaves', 'slave0', 'master_replid', 'master_repl_offset', 'repl_backlog_active', 'repl_backlog_size', 'repl_backlog_first_byte_offset', 'repl_backlog_histlen'])
  out.infoReplica = pick(ri, ['role', 'master_host', 'master_port', 'master_link_status', 'master_last_io_seconds_ago', 'slave_repl_offset', 'slave_read_only', 'master_replid', 'master_repl_offset'])

  {
    const tr = new lab.Transcript()
    await tr.run(m, 'SET order:9001 paid', 'primary')
    await tr.run(m, 'WAIT 1 1000', 'primary')
    await tr.run(r, 'GET order:9001', 'replica')
    await tr.run(r, 'SET order:9002 paid', 'replica')
    out.readOnly = tr.steps
  }

  // Short disconnect: partial resync from the backlog
  const logLen = master.log().length, rlogLen = replica.log().length
  await m.call('CLIENT', 'KILL', 'TYPE', 'replica')
  for (let i = 0; i < 100; i++) await m.call('SET', `while-away:${i}`, i)
  for (let i = 0; i < 60 && stat(await r.call('INFO', 'replication'), 'master_link_status') !== 'up'; i++) await lab.sleep(100)
  await lab.sleep(300)
  const tail = (s, from) => s.log().slice(from).split('\n').map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ [*#.-] /, '')).filter((l) => REPL_LOG.test(l)).map((l) => l.replaceAll(String(replica.port), '6380').replaceAll(String(master.port), '6379'))
  out.partialMaster = tail(master, logLen)
  out.partialReplica = tail(replica, rlogLen)

  // Long disconnect: more writes than the backlog holds → full resync
  await m.call('CONFIG', 'SET', 'repl-backlog-size', '16384')
  await lab.sleep(200)
  const logLen2 = master.log().length
  replica.proc.kill('SIGSTOP')           // the replica is frozen: it cannot reconnect while the burst is written
  await m.call('CLIENT', 'KILL', 'TYPE', 'replica')
  await m.pipeline(Array.from({ length: 2000 }, (_, i) => ['SET', `burst:${i}`, 'x'.repeat(100)]))
  replica.proc.kill('SIGCONT')
  for (let i = 0; i < 80 && stat(await r.call('INFO', 'replication'), 'master_link_status') !== 'up'; i++) await lab.sleep(100)
  await lab.sleep(500)
  out.backlogTooSmall = { backlogBytes: 16384, writtenBytes: 2000 * 100, master: tail(master, logLen2) }

  // A replica that is not keeping up: WAIT tells you
  {
    replica.proc.kill('SIGSTOP')
    const tr = new lab.Transcript()
    await tr.run(m, 'SET order:9003 paid', 'primary')
    await tr.run(m, 'WAIT 1 500', 'primary')
    out.waitStopped = tr.steps
    replica.proc.kill('SIGCONT')
  }
  m.close(); r.close()
  await replica.stop(); await master.stop()

  // Sentinel: one primary, one replica, three sentinels; then the primary crashes
  const p = await lab.server('s-primary', [], { bare: true })
  const rp = await lab.server('s-replica', ['--replicaof', '127.0.0.1', String(p.port)], { bare: true })
  const sentinels = []
  for (let i = 1; i <= 3; i++) {
    const sv = lab.newServer(`sentinel-${i}`, [], { binary: 'redis-sentinel' })
    const conf = sv.writeFile('sentinel.conf', `port ${sv.port}\ndir ${sv.dir}\nlogfile ${sv.logPath}\nsentinel monitor shop 127.0.0.1 ${p.port} 2\nsentinel down-after-milliseconds shop 1000\nsentinel failover-timeout shop 5000\nsentinel parallel-syncs shop 1\n`)
    sv.configFile = conf
    sv.bare = true
    sv.args = []
    sentinels.push(sv)
  }
  // redis-sentinel takes the config file as the only argument
  for (const sv of sentinels) { sv.start = async function () { const { spawn } = await import('node:child_process'); this.proc = spawn('redis-sentinel', [this.configFile], { stdio: 'ignore' }); for (let i = 0; i < 100; i++) { try { const c = await this.client(); await c.call('PING'); c.close(); return this } catch { await lab.sleep(50) } } } ; await sv.start() }
  const s1 = await sentinels[0].client()
  for (let i = 0; i < 100; i++) { const replicas = await s1.call('SENTINEL', 'REPLICAS', 'shop'); const sents = await s1.call('SENTINEL', 'SENTINELS', 'shop'); if (replicas.length === 1 && sents.length === 2) break; await lab.sleep(200) }
  const portName = (x) => String(x).replaceAll(String(p.port), '6379').replaceAll(String(rp.port), '6380')
  out.sentinelBefore = portName((await s1.call('SENTINEL', 'GET-MASTER-ADDR-BY-NAME', 'shop')).join(':'))
  const t0 = Date.now()
  await p.kill('SIGKILL')
  let addr
  for (;;) {
    addr = (await s1.call('SENTINEL', 'GET-MASTER-ADDR-BY-NAME', 'shop')).join(':')
    if (addr.endsWith(String(rp.port))) break
    if (Date.now() - t0 > 20000) throw new Error('no failover')
    await lab.sleep(50)
  }
  out.failoverMs = Date.now() - t0
  out.sentinelAfter = portName(addr)
  await lab.sleep(1500)
  const events = /\+sdown|\+odown|\+new-epoch|\+try-failover|\+vote-for-leader|\+elected-leader|\+failover-state|\+selected-slave|\+promoted-slave|\+switch-master|\+failover-end|\+convert-to-slave|\+slave /
  out.sentinelLog = sentinels[0].messages().filter((l) => events.test(l)).map((l) => portName(l).replace(/[0-9a-f]{40}/g, '<id>'))
  // The old primary comes back and is turned into a replica
  await p.start()
  const back = Date.now()
  const pc = await p.client()
  out.oldPrimaryRoleOnReturn = (await pc.call('INFO', 'replication')).match(/^role:(.*)$/m)[1].trim()
  // Sentinel disconnects normal clients when it reconfigures an instance, so reconnect on every poll
  for (;;) {
    let role = ''
    try { const q = await p.client(); role = await q.call('INFO', 'replication'); q.close() } catch {}
    if (/role:slave/.test(role) || Date.now() - back > 30000) break
    await lab.sleep(200)
  }
  out.convertedAfterMs = Date.now() - back
  const pc2 = await p.client()
  out.oldPrimaryRole = portName(pick(await pc2.call('INFO', 'replication'), ['role', 'master_host', 'master_port', 'master_link_status']))
  out.sentinelLogAfterReturn = sentinels[0].messages().filter((l) => /\+convert-to-slave|-sdown/.test(l)).map((l) => portName(l).replace(/[0-9a-f]{40}/g, '<id>')).slice(-2)
  pc.close(); pc2.close(); s1.close()
  for (const sv of sentinels) await sv.kill('SIGTERM')
  await rp.stop(); await p.stop()
  return out
}
