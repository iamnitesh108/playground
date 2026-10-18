import { Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { HttpExchange } from '../components/HttpExchange'
import { HUE } from '../components/legend'
import { RequestsSigner } from '../components/RequestsSigner'
import { RequestsVerbs } from '../components/RequestsVerbs'
import { Terminal } from '../components/Terminal'
import { UrlStyles } from '../components/UrlStyles'
import { REQUESTS } from '../data/requests'

const R = REQUESTS
const VERB_NAMES = ['create a bucket', 'upload', 'download', 'metadata only', 'list', 'delete']

/** Status line and S3 error code of a recorded error step. */
const errorRows = R.errors.map((e) => {
  const [status, body = ''] = (e.out ?? '').split('\n')
  return { status: status.replace('HTTP/1.1 ', ''), code: body.match(/<Code>(\w+)<\/Code>/)?.[1] ?? '(none: the request worked)', cmd: e.cmd ?? '' }
})
const CAUSES: Record<string, [string, string]> = {
  NoSuchKey: ['the key is not in the bucket', 'check the key (case, leading slash, URL encoding); for “maybe missing” use HEAD and treat 404 as an answer'],
  NoSuchBucket: ['the bucket name is wrong, or it lives on another server', 'check the bucket and the endpoint'],
  AccessDenied: ['no signature at all, or the user may not do this', 'sign the request; check the policies (lesson “Access”)'],
  SignatureDoesNotMatch: ['the server computed a different signature', 'wrong secret key, a proxy changed a signed header, or path-style vs virtual-hosted mix-up'],
  InvalidAccessKeyId: ['the access key does not exist on this server', 'wrong key, or keys of another server/environment'],
}
const RE = R.skewWire
const skewWire = [
  'GET /catalog/readme.txt HTTP/1.1',
  ...Object.entries(RE.headers).map(([k, v]) => `${k}: ${v}`),
  '',
  `HTTP/1.1 ${RE.status} Forbidden`,
  '',
  RE.body,
].join('\n')
const C = R.consistency

export default function Requests() {
  return (
    <>
      <LessonGoals
        goals={[
          'see that every S3 action is one HTTP request, and read requests and responses',
          'tell path-style from virtual-hosted-style addresses',
          'know the headers that matter, what an ETag is, and what the common error codes mean',
          'compute an AWS Signature Version 4 by hand, step by step — in your browser',
          'explain clock-skew errors, conditional requests, and why a read right after a write sees it',
        ]}
        before={<>Lessons <a href="#/s3/what">What object storage is</a> and <a href="#/s3/using">Using S3</a>. No HTTP knowledge needed.</>}
      />

      <h2>Letters to the server</h2>
      <p>
        Every tool in the last lesson — console, CLI, SDK — does the same thing underneath: it sends <strong>HTTP requests</strong>, the same
        protocol your browser uses to load web pages. Knowing what those requests look like makes errors readable and tools less magical.
      </p>
      <Callout tone="analogy" title="Analogy: a sealed letter">
        A request is a letter. The <em>address</em> (URL) says where it goes, notes on the envelope (<em>headers</em>) say what it is about, the
        letter itself is the <em>body</em>. The wax <em>seal</em> — the signature — proves it was sealed by someone who owns the right ring (the
        secret key) and that nobody opened it on the way. The <em>postmark</em> (date) makes an old letter useless if someone tries to send it
        again later.
      </Callout>
      <TermList
        items={[
          { term: 'HTTP method', definition: 'The verb of a request: GET (read), PUT (store), HEAD (only the headers), DELETE (remove), POST (special actions).' },
          { term: 'path and query', definition: 'The part of the URL after the host: /catalog/readme.txt, and after a ? options like list-type=2&prefix=images/.' },
          { term: 'header', definition: 'A name: value line sent with a request or response, e.g. Content-Type: text/plain.' },
          { term: 'status code', definition: 'The first line of the answer: 200 OK, 204 No Content, 304 Not Modified, 403 Forbidden, 404 Not Found, 412 Precondition Failed.' },
          { term: 'body', definition: 'The content after the headers: the object’s bytes on PUT and GET, an XML document for lists and errors.' },
          { term: 'signature', definition: 'A code computed from the request and your secret key (AWS Signature Version 4). The server recomputes it to know the request is yours and unchanged.' },
          { term: 'ETag', definition: 'A fingerprint of an object’s content, returned with every PUT, GET and HEAD.' },
        ]}
      />

      <h2>Every action is one request</h2>
      <p>The S3 API is a small set of requests. The method says what to do; the path says to which bucket and key:</p>
      <Table
        head={['Action (API name)', 'Method', 'Path and query', 'Answer']}
        rows={[
          ['create a bucket (CreateBucket)', 'PUT', '/catalog', '200, empty'],
          ['upload (PutObject)', 'PUT', '/catalog/readme.txt + body', '200, ETag header'],
          ['download (GetObject)', 'GET', '/catalog/readme.txt', '200, the bytes'],
          ['metadata only (HeadObject)', 'HEAD', '/catalog/readme.txt', '200, headers only'],
          ['list (ListObjectsV2)', 'GET', '/catalog?list-type=2&prefix=…&delimiter=/', '200, XML'],
          ['delete (DeleteObject)', 'DELETE', '/catalog/readme.txt', '204, empty'],
          ['copy (CopyObject)', 'PUT', '/catalog/new-key + x-amz-copy-source header', '200, XML'],
          ['delete many (DeleteObjects)', 'POST', '/catalog?delete + XML list of keys', '200, XML'],
          ['multipart upload', 'POST / PUT / POST', '?uploads, ?partNumber=1&uploadId=…, ?uploadId=…', 'lesson “Large files”'],
        ]}
      />
      <p>Here are the first six, sent with <code>curl</code> (which can sign S3 requests itself) to RustFS {R.version} and recorded on the wire:</p>
      <RequestsVerbs steps={R.verbs} names={VERB_NAMES} />
      <Terminal title="recorded: the same six requests as curl printed them" steps={R.verbs} maxLines={14} />
      <ul>
        <li>Every request carries <code>Authorization</code>, <code>X-Amz-Date</code> and <code>x-amz-content-sha256</code>: the signature, its time, and a hash of the body.</li>
        <li>
          The upload sent <code>x-amz-content-sha256: UNSIGNED-PAYLOAD</code>: curl chose not to hash the body. The signature then covers the
          headers but not the bytes — fine over HTTPS, which protects the body on its own.
        </li>
        <li><code>HEAD</code> returns exactly the headers <code>GET</code> would, without the body: the cheap way to ask “does it exist, how big, which version?”.</li>
        <li>Lists and errors come back as XML. The SDKs parse it for you; the CLI prints it as JSON.</li>
      </ul>

      <h2>Where the bucket goes: path or host</h2>
      <UrlStyles />
      <p>
        RustFS understands the second form only once it knows its own domain. With <code>RUSTFS_SERVER_DOMAINS=s3.lab.test:9000</code> and a name
        that resolves to the server, the bucket moves into the host name:
      </p>
      <Terminal title="recorded: virtual-hosted-style on RustFS with RUSTFS_SERVER_DOMAINS" steps={R.virtual} />
      <p>
        AWS prefers virtual-hosted style (its SDKs use it by default); self-hosted servers usually run path-style, because it needs no
        wildcard DNS or wildcard TLS certificate. SDKs pick one with a single switch (lesson “Using S3”).
      </p>

      <h2>Headers you will meet</h2>
      <Table
        head={['Header', 'Sent by', 'Meaning']}
        rows={[
          [<code key="a">Authorization</code>, 'client', 'AWS4-HMAC-SHA256 Credential=…, SignedHeaders=…, Signature=…'],
          [<code key="b">X-Amz-Date</code>, 'client', 'when the request was signed (UTC); the server rejects old or future dates'],
          [<code key="c">x-amz-content-sha256</code>, 'client', 'SHA-256 of the body, or UNSIGNED-PAYLOAD'],
          [<code key="d">Content-Type</code>, 'both', 'kind of content; stored with the object on upload and returned on download'],
          [<code key="e">Content-Length</code>, 'both', 'size of the body in bytes'],
          [<code key="f">x-amz-meta-*</code>, 'both', 'your own metadata fields'],
          [<code key="g">ETag</code>, 'server', 'fingerprint of the content'],
          [<code key="h">Last-Modified</code>, 'server', 'time of the last write'],
          [<code key="i">Range</code>, 'client', 'only some bytes, e.g. bytes=0-1023 (lesson “Large files”)'],
          [<code key="j">If-Match / If-None-Match</code>, 'client', 'only if the ETag is / is not … (conditional requests, below)'],
          [<code key="k">x-amz-request-id</code>, 'server', 'id of this request in the server’s logs; quote it when reporting a problem'],
        ]}
      />

      <h2>ETag: the content’s fingerprint</h2>
      <Terminal title="recorded: the ETag of a simple upload, and the file’s MD5" steps={R.etag} />
      <p>
        For an object uploaded in one PUT, the ETag is the MD5 checksum of its bytes, in quotes. Two objects with the same content have the same
        ETag; any change gives a new one. Clients use it to check an upload arrived intact, to see whether a cached copy is still current, and
        for conditional requests. Two cases break the “ETag = MD5” rule: objects uploaded in parts (the ETag ends in <code>-N</code>, lesson
        “Large files”) and objects encrypted by the server. So compare ETags with ETags; do not compute them yourself.
      </p>

      <h2>Errors</h2>
      <p>Errors come back as a status code plus an XML body with a <code>Code</code> and a <code>Message</code>. Six recorded attempts:</p>
      <Terminal title="recorded: what goes wrong" steps={R.errors} />
      <Table
        head={['Status', 'Code', 'What it means', 'What to check']}
        rows={errorRows
          .filter((e) => CAUSES[e.code])
          .map((e) => [e.status, <code key={e.code}>{e.code}</code>, CAUSES[e.code][0], CAUSES[e.code][1]])}
      />
      <Callout tone="note" title="A difference from AWS">
        The last request was signed for <code>eu-west-1</code> and RustFS answered {errorRows[errorRows.length - 1].status}. AWS checks the region
        in the signature against the bucket’s real region and refuses a mismatch; this RustFS, with no <code>RUSTFS_REGION</code> set, accepted
        it. Configure the right region anyway — the same code will one day talk to a server that checks.
      </Callout>

      <h2>Signing a request, step by step</h2>
      <p>
        The signature is the heart of S3 security. Your secret key never travels over the network; instead the client computes a code from the
        request and the key, and the server — which has its own copy of the key — computes the same code and compares. This scheme is called{' '}
        <strong>AWS Signature Version 4</strong> (SigV4).
      </p>
      <Flow
        title="SigV4: both sides compute, only the result travels"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'req', label: 'the request', sub: 'method, path, headers', col: 0, row: 0, hue: HUE.client },
          { id: 'canon', label: 'canonical request', sub: 'one exact text form', col: 1, row: 0, hue: HUE.network },
          { id: 'sts', label: 'string to sign', sub: 'time, scope, hash', col: 2, row: 0, hue: HUE.network },
          { id: 'secret', label: 'secret key', sub: 'never sent', col: 0, row: 2, hue: HUE.identity },
          { id: 'skey', label: 'signing key', sub: 'day, region, s3', col: 1, row: 2, hue: HUE.identity },
          { id: 'sig', label: 'signature', sub: '64 hex characters', col: 2, row: 2, hue: HUE.network },
          { id: 'server', label: 'RustFS', sub: 'recomputes, compares', col: 3, row: 0, rowSpan: 3, hue: HUE.server },
        ]}
        edges={[
          { from: 'req', to: 'canon', hue: HUE.network },
          { from: 'canon', to: 'sts', label: 'SHA-256', hue: HUE.network },
          { from: 'secret', to: 'skey', label: '4 × HMAC', hue: HUE.identity },
          { from: 'skey', to: 'sig', hue: HUE.identity },
          { from: 'sts', to: 'sig', label: 'HMAC', hue: HUE.network },
          { from: 'sig', to: 'server', label: 'Authorization', hue: HUE.network, flow: true },
        ]}
        steps={[
          { title: 'Write the request down exactly', body: <p>Method, path, sorted query, the chosen headers (lower-case, trimmed), the list of signed headers, and the body hash — one per line.</p>, active: ['req', 'canon', 'req>canon'] },
          { title: 'Say what is being signed', body: <p>The string to sign holds the algorithm, the time, the <em>scope</em> (day/region/service) and the SHA-256 of the canonical request.</p>, active: ['canon', 'sts', 'canon>sts'] },
          { title: 'Derive a key for today', body: <p>Four HMACs turn the secret into a key valid only for this day, region and service. A leaked signing key is useless tomorrow.</p>, active: ['secret', 'skey', 'secret>skey'] },
          { title: 'Sign and send', body: <p>HMAC(signing key, string to sign) is the signature. It goes into the Authorization header with the access key and the list of signed headers.</p>, active: ['skey', 'sts', 'sig', 'server', 'skey>sig', 'sts>sig', 'sig>server'] },
          { title: 'The server checks', body: <p>RustFS looks up the secret for the access key, repeats every step on the request it received, and compares. Equal: proceed. Different: 403 SignatureDoesNotMatch.</p>, active: ['server', 'sig>server'] },
        ]}
      />
      <p>
        Below, your browser repeats the computation for a real request: <code>GET /catalog/readme.txt</code> as sent by the aws CLI (it logged its
        canonical request, string to sign and signature with <code>--debug</code>). The lab secret key is public on purpose — never paste a real
        one into a web page.
      </p>
      <RequestsSigner recorded={R.sigv4} />
      <p>
        The aws CLI signed one more header than curl did: <code>x-amz-checksum-mode</code> (it asks the server to return checksums). Signed headers
        can be anything the client chooses, as long as <code>host</code> and the <code>x-amz-*</code> headers it sends are included.
      </p>
      <Callout tone="note" title="Presigned URLs are the same signature">
        A presigned link carries the same pieces in its query string instead of headers: <code>X-Amz-Algorithm</code>,{' '}
        <code>X-Amz-Credential</code>, <code>X-Amz-Date</code>, <code>X-Amz-Expires</code>, <code>X-Amz-SignedHeaders</code> and{' '}
        <code>X-Amz-Signature</code>. Whoever holds the link can make exactly that request until it expires — and nothing else, because changing
        any part breaks the signature.
      </Callout>

      <h2>Clocks matter</h2>
      <p>
        The signed date stops replays: a captured request is worthless a few minutes later. The capture script signed the same GET with its clock
        moved by up to 20 minutes either way:
      </p>
      <Timeline
        title="Recorded: requests signed with a wrong clock (minutes off the server’s time)"
        start={-20}
        end={20}
        unit="min"
        lanes={[
          { id: 'ok', label: 'accepted (200), ±15 min' },
          { id: 'bad', label: 'refused (403)' },
        ]}
        segments={[
          { lane: 'ok', from: -15, to: 15, hue: HUE.ok },
          { lane: 'bad', from: -20, to: -15, hue: HUE.error, striped: true },
          { lane: 'bad', from: 15, to: 20, hue: HUE.error, striped: true },
        ]}
        events={R.skew.map((x) => ({ lane: x.status === 200 ? 'ok' : 'bad', at: x.minutes, label: `${x.minutes > 0 ? '+' : ''}${x.minutes}`, hue: x.status === 200 ? HUE.ok : HUE.error }))}
      />
      <HttpExchange wire={skewWire} title="Recorded: signed 20 minutes in the past (by the capture script’s own SigV4 signer)" />
      <p>
        RustFS accepted −14 and +14 minutes and refused ±16, the same 15-minute window AWS uses. Its message (“{R.skewed.message}”) differs from
        AWS’s wording; the code <code>{R.skewed.code}</code> is the same. If you see it, fix the clock (NTP), not the code — containers and VMs
        that were suspended are typical culprits.
      </p>

      <h2>Conditional requests</h2>
      <p>Headers can make a request depend on the object’s current ETag. The server checks and refuses if the condition does not hold:</p>
      <Terminal title="recorded: If-None-Match and If-Match" steps={R.conditional} />
      <Table
        head={['Request', 'Recorded answer', 'Use it for']}
        rows={[
          ['PUT with If-None-Match: * (key exists)', '412 Precondition Failed', 'create only if absent — two uploaders cannot overwrite each other'],
          ['GET with If-None-Match: "<current ETag>"', '304 Not Modified, no body', 'refresh a cache only when the object changed'],
          ['GET with If-Match: "<other ETag>"', '412 Precondition Failed', 'read only the version you expect'],
          ['PUT with If-None-Match: * (new key)', '200 OK', 'the normal case: the key did not exist yet'],
        ]}
      />
      <Predict
        question={<p>Two workers both generate <code>reports/2026-10.pdf</code> and upload it with <code>If-None-Match: *</code> at the same moment. What happens?</p>}
        options={['Both succeed; the last one wins', 'One gets 200, the other 412 — exactly one upload wins', 'Both get 412']}
        answer={1}
        explanation={
          <p>
            Recorded: in {R.race.trials} races of two simultaneous uploads, the outcome was “{Object.entries(R.race.outcomes).map(([k, n]) => `${k.replace('+', ' and ')} in ${n}`).join(', ')}”
            — always exactly one winner. Without the header the second write would silently replace the first.
          </p>
        }
      />

      <h2>Read-after-write: you see what you wrote</h2>
      <p>
        After a successful PUT or DELETE, every later request sees the change — no waiting, no “eventually”. The capture script tested it{' '}
        {C.rounds} times in a row:
      </p>
      <StatTiles
        title={`Recorded: ${C.rounds} rounds of write-then-read (${(C.ms / 1000).toFixed(1)} s)`}
        stats={[
          { label: 'overwrite, then GET returned the old content', value: C.overwriteStale, sub: `of ${C.rounds}`, hue: C.overwriteStale ? HUE.error : HUE.ok },
          { label: 'new key, then LIST did not show it', value: C.listMissing, sub: `of ${C.rounds}`, hue: C.listMissing ? HUE.error : HUE.ok },
          { label: 'DELETE, then GET still found it', value: C.deleteVisible, sub: `of ${C.rounds}`, hue: C.deleteVisible ? HUE.error : HUE.ok },
        ]}
      />
      <p>
        RustFS answers a write only after enough drives have it (a <em>write quorum</em>, lesson “Surviving disk failures”), and reads consult
        enough drives to find the newest version, so this holds on a cluster too. AWS S3 has given the same strong read-after-write guarantee
        since December 2020; before that, overwrites and lists could lag. What S3 does <strong>not</strong> give you is transactions: two
        objects cannot be changed together atomically, and two simultaneous PUTs to one key end with whichever finished last.
      </p>

      <Recap
        points={[
          'Every S3 action is one HTTP request: PUT, GET, HEAD, DELETE, POST on /bucket/key, with headers and maybe a body; answers are status codes, headers and XML.',
          'Path-style puts the bucket in the path (RustFS default); virtual-hosted style in the host name (needs RUSTFS_SERVER_DOMAINS and DNS).',
          'The ETag fingerprints the content: the MD5 for single uploads, something else for multipart or encrypted objects.',
          'SigV4: canonical request → SHA-256 → string to sign → HMAC with a key derived from secret, day, region and service. The secret never travels.',
          'Clocks must be within 15 minutes; If-Match / If-None-Match make writes and reads conditional; reads see completed writes immediately.',
        ]}
      />
    </>
  )
}
