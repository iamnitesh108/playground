// Pub/Sub (fire and forget), list queues, and Streams with consumer groups.
import { formatReply } from '../lib/format.mjs'

export async function run(lab) {
  const s = await lab.server('msg')
  const out = {}
  const [pub, sub1, sub2] = [await s.client(), await s.client(), await s.client()]

  // Pub/Sub: two subscribers, then one disconnects
  {
    const tr = new lab.Transcript()
    await tr.run(sub1, 'SUBSCRIBE orders', 'sub-1')
    await tr.run(sub2, 'PSUBSCRIBE orders*', 'sub-2')
    await tr.run(pub, 'PUBLISH orders "order 1001 paid"', 'publisher')
    tr.steps.push({ who: 'sub-1', cmd: '(message arrives)', out: formatReply(await sub1.nextPush()).trimEnd() })
    tr.steps.push({ who: 'sub-2', cmd: '(message arrives)', out: formatReply(await sub2.nextPush()).trimEnd() })
    sub1.close()
    tr.note('sub-1 disconnects (a deploy, a network blip)')
    await lab.sleep(100)
    await tr.run(pub, 'PUBLISH orders "order 1002 paid"', 'publisher')
    tr.steps.push({ who: 'sub-2', cmd: '(message arrives)', out: formatReply(await sub2.nextPush()).trimEnd() })
    tr.note('sub-2 disconnects too')
    sub2.close()
    await lab.sleep(100)
    await tr.run(pub, 'PUBLISH orders "order 1003 paid"', 'publisher')
    tr.note('order 1003 reached nobody, and nothing kept it')
    await tr.run(pub, 'PUBSUB NUMSUB orders', 'publisher')
    out.pubsub = tr.steps
  }

  // A subscriber that stops reading gets disconnected by the server
  {
    const limit = (await pub.call('CONFIG', 'GET', 'client-output-buffer-limit'))[1]
    out.outputBufferDefault = limit
    await pub.call('CONFIG', 'SET', 'client-output-buffer-limit', 'pubsub 256kb 64kb 60')
    const slow = await s.client()
    await slow.call('SUBSCRIBE', 'firehose')
    slow.sock.pause()                       // stops reading from the socket
    const before = s.log().length
    let received = 0
    for (let i = 0; i < 2000; i++) received = Math.max(received, await pub.call('PUBLISH', 'firehose', 'x'.repeat(50_000)))
    await lab.sleep(200)
    out.slowSubscriber = { publishedBytes: 2000 * 50_000, disconnections: Number((await pub.call('INFO', 'stats')).match(/client_output_buffer_limit_disconnections:(\d+)/)?.[1]), limit: 'pubsub 256kb 64kb 60', subscribersAtEnd: (await pub.call('PUBSUB', 'NUMSUB', 'firehose'))[1], log: s.log().slice(before).split('\n').filter((l) => /output buffer|closed/i.test(l)).map((l) => l.replace(/^\d+:[A-Z] \d+ \w+ \d{4} [\d:.]+ [*#.-] /, '').replace(/id=\d+ addr=[^ ]+ laddr=[^ ]+ fd=\d+/, 'id=… addr=… fd=…').replace(/^Client id=… addr=… fd=… .*?(sub=\d+).*?(omem=\d+).*?(scheduled to be closed.*)$/, 'Client id=… addr=… fd=… … $1 … $2 … $3')).slice(0, 1) }
    slow.close()
  }

  // A list as a work queue, with a processing list so a crash does not lose the job
  {
    const [producer, worker] = [await s.client(), await s.client()]
    const tr = new lab.Transcript()
    await tr.run(producer, 'LPUSH jobs:email job-1 job-2', 'producer')
    await tr.run(worker, 'BLMOVE jobs:email jobs:email:processing RIGHT LEFT 5', 'worker')
    await tr.run(worker, 'LRANGE jobs:email:processing 0 -1', 'worker')
    tr.note('the worker sends the email, then removes the job from its processing list')
    await tr.run(worker, 'LREM jobs:email:processing 1 job-1', 'worker')
    await tr.run(worker, 'BLMOVE jobs:email jobs:email:processing RIGHT LEFT 5', 'worker')
    tr.note('the worker crashes here; job-2 is still in jobs:email:processing, where a reaper can find it')
    await tr.run(producer, 'LRANGE jobs:email:processing 0 -1', 'producer')
    const done = tr.start(worker, 'BLPOP jobs:sms 5', 'worker')
    await lab.sleep(300)
    await tr.run(producer, 'RPUSH jobs:sms sms-1', 'producer')
    await done()
    out.listQueue = tr.steps
    producer.close(); worker.close()
  }

  // Streams with a consumer group
  {
    const [p, c1, c2, admin] = [await s.client(), await s.client(), await s.client(), await s.client()]
    const ids = []
    const idFix = (txt) => { if (!txt) return txt; ids.forEach((id, i) => { txt = txt.replaceAll(id, `${1792300000000 + i * 7}-0`) }); return txt }
    const tr = new lab.Transcript()
    for (const o of ['1001', '1002', '1003', '1004']) {
      const r = await tr.run(p, `XADD orders * order ${o} status paid`, 'producer')
      ids.push(r.value.toString())
    }
    await tr.run(p, 'XLEN orders', 'producer')
    await tr.run(admin, 'XGROUP CREATE orders billing 0', 'admin')
    await tr.run(c1, 'XREADGROUP GROUP billing worker-1 COUNT 2 STREAMS orders >', 'worker-1')
    await tr.run(c2, 'XREADGROUP GROUP billing worker-2 COUNT 2 STREAMS orders >', 'worker-2')
    await tr.run(c1, `XACK orders billing ${ids[0]} ${ids[1]}`, 'worker-1')
    tr.note('worker-2 crashes before acknowledging its two orders')
    await tr.run(admin, 'XPENDING orders billing', 'admin')
    await tr.run(admin, 'XPENDING orders billing - + 10', 'admin')
    await lab.sleep(1100)
    tr.note('(1.1 seconds later) worker-1 claims entries idle for more than 1000 ms')
    await tr.run(c1, 'XAUTOCLAIM orders billing worker-1 1000 0-0 COUNT 10', 'worker-1')
    await tr.run(c1, `XACK orders billing ${ids[2]} ${ids[3]}`, 'worker-1')
    await tr.run(admin, 'XINFO GROUPS orders', 'admin')
    await tr.run(admin, 'XGROUP CREATE orders analytics 0', 'admin')
    await tr.run(admin, 'XREADGROUP GROUP analytics a-1 COUNT 10 STREAMS orders >', 'admin')
    out.streams = tr.steps.map((st) => ({ ...st, cmd: idFix(st.cmd), out: st.out ? idFix(st.out) : st.out }))
    // Blocking read woken by a new entry
    const t2 = new lab.Transcript()
    const waiting = t2.start(c2, 'XREADGROUP GROUP billing worker-2 BLOCK 5000 STREAMS orders >', 'worker-2')
    await lab.sleep(300)
    const r = await t2.run(p, 'XADD orders * order 1005 status paid', 'producer')
    ids.push(r.value.toString())
    await waiting()
    out.streamsBlocking = t2.steps.map((st) => ({ ...st, cmd: idFix(st.cmd), out: idFix(st.out) }))
    // Trimming
    const t3 = new lab.Transcript()
    for (let i = 0; i < 2000; i++) await p.call('XADD', 'events', '*', 'n', i)
    await t3.run(p, 'XLEN events')
    await t3.run(p, 'XTRIM events MAXLEN ~ 1000')
    await t3.run(p, 'XLEN events')
    await t3.run(p, 'XTRIM events MAXLEN 1000')
    await t3.run(p, 'XLEN events')
    out.streamTrim = t3.steps
    ;[p, c1, c2, admin].forEach((x) => x.close())
  }
  pub.close()
  await s.stop()
  return out
}
