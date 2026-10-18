import { BarChart, ByteLayout, Flow, Timeline } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { DurabilitySimulator } from '../components/DurabilitySimulator'
import { DurabilityXor } from '../components/DurabilityXor'
import { HUE } from '../components/legend'
import { ResultChip } from '../components/ResultChip'
import { Terminal } from '../components/Terminal'
import { DURABILITY } from '../data/durability'
import { defaultParity, replication, setStatus } from '../simulation/erasure'

const D = DURABILITY
const MiB = 1024 * 1024
const BLOCK = MiB
const HASH = 32
const shardFiles = (D.mdSetup.find((s) => s.cmd?.includes('du -b'))?.out ?? '').split('\n').map((l) => ({ bytes: Number(l.split('\t')[0]), path: l.split('\t')[1] }))
const shardBytes = shardFiles[0]?.bytes ?? 0
const blocks = Math.ceil(D.objectBytes / BLOCK)
const perShardBlock = BLOCK / 2
const stored = shardFiles.reduce((n, f) => n + f.bytes, 0)
const ev = D.events
const restartAt = ev.find((e) => e.label === 'both started')?.at ?? 0
const end = Math.ceil((D.healedAt ?? restartAt) + 2)

const LAYOUTS = [
  { label: '3 copies (replication)', ...replication(3), hue: HUE.disk },
  { label: 'EC 2+2 (4 drives)', tolerates: 2, overhead: setStatus(2, 2, 0).overhead, usable: 0.5, hue: HUE.data },
  { label: 'EC 4+2 (6 drives)', tolerates: 2, overhead: setStatus(4, 2, 0).overhead, usable: 4 / 6, hue: HUE.data },
  { label: 'EC 12+4 (16 drives)', tolerates: 4, overhead: setStatus(12, 4, 0).overhead, usable: 0.75, hue: HUE.data },
]

export default function Durability() {
  return (
    <>
      <LessonGoals
        goals={[
          'name the ways storage loses data, and which ones a storage server can protect against',
          'compare keeping copies (replication) with erasure coding: data and parity shards',
          'predict, for a set of drives and a parity count, how many failures reads and writes survive',
          'watch RustFS keep serving through broken drives and stopped servers, then heal itself — recorded',
          'do the capacity maths for a deployment',
        ]}
        before={<>Lesson <a href="#/s3/run">Running RustFS</a> (drives and the single/multi-drive layouts). No maths beyond multiplication.</>}
      />

      <h2>Disks fail — all the time</h2>
      <p>
        A single disk is fragile. Large operators publish their numbers: around one or two drives in a hundred fail every year, and a
        data centre with thousands of drives replaces some every day. Data must survive that without anyone noticing.
      </p>
      <Callout tone="analogy" title="Analogy: a family recipe">
        To keep a precious recipe safe you could give a full copy to three relatives — safe, but three times the paper. Or you cut it into two
        halves, give each half to a relative, and give two more relatives a “summary card” each, computed so that <em>any two</em> of the four
        pieces are enough to rewrite the whole recipe. Four pieces, two may be lost, and only twice the paper. That second idea is erasure coding.
      </Callout>
      <Table
        head={['What goes wrong', 'Example', 'What protects you']}
        rows={[
          ['a whole drive dies', 'a disk stops spinning or an SSD stops answering', 'erasure coding or replication across drives'],
          ['a whole server is gone', 'power supply, network, maintenance reboot', 'erasure coding across servers'],
          ['bit rot', 'bits on the disk silently change; the drive reports no error', 'checksums on every block, and healing'],
          ['a whole site is lost', 'fire, flood, a region-wide outage', 'a copy in another place (replication, backups — lesson “Patterns”)'],
          ['people and programs', 'a wrong delete, an overwrite, ransomware', 'versioning, object lock (lesson “Versioning”), backups'],
        ]}
      />
      <TermList
        items={[
          { term: 'replication', definition: 'Keeping full copies on different drives or servers. Three copies survive two losses and cost three times the space.' },
          { term: 'erasure coding', definition: 'Cutting each object into data shards and computing extra parity shards, so missing shards can be recomputed from the rest.' },
          { term: 'shard', definition: 'One piece of an object stored on one drive. With 2 data + 2 parity, each drive holds one of four shards.' },
          { term: 'parity', definition: 'Shards computed from the data shards (RustFS uses Reed–Solomon codes). With m parity shards, any m shards may be lost.' },
          { term: 'erasure set', definition: 'The group of drives (2 to 16 in RustFS) one object is spread across. Large deployments have many sets.' },
          { term: 'quorum', definition: 'How many drives must answer: reads need as many as there are data shards; writes need that many too, plus one when data and parity counts are equal.' },
          { term: 'healing', definition: 'Recomputing missing or damaged shards and writing them back, after a drive or server returns or is replaced.' },
          { term: 'bit rot', definition: 'Silent corruption of stored bits. Detected with a checksum per block, then repaired from the other shards.' },
        ]}
      />

      <h2>Copies or codes?</h2>
      <p>Both tolerate failures; erasure coding does it with much less extra space:</p>
      <BarChart
        title="Raw space stored per byte of data (lower is cheaper)"
        bars={LAYOUTS.map((l) => ({ label: `${l.label} — survives ${l.tolerates} lost`, value: l.overhead, display: `${l.overhead.toFixed(2)}×`, hue: l.hue }))}
      />
      <p>
        Replication is simple and fast to rebuild (copy a file), and it is what you use between sites. Erasure coding is the standard inside one
        cluster: RustFS and MinIO always use it, Ceph offers it, and large cloud stores use it internally.
      </p>

      <h2>How RustFS cuts an object</h2>
      <p>
        RustFS was started with four drives in one container (the lab trick from lesson 2 that lets folders act as drives), and a 3 MiB object
        was uploaded:
      </p>
      <Terminal title="recorded: four drives, parity 2, one 3 MiB object" steps={D.mdSetup} />
      <ByteLayout
        title={`Recorded sizes: each 1 MiB block of the object becomes 2 data + 2 parity shards of ${perShardBlock / 1024} KiB, one per drive`}
        rows={[
          { label: 'one 1 MiB block of the object', fields: [{ label: 'block', bytes: BLOCK, hue: HUE.data, content: '1 MiB' }] },
          {
            label: 'the shards written for it',
            fields: [
              { label: 'drive 0: data', bytes: perShardBlock, hue: HUE.data, content: 'D1' },
              { label: 'drive 1: data', bytes: perShardBlock, hue: HUE.data, content: 'D2' },
              { label: 'drive 2: parity', bytes: perShardBlock, hue: HUE.network, content: 'P1' },
              { label: 'drive 3: parity', bytes: perShardBlock, hue: HUE.network, content: 'P2' },
            ],
          },
        ]}
        caption={`On disk each drive’s part.1 is ${shardBytes.toLocaleString()} bytes: ${blocks} blocks × (${perShardBlock.toLocaleString()} bytes of shard + ${HASH} bytes of checksum). Four drives together store ${stored.toLocaleString()} bytes for a ${D.objectBytes.toLocaleString()}-byte object: ${(stored / D.objectBytes).toFixed(2)}×. Which drive gets which shard is rotated per object.`}
      />
      <p>
        The parity is computed with Reed–Solomon codes, which can rebuild any 2 missing shards out of 4. The simplest member of that family has
        one parity shard that is the XOR of the data shards — small enough to compute here:
      </p>
      <DurabilityXor />

      <h2>Breaking drives, recorded</h2>
      <p>Each drive was made unreadable in turn (<code>chmod 000</code> on its folder), and after each one the object was read and a new one written:</p>
      <Terminal title="recorded: one, two, then three drives unreadable" steps={D.failing} maxLines={30} />
      <Table
        head={['Drives lost', 'Read the object', 'Write a new object', 'Why']}
        rows={D.driveSteps.map((s) => [
          `${s.down} of 4`,
          <ResultChip key="r" ok={s.read}>{s.read ? 'works' : 'fails'}</ResultChip>,
          <ResultChip key="w" ok={s.write}>{s.write ? 'works' : 'fails'}</ResultChip>,
          s.down === 1 ? '3 drives left ≥ write quorum 3' : s.down === 2 ? '2 left: enough to read (2 data shards), not to write (needs 3)' : '1 left: fewer than the 2 shards needed',
        ])}
      />
      <p>
        That is the quorum rule exactly: with 2 data + 2 parity, reads need any 2 drives; writes need 3, because 2 + 2 is an even split and RustFS
        will not report a write as done on only half the drives. RustFS answered the refused writes with <code>ServiceUnavailable</code> and the
        unreadable object with <code>SlowDownRead</code> — retryable errors, so clients wait and retry instead of giving up.
      </p>
      <Predict
        question={<p>Same four drives, but the bucket is written with parity 1 (3 data + 1 parity). How many drives may fail before reads stop?</p>}
        options={['0', '1', '2']}
        answer={1}
        explanation={<p>Reads need 3 of 4 shards, so one lost drive is fine and two are not. Less parity gives more usable space (75 % instead of 50 %) and less safety — try it in the simulator below.</p>}
      />

      <h2>Try it: an erasure set</h2>
      <DurabilitySimulator recordedDrives={4} recordedParity={defaultParity(4)} />

      <h2>Healing</h2>
      <h3>A drive comes back</h3>
      <Terminal title="recorded: drives readable again; the object written while drive 1 was down" steps={D.back} maxLines={30} />
      <p>
        <code>written-with-1-down.bin</code> was written while drive 1 was unreadable, yet two seconds after the drives came back its shard was
        already there: RustFS remembers writes that missed a drive and repairs them as soon as it returns. <code>rc admin heal start</code>{' '}
        starts a full check of a bucket on demand; the background scanner does the same over time.
      </p>
      <h3>A drive is replaced by an empty one</h3>
      <Terminal title="recorded: wipe a drive’s data, read, heal" steps={D.replaced} />
      <h3>Bit rot</h3>
      <p>Here six bytes inside one shard file were overwritten directly on the disk — the kind of damage a disk does not report:</p>
      <Terminal title="recorded: corrupt one shard, read the object, look again" steps={D.bitrot} />
      <p>
        The read still returned the right bytes (the MD5 of the download matches the original), and five seconds later the damaged shard file
        had its original checksum back. Every 1 MiB block carries a HighwayHash checksum (lesson 2); the read noticed the mismatch, rebuilt the
        block from the other shards, served it, and queued the shard for repair.
      </p>
      <Flow
        title="What happens on a read when a shard is bad"
        cols={4}
        rows={2}
        rowHeight={72}
        nodes={[
          { id: 'client', label: 'GET three.bin', col: 0, row: 0, rowSpan: 2, hue: HUE.client, shape: 'actor' },
          { id: 'server', label: 'RustFS', sub: 'reads 2 good shards', col: 1, row: 0, rowSpan: 2, hue: HUE.server },
          { id: 'bad', label: 'drive 0 shard', sub: 'checksum mismatch', col: 2, row: 0, hue: HUE.error, shape: 'store' },
          { id: 'good', label: 'drives 1–3', sub: 'checksums ok', col: 2, row: 1, hue: HUE.disk, shape: 'store' },
          { id: 'heal', label: 'heal', sub: 'rewrite the shard', col: 3, row: 0, hue: HUE.ok },
        ]}
        edges={[
          { from: 'client', to: 'server', hue: HUE.client, flow: true },
          { from: 'server', to: 'bad', hue: HUE.error, dashed: true },
          { from: 'server', to: 'good', hue: HUE.disk, flow: true },
          { from: 'bad', to: 'heal', hue: HUE.ok },
        ]}
        caption="Data is never handed out before its checksum is verified; a bad block is rebuilt from the other shards."
      />

      <h2>Several servers</h2>
      <p>
        Drives in one machine do not survive the machine. With four servers on one network, each with one drive, every object is spread across the
        servers. All nodes are started with the same <code>RUSTFS_VOLUMES</code> listing every node’s drive:
      </p>
      <Terminal title="recorded: four nodes on the podman network s3-net" steps={D.nodesSetup} maxLines={36} />
      <Terminal title="recorded: stop one server, then a second" steps={D.nodesDown} />
      <Terminal title="recorded: start both again; the missing object heals onto them" steps={D.nodesBack} />
      <Timeline
        title="Recorded: seconds since the first server was stopped"
        start={0}
        end={end}
        unit="s"
        lanes={[
          { id: 'nodes', label: 'servers' },
          { id: 'reads', label: 'reads' },
          { id: 'writes', label: 'writes' },
        ]}
        segments={[
          { lane: 'nodes', from: ev[0].at, to: ev.find((e) => e.label === 's3-node-4 stopped')!.at, label: '3 of 4 up', hue: HUE.server },
          { lane: 'nodes', from: ev.find((e) => e.label === 's3-node-4 stopped')!.at, to: restartAt, label: '2 up', hue: HUE.error, striped: true },
          { lane: 'nodes', from: restartAt, to: end, label: 'all 4 up, healing', hue: HUE.ok },
        ]}
        events={ev
          .filter((e) => e.label === 'read' || e.label === 'write' || e.label.includes('back on'))
          .map((e) => ({ lane: e.label === 'read' ? 'reads' : e.label === 'write' ? 'writes' : 'nodes', at: e.at, label: e.label.includes('back on') ? 'healed' : e.ok ? 'ok' : 'refused', hue: e.ok ? HUE.ok : HUE.error }))}
      />
      <p>
        The servers behave exactly like drives: one stopped server is invisible to clients, two stopped servers make the cluster read-only.
        Production deployments therefore use more drives per set (8 to 16) and higher parity, put the servers behind a load balancer, and
        replace failed hardware before a second failure arrives.
      </p>

      <h2>Capacity maths</h2>
      <p>
        Usable space = drives × drive size × data ÷ (data + parity). RustFS picks the parity from the set size unless you configure it (the{' '}
        <code>STANDARD</code> and <code>REDUCED_REDUNDANCY</code> storage classes can have different parity):
      </p>
      <Table
        head={['Drives per set', 'Default parity', 'Data + parity', 'Survives', 'Usable']}
        rows={[2, 4, 6, 8, 12, 16].map((n) => {
          const p = defaultParity(n)
          return [String(n), String(p), `${n - p} + ${p}`, `${p} lost drive${p === 1 ? '' : 's'} (reads)`, `${Math.round(((n - p) / n) * 100)} %`]
        })}
      />
      <Callout tone="tip" title="Example">
        Four servers with four 8 TB drives each are 16 drives, one set, default parity 4: 16 × 8 TB × 12/16 = 96 TB usable of 128 TB raw. Any
        four drives — or one whole server — may fail and everything stays readable and writable.
      </Callout>
      <Callout tone="warn" title="What erasure coding does not do">
        It protects against hardware, not against you. A delete is applied to every shard at once; a wrong overwrite is perfectly protected.
        Versioning, object lock and copies in another place (next lesson) cover those.
      </Callout>

      <Recap
        points={[
          'Disks and servers fail routinely; bit rot is silent. Storage must expect both.',
          'Erasure coding cuts objects into data + parity shards across a set of drives; any “data” shards rebuild the object.',
          'Reads need as many drives as data shards; writes need that many, plus one when data = parity. Recorded: 2+2 survives 2 lost drives for reads, 1 for writes.',
          'RustFS checks a checksum on every block, rebuilds bad or missing shards on read, and heals drives and servers that come back.',
          'Usable space = data ÷ (data + parity) of raw; erasure coding is not a backup.',
        ]}
      />
    </>
  )
}
