import { Timeline } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { HUE } from '../components/legend'
import { ResultChip } from '../components/ResultChip'
import { Terminal, type TermStep } from '../components/Terminal'
import { VersioningHistory, type Snapshot } from '../components/VersioningHistory'
import { VersioningStack } from '../components/VersioningStack'
import { VERSIONING } from '../data/versioning'
import lifecycleJson from '../../../../tools/s3-capture/policies/lifecycle.json?raw'

const V = VERSIONING
const PRICES = ['12.00', '12.50', '13.00']
const restoredId = (JSON.parse(V.restore[0].out ?? '{}') as { VersionId: string }).VersionId
const labelOf = (id: string) => (id === restoredId ? 'copy of 12.00' : `price ${PRICES[V.ids.indexOf(id as (typeof V.ids)[number])] ?? '?'}`)
const listing = (out: string | undefined) => JSON.parse(out ?? '{}') as { versions: [string, boolean, number][] | null; deleteMarkers: [string, boolean][] | null }
const snap = (title: string, out: string | undefined): Snapshot => {
  const l = listing(out)
  return { title, versions: l.versions ?? [], markers: l.deleteMarkers ?? [] }
}
const listOut = (steps: readonly { cmd?: string; out?: string }[]) => steps.find((s) => s.cmd?.includes('list-object-versions'))?.out
const SNAPSHOTS = [
  snap('after 3 uploads', listOut(V.overwrite)),
  snap('after aws s3 rm', listOut(V.del)),
  snap('after copying v1 back', listOut(V.restore)),
  snap('after deleting 12.50 by id', listOut(V.purge)),
]
const fail = (s: TermStep) => Boolean(s.code)
const F = V.fast
const tl = F.timeline
const expiredAt = tl.find((t) => t.state.includes('delete marker of tmp/export.csv'))?.at ?? 0
const purgedAt = tl.find((t) => t.at > 0 && (t.state.match(/version of docs\/terms\.txt/g) ?? []).length === 1)?.at ?? 0
const end = Math.ceil(Math.max(expiredAt, purgedAt) + 3)
const expiryHeader = (V.rules.find((s) => s.cmd?.startsWith('aws s3api head-object'))?.out ?? '').match(/"Expiration": "(.*)",/)?.[1]?.replace(/\\"/g, '"')

export default function Versioning() {
  return (
    <>
      <LessonGoals
        goals={[
          'switch on versioning and explain versions, version ids and delete markers',
          'undo an overwrite or a delete, and delete one version for good',
          'lock objects so nobody can delete them for a while (governance, compliance, legal hold)',
          'write lifecycle rules that expire temporary files, old versions and abandoned uploads',
          'say what each costs in storage and what RustFS does differently from AWS',
        ]}
        before={<>Lessons <a href="#/s3/what">What object storage is</a> (overwrites replace whole objects) and <a href="#/s3/using">Using S3</a>.</>}
      />

      <h2>Undo for a bucket</h2>
      <p>
        Without versioning, an overwrite or a delete is final: the old bytes are gone. A bug that writes the wrong price list, a sync with{' '}
        <code>--delete</code> from the wrong folder, or someone with a leaked key can destroy data in seconds. <strong>Versioning</strong> keeps
        every version of every key, so any of that can be undone.
      </p>
      <Callout tone="analogy" title="Analogy: a stack of paper">
        Imagine each key is a tray of paper. Without versioning, writing means shredding the old sheet and putting in the new one. With versioning
        you lay the new sheet on top and keep the old ones underneath; reading shows the top sheet. “Deleting” puts a red card saying{' '}
        <em>deleted</em> on top — the sheets are still there, and removing the red card brings the document back. Object lock glues the sheets to
        the tray until a date, and lifecycle rules are the cleaner who empties old sheets on schedule.
      </Callout>
      <TermList
        items={[
          { term: 'versioning', definition: 'A bucket setting: Enabled keeps every version; Suspended stops making new ones (old ones stay). It cannot go back to “never enabled”.' },
          { term: 'version id', definition: 'A unique id the server gives every write of a key. Requests can name it to read or delete that exact version.' },
          { term: 'current version', definition: 'The newest version, the one a plain GET returns.' },
          { term: 'noncurrent version', definition: 'Any older version. It still uses space until deleted or expired.' },
          { term: 'delete marker', definition: 'What a DELETE without a version id creates in a versioned bucket: an empty “deleted” entry on top. GET then says 404, but nothing was destroyed.' },
          { term: 'object lock (WORM)', definition: 'Write Once, Read Many: versions that cannot be deleted or changed until a retention date, or while a legal hold is on.' },
          { term: 'lifecycle rule', definition: 'A bucket rule that acts on its own after a number of days: expire objects, expire old versions, abort unfinished uploads.' },
        ]}
      />

      <h2>Versions, recorded</h2>
      <Terminal title="recorded: switch versioning on" steps={V.enable} />
      <p>Then the same key was written three times, each with a new price:</p>
      <Terminal title="recorded: three writes, three versions, and reading the first one back" steps={V.overwrite} maxLines={30} />
      <p>
        Every PUT returned a new <code>VersionId</code>. A plain GET returns the newest price, and <code>--version-id</code> fetches any older one.
        Now a delete:
      </p>
      <Terminal title="recorded: delete without a version id" steps={V.del} maxLines={30} />
      <VersioningHistory title="Recorded: the version list of prices.csv after each step (newest on top)" snapshots={SNAPSHOTS} labelOf={labelOf} />
      <p>
        The “delete” only stacked a <strong>delete marker</strong> on top: listings and GET act as if the key were gone (404), while all three
        versions are still stored. There are two ways back:
      </p>
      <Terminal title="recorded: undo the delete by deleting the delete marker" steps={V.undelete} />
      <Terminal title="recorded: restore an old version by copying it on top" steps={V.restore} maxLines={30} />
      <p>Deleting <em>with</em> a version id is the only real delete — that version is gone for good:</p>
      <Terminal title="recorded: remove one version permanently" steps={V.purge} maxLines={30} />
      <p>
        RustFS’s <code>rc</code> also has an <code>undo</code> command that reverts the last PUT or DELETE of a key, with a dry run first:
      </p>
      <Terminal title="recorded: a wrong price uploaded, then rc undo" steps={V.undo} />

      <h2>Try it</h2>
      <VersioningStack initial={[...V.ids].reverse().map((id, i) => ({ id, content: PRICES[PRICES.length - 1 - i] }))} />
      <Predict
        question={<p>Versioning is on. A script runs <code>aws s3 rm s3://catalog/ --recursive</code> by mistake. How much data is lost?</p>}
        options={['Everything in the bucket', 'Nothing yet — every key got a delete marker; removing the markers brings it all back', 'Only the newest versions']}
        answer={1}
        explanation={<p>A delete without a version id never destroys a version in a versioned bucket. Undo is “delete the delete markers” (or <code>rc undo --recursive</code>). Only requests that name version ids destroy data — which is why policies should deny <code>s3:DeleteObjectVersion</code> to applications.</p>}
      />
      <Callout tone="warn" title="Versions cost space">
        Every version is a full copy: a 1 GB file overwritten 30 times uses 30 GB. Pair versioning with a lifecycle rule that expires noncurrent
        versions after some days (below), and watch the bucket size.
      </Callout>

      <h2>Object lock: write once, read many</h2>
      <p>
        Versioning protects against mistakes; <strong>object lock</strong> protects against people — including administrators and stolen keys. A
        locked version cannot be deleted or overwritten until its <em>retain-until</em> date. It is used for invoices, audit logs and backups that
        must survive ransomware. Object lock must be chosen when the bucket is created, and it switches versioning on.
      </p>
      <Terminal title="recorded: a bucket with object lock and a default retention of 1 day (governance)" steps={V.lockSetup} />
      <Terminal title="recorded: governance mode — refused, unless the caller may bypass it" steps={V.governance} />
      <Terminal title="recorded: compliance mode — refused even with bypass; the date cannot be shortened" steps={V.compliance} maxLines={30} />
      <Terminal title="recorded: a legal hold, on and off" steps={V.legalHold} />
      <Table
        head={['Protection', 'Delete a version', 'With bypass-governance', 'Ends']}
        rows={[
          ['GOVERNANCE retention', <ResultChip key="g1" ok={!fail(V.governance[2])} />, <ResultChip key="g2" ok={!fail(V.governance[3])} />, 'at the retain-until date, or early by users allowed s3:BypassGovernanceRetention'],
          ['COMPLIANCE retention', <ResultChip key="c1" ok={!fail(V.compliance[2])} />, <ResultChip key="c2" ok={!fail(V.compliance[2])} />, 'only at the retain-until date — nobody can shorten it'],
          ['legal hold ON', <ResultChip key="l1" ok={!fail(V.legalHold[2])} />, <ResultChip key="l2" ok={!fail(V.legalHold[2])} />, 'when someone turns it off; no date'],
        ]}
      />
      <ul>
        <li>
          A delete <em>without</em> a version id still worked on the compliance-locked key: it only added a delete marker. The locked version
          stayed — lock protects versions, not the “current” view.
        </li>
        <li>
          Compliance mode is unforgiving by design: a wrong date of 10 years keeps the data (and its cost) for 10 years. Test with governance
          mode and short dates first.
        </li>
        <li>RustFS also accepted object lock being switched on for an existing versioned bucket (<code>catalog</code>), as AWS now does.</li>
      </ul>
      <Terminal title="recorded: object lock on an existing bucket" steps={V.lockLater} />

      <h2>Lifecycle: rules that clean up</h2>
      <p>Lifecycle rules run on the server, so nobody has to remember to delete temporary files or old versions. The rules used here:</p>
      <CodeBlock title="lifecycle.json" language="json" code={lifecycleJson} />
      <Table
        head={['Rule', 'What it does', 'Typical use']}
        rows={[
          [<code key="a">Expiration Days</code>, 'expires current objects n days after they were written (in a versioned bucket: adds a delete marker)', 'exports, temporary files, logs'],
          [<code key="b">NoncurrentVersionExpiration</code>, 'deletes versions n days after they stopped being current (optionally keeping the newest few)', 'keep 30 days of undo, not forever'],
          [<code key="c">AbortIncompleteMultipartUpload</code>, 'aborts uploads not completed within n days', 'free the space of crashed uploads'],
          [<code key="d">ExpiredObjectDeleteMarker</code>, 'removes delete markers that have no versions left under them', 'keep listings of versions clean'],
          [<code key="e">Transition</code>, 'moves objects to another storage tier after n days', 'cheaper storage for old data (needs a tier, see below)'],
        ]}
      />
      <Terminal title="recorded: set the rules; a new object under tmp/ is told when it expires" steps={V.rules} maxLines={30} />
      <p>
        The server answers every write and HEAD of a matching key with an <code>x-amz-expiration</code> header: <code>{expiryHeader}</code>. The
        date is rounded up to midnight UTC, as on AWS. The last two commands show where RustFS differs: a <code>Transition</code> needs a
        remote tier configured first (“invalid tier”), and AWS storage classes such as GLACIER are refused — RustFS only has{' '}
        <code>STANDARD</code> and <code>REDUCED_REDUNDANCY</code>.
      </p>
      <h3>Watching expiry happen</h3>
      <p>
        Real rules count real days, so the expiry above was not waited for. RustFS has a test setting that shortens a lifecycle day:{' '}
        <code>RUSTFS_ILM_DEBUG_DAY_SECS={F.daySeconds}</code> (with a fast scanner). On such a server, a versioned bucket got two 1-day rules — expire{' '}
        <code>tmp/</code>, and expire noncurrent versions under <code>docs/</code> — and the version list was polled every second:
      </p>
      <Terminal title={`recorded: the setup (one lifecycle day = ${F.daySeconds} seconds)`} steps={F.setup} maxLines={20} />
      <Timeline
        title={`Recorded: seconds after the uploads, with one lifecycle day = ${F.daySeconds} s (a test setting)`}
        start={0}
        end={end}
        unit="s"
        lanes={[
          { id: 'tmp', label: 'tmp/export.csv' },
          { id: 'docs', label: 'docs/terms.txt, old version' },
        ]}
        segments={[
          { lane: 'tmp', from: 0, to: expiredAt, label: 'current', hue: HUE.data },
          { lane: 'tmp', from: expiredAt, to: end, label: 'delete marker on top', hue: HUE.error, striped: true },
          { lane: 'docs', from: 0, to: purgedAt, label: 'noncurrent', hue: HUE.data },
        ]}
        events={[
          { lane: 'tmp', at: expiredAt, label: `expired at ${expiredAt} s`, hue: HUE.error },
          { lane: 'docs', at: purgedAt, label: `deleted at ${purgedAt} s`, hue: HUE.error },
        ]}
      />
      <Terminal title="recorded: the version list afterwards" steps={F.after} maxLines={30} />
      <p>
        The scanner expired the current <code>tmp/export.csv</code> by adding a delete marker (the bucket is versioned, so even lifecycle does
        not destroy the current version directly), and removed the noncurrent version of <code>docs/terms.txt</code> for good. On a real
        server the same happens days later, whenever the background scanner next passes the object — expiry is not to the second.
      </p>

      <Recap
        points={[
          'Versioning keeps every write; a DELETE without a version id only adds a delete marker; deleting a version id is the only real delete.',
          'Undo a delete by deleting its marker; restore an old version by copying it on top.',
          'Object lock: governance can be bypassed by privileged users, compliance by nobody until the date; legal holds have no date.',
          'Lifecycle rules expire objects, noncurrent versions and unfinished uploads on their own; versions otherwise cost space forever.',
          'RustFS: STANDARD and REDUCED_REDUNDANCY only; transitions need a remote tier; expiry runs when the scanner passes.',
        ]}
      />
    </>
  )
}
