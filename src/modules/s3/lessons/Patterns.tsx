import { BarChart, Flow } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { HUE } from '../components/legend'
import { Terminal } from '../components/Terminal'
import { PATTERNS } from '../data/patterns'
import { PATTERN_FILES } from '../data/patternsSources'

const P = PATTERNS
const envText = Object.entries(P.notifyEnv)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n')
const firstEvent = JSON.stringify(P.firstEvent, null, 2)

export default function Patterns() {
  return (
    <>
      <LessonGoals
        goals={[
          'let browsers upload and download directly, with presigned PUT, POST and GET links',
          'name keys so they stay useful, safe and fast to list',
          'page through thousands of keys, and react to uploads with bucket events',
          'monitor a server, encrypt data at rest, and secure a deployment',
          'move a bucket from one S3 server to another (for example from MinIO to RustFS) — recorded',
        ]}
        before={<>Lessons <a href="#/s3/using">Using S3</a> and <a href="#/s3/access">Access, policies and sharing</a>.</>}
      />

      <h2>Your application is not a file server</h2>
      <p>
        The tempting design is to send every upload through your own API and pass it on to the bucket. It works — until a few hundred users upload
        videos at once and your app servers spend their memory and bandwidth relaying bytes. The patterns in this lesson keep the bytes going
        straight between the browser and the storage, and keep your application in charge of <em>who</em> may do <em>what</em>.
      </p>
      <Callout tone="analogy" title="Analogy: the parcel depot">
        A shop does not carry every customer’s parcel through its office. The clerk checks the customer and hands over a stamped slip (“one parcel,
        under 5 kg, to shelf 18, today only”); the customer drops it at the depot themselves; the depot calls the shop when it arrives. Presigned
        links are the slips, bucket events are the phone call, and the shop’s order book — your database — records which shelf holds what.
      </Callout>
      <TermList
        items={[
          { term: 'presigned PUT', definition: 'A link that allows one upload to one key until it expires (lesson “Access”).' },
          { term: 'presigned POST', definition: 'A signed HTML-form upload with conditions the server enforces, such as a maximum size and a content type.' },
          { term: 'bucket event', definition: 'A message the server sends when something happens in a bucket — an object created or removed — to a webhook or a queue.' },
          { term: 'continuation token', definition: 'The bookmark a list response returns when there are more keys; the next request passes it back.' },
          { term: 'SSE', definition: 'Server-side encryption: the server encrypts objects before writing them to disk and decrypts them on read.' },
          { term: 'sync / mirror', definition: 'Copying a bucket to another place, transferring only what differs.' },
        ]}
      />

      <h2>Uploads that bypass your app</h2>
      <Flow
        title="Direct upload: the app signs, the browser uploads, an event closes the loop"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'browser', label: 'browser', sub: 'the user’s photo', col: 0, row: 0, rowSpan: 3, hue: HUE.client, shape: 'actor' },
          { id: 'app', label: 'your app', sub: 'checks the user', col: 1, row: 0, hue: HUE.client },
          { id: 'db', label: 'database', sub: 'key ↔ product', col: 2, row: 0, hue: HUE.disk, shape: 'store' },
          { id: 'rustfs', label: 'RustFS', sub: 'checks the signature', col: 1, row: 2, span: 2, hue: HUE.server, shape: 'store' },
          { id: 'hook', label: 'webhook', sub: 'event: created', col: 3, row: 1, hue: HUE.network },
        ]}
        edges={[
          { from: 'browser', to: 'app', label: '1', hue: HUE.client },
          { from: 'browser', to: 'rustfs', label: '2 PUT', hue: HUE.client, flow: true },
          { from: 'rustfs', to: 'hook', label: '3', hue: HUE.network, flow: true },
          { from: 'hook', to: 'db', label: '4', hue: HUE.network },
        ]}
        steps={[
          { title: '1. Ask for a link', body: <p>The browser asks the app for an upload. The app checks the login, picks the key (never the user’s file name) and returns a presigned URL valid for a few minutes.</p>, active: ['browser', 'app', 'browser>app'] },
          { title: '2. Upload directly', body: <p>The browser sends the file straight to RustFS with that URL — the app never touches the bytes.</p>, active: ['browser', 'rustfs', 'browser>rustfs'] },
          { title: '3. Event', body: <p>RustFS sends an <code>s3:ObjectCreated</code> event to a webhook (or a queue).</p>, active: ['rustfs', 'hook', 'rustfs>hook'] },
          { title: '4. Record it', body: <p>The receiver checks the object (size, type, maybe a virus scan), then records the key in the database. Only now does the photo “exist” for the shop.</p>, active: ['hook', 'db', 'hook>db'] },
        ]}
      />
      <h3>With a presigned PUT</h3>
      <Terminal title="recorded: the app makes the link (node, script below)" steps={P.presignPut} />
      <Terminal title="recorded: the upload, then a check of what arrived" steps={P.putUpload} />
      <p>
        A browser sends the same request with <code>fetch(url, {'{'} method: 'PUT', body: file, headers: {'{'} 'Content-Type': file.type {'}'} {'}'})</code>,
        which needs the CORS rules from lesson “Access”. The weakness of a PUT link: it does not limit the size.
      </p>
      <h3>With a presigned POST: limits the server enforces</h3>
      <CodeBlock title="upload-form.ts (the script that ran)" language="typescript" code={PATTERN_FILES.uploadForm} />
      <Terminal title="recorded: the form fields" steps={P.presignPost} maxLines={20} />
      <Terminal title="recorded: a 2 KiB image, a 200 KiB image, and an HTML file — same form" steps={P.postUpload} />
      <p>
        The signed <code>Policy</code> carried two conditions, and RustFS enforced both: the 200 KiB file was refused with{' '}
        <code>EntityTooLarge</code> (limit 100,000 bytes), the HTML file with <code>InvalidPolicyDocument</code>. Use POST when users upload
        and you need limits; use PUT for trusted clients and large multipart uploads.
      </p>
      <Table
        head={['', 'presigned PUT', 'presigned POST']}
        rows={[
          ['how the browser sends it', 'fetch / XHR with the file as body', 'an HTML form (multipart/form-data) or fetch with FormData'],
          ['size limit', 'no', 'yes: content-length-range'],
          ['content type', 'only if signed (lesson “Access”)', 'yes: exact or starts-with'],
          ['multipart for huge files', 'yes (presign each part)', 'no (one request, up to 5 GiB)'],
        ]}
      />

      <h2>Serving private files</h2>
      <p>Invoices and user documents stay in a private bucket. The app hands out a short download link — and can choose the file name the browser saves:</p>
      <CodeBlock title="share.ts (the script that ran)" language="typescript" code={PATTERN_FILES.share} />
      <Terminal title="recorded: the link, and what the browser gets" steps={[...P.shareCmd, ...P.download]} />
      <p>
        <code>response-content-disposition</code> in the signed query made the server answer with{' '}
        <code>content-disposition: attachment; filename="invoice-0042.pdf"</code>, although the key is <code>invoices/2026/0042.pdf</code>. Keep
        links short-lived (minutes), create them when the user clicks, and do not cache pages that contain them for longer than their expiry.
      </p>

      <h2>Naming keys</h2>
      <Table
        head={['Rule', 'Good', 'Avoid', 'Why']}
        rows={[
          ['generate keys; keep the user’s file name as metadata or in the database', 'uploads/2026/10/18/7f3c…e1f.jpg', 'uploads/My Holiday (1).JPG', 'no clashes, no strange characters, nothing to guess'],
          ['no personal data in keys', 'avatars/u-81233.webp', 'avatars/jane.doe@example.com.png', 'keys appear in logs, URLs and listings'],
          ['a prefix per kind of data', 'invoices/, exports/, uploads/', 'everything at the top level', 'policies, lifecycle rules and listings work per prefix'],
          ['dates for things you clean up or browse by time', 'exports/2026/10/18/orders.csv', 'exports/orders-18-10-2026.csv', 'list one day with one prefix; expire by prefix'],
          ['no “..”, “//” or leading slashes', 'images/mug/front.jpg', 'images/../x, images//x', 'RustFS refuses them (lesson 1); others may store them oddly'],
        ]}
      />
      <Terminal title="recorded: one day of exports is one prefix" steps={P.byDate} />
      <Callout tone="note" title="Prefixes and speed">
        AWS documents a request rate per prefix (at least 3,500 writes and 5,500 reads per second), which is why very busy systems spread keys
        over many prefixes. On a self-hosted RustFS the limit is your drives and network, not the prefix; good names matter for people,
        policies and lifecycle rules first.
      </Callout>

      <h2>Listing thousands of keys</h2>
      <p>
        A list request returns at most 1,000 keys. The capture script stored {P.objects.toLocaleString()} log files and listed them page by page:
      </p>
      <BarChart
        title={`Recorded: listing ${P.objects.toLocaleString()} keys under logs/ took ${P.pages.length} requests (${P.listMs} ms)`}
        bars={P.pages.map((p, i) => ({ label: `page ${i + 1}${p.truncated ? ' (more)' : ' (last)'}`, value: p.keys, display: `${p.keys} keys`, hue: p.truncated ? HUE.data : HUE.ok, note: `${p.first} … ${p.last}` }))}
      />
      <Terminal title="recorded: the CLI pages too (--max-items, --starting-token), then deletes them all" steps={P.paging} />
      <ul>
        <li>Each page carries a continuation token; the SDK paginators from lesson 3 follow it for you.</li>
        <li>Keys come back sorted, so zero-padded numbers and ISO dates (<code>2026-10-18</code>) list in a useful order.</li>
        <li>
          Listing is for maintenance, not for answering questions. “All photos of product 42” belongs in a database that stores the keys; a
          listing of millions of keys takes thousands of requests.
        </li>
      </ul>

      <h2>Bucket events</h2>
      <p>RustFS can send an event for every change to a webhook (and, per its documentation, to queues such as AMQP or NATS — not recorded here). The server was started with:</p>
      <CodeBlock title="server environment (as the recording passed it)" language="properties" code={envText} />
      <CodeBlock title="notification.json — which events, for which keys" language="json" code={PATTERN_FILES.notification} />
      <Terminal title="recorded: attach it to the bucket" steps={P.eventsSetup} maxLines={30} />
      <CodeBlock title="receiver.mjs — the webhook that ran" language="javascript" code={PATTERN_FILES.receiver} />
      <p>The uploads above (PUT, then POST) and one delete produced these events:</p>
      <Table
        head={['Event', 'Key', 'Size', 'Time']}
        rows={P.events.map((e) => [<code key="e">{e.eventName}</code>, <code key="k">{e.key}</code>, 'size' in e ? `${e.size} B` : '—', e.time])}
      />
      <CodeBlock title="recorded: the first event as the webhook received it" language="json" code={firstEvent} />
      <ul>
        <li>The format follows AWS’s S3 event records; the key is URL-encoded inside the event.</li>
        <li>The queue directory setting is where RustFS keeps events it could not deliver yet (delivery failures were not tested here). Make receivers idempotent: an event may arrive twice.</li>
        <li>Typical uses: make thumbnails, scan for viruses, index documents, update the database.</li>
      </ul>

      <h2>Monitoring</h2>
      <Table
        head={['Watch', 'Where', 'Why']}
        rows={[
          ['alive / ready', '/health and /health/ready (lesson 2)', 'load balancers and orchestrators'],
          ['drives and servers online', 'rc admin info cluster, the console’s Running Status', 'replace a failed drive before the next one fails'],
          ['used capacity', 'rc admin info, metrics', 'erasure coding cannot write when drives are full'],
          ['request errors and latency', 'metrics (OpenTelemetry), your SDK’s metrics', '5xx and SlowDown mean quorum or overload trouble'],
          ['heal and scanner progress', 'rc admin heal status', 'a long heal after a drive swap is a window of lower safety'],
          ['unfinished multipart uploads, old versions', 'list-multipart-uploads, lifecycle rules', 'hidden space use'],
        ]}
      />
      <Terminal title="recorded: realtime metrics through rc" steps={P.metrics} />
      <p>
        RustFS {P.version} has no Prometheus scrape URL like some other S3 servers; it pushes logs, metrics and traces with OpenTelemetry to a
        collector (<code>RUSTFS_OBS_ENDPOINT</code>, not recorded here). The <code>rc admin metrics</code> request was refused by this version,
        as recorded — check what your versions of server and client support together.
      </p>

      <h2>Encryption at rest</h2>
      <Terminal title="recorded: SSE without a key configured" steps={P.sse} />
      <Terminal title="recorded: a second server started with RUSTFS_SSE_S3_MASTER_KEY" steps={P.sseOn} />
      <p>
        With a master key the same request succeeded; reading needs nothing special. On the drive, the plain object’s file ends with the text;
        the encrypted one shows only metadata strings — the text is not there to read. Its ETag is no longer the MD5 of the content (lesson 4 warned about this). RustFS also supports
        keys you send with each request (SSE-C) and a key management service such as Vault (SSE-KMS) — not recorded here. Encryption at rest
        protects stolen disks, not stolen access keys.
      </p>

      <h2>Moving data between S3 servers</h2>
      <p>
        Because every server speaks S3, moving a bucket — to a new cluster, to a backup site, or from another S3 server such as MinIO to RustFS —
        is a copy through the API. Two RustFS servers (<code>s3-lab</code> and <code>s3-node-b</code>) on one network stood in for old and new:
      </p>
      <CodeBlock title="rclone.conf — one remote per server" language="ini" code={PATTERN_FILES.rcloneConf} />
      <Terminal title={`recorded: ${P.rclone} — sync, check, change one object, sync again`} steps={P.rcloneSteps} />
      <Terminal title="recorded: the same with rc mirror" steps={P.mirror} />
      <Flow
        title="A migration without downtime"
        cols={5}
        rows={1}
        rowHeight={84}
        nodes={[
          { id: 'prep', label: '1. prepare', sub: 'buckets, users, rules', col: 0, row: 0, hue: HUE.identity },
          { id: 'bulk', label: '2. bulk sync', sub: 'hours, apps still old', col: 1, row: 0, hue: HUE.data },
          { id: 'delta', label: '3. sync again', sub: 'only the changes', col: 2, row: 0, hue: HUE.data },
          { id: 'switch', label: '4. switch apps', sub: 'endpoint + keys', col: 3, row: 0, hue: HUE.client },
          { id: 'final', label: '5. final sync', sub: 'old one read-only', col: 4, row: 0, hue: HUE.ok },
        ]}
        edges={[
          { from: 'prep', to: 'bulk', hue: HUE.data, flow: true },
          { from: 'bulk', to: 'delta', hue: HUE.data, flow: true },
          { from: 'delta', to: 'switch', hue: HUE.client, flow: true },
          { from: 'switch', to: 'final', hue: HUE.ok, flow: true },
        ]}
        caption="From MinIO, the source remote simply points at the MinIO endpoint; mc mirror works the same way as rc mirror (not recorded here)."
      />
      <ul>
        <li>Sync tools copy objects (current versions, metadata), not bucket settings: recreate policies, users, versioning, lifecycle, CORS and events first.</li>
        <li>Old versions are not copied; if you need them, copy with a versioning-aware tool or keep the old server until they expire.</li>
        <li><code>rclone check</code> (or <code>rc diff</code>) compares both sides before you switch.</li>
      </ul>
      <Predict
        question={<p>A nightly <code>rclone sync source:catalog backup:catalog</code> is your backup. Someone deletes half the bucket at 17:00. What is in the backup the next morning?</p>}
        options={['Everything — it is a backup', 'Only the remaining half — sync copied the deletes too', 'Nothing — the sync fails']}
        answer={1}
        explanation={<p>Sync makes the target look like the source, deletions included. A backup needs history: versioning (better, object lock) on the backup bucket, or <code>rclone copy</code> plus lifecycle rules, so yesterday’s objects survive today’s mistakes.</p>}
      />

      <h2>Security checklist</h2>
      <Table
        head={['Check', 'How']}
        rows={[
          ['TLS everywhere', 'RUSTFS_TLS_PATH with a certificate, or a TLS-terminating proxy; https:// endpoints in every client'],
          ['root keys locked away', 'set your own at start-up (files, not command lines); use them only for administration'],
          ['least privilege', 'one user or access key per application, with a policy for its prefix and actions; deny DeleteObjectVersion to apps'],
          ['no public buckets', 'presigned links instead; public access block on private buckets; never allow anonymous listing'],
          ['rotate keys', 'access keys with expiry; replace keys without downtime (two keys, deploy, delete the old)'],
          ['protect against mistakes', 'versioning + lifecycle for noncurrent versions; object lock for records that must not change'],
          ['encryption at rest', 'SSE with a master key or a KMS when disks could leave your control'],
          ['copies elsewhere', 'replication or versioned/immutable backups in another place; test restoring'],
          ['console exposure', 'keep port 9001 internal or turn the console off (RUSTFS_CONSOLE_ENABLE=false) where nobody needs it'],
        ]}
      />

      <h2>Common mistakes</h2>
      <Table
        head={['Mistake', 'What happens', 'Instead']}
        rows={[
          ['uploading through the app server', 'memory, bandwidth and timeouts on your servers', 'presigned PUT / POST'],
          ['using the user’s file name as the key', 'overwrites, odd characters, personal data in logs', 'generated keys, name in metadata'],
          ['listing the bucket to find things', 'slow, many requests', 'store keys in your database'],
          ['forgetting path-style on a self-hosted server', 'DNS errors like catalog.localhost', 'forcePathStyle / force_path_style / path-style-access-enabled'],
          ['ignoring unfinished multipart uploads', 'invisible space use', 'lifecycle AbortIncompleteMultipartUpload'],
          ['versioning without lifecycle', 'storage grows with every overwrite', 'NoncurrentVersionExpiration'],
          ['“sync --delete” as a backup', 'deletes reach the backup too', 'versioned or locked backup target'],
          ['comparing ETags with your own MD5', 'fails for multipart and encrypted objects', 'compare checksums or ETags with ETags'],
          ['one drive in production', 'one disk failure loses data', 'several drives and servers (lesson “Surviving disk failures”)'],
        ]}
      />

      <Recap
        points={[
          'Let browsers talk to storage directly: presigned PUT for trusted uploads, presigned POST when the server must enforce size and type, presigned GET for private downloads.',
          'Generate keys under meaningful prefixes (kind, date, id); keep names and personal data out of them; keep the index in a database.',
          'Lists come in pages of 1,000 with continuation tokens; bucket events tell other systems what changed.',
          'Monitor drives, capacity, errors and heals; encrypt at rest where disks can leave; TLS and least privilege always.',
          'Moving between S3 servers is sync + switch + final sync; sync is not a backup without versions.',
        ]}
      />
    </>
  )
}
