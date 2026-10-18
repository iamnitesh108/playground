import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarChart, ByteLayout, Flow, StatTiles, Timeline, type Hue } from '@/shared/figures'
import { DurabilityPlayground } from '../components/DurabilityPlayground'
import { LogLines } from '../components/LogLines'
import { CAPTURE, REDIS_VERSION } from '../data/captures'

const P = CAPTURE.persistence
const D = P.rdb.configDefaults
const MB = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`

const CRASH_LABEL: Record<string, string> = {
  none: 'no persistence',
  rdb: 'RDB snapshot taken halfway',
  'aof-everysec': 'AOF, appendfsync everysec',
  'aof-always': 'AOF, appendfsync always',
}

/** "105.77M" → megabytes */
const megabytes = (human: string) => Number(human.replace(/[^\d.]/g, '')) * (/G$/.test(human) ? 1024 : /K$/.test(human) ? 1 / 1024 : 1)

/** The RESP lines of the first SET in the recorded incremental AOF, with their sizes (each line ends in \r\n). */
function firstSet(aof: string) {
  const lines = aof.split('\n')
  const at = lines.indexOf('SET')
  const frame = at > 1 ? lines.slice(at - 2, at + 5) : []
  return frame.map((l) => ({ content: l, bytes: l.length + 2 }))
}

/** File names in appendonlydir/ from a recorded listing. */
const aofFiles = (listing: string) => [...listing.matchAll(/appendonly\.aof\.\d+\.(?:base\.rdb|incr\.aof)/g)].map((m) => m[0])

const CRASH_HUE: Record<string, Hue> = { none: 8, rdb: 4, 'aof-everysec': 6, 'aof-always': 6 }

const rps = (line: string) => Number(line.match(/([\d.]+) requests per second/)?.[1] ?? 0)

export default function Persistence() {
  const bench = P.fsyncBench.map((b) => ({ label: b.label, value: Math.round(rps(b.result)), p50: b.result.match(/p50=([\d.]+)/)?.[1] }))
  const by = (label: string) => bench.find((b) => b.label === label)?.value ?? 1
  const slowdown = Math.round(by('appendfsync everysec') / by('appendfsync always'))
  return (
    <>
      <LessonGoals
        goals={[
          'know what RDB snapshots and the AOF write, and when',
          'read the files Redis keeps on disk and what is inside them',
          'predict how many acknowledged writes survive a crash for each setting — checked against a real kill -9',
          'choose a persistence setting for a cache, a queue and a primary data store',
        ]}
        before="Lesson 1 — Redis keeps everything in memory"
      />

      <h2>Memory first, disk second</h2>
      <p>
        Redis answers every command from memory. Persistence is a copy kept on disk so that a restart does not start empty. There are two
        kinds, and they can be combined:
      </p>
      <TermList
        items={[
          { term: 'RDB', definition: 'A snapshot: the whole dataset at one moment, in a compact binary file (dump.rdb).' },
          { term: 'AOF', definition: 'The append-only file: every write command, appended as it happens, replayed on start.' },
          { term: 'fork', definition: 'The system call that creates a child process with a copy of the parent’s memory — cheaply, by sharing pages.' },
          { term: 'copy-on-write', definition: 'After a fork, a memory page is copied only when one side writes to it. Untouched pages stay shared.' },
          { term: 'fsync', definition: 'Asking the kernel to put a file’s data on the physical disk. Before fsync, written data sits in the kernel’s page cache.' },
        ]}
      />
      <p>The defaults of the recorded server (Redis {REDIS_VERSION}, no configuration file):</p>
      <Table
        head={['Setting', 'Default', 'Meaning']}
        rows={[
          [<code key="s">save</code>, <code key="v">{D.save}</code>, 'snapshot after 3600 s if ≥ 1 write, after 300 s if ≥ 100, after 60 s if ≥ 10,000'],
          [<code key="s">appendonly</code>, <code key="v">{D.appendonly}</code>, 'the AOF is off'],
          [<code key="s">appendfsync</code>, <code key="v">{D.appendfsync}</code>, 'when the AOF is on: fsync once per second'],
          [<code key="s">aof-use-rdb-preamble</code>, <code key="v">{D.aofUseRdbPreamble}</code>, 'a rewritten AOF starts with an RDB snapshot'],
          [<code key="s">auto-aof-rewrite-percentage</code>, <code key="v">{D.autoAofRewritePercentage}</code>, 'rewrite the AOF when it has doubled since the last rewrite…'],
          [<code key="s">auto-aof-rewrite-min-size</code>, <code key="v">{MB(Number(D.autoAofRewriteMinSize))}</code>, '…but never below this size'],
        ]}
      />
      <p>
        So out of the box Redis takes a snapshot now and then, and a crash loses everything since the last one. Packaged installs and container
        images often ship their own configuration — always check <code>CONFIG GET save</code> and <code>CONFIG GET appendonly</code> on your server.
      </p>

      <h2>RDB: a snapshot by forking</h2>
      <p>
        <code>BGSAVE</code> (or a <code>save</code> rule) forks the server. The child sees the memory exactly as it was at the fork, writes it to
        a temporary file and renames it to <code>dump.rdb</code>. The parent keeps serving clients the whole time.
      </p>
      <p>
        Thanks to copy-on-write the
        child costs almost no memory — only the pages the parent changes during the save get copied. Recorded with {P.rdb.keys.toLocaleString()}{' '}
        keys:
      </p>
      <Flow
        title="BGSAVE: fork, share the pages, copy only what changes"
        cols={4}
        rows={2}
        nodes={[
          { id: 'clients', label: 'clients', sub: 'keep writing', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'parent', label: 'Redis (parent)', sub: 'serves commands', col: 1, row: 0, hue: 2 },
          { id: 'pages', label: 'memory pages', sub: 'shared, copied on write', col: 2, row: 0, hue: 3, shape: 'queue' },
          { id: 'child', label: 'child process', sub: 'sees the fork moment', col: 2, row: 1, hue: 4 },
          { id: 'tmp', label: 'temp-<pid>.rdb', sub: 'written by the child', col: 3, row: 1, hue: 4, shape: 'log' },
          { id: 'rdb', label: 'dump.rdb', sub: MB(P.rdb.fileBytes), col: 3, row: 0, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'clients', to: 'parent', label: 'writes', hue: 1, flow: true },
          { from: 'parent', to: 'pages', hue: 3 },
          { from: 'parent', to: 'child', label: 'fork()', hue: 4, dashed: true },
          { from: 'pages', to: 'child', label: 'read', hue: 3 },
          { from: 'child', to: 'tmp', label: 'serialize', hue: 4, flow: true },
          { from: 'tmp', to: 'rdb', label: 'rename', hue: 4 },
        ]}
        steps={[
          { title: 'BGSAVE forks', body: <p>The parent calls <code>fork()</code>: the child gets the same memory by sharing its pages. Copying the page tables is the only pause — recorded: {(P.rdb.forkUsec / 1000).toFixed(1)} ms for {P.rdb.usedMemory} of data.</p>, active: ['parent', 'child', 'parent>child'] },
          { title: 'The child reads a frozen picture', body: <p>The child walks the shared pages — the data exactly as it was at the fork — and serializes it into a temporary file.</p>, active: ['pages', 'child', 'tmp', 'pages>child', 'child>tmp'] },
          { title: 'Meanwhile the parent keeps serving', body: <p>Clients keep writing. When the parent changes a page, the kernel copies it first so the child still sees the old one: copy-on-write. Recorded here: {MB(P.rdb.cowBytes)} copied.</p>, active: ['clients', 'parent', 'pages', 'clients>parent', 'parent>pages'] },
          { title: 'Rename: the new snapshot replaces the old', body: <p>When the file is complete the child renames it to <code>dump.rdb</code> in one step, so a crash mid-save never leaves a half-written snapshot. Recorded: {P.rdb.lastBgsaveSec} s.</p>, active: ['tmp', 'rdb', 'tmp>rdb'] },
        ]}
      />
      <StatTiles
        title={`One BGSAVE of ${P.rdb.keys.toLocaleString()} keys (recorded)`}
        stats={[
          { label: 'dataset in memory', value: P.rdb.usedMemory, sub: 'used_memory', hue: 3 },
          { label: 'server paused by fork()', value: `${(P.rdb.forkUsec / 1000).toFixed(1)} ms`, sub: `latest_fork_usec ${P.rdb.forkUsec}`, hue: 2 },
          { label: 'copied by copy-on-write', value: MB(P.rdb.cowBytes), sub: 'rdb_last_cow_size', hue: 7 },
          { label: 'dump.rdb on disk', value: MB(P.rdb.fileBytes), sub: `written in ${P.rdb.lastBgsaveSec} s`, hue: 4 },
        ]}
      />
      <BarChart
        title="Memory vs file (MB, recorded)"
        unit=" MB"
        bars={[
          { label: 'dataset in memory', value: Math.round(megabytes(P.rdb.usedMemory) * 10) / 10, hue: 3 },
          { label: 'dump.rdb on disk', value: Math.round((P.rdb.fileBytes / 1024 / 1024) * 10) / 10, hue: 4 },
          { label: 'copy-on-write during the save', value: Math.round((P.rdb.cowBytes / 1024 / 1024) * 10) / 10, hue: 7 },
        ]}
      />
      <LogLines title="server log during BGSAVE (recorded)" lines={P.rdb.log} highlight={/CoW/} />
      <p>
        Two things in these numbers matter for design.
      </p>
      <ul>
        <li>
          The file is much smaller than memory (no pointers, compact encodings, and compression), so snapshots are good backups and fast to load.
        </li>
        <li>
          The fork itself is the only pause: it copies the page tables, so it grows with the size of the dataset — a few milliseconds here, but
          hundreds of milliseconds for tens of gigabytes. During heavy writes many pages get copied, so a busy server can need much more memory
          while a snapshot runs.
        </li>
      </ul>
      <Callout tone="warn" title="Leave memory for the fork">
        In the worst case (every page written during the save) the parent and the child together need twice the memory. Set{' '}
        <code>maxmemory</code> well below the machine’s memory and set the kernel’s <code>vm.overcommit_memory = 1</code>, which Redis
        recommends, so the fork is not refused when memory looks short.
      </Callout>

      <h2>AOF: a log of write commands</h2>
      <p>
        With <code>appendonly yes</code> Redis appends every write to a log. Since Redis 7 the log is several files in{' '}
        <code>appendonlydir/</code>, tied together by a manifest. Right after starting:
      </p>
      <CodeBlock title="appendonlydir/ on a fresh server (recorded)" language="text" code={P.aofFilesAtStart} />
      <CodeBlock title="appendonly.aof.manifest" language="text" code={P.aofManifest} />
      <p>
        The base file (<code>type b</code>) holds the data as of the last rewrite — here an RDB file, because of <code>aof-use-rdb-preamble</code>.
        The incremental file (<code>type i</code>) holds the commands since. After{' '}
        <code>SET cart:7 apple</code>, two <code>INCR visits</code>, <code>EXPIRE cart:7 3600</code> and <code>DEL cart:7</code>, it contains:
      </p>
      <CodeBlock title="appendonly.aof.1.incr.aof — RESP, one command after another" language="text" code={P.aofIncr} />
      <ByteLayout
        title="One command in the file, to scale: SET cart:7 apple (every line ends in \r\n)"
        rows={[
          {
            fields: firstSet(P.aofIncr).map((l, i) => ({
              label: i === 0 ? 'array of 3' : l.content.startsWith('$') ? 'length' : 'argument',
              bytes: l.bytes,
              content: l.content,
              hue: (l.content.startsWith('*') ? 2 : l.content.startsWith('$') ? 7 : 3) as Hue,
            })),
          },
        ]}
        caption={`${firstSet(P.aofIncr).reduce((n, l) => n + l.bytes, 0)} bytes on disk for a three-word command: the headers say how many arguments there are and how long each one is.`}
      />
      <p>
        It is the same protocol clients speak (lesson 2): replaying the file is replaying the commands. Note one rewrite on the way:{' '}
        <code>EXPIRE cart:7 3600</code> was stored as <code>PEXPIREAT</code> with an absolute time, so a replay after a restart does not give the
        key another full hour.
      </p>

      <h3>When the data reaches the disk</h3>
      <p>
        Redis collects the writes of one event-loop iteration in a buffer and <code>write()</code>s it to the file before it sends the replies.
        So an acknowledged write is normally already in the kernel.
      </p>
      <p>
        The exception is <code>everysec</code> on a disk that cannot keep up: if the previous background fsync is still running, Redis postpones
        the <code>write()</code> itself (for up to 2 s) while it keeps replying. In that window even a process crash can lose acknowledged writes.
      </p>
      <p>
        <code>appendfsync</code> decides when the kernel is told to put the data on the disk:
      </p>
      <Flow
        title="Where an acknowledged write is, and how fsync moves it to the disk"
        cols={5}
        rows={2}
        nodes={[
          { id: 'cmd', label: 'write cmd', sub: 'run in memory', col: 0, row: 0, hue: 2 },
          { id: 'buf', label: 'AOF buffer', sub: 'appended here', col: 1, row: 0, hue: 3, shape: 'queue' },
          { id: 'cache', label: 'page cache', sub: 'kernel, via write()', col: 2, row: 0, hue: 7 },
          { id: 'disk', label: 'disk', sub: 'appendonlydir/', col: 4, row: 0, hue: 4, shape: 'store' },
          { id: 'reply', label: 'reply +OK', sub: 'to the client', col: 2, row: 1, hue: 1, shape: 'actor' },
          { id: 'bio', label: 'bio_aof', sub: 'background fsync', col: 3, row: 1, hue: 4 },
        ]}
        edges={[
          { from: 'cmd', to: 'buf', hue: 3, flow: true },
          { from: 'buf', to: 'cache', hue: 7, flow: true },
          { from: 'cache', to: 'disk', label: 'fsync', hue: 4, flow: true },
          { from: 'cache', to: 'reply', label: 'then reply', hue: 1 },
          { from: 'bio', to: 'disk', label: 'every second', hue: 4, dashed: true },
        ]}
        steps={[
          { title: 'Every policy: into the kernel before the reply', body: <p>The writes of one event-loop round are appended to the AOF buffer and handed to the kernel with <code>write()</code> before replies are sent. A kill -9 of Redis cannot lose them; only the machine going down can (or everysec postponing on a slow disk).</p>, active: ['cmd', 'buf', 'cache', 'reply', 'cmd>buf', 'buf>cache', 'cache>reply'] },
          { title: 'appendfsync always', body: <p>fsync before the reply: the write is on the disk when the client hears OK. Every write waits for the disk.</p>, active: ['cache', 'disk', 'cache>disk', 'reply'] },
          { title: 'appendfsync everysec (default)', body: <p>A background thread fsyncs once a second. A power loss can take about the last second (up to two in the worst case).</p>, active: ['bio', 'disk', 'bio>disk', 'cache'] },
          { title: 'appendfsync no', body: <p>Redis never fsyncs; the kernel flushes its cache when it decides (typically within ~30 s on Linux). A power loss can take everything since.</p>, active: ['cache', 'disk'] },
        ]}
      />
      <Table
        head={['appendfsync', 'fsync', 'A power loss can lose']}
        rows={[
          ['always', 'after every write, before the reply', 'nothing that was acknowledged'],
          ['everysec', 'once per second, in a background thread', 'about the last second (up to two in the worst case)'],
          ['no', 'whenever the kernel flushes (typically within ~30 s on Linux)', 'up to the kernel’s flush interval'],
        ]}
      />
      <Timeline
        title="What a power loss at 10 s can take (schematic)"
        lanes={[{ id: 'always', label: 'always' }, { id: 'everysec', label: 'everysec' }, { id: 'no', label: 'no' }]}
        segments={[
          { lane: 'always', from: 0, to: 10, label: 'on disk', hue: 6 },
          { lane: 'everysec', from: 0, to: 9, label: 'on disk', hue: 6 },
          { lane: 'everysec', from: 9, to: 10, label: 'lost', hue: 8, striped: true },
          { lane: 'no', from: 0, to: 10, label: 'not flushed by the kernel yet: lost', hue: 8, striped: true },
        ]}
        events={[{ lane: 'no', at: 10, label: 'power loss', hue: 8 }]}
        end={11}
        unit="s"
      />
      <BarChart
        title="SET throughput, 20 clients, on the recording machine’s disk (redis-benchmark)"
        bars={bench.map((b) => ({ label: b.label, value: b.value, display: `${b.value.toLocaleString()}/s · p50 ${b.p50} ms`, hue: (b.label === 'appendfsync always' ? 8 : b.label === 'no persistence' ? 2 : 4) as Hue }))}
      />
      <p>
        <code>everysec</code> costs nothing measurable here; <code>always</code> is about {slowdown}× slower because every write waits for the disk.
        The exact factor depends on the disk, but the shape is always the same.
      </p>

      <h3>Rewriting the AOF</h3>
      <p>
        The log only grows: a counter incremented a million times is a million commands. A rewrite (<code>BGREWRITEAOF</code>, or automatic per
        the two <code>auto-aof-rewrite-*</code> settings) forks, writes the current data as a new base file, and starts a new incremental file;
        the old pair is deleted once the manifest points at the new one.
      </p>
      <Flow
        title="A rewrite: new base, new incremental file, then the manifest switches"
        cols={4}
        rows={2}
        nodes={[
          { id: 'man', label: 'manifest', sub: 'which files count', col: 0, row: 0, rowSpan: 2, hue: 4, shape: 'log' },
          { id: 'b1', label: aofFiles(P.aofFilesAtStart).find((n) => n.includes('base'))?.replace('appendonly.', '') ?? 'base 1', sub: 'old base', col: 1, row: 0, hue: 4, shape: 'store' },
          { id: 'i1', label: aofFiles(P.aofFilesAtStart).find((n) => n.includes('incr'))?.replace('appendonly.', '') ?? 'incr 1', sub: 'old commands', col: 1, row: 1, hue: 4, shape: 'log' },
          { id: 'child', label: 'fork child', sub: 'snapshots current data', col: 2, row: 0, hue: 2 },
          { id: 'b2', label: aofFiles(P.aofFilesAfterRewrite).find((n) => n.includes('base'))?.replace('appendonly.', '') ?? 'base 2', sub: 'new base', col: 3, row: 0, hue: 6, shape: 'store' },
          { id: 'i2', label: aofFiles(P.aofFilesAfterRewrite).find((n) => n.includes('incr'))?.replace('appendonly.', '') ?? 'incr 2', sub: 'new writes go here', col: 3, row: 1, hue: 6, shape: 'log' },
        ]}
        edges={[
          { from: 'man', to: 'b1', hue: 4, dashed: true },
          { from: 'man', to: 'i1', hue: 4, dashed: true },
          { from: 'child', to: 'b2', hue: 2, flow: true },
          { from: 'i1', to: 'i2', label: 'writes switch over', hue: 4 },
        ]}
        steps={[
          { title: 'Before', body: <p>The manifest lists base 1 and incremental 1; every write is appended to incremental 1.</p>, active: ['man', 'b1', 'i1', 'man>b1', 'man>i1'] },
          { title: 'The rewrite starts', body: <p>Redis opens incremental 2 for new writes (the manifest now lists base 1 + incremental 1 + incremental 2, so a crash right now loses nothing) and forks; the child writes the current data as base 2 — an RDB file, because of <code>aof-use-rdb-preamble</code>.</p>, active: ['child', 'b2', 'i2', 'child>b2', 'i1>i2'] },
          { title: 'Switch and clean up', body: <p>When base 2 is complete the manifest is rewritten to list only base 2 + incremental 2 — that is the switch — and the old pair is deleted in the background (see the log below).</p>, active: ['man', 'b2', 'i2'] },
        ]}
      />
      <CodeBlock title="appendonlydir/ after BGREWRITEAOF (recorded)" language="text" code={`${P.aofFilesAfterRewrite}\n\n${P.aofManifestAfterRewrite}`} />
      <LogLines title="server log during the rewrite (recorded)" lines={P.aofRewriteLog} highlight={/renamed|finished/} />

      <h3>A torn last write</h3>
      <p>
        If the machine dies in the middle of writing, the last command in the file can be incomplete. To show it, the recording cut 5 bytes off
        the end of the incremental file and started the server again:
      </p>
      <LogLines title="startup with a truncated AOF (recorded)" lines={P.aofTruncatedLog} highlight={/Truncating|loaded anyway/} />
      <p>
        With <code>aof-load-truncated yes</code> (the default) Redis drops the broken tail and starts: <code>visits</code> came back as{' '}
        {String(P.aofTruncatedResult.visits)}, while the half-written <code>SET last write</code> is gone ({String(P.aofTruncatedResult.last)}).
        Damage in the <em>middle</em> of the file stops the server instead; then <code>redis-check-aof --fix</code> repairs it. After Redis had
        cut the tail, the file checked clean:
      </p>
      <CodeBlock title="redis-check-aof appendonly.aof.2.incr.aof" language="text" code={P.checkAof.join('\n')} />

      <h2>A real crash: what came back</h2>
      <p>
        Each recording below wrote 100,000 keys, every one acknowledged by the server, then killed it with <code>kill -9</code> (no shutdown, no
        final save) and started it again.
      </p>
      <Predict
        question={<p>With <code>appendfsync everysec</code>, Redis is killed with <code>kill -9</code> right after the 100,000th acknowledged write. How many keys are there after the restart?</p>}
        options={['about 99,000 — the last second is lost', 'all 100,000', 'none — the AOF is only read on a clean start']}
        answer={1}
        explanation="Every acknowledged write had already been handed to the kernel with write(). Killing the process does not lose the kernel’s page cache, so the file is complete. Only a power loss or kernel crash would lose the part not yet fsync'd — or, on a disk too slow for everysec, the up to 2 s of writes Redis had postponed."
      />
      <BarChart
        title="keys back after kill -9 (of 100,000 acknowledged, recorded)"
        max={100_000}
        bars={P.crash.map((c) => ({ label: CRASH_LABEL[c.label] ?? c.label, value: c.survived, display: `${c.survived.toLocaleString()} of ${c.acknowledged.toLocaleString()}`, hue: CRASH_HUE[c.label] ?? 2 }))}
      />
      <p>
        No persistence: nothing. RDB: exactly the 50,000 keys written before the snapshot. Both AOF settings: everything — on this fast disk a
        process crash could not tell <code>everysec</code> from <code>always</code>. The difference shows when the machine itself goes down, or
        when a slow disk makes <code>everysec</code> postpone its writes.
      </p>
      <DurabilityPlayground />

      <h2>Restarting with both</h2>
      <p>
        If the AOF is on, Redis loads it at start and ignores <code>dump.rdb</code>, because the AOF is the more complete copy. Loading time grows
        with the dataset: plan for it in your restart and failover times — a replica that is already running is far faster than a restart from disk
        (lesson 11).
      </p>

      <Callout tone="tip" title="Design rules">
        <ul>
          <li>Pure cache that can be rebuilt: persistence off, or RDB only for faster warm-up after a restart.</li>
          <li>Data you cannot rebuild (queues, sessions you must keep, counters): <code>appendonly yes</code> with <code>appendfsync everysec</code>, plus regular RDB snapshots copied to another machine as backups.</li>
          <li>Use <code>always</code> only for small, critical write rates, and measure first — every write waits for the disk.</li>
          <li>Keep memory headroom for fork and copy-on-write; set <code>vm.overcommit_memory = 1</code>.</li>
          <li>Persistence protects against restarts, not against a lost machine: that needs replicas (lesson 11) and off-host backups.</li>
          <li>Test a restore: load a backup into a fresh server and count the keys.</li>
        </ul>
      </Callout>

      <Recap
        points={[
          'RDB forks and writes a compact snapshot; the fork is the only pause, and copy-on-write costs memory while writes continue.',
          'The AOF logs every write as RESP in a base + incremental file set; rewrites compact it.',
          'Acknowledged writes are normally already in the kernel, so a process crash loses nothing with the AOF on (everysec on a slow disk can postpone up to 2 s); appendfsync decides what a power loss can take.',
          'A torn tail is dropped automatically; corruption in the middle needs redis-check-aof.',
        ]}
      />
    </>
  )
}
