import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { BarList, DurabilityPlayground, LogLines } from '../components'
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
        a temporary file and renames it to <code>dump.rdb</code>. The parent keeps serving clients the whole time. Thanks to copy-on-write the
        child costs almost no memory — only the pages the parent changes during the save get copied. Recorded with {P.rdb.keys.toLocaleString()}{' '}
        keys:
      </p>
      <Table
        head={['Measured', 'Value']}
        rows={[
          ['dataset in memory (used_memory)', P.rdb.usedMemory],
          ['fork() blocked the server for', `${(P.rdb.forkUsec / 1000).toFixed(1)} ms (latest_fork_usec ${P.rdb.forkUsec})`],
          ['memory copied by copy-on-write', `${MB(P.rdb.cowBytes)} (rdb_last_cow_size)`],
          ['dump.rdb on disk', MB(P.rdb.fileBytes)],
          ['time to write it', `${P.rdb.lastBgsaveSec} s`],
        ]}
      />
      <LogLines title="server log during BGSAVE (recorded)" lines={P.rdb.log} highlight={/CoW/} />
      <p>
        Two things in these numbers matter for design. The file is much smaller than memory (no pointers, compact encodings, and compression), so
        snapshots are good backups and fast to load. And the fork itself is the only pause: it copies the page tables, so it grows with the size
        of the dataset — a few milliseconds here, but hundreds of milliseconds for tens of gigabytes. During heavy writes many pages get copied,
        so a busy server can need much more memory while a snapshot runs.
      </p>
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
      <p>
        It is the same protocol clients speak (lesson 2): replaying the file is replaying the commands. Note one rewrite on the way:{' '}
        <code>EXPIRE cart:7 3600</code> was stored as <code>PEXPIREAT</code> with an absolute time, so a replay after a restart does not give the
        key another full hour.
      </p>

      <h3>When the data reaches the disk</h3>
      <p>
        Redis collects the writes of one event-loop iteration in a buffer and <code>write()</code>s it to the file before it sends the replies.
        So an acknowledged write is normally already in the kernel. The exception is <code>everysec</code> on a disk that cannot keep up: if the
        previous background fsync is still running, Redis postpones the <code>write()</code> itself (for up to 2 s) while it keeps replying — in that
        window even a process crash can lose acknowledged writes. <code>appendfsync</code> decides when the kernel is told to put the data on the
        disk:
      </p>
      <Table
        head={['appendfsync', 'fsync', 'A power loss can lose']}
        rows={[
          ['always', 'after every write, before the reply', 'nothing that was acknowledged'],
          ['everysec', 'once per second, in a background thread', 'about the last second (up to two in the worst case)'],
          ['no', 'whenever the kernel flushes (typically within ~30 s on Linux)', 'up to the kernel’s flush interval'],
        ]}
      />
      <BarList
        title="SET throughput, 20 clients, on the recording machine’s disk (redis-benchmark)"
        bars={bench.map((b) => ({ label: b.label, value: b.value, display: `${b.value.toLocaleString()}/s · p50 ${b.p50} ms`, emphasis: b.label === 'appendfsync everysec' }))}
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
      <BarList
        title="keys back after kill -9 (of 100,000 acknowledged)"
        max={100_000}
        bars={P.crash.map((c) => ({ label: CRASH_LABEL[c.label] ?? c.label, value: c.survived, display: `${c.survived.toLocaleString()} of ${c.acknowledged.toLocaleString()}`, emphasis: c.label === 'aof-everysec' }))}
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
