import { ByteLayout, Flow, StatTiles, Timeline } from '@/shared/figures'
import { Callout, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { LargeFilesRanges } from '../components/LargeFilesRanges'
import { LargeFilesSimulator } from '../components/LargeFilesSimulator'
import { HUE } from '../components/legend'
import { Terminal } from '../components/Terminal'
import { LARGE } from '../data/large'

const L = LARGE
const json = (out: string | undefined) => JSON.parse(out ?? '{}') as Record<string, unknown>
const stepOf = (steps: readonly { cmd?: string; out?: string }[], start: string) => steps.find((s) => s.cmd?.startsWith(start))
const shortId = (cmd: string) => cmd.replace(/--upload-id (\S{10})\S+/, '--upload-id $1…')
const short = <T extends { cmd?: string }>(steps: readonly T[]) => steps.map((s) => ({ ...s, cmd: s.cmd && shortId(s.cmd) }))

// the three part MD5s and the final ETag, from the recording
const partMd5 = (stepOf(L.etag, 'md5sum part-*')?.out ?? '').split('\n').map((l) => l.split(/\s+/)[0])
const finalEtag = String(json(stepOf(L.complete, 'aws s3api complete-multipart-upload')?.out).ETag).replace(/"/g, '')
const md5OfMd5s = (stepOf(L.etag, 'for p in part-*')?.out ?? '').split(/\s+/)[0]
const wholeMd5 = (stepOf(L.etag, 'cat part-00')?.out ?? '').split(/\s+/)[0]
const head = json(stepOf(L.complete, 'aws s3api head-object')?.out) as { ContentLength: number }
const SIZE = head.ContentLength

// aws s3 cp of 64 MiB: parts per thread
const CP = L.cpTimeline
const threads = [...new Set(CP.map((r) => r.thread))].sort((a, b) => Number(a.split('_').pop()) - Number(b.split('_').pop()))
const cpEnd = Math.max(...CP.map((r) => r.end))
const parts = CP.filter((r) => r.op === 'UploadPart')
const cpEtag = String(json(L.cpSteps[1]?.out).etag).replace(/"/g, '')

// recorded ranges
const rangeOf = (cmdStart: string) => {
  const out = stepOf(L.range, cmdStart)?.out ?? ''
  const m = out.match(/content-range: bytes (\d+)-(\d+)/i) ?? out.match(/"ContentRange": "bytes (\d+)-(\d+)/)
  return m ? [Number(m[1]), Number(m[2])] : [0, 0]
}
const [r1from, r1to] = rangeOf('curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H "Range: bytes=0-15"')
const [r2from, r2to] = rangeOf('curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H "Range: bytes=-10"')
const [r3from, r3to] = rangeOf('aws s3api get-object --bucket catalog --key videos/demo.mp4 --range')
const [r4from, r4to] = rangeOf('aws s3api get-object --bucket catalog --key videos/demo.mp4 --part-number')

export default function LargeFiles() {
  return (
    <>
      <LessonGoals
        goals={[
          'explain why big files are uploaded in parts, and the limits that apply',
          'do a multipart upload by hand — create, upload parts, list, complete or abort — and resume one after a crash',
          'read a multipart ETag, and see how a CLI uploads parts in parallel',
          'download only part of an object with a Range request',
          'protect uploads with Content-MD5 and x-amz-checksum headers',
          'plan part size and parallelism for a file of any size',
        ]}
        before={<>Lesson <a href="#/s3/requests">The S3 API on the wire</a> (requests, ETags).</>}
      />

      <h2>Big files do not travel in one piece</h2>
      <p>
        Uploading a 20 GB video in one request is fragile: if the connection drops at 19 GB, everything starts again, and one connection may not
        use all your bandwidth. S3 lets you cut a file into numbered <strong>parts</strong>, send them separately — in parallel, in any order,
        retrying only the ones that fail — and then ask the server to join them into one object.
      </p>
      <Callout tone="analogy" title="Analogy: moving house">
        Nobody carries a house in one trip. You pack numbered boxes, several friends carry boxes at the same time, and a dropped box means
        re-packing that box, not the whole house. At the end you hand the new owner a list — “boxes 1, 2 and 3, in that order” — and only then is
        the house moved in. Reading works the same way backwards: to read page 200 of a book you open it there, you do not copy the whole book
        first.
      </Callout>
      <TermList
        items={[
          { term: 'multipart upload', definition: 'An upload in three stages: create it (get an upload id), upload numbered parts, then complete it with the list of parts.' },
          { term: 'upload id', definition: 'The name of one unfinished multipart upload. Every part request and the final complete or abort quote it.' },
          { term: 'part', definition: 'One piece, numbered 1 to 10,000. Each must be at least 5 MiB, except the last, and at most 5 GiB.' },
          { term: 'complete', definition: 'The request that joins the parts, in part-number order, into the object. Until then nobody can read it.' },
          { term: 'abort', definition: 'Cancels an unfinished upload and frees the space its parts use.' },
          { term: 'range request', definition: 'A GET with a Range header: the server returns only those bytes (206 Partial Content).' },
          { term: 'checksum', definition: 'A short value computed from the bytes (MD5, SHA-256, CRC…); the server recomputes it and refuses the upload if they differ.' },
        ]}
      />

      <h2>Why parts — and the rules</h2>
      <ul>
        <li><strong>Resume:</strong> a failure costs one part, not the file.</li>
        <li><strong>Speed:</strong> several parts in flight use bandwidth one connection cannot.</li>
        <li><strong>Streaming:</strong> you can start uploading before you know the final size (a backup being written, a video being recorded).</li>
        <li><strong>Size:</strong> one PUT may carry at most 5 GiB. Anything bigger <em>must</em> be multipart.</li>
      </ul>
      <StatTiles
        title="The limits (RustFS source, and AWS documents the same)"
        stats={[
          { label: 'largest single PUT', value: '5 GiB', sub: 'larger objects must use multipart', hue: HUE.network },
          { label: 'smallest part', value: '5 MiB', sub: 'except the last part', hue: HUE.data },
          { label: 'largest part', value: '5 GiB', sub: 'per upload-part request', hue: HUE.data },
          { label: 'most parts', value: '10,000', sub: 'numbered 1 to 10,000', hue: HUE.data },
        ]}
      />

      <h2>A multipart upload by hand</h2>
      <Flow
        title="Create, upload parts, complete (or abort)"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'client', label: 'your machine', sub: 'demo.mp4, 20 MiB', col: 0, row: 0, rowSpan: 3, hue: HUE.client, shape: 'actor' },
          { id: 'create', label: 'create', sub: 'POST ?uploads', col: 1, row: 0, hue: HUE.network },
          { id: 'parts', label: 'upload parts 1, 2, 3', sub: 'PUT ?partNumber=N', col: 1, row: 1, hue: HUE.network },
          { id: 'complete', label: 'complete', sub: 'POST ?uploadId= + list', col: 1, row: 2, hue: HUE.network },
          { id: 'pending', label: 'pending parts', sub: 'invisible to readers', col: 2, row: 1, hue: HUE.server, shape: 'queue' },
          { id: 'object', label: 'videos/demo.mp4', sub: 'ETag …-3', col: 3, row: 2, hue: HUE.data, shape: 'store' },
          { id: 'abort', label: 'abort', sub: 'parts deleted', col: 3, row: 0, hue: HUE.error },
        ]}
        edges={[
          { from: 'client', to: 'create', hue: HUE.client },
          { from: 'client', to: 'parts', hue: HUE.client, flow: true },
          { from: 'client', to: 'complete', hue: HUE.client },
          { from: 'parts', to: 'pending', hue: HUE.data, flow: true },
          { from: 'pending', to: 'object', label: 'joined', hue: HUE.data },
          { from: 'pending', to: 'abort', dashed: true, hue: HUE.error },
        ]}
        steps={[
          { title: '1. Create', body: <p>The server answers with an <strong>upload id</strong>. Nothing is stored under the key yet.</p>, active: ['client', 'create', 'client>create'] },
          { title: '2. Upload parts', body: <p>Each part is an ordinary PUT with the upload id and a part number; the server returns the part’s ETag. Parts can go in parallel and in any order.</p>, active: ['client', 'parts', 'pending', 'client>parts', 'parts>pending'] },
          { title: '3. Complete', body: <p>You send the list of part numbers and their ETags. The server checks them, joins the parts and the object appears — atomically, all at once.</p>, active: ['client', 'complete', 'pending', 'object', 'client>complete', 'pending>object'] },
          { title: 'or: abort', body: <p>Abort throws the parts away. An upload you neither complete nor abort keeps its parts — and their disk space — until something cleans them up.</p>, active: ['pending', 'abort', 'pending>abort'] },
        ]}
      />
      <p>The aws CLI has a command for each request. A 20 MiB file, cut into 8 MiB pieces with <code>split</code>, then two parts uploaded:</p>
      <Terminal title="recorded: split, create, upload parts 1 and 2 (upload ids shortened here)" steps={short(L.byHand)} />
      <p>
        Each part also came back with a <code>ChecksumCRC64NVME</code>: recent aws CLI versions add a CRC checksum to every upload unless told
        otherwise, and RustFS verifies and stores it (more below).
      </p>
      <h3>The laptop crashes — resume</h3>
      <p>The server remembers unfinished uploads and their parts, so a restarted program can ask what is already there and send only the rest:</p>
      <Terminal title="recorded: list unfinished uploads and their parts, then send part 3" steps={short(L.resume)} />
      <h3>Complete</h3>
      <Terminal title="recorded: the part list, complete, and the result" steps={short(L.complete)} />
      <p>
        The object is {SIZE.toLocaleString()} bytes, readable at once, and the list of unfinished uploads is empty again. Its ETag ends in{' '}
        <code>-3</code>: three parts.
      </p>

      <h2>The multipart ETag</h2>
      <Terminal title="recorded: three ways to hash the same 20 MiB" steps={L.etag} />
      <ByteLayout
        title={`Recorded: the ETag ${finalEtag} is the MD5 of the three part MD5s, plus “-3”`}
        rows={[
          { label: 'the part ETags, as 16 raw bytes each', fields: partMd5.map((m, i) => ({ label: `part ${i + 1}: MD5`, bytes: 16, hue: HUE.data, content: `${m.slice(0, 8)}…` })) },
          { label: 'MD5 of those 48 bytes', fields: [{ label: `+ “-${partMd5.length}”`, bytes: 16, hue: HUE.network, content: `${md5OfMd5s.slice(0, 8)}…` }] },
        ]}
        caption={`The MD5 of the whole file is ${wholeMd5.slice(0, 8)}…, a different value. A multipart ETag depends on how the file was cut: the same bytes uploaded with other part sizes get another ETag.`}
      />
      <Predict
        question={<p>You upload the same 64 MiB file twice: once with the aws CLI (8 MiB parts), once with a tool that uses 16 MiB parts. Do the two objects have the same ETag?</p>}
        options={['Yes — same bytes, same ETag', 'No — 8 parts and 4 parts give different ETags', 'Only if both tools use the same thread count']}
        answer={1}
        explanation={<p>The ETag is built from the part MD5s and ends in the part count (<code>-8</code> vs <code>-4</code>). To compare content across uploads, use a full-object checksum (below) or your own hash in metadata.</p>}
      />

      <h2>How tools do it: parts in parallel</h2>
      <p>
        You rarely run these commands yourself: <code>aws s3 cp</code>, <code>rc</code>, the SDKs’ transfer managers and the console switch to
        multipart above a threshold. Here the aws CLI uploaded a 64 MiB file; its debug log shows every request, on which thread and when:
      </p>
      <Timeline
        title={`Recorded: aws s3 cp of 64 MiB — ${parts.length} parts of 8 MiB on ${threads.length} threads (ms)`}
        start={0}
        end={cpEnd}
        unit="ms"
        lanes={threads.map((t) => ({ id: t, label: t.replace('ThreadPoolExecutor-0_', 'thread ') }))}
        segments={CP.map((r) => ({
          lane: r.thread,
          from: r.start,
          to: r.end,
          label: r.op === 'UploadPart' ? `part ${r.part}` : r.op === 'CreateMultipartUpload' ? 'create' : 'complete',
          hue: r.op === 'UploadPart' ? HUE.data : HUE.network,
        }))}
      />
      <Terminal title={`recorded: the command and the result (ETag …-${cpEtag.split('-')[1]})`} steps={L.cpSteps} />
      <p>
        All {parts.length} parts were in flight at the same moment, so the upload took about as long as one part. The aws CLI’s defaults:
        multipart above 8 MiB, 8 MiB parts, up to 10 requests at once (<code>multipart_threshold</code>, <code>multipart_chunksize</code>,{' '}
        <code>max_concurrent_requests</code> under <code>s3</code> in the config). This recording used the <code>classic</code> profile, whose
        Python transfer manager logs each part; by default the CLI may use the faster native “CRT” client, which uploads the same way but does not
        log per part.
      </p>

      <h2>Abandoned uploads</h2>
      <Terminal title="recorded: start an upload, abort it" steps={short(L.abort)} />
      <p>
        A program that crashes and never comes back leaves its parts on the server, using space but invisible in normal listings. List them with{' '}
        <code>list-multipart-uploads</code>, abort old ones, and — better — add a lifecycle rule that aborts unfinished uploads after a few days
        (lesson “Versioning, object lock and lifecycle”).
      </p>

      <h2>The rules, enforced</h2>
      <Terminal title="recorded: two 1 MiB parts, and part number 10,001" steps={short(L.rules)} />
      <p>
        Uploading tiny parts is allowed; <strong>completing</strong> with a non-last part under 5 MiB is not (<code>EntityTooSmall</code>). Part
        numbers outside 1–10,000 are refused at once. With 10,000 parts as the ceiling, the part size decides the largest file you can upload:
        8 MiB parts stop at about 78 GiB, 64 MiB parts at about 625 GiB.
      </p>

      <h2>Plan an upload</h2>
      <p>Choose a file size, part size, parallelism and bandwidth. The model shows how many parts that makes, how long it takes, and what one dropped connection costs:</p>
      <LargeFilesSimulator />
      <p>Things to try:</p>
      <ul>
        <li>200 GiB with 8 MiB parts: over 10,000 parts, refused. Bigger parts fix it.</li>
        <li>2 GiB at 1 in parallel vs 8: one connection is capped (30 MB/s here), so parallel parts use the 100 MB/s link.</li>
        <li>With a drop at 60 %, the single PUT sends more than half the file again; multipart re-sends half a part.</li>
        <li>Huge parallelism on a slow link gains nothing: the parts just share the same bandwidth.</li>
      </ul>

      <h2>Reading part of an object: ranges</h2>
      <p>
        A <code>Range</code> header asks for some bytes only. The server answers <code>206 Partial Content</code> with a{' '}
        <code>Content-Range</code> saying which bytes of how many:
      </p>
      <Terminal title="recorded: range reads of the 20 MiB object" steps={L.range} maxLines={14} />
      <LargeFilesRanges
        title="Recorded: where those reads landed in videos/demo.mp4"
        size={SIZE}
        parts={[8 * 1024 * 1024, 16 * 1024 * 1024]}
        ranges={[
          { label: 'Range: bytes=0-15 (the first 16 bytes)', from: r1from, to: r1to, hue: HUE.client },
          { label: 'Range: bytes=8388608-8388623 (16 bytes at 8 MiB)', from: r3from, to: r3to, hue: HUE.network },
          { label: '--part-number 3 (the whole third part)', from: r4from, to: r4to, hue: HUE.data },
          { label: 'Range: bytes=-10 (the last 10 bytes)', from: r2from, to: r2to, hue: HUE.identity },
        ]}
      />
      <ul>
        <li>The first 16 bytes from the server matched the first 16 bytes of the local file (<code>od</code> output).</li>
        <li><code>bytes=-10</code> means “the last 10”; a start past the end is <code>416 InvalidRange</code>.</li>
        <li>
          Uses: video players seek with ranges, download tools resume and split downloads into parallel ranges, and data tools read only the
          footer of a large file (Parquet, ZIP) before fetching the pieces they need.
        </li>
        <li>
          <code>GET … ?partNumber=3</code> returns exactly that part (with <code>PartsCount</code>). A <code>HEAD</code> with a part number,
          though, returned the whole object’s size on RustFS — AWS returns the part’s size there. Use GET with a range if you need it portable.
        </li>
      </ul>

      <h2>Checksums: proving nothing changed on the way</h2>
      <p>
        TLS protects bytes on the network, but bugs in proxies, disks and memory still corrupt data. A checksum sent with the upload lets the server
        check what it received before storing it:
      </p>
      <Terminal title="recorded: Content-MD5 and x-amz-checksum-sha256, right and wrong" steps={L.checksums} />
      <Table
        head={['Header', 'Algorithm', 'Notes']}
        rows={[
          [<code key="a">Content-MD5</code>, 'MD5, base64', 'the original S3 check; required by some APIs (e.g. DeleteObjects on AWS)'],
          [<code key="b">x-amz-checksum-crc32 / crc32c / crc64nvme</code>, 'CRCs', 'fast; CRC64NVME is what recent aws CLI and SDK versions send by default'],
          [<code key="c">x-amz-checksum-sha1 / sha256</code>, 'cryptographic hashes', 'slower; useful when you also keep the hash in your own records'],
        ]}
      />
      <ul>
        <li>A wrong checksum was refused with <code>BadDigest</code> and nothing was stored. (RustFS’s message mentions Content-MD5 even when the SHA-256 was wrong; the code is the right one.)</li>
        <li>
          The checksum is stored with the object: <code>head-object --checksum-mode ENABLED</code> returns it, so you can verify a download later
          without the original file.
        </li>
        <li>
          For the 64 MiB multipart upload the stored <code>ChecksumCRC64NVME</code> is of type <code>FULL_OBJECT</code>: a checksum of all the
          bytes, unlike the ETag, so it is the same however the file was cut.
        </li>
      </ul>

      <Recap
        points={[
          'Multipart: create (upload id) → upload numbered parts (parallel, retryable) → complete with the part list; or abort.',
          'Parts are 5 MiB to 5 GiB (the last may be smaller), at most 10,000; a single PUT carries at most 5 GiB.',
          'A multipart ETag is MD5(part MD5s) + “-N”; it depends on the part size. Full-object checksums do not.',
          'Unfinished uploads keep their parts until completed or aborted: list them, and add a lifecycle rule to abort old ones.',
          'Range GETs read any byte span (206); checksums (Content-MD5, x-amz-checksum-*) make the server refuse corrupted uploads.',
        ]}
      />
    </>
  )
}
