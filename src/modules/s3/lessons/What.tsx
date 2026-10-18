import { Flow } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Legend } from '../components/Legend'
import { HUE } from '../components/legend'
import { Terminal } from '../components/Terminal'
import { WhatObjectCard } from '../components/WhatObjectCard'
import { WhatPrefixExplorer } from '../components/WhatPrefixExplorer'
import { WhatStorageKinds } from '../components/WhatStorageKinds'
import { WHAT } from '../data/what'

const KEYS = WHAT.flat[0].out.split('\n').map((l) => l.split('\t')[0])
const SIZES = new Map(WHAT.flat[0].out.split('\n').map((l) => [l.split('\t')[0], Number(l.split('\t')[1])]))

/** The recorded delimiter listings, as (prefix, delimiter) → answer, so the explorer can check itself. */
const RECORDED = WHAT.delimiter.map((s) => {
  const out = JSON.parse(s.out) as { folders: string[] | null; objects: string[] | null }
  return { prefix: s.cmd.match(/--prefix (\S+)/)?.[1] ?? '', delimiter: s.cmd.match(/--delimiter (\S+)/)?.[1] ?? '', ...out }
})

const etagOf = (out: string) => (JSON.parse(out) as { etag: string }).etag.replace(/"/g, '')
const sizeOf = (out: string) => (JSON.parse(out) as { size: number }).size
const heads = WHAT.overwrite.filter((s) => s.cmd.includes('head-object'))

export default function What() {
  return (
    <>
      <LessonGoals
        goals={[
          'tell file, block and object storage apart, and say what each is for',
          'explain buckets, keys, objects and metadata in your own words',
          'see why “folders” in S3 are only a way of listing, and list a bucket by prefix',
          'name several S3-compatible servers and know why they all speak the same language',
          'decide whether some data belongs in object storage — and what object storage cannot do',
        ]}
        before="Nothing. If you have saved a file on a computer, you know enough to start."
      />

      <h2>Where do your files go?</h2>
      <p>
        When you save a photo on your laptop, it goes into a folder on the laptop’s disk. That works for one person on one machine. But a web shop
        with thousands of product photos, an app where every user has an avatar, or a company that keeps every invoice as a PDF needs somewhere
        else: a place that many servers can reach over the network, that never runs out of room, and that keeps the files safe when a disk breaks.
        That place is usually <strong>object storage</strong>, and the way programs talk to it is called <strong>S3</strong>.
      </p>
      <Callout tone="analogy" title="Analogy: the cloakroom">
        At a theatre cloakroom you hand over your coat and get a ticket with a number. You do not know which rail it hangs on, and you do not
        care. Later you show the ticket and get the whole coat back. You cannot ask the attendant to sew a new button on while it hangs there —
        you take the coat, change it, and hand it in again. Object storage works the same way: you hand over a file (an <em>object</em>), you
        name it with a <em>key</em> (your ticket), and you always get back, or replace, the whole thing.
      </Callout>
      <p>The figures in this module use the same colours throughout, and every colour also has a label:</p>
      <Legend />

      <h2>Three kinds of storage</h2>
      <p>Computers store bytes in three common ways. They differ in what you ask for and in what you are allowed to change.</p>
      <WhatStorageKinds />
      <Table
        head={['', 'File storage', 'Block storage', 'Object storage']}
        rows={[
          ['You address', 'a path in folders', 'a block number', 'bucket + key'],
          ['You talk to it with', 'the operating system (open, read, write)', 'a disk driver; a file system sits on top', 'HTTP requests (PUT, GET, DELETE…)'],
          ['Change part of the data', 'yes, any byte', 'yes, any block', 'no: replace the whole object'],
          ['Shared by many machines', 'with a network file system, carefully', 'usually one machine at a time', 'yes, by design'],
          ['Grows to', 'the size of the disk or share', 'the size of the volume', 'practically no limit'],
          ['Typical use', 'documents, code, a shared drive', 'databases, virtual machine disks', 'photos, videos, backups, logs, exports'],
        ]}
      />

      <h2>The words you need</h2>
      <p>Five words carry the rest of this module. Each is shown on a real server below.</p>
      <TermList
        items={[
          { term: 'object', definition: 'A stored file plus its description: the bytes, a key, and metadata. Objects are written and replaced whole.' },
          { term: 'key', definition: 'The object’s full name inside its bucket, for example images/mug/front.jpg. The slashes are just characters.' },
          { term: 'bucket', definition: 'A named container for objects, like catalog or invoices. Every request names a bucket; permissions and settings are often per bucket.' },
          { term: 'metadata', definition: 'Facts about the object kept next to it: its size, content type, a checksum (the ETag), when it changed, and any extra fields you add.' },
          { term: 'S3', definition: 'Amazon’s “Simple Storage Service” (2006) and, by now, the name of its HTTP API — which many other storage servers also speak.' },
          { term: 'S3-compatible server', definition: 'Any server that answers the S3 API, so S3 tools work with it. This module uses RustFS, an open-source one you can run yourself.' },
        ]}
      />

      <h2>An object, taken apart</h2>
      <p>
        Here a few files from a laptop were uploaded to a bucket called <code>catalog</code> on a RustFS {WHAT.version} server, using the{' '}
        <code>aws</code> command-line tool (lesson “Running RustFS” shows how to set it up).
      </p>
      <Terminal title="recorded: the files on the laptop" steps={WHAT.laptop} />
      <Terminal title="recorded: create a bucket and upload five objects" steps={WHAT.upload} />
      <p>
        The first upload also set a content type and two fields of our own (<code>color</code> and <code>sku</code>). Asking the server about that
        object returns everything it keeps besides the bytes:
      </p>
      <Terminal title="recorded: HEAD — the metadata, without the bytes" steps={WHAT.anatomy} />
      <WhatObjectCard bucket="catalog" objectKey="images/mug/front.jpg" head={WHAT.headObject} />
      <ul>
        <li>
          <strong>The key</strong> is the whole name, slashes included. There is no separate folder called <code>images</code>.
        </li>
        <li>
          <strong>System metadata</strong> is set or computed by the server: size, type, a fingerprint of the content (the <code>ETag</code>, in
          lesson “The S3 API on the wire”) and the time of the last write.
        </li>
        <li>
          <strong>User metadata</strong> is yours: small text fields that travel with the object as <code>x-amz-meta-…</code> headers. Keep them
          small (AWS allows 2 KB in total) and never put secrets in them.
        </li>
        <li>
          <strong>The data</strong> can be anything — an image, a PDF, a zip — from zero bytes up to terabytes. The server does not look inside.
        </li>
      </ul>

      <h2>Buckets</h2>
      <p>
        A bucket groups objects that belong together and carries settings for all of them: who may read it, whether old versions are kept, when
        objects expire. Most applications use a handful of buckets (say <code>catalog</code>, <code>invoices</code>, <code>backups</code>), not
        one per user.
      </p>
      <Terminal title="recorded: bucket names follow DNS rules" steps={WHAT.bucketNames} />
      <p>
        Bucket names must look like part of a web address: 3–63 characters, lowercase letters, digits, hyphens and dots, starting and ending with a
        letter or digit. <code>Product_Photos</code> was refused. Creating <code>catalog</code> a second time succeeded quietly, because this
        account already owns it. On AWS, bucket names are shared by every customer in the world, so short names are long gone; on your own server
        they only need to be unique on that server.
      </p>

      <h2>Folders are an illusion</h2>
      <p>
        Inside a bucket there are no folders — only a flat, sorted list of keys. Here is everything the bucket held, exactly as the server
        listed it:
      </p>
      <Terminal title="recorded: the flat list of keys (ListObjectsV2)" steps={WHAT.flat} />
      <p>
        Tools still show folders, because people like them. They ask the server to <strong>group keys at a delimiter</strong>, usually{' '}
        <code>/</code>: everything up to the next <code>/</code> after the requested <strong>prefix</strong> is folded into one “common prefix”.
      </p>
      <Terminal title="recorded: the same keys listed with a prefix and the delimiter /" steps={WHAT.delimiter} />
      <Flow
        title="One flat list, read as folders (recorded keys)"
        cols={3}
        rows={3}
        rowHeight={72}
        nodes={[
          { id: 'keys', label: `${KEYS.length} keys, flat`, sub: 'sorted byte by byte', col: 0, row: 0, rowSpan: 3, hue: HUE.data, shape: 'store' },
          { id: 'images', label: 'images/', sub: 'common prefix', col: 1, row: 0, hue: HUE.server },
          { id: 'manuals', label: 'manuals/', sub: 'common prefix', col: 1, row: 1, hue: HUE.server },
          { id: 'readme', label: 'readme.txt', sub: `object · ${SIZES.get('readme.txt')} B`, col: 1, row: 2, hue: HUE.data },
          { id: 'mug', label: 'images/mug/', sub: '2 objects inside', col: 2, row: 0, hue: HUE.server },
          { id: 'lamp', label: 'images/lamp/', sub: '1 object inside', col: 2, row: 1, hue: HUE.server },
        ]}
        edges={[
          { from: 'keys', to: 'images', hue: HUE.server },
          { from: 'keys', to: 'manuals', hue: HUE.server },
          { from: 'keys', to: 'readme', hue: HUE.data },
          { from: 'images', to: 'mug', hue: HUE.server, dashed: true },
          { from: 'images', to: 'lamp', hue: HUE.server, dashed: true },
        ]}
        steps={[
          { title: 'prefix "" and delimiter /', body: <p>The top level: two common prefixes and one object whose key has no slash.</p>, active: ['keys', 'images', 'manuals', 'readme', 'keys>images', 'keys>manuals', 'keys>readme'] },
          { title: 'prefix images/ and delimiter /', body: <p>A second request, starting further in. The keys under <code>images/</code> fold at their next slash.</p>, active: ['keys', 'images', 'mug', 'lamp', 'images>mug', 'images>lamp'] },
        ]}
        caption="Each “folder” costs one more list request. The server never stored a folder; it computed one from the keys."
      />
      <WhatPrefixExplorer bucket="catalog" keys={KEYS} recorded={RECORDED} />
      <p>The friendly listing of the aws tool does the same; <code>PRE</code> marks a common prefix:</p>
      <Terminal title="recorded: aws s3 ls with and without --recursive" steps={WHAT.ls} />
      <Predict
        question={
          <p>
            <code>manuals/lamp.pdf</code> is the only key that starts with <code>manuals/</code>. You delete it. What happens to the “folder”{' '}
            <code>manuals/</code>?
          </p>
        }
        options={['It stays, empty, until you delete it too', 'It disappears from the listing', 'The delete fails: the folder is not empty']}
        answer={1}
        explanation={
          <p>
            Recorded below: the next listing has no <code>manuals/</code>. A folder exists only while some key starts with it. (Consoles that let
            you “create a folder” do it by storing an empty object whose key ends in <code>/</code>.)
          </p>
        }
      />
      <Terminal title="recorded: the last object goes, the folder goes with it" steps={WHAT.vanish} />

      <h2>Why everyone speaks S3</h2>
      <p>
        Amazon opened S3 in 2006 with a simple HTTP interface: <code>PUT</code> a key to store it, <code>GET</code> it to read it. Backup programs,
        databases, data tools, content-delivery networks and every programming language grew libraries for that interface. Other storage
        projects then implemented the same API so all those tools would work with them unchanged. Today “S3” means the protocol as much as the
        Amazon product.
      </p>
      <Flow
        title="Many tools, one API, many servers"
        cols={3}
        rows={4}
        rowHeight={66}
        nodes={[
          { id: 'cli', label: 'aws CLI · rc · rclone', col: 0, row: 0, hue: HUE.client, shape: 'actor' },
          { id: 'sdk', label: 'SDKs', sub: 'Java, TypeScript, Rust…', col: 0, row: 1, hue: HUE.client, shape: 'actor' },
          { id: 'backup', label: 'backup tools', sub: 'restic, database backups', col: 0, row: 2, hue: HUE.client, shape: 'actor' },
          { id: 'browser', label: 'a browser', sub: 'presigned links', col: 0, row: 3, hue: HUE.client, shape: 'actor' },
          { id: 'api', label: 'S3 API', sub: 'HTTP + signed requests', col: 1, row: 0, rowSpan: 4, hue: HUE.network },
          { id: 'aws', label: 'AWS S3', sub: 'managed service', col: 2, row: 0, hue: HUE.server, shape: 'store' },
          { id: 'rustfs', label: 'RustFS', sub: 'this module', col: 2, row: 1, hue: HUE.server, shape: 'store' },
          { id: 'minio', label: 'MinIO', col: 2, row: 2, hue: HUE.server, shape: 'store' },
          { id: 'others', label: 'Ceph RGW · Garage', col: 2, row: 3, hue: HUE.server, shape: 'store' },
        ]}
        edges={[
          { from: 'cli', to: 'api', hue: HUE.client, flow: true },
          { from: 'sdk', to: 'api', hue: HUE.client, flow: true },
          { from: 'backup', to: 'api', hue: HUE.client },
          { from: 'browser', to: 'api', hue: HUE.client },
          { from: 'api', to: 'aws', hue: HUE.network },
          { from: 'api', to: 'rustfs', hue: HUE.network, flow: true },
          { from: 'api', to: 'minio', hue: HUE.network },
          { from: 'api', to: 'others', hue: HUE.network },
        ]}
        caption="Switching servers means changing an endpoint address and keys, not your code. Server-specific extras (admin, events, metrics) do differ."
      />
      <Table
        head={['Server', 'Who runs it', 'Written in · licence', 'Good to know']}
        rows={[
          ['AWS S3', 'Amazon, as a paid service', 'closed source', 'the reference: other servers aim to behave like it'],
          ['RustFS', 'you', 'Rust · Apache 2.0', 'single binary or container, web console, erasure coding across drives and nodes; used in this module'],
          ['MinIO', 'you', 'Go · AGPL v3', 'long the best-known self-hosted S3 server; RustFS keeps a similar layout and admin style'],
          ['Ceph Object Gateway (RGW)', 'you', 'C++ · LGPL', 'S3 on top of a Ceph cluster that also offers block and file storage; large and powerful'],
          ['Garage', 'you', 'Rust · AGPL v3', 'small, made for a few machines spread over several sites'],
        ]}
      />
      <Callout tone="note" title="“Compatible” is a range">
        Every server implements the everyday calls (buckets, put, get, list, delete, multipart uploads, presigned links). Less common features —
        ACLs, some lifecycle rules, storage classes, event formats — vary. RustFS documents what passes the standard S3 test suite; this module
        records what it really did and says so when something differs from AWS.
      </Callout>

      <h2>What object storage is good at — and what it cannot do</h2>
      <p>The cloakroom rules have consequences you will meet in code. All of these were recorded on the server:</p>
      <h3>No partial changes: every write replaces the whole object</h3>
      <Terminal title="recorded: read, replace, read again" steps={WHAT.overwrite} />
      <p>
        To add one line to <code>readme.txt</code> the whole file was uploaded again: its size went from {sizeOf(heads[0].out)} to{' '}
        {sizeOf(heads[1].out)} bytes and its ETag changed from <code>{etagOf(heads[0].out).slice(0, 8)}…</code> to{' '}
        <code>{etagOf(heads[1].out).slice(0, 8)}…</code>. There is no S3 request for “append” or “change bytes 10 to 20”. Readers see either the
        old object or the new one, never a mix.
      </p>
      <h3>No rename: “move” is a copy and a delete</h3>
      <Terminal title="recorded: aws s3 mv (debug log trimmed to the result; its HTTP requests are below)" steps={WHAT.rename} />
      <Flow
        title="What aws s3 mv sent (recorded requests)"
        cols={3}
        rows={2}
        rowHeight={78}
        nodes={[
          { id: 'cli', label: 'aws s3 mv', sub: 'your machine', col: 0, row: 0, rowSpan: 2, hue: HUE.client, shape: 'actor' },
          { id: 'srv', label: 'RustFS', sub: 'copies inside the server', col: 1, row: 0, rowSpan: 2, hue: HUE.server },
          { id: 'old', label: 'readme.txt', sub: 'old key', col: 2, row: 0, hue: HUE.data },
          { id: 'new', label: 'docs/readme.txt', sub: 'new key', col: 2, row: 1, hue: HUE.data },
        ]}
        edges={[
          { from: 'cli', to: 'srv', hue: HUE.network, flow: true },
          { from: 'srv', to: 'old', hue: HUE.data },
          { from: 'srv', to: 'new', hue: HUE.data },
        ]}
        steps={WHAT.requests.map((r) => ({
          title: `${r.op}: ${r.method} ${r.path} → ${r.status}`,
          body:
            r.op === 'HeadObject' ? (
              <p>First the tool checks the source exists and learns its size (a big object would be copied in parts).</p>
            ) : r.op === 'CopyObject' ? (
              <p>A PUT with an <code>x-amz-copy-source</code> header: the server writes a new object from the old one. The bytes never travel to your machine.</p>
            ) : (
              <p>Then the old key is deleted (204: no content). Between these two requests both keys exist; if the delete failed, both would stay.</p>
            ),
          active: ['cli', 'srv', 'cli>srv', r.op === 'CopyObject' ? 'new' : 'old', r.op === 'CopyObject' ? 'srv>new' : 'srv>old'],
        }))}
        caption="Renaming a “folder” with 10,000 objects means 10,000 copies and 10,000 deletes. Choose keys you will not need to rename."
      />
      <h3>Keys are names, with a few rules</h3>
      <Terminal title="recorded: keys RustFS refuses" steps={WHAT.keyRules} />
      <p>
        Keys may contain spaces, brackets and almost any character (up to 1,024 bytes). RustFS stores objects as paths on its drives, so it
        refuses keys with <code>..</code> or empty segments (<code>//</code>). AWS would accept both — it is one of RustFS’s documented, deliberate
        differences, and a good reason to build keys from ids rather than from what users type.
      </p>

      <Table
        head={['Object storage is good at', 'Object storage is bad at']}
        rows={[
          ['many large or small files written once and read often (photos, video, PDFs)', 'data that changes in small pieces (a counter, a row, a document being edited)'],
          ['sharing files with many servers and with browsers over HTTP', 'renames and moves of many objects (copy + delete each)'],
          ['growing without planning disk sizes; paying per byte stored', 'appending (logs written line by line belong in files or a log system first)'],
          ['keeping old versions and surviving disk failures', 'queries such as “all invoices over 100” (use a database and store the key there)'],
          ['backups, archives, exports, static website files', 'locks and transactions across several objects'],
        ]}
      />

      <h2>Does this data belong in object storage?</h2>
      <p>A rule of thumb: if you would attach it to an email, it is probably an object. If you would put it in a spreadsheet cell, it is a row.</p>
      <Table
        head={['Data', 'Where', 'Why']}
        rows={[
          ['product photos, user avatars', 'object storage', 'written once, read by many, served over HTTP'],
          ['invoice PDFs, exports, reports', 'object storage', 'files that must be kept for years; versioning and lifecycle help'],
          ['database backups, log archives', 'object storage', 'large, append-once, cheap to keep, copied off-site easily'],
          ['orders, payments, user accounts', 'a database', 'small records updated often, queried, in transactions'],
          ['which photo belongs to which product', 'a database (storing the object key)', 'the database answers questions; the object holds the bytes'],
          ['a database’s own data files', 'block storage (a volume)', 'the database rewrites small pieces in place all the time'],
          ['a shared folder people edit in place', 'file storage', 'needs partial writes, renames and locks'],
        ]}
      />
      <Predict
        question={<p>A service writes a log line every second. Should each line be appended to one object in a bucket?</p>}
        options={['Yes — that is what buckets are for', 'No — collect lines locally and upload whole files, e.g. one per hour']}
        answer={1}
        explanation={
          <p>
            S3 cannot append: each “append” would re-upload the whole, growing object. Write lines to a local file or a log system, and upload
            finished files (<code>logs/2026/10/18/12.log.gz</code>) to the bucket.
          </p>
        }
      />

      <Recap
        points={[
          'Object storage keeps whole objects — bytes, a key and metadata — in buckets, and you reach it with HTTP requests.',
          'Keys are flat names; “folders” are computed when listing with a prefix and the delimiter /, and vanish with their last object.',
          'Every write replaces the whole object; there is no append, no partial update, and “move” is copy + delete.',
          'S3 is Amazon’s service and the API almost every storage server and tool speaks: AWS S3, RustFS, MinIO, Ceph RGW, Garage.',
          'Files go in object storage, records in a database that stores the object’s key.',
        ]}
      />
    </>
  )
}
