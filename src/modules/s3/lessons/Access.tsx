import { Flow } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { AccessPolicyEvaluator, type RecordedCase } from '../components/AccessPolicyEvaluator'
import { consoleLabel as label } from '../components/consoleLabel'
import { HUE } from '../components/legend'
import { ResultChip } from '../components/ResultChip'
import { Terminal, type TermStep } from '../components/Terminal'
import { ACCESS } from '../data/access'
import { POLICIES, POLICY_FILES } from '../data/accessSources'

const A = ACCESS
const allowed = (s: TermStep) => !s.code && !(s.out ?? '').includes('AccessDenied')

const RECORDED: RecordedCase[] = [
  { user: 'catalog-reader', action: 's3:ListBucket', target: '', allowed: allowed(A.reader[0]), how: 'aws --profile reader s3 ls s3://catalog/ --recursive' },
  { user: 'catalog-reader', action: 's3:GetObject', target: 'invoices/2026-0042.pdf', allowed: allowed(A.reader[1]), how: 'aws --profile reader s3 cp s3://catalog/invoices/2026-0042.pdf -' },
  { user: 'catalog-reader', action: 's3:PutObject', target: 'note.txt', allowed: allowed(A.reader[2]), how: 'aws --profile reader s3 cp note.txt s3://catalog/note.txt' },
  { user: 'catalog-uploader', action: 's3:PutObject', target: 'uploads/photo.jpg', allowed: allowed(A.uploader[0]), how: 'aws --profile uploader s3 cp photo.jpg s3://catalog/uploads/photo.jpg' },
  { user: 'catalog-uploader', action: 's3:PutObject', target: 'images/photo.jpg', allowed: allowed(A.uploader[1]), how: 'aws --profile uploader s3 cp photo.jpg s3://catalog/images/photo.jpg' },
  { user: 'catalog-uploader', action: 's3:ListBucket', target: 'uploads/', allowed: allowed(A.uploader[2]), how: 'aws --profile uploader s3 ls s3://catalog/uploads/' },
  { user: 'catalog-uploader', action: 's3:ListBucket', target: '', allowed: allowed(A.uploader[3]), how: 'aws --profile uploader s3 ls s3://catalog/' },
  { user: 'catalog-uploader', action: 's3:GetObject', target: 'uploads/photo.jpg', allowed: allowed(A.uploader[4]), how: 'aws --profile uploader s3 cp s3://catalog/uploads/photo.jpg -' },
  { user: 'catalog-app', action: 's3:PutObject', target: 'invoices/2026-0043.pdf', allowed: allowed(A.app[0]), how: 'aws --profile app s3 cp invoice.pdf s3://catalog/invoices/2026-0043.pdf' },
  { user: 'catalog-app', action: 's3:DeleteObject', target: 'uploads/photo.jpg', allowed: allowed(A.app[1]), how: 'aws --profile app s3 rm s3://catalog/uploads/photo.jpg' },
  { user: 'catalog-app', action: 's3:DeleteObject', target: 'invoices/2026-0043.pdf', allowed: allowed(A.app[2]), how: 'aws --profile app s3 rm s3://catalog/invoices/2026-0043.pdf' },
  { user: null, action: 's3:GetObject', target: 'public/logo.svg', allowed: allowed(A.bucketPolicy[3]), how: 'curl, with the public-read bucket policy' },
  { user: null, action: 's3:GetObject', target: 'invoices/2026-0042.pdf', allowed: allowed(A.bucketPolicy[4]), how: 'curl, with the public-read bucket policy' },
  { user: null, action: 's3:ListBucket', target: '', allowed: allowed(A.bucketPolicy[5]), how: 'curl, with the public-read bucket policy' },
]
const builtIns = (A.builtIn[1].out ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

export default function Access() {
  return (
    <>
      <LessonGoals
        goals={[
          'tell the root user from ordinary users and access keys, and create them on RustFS',
          'read and write IAM-style policies: Effect, Action, Resource, Condition',
          'predict allow and deny — including why an explicit deny always wins',
          'make part of a bucket public with a bucket policy, and know why that is risky',
          'share one object with a presigned GET or PUT link that expires',
          'set up CORS so a web page can upload straight to a bucket',
        ]}
        before={<>Lessons <a href="#/s3/using">Using S3</a> and <a href="#/s3/requests">The S3 API on the wire</a> (signatures).</>}
      />

      <h2>Who may do what</h2>
      <p>
        So far every request used the root keys, which may do anything. Real applications should not: a web shop’s image service needs to read
        product photos, an upload service only to write new files, an accounting job only to read invoices. S3 controls this with{' '}
        <strong>identities</strong> (who is asking) and <strong>policies</strong> (what they may do).
      </p>
      <Callout tone="analogy" title="Analogy: a hotel">
        The owner has a master key (the root user) and keeps it in a safe. Guests get key cards (users and access keys) that open only their own
        doors (policies). A cleaner’s card opens every room but not the safe — and a rule taped to the safe (“nobody but the owner”) beats any card
        (an explicit deny). A sign in the lobby can make one room open to the public (a bucket policy), a day pass works until midnight (a
        presigned link), and the doorman only lets in visitors from buildings on his list (CORS).
      </Callout>
      <TermList
        items={[
          { term: 'root user', definition: 'The credentials given at start-up (RUSTFS_ACCESS_KEY/SECRET_KEY). Can do everything, including managing users. Use it for administration only.' },
          { term: 'user', definition: 'An identity with an access key (its name) and a secret key, and policies that say what it may do.' },
          { term: 'access key (service account)', definition: 'An extra key pair that belongs to a user, optionally with a narrower policy. Give each application its own and rotate them.' },
          { term: 'policy', definition: 'A JSON document of statements. Attached to a user it says what that user may do; attached to a bucket it says who may use the bucket.' },
          { term: 'statement', definition: 'One rule: Effect (Allow or Deny), Action (s3:GetObject…), Resource (which bucket or keys), optional Condition.' },
          { term: 'ARN', definition: 'Amazon Resource Name, how policies name things: arn:aws:s3:::catalog is the bucket, arn:aws:s3:::catalog/invoices/* the keys under invoices/.' },
          { term: 'presigned URL', definition: 'A link signed with someone’s keys that allows one request (GET or PUT of one key) until it expires.' },
          { term: 'CORS', definition: 'Cross-Origin Resource Sharing: the rules that let JavaScript on another website call the bucket from a browser.' },
        ]}
      />
      <Flow
        title="Identities, policies and the bucket"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'root', label: 'root user', sub: 'labadmin', col: 0, row: 0, hue: HUE.identity, shape: 'actor' },
          { id: 'reader', label: 'catalog-reader', sub: 'user', col: 0, row: 1, hue: HUE.identity, shape: 'actor' },
          { id: 'anon', label: 'anyone', sub: 'no keys', col: 0, row: 2, hue: HUE.client, shape: 'actor' },
          { id: 'up', label: 'user policy', sub: 'catalog-read', col: 1, row: 1, hue: HUE.identity },
          { id: 'bp', label: 'bucket policy', sub: 'public-read', col: 1, row: 2, hue: HUE.identity },
          { id: 'eval', label: 'RustFS decides', sub: 'deny > allow > default', col: 2, row: 0, rowSpan: 3, hue: HUE.server },
          { id: 'bucket', label: 'catalog', sub: 'bucket', col: 3, row: 1, hue: HUE.data, shape: 'store' },
        ]}
        edges={[
          { from: 'root', to: 'eval', label: 'all allowed', hue: HUE.identity },
          { from: 'reader', to: 'up', hue: HUE.identity },
          { from: 'up', to: 'eval', hue: HUE.identity },
          { from: 'anon', to: 'bp', hue: HUE.client },
          { from: 'bp', to: 'eval', hue: HUE.identity },
          { from: 'eval', to: 'bucket', hue: HUE.ok, flow: true },
        ]}
        caption="A signed request is checked against the user’s policies and the bucket’s policy; an unsigned one only against the bucket policy."
      />

      <h2>Users and policies on RustFS</h2>
      <p>RustFS ships a few ready-made policies and lets you add your own. Recorded with <code>rc</code> (which calls the RustFS admin API under <code>/rustfs/admin/v3/</code>):</p>
      <Terminal title="recorded: built-in policies" steps={A.builtIn} />
      <p>
        The built-ins ({builtIns.join(', ')}) are broad: <code>readonly</code> reads <em>every</em> bucket. For applications, write a policy per
        job. Three were used here:
      </p>
      <CodeBlock title="catalog-read.json — list the bucket, read every object" language="json" code={POLICY_FILES.catalogRead} />
      <CodeBlock title="uploads-write.json — write under uploads/, list only that prefix" language="json" code={POLICY_FILES.uploadsWrite} />
      <CodeBlock title="catalog-app.json — everything in catalog, except deleting invoices" language="json" code={POLICY_FILES.catalogApp} />
      <Table
        head={['Field', 'Meaning', 'Example from above']}
        rows={[
          [<code key="a">Effect</code>, 'what happens when the statement matches', 'Allow, or Deny'],
          [<code key="b">Action</code>, 'which API calls; * is a wildcard', 's3:GetObject, s3:PutObject, s3:ListBucket, s3:*'],
          [<code key="c">Resource</code>, 'which bucket (for bucket actions) or keys (for object actions)', 'arn:aws:s3:::catalog, arn:aws:s3:::catalog/uploads/*'],
          [<code key="d">Condition</code>, 'extra checks on the request', 'StringLike s3:prefix = uploads/* (only for listings of uploads/)'],
          [<code key="e">Principal</code>, 'who — only in bucket policies', '"*" means everybody, signed or not'],
          [<code key="f">Sid</code>, 'a name for the statement', 'NeverDeleteInvoices'],
        ]}
      />
      <Callout tone="warn" title="Bucket and objects are different resources">
        <code>s3:ListBucket</code> acts on the bucket (<code>arn:aws:s3:::catalog</code>); <code>s3:GetObject</code> on keys (
        <code>arn:aws:s3:::catalog/*</code>). A policy that grants GetObject on the bucket ARN, or ListBucket on <code>catalog/*</code>, grants
        nothing — the most common policy mistake.
      </Callout>
      <Terminal title="recorded: three users, three policies" steps={A.users} />
      <p>
        In the console the same lives under {label('users', 'Users')} → {label('users', 'Add User')} (fields {label('addUser', 'User Name')},{' '}
        {label('addUser', 'Password')}, {label('addUser', 'Policy')}) and {label('policies', 'IAM Policies')} → {label('policies', 'New Policy')}.
      </p>

      <h2>Allowed and denied, recorded</h2>
      <p>Each user got its own profile in the aws CLI’s credentials file, so <code>--profile reader</code> signs with the reader’s keys:</p>
      <CodeBlock title="~/.aws/credentials (the profiles the recordings used)" language="ini" code={POLICY_FILES.awsAccessCredentials} />
      <Terminal title="recorded: catalog-reader" steps={A.reader} />
      <Terminal title="recorded: catalog-uploader" steps={A.uploader} />
      <Terminal title="recorded: catalog-app — allowed everything, except one thing" steps={A.app} />
      <Table
        head={['Who', 'Action', 'On', 'RustFS said']}
        rows={RECORDED.map((r) => [r.user ?? 'anyone (no keys)', r.action, r.target || '(the whole bucket)', <ResultChip key={r.how} ok={r.allowed} />])}
      />
      <ul>
        <li>
          The uploader may list <code>uploads/</code> but not the whole bucket: the <code>Condition</code> on <code>s3:prefix</code>.
        </li>
        <li>
          The uploader’s download failed as <code>403 Forbidden</code> on <code>HeadObject</code> — the CLI asks for the size first, and a HEAD
          response has no body to carry the error code.
        </li>
        <li>
          <code>catalog-app</code> may do <code>s3:*</code> in the bucket, yet deleting an invoice was refused: the{' '}
          <code>NeverDeleteInvoices</code> Deny matched. <strong>An explicit deny always wins</strong>, whatever else allows.
        </li>
        <li>
          The reader’s plain <code>aws s3 ls</code> listed <code>catalog</code> although no policy grants <code>s3:ListAllMyBuckets</code>:
          RustFS shows a user the buckets it can use. AWS would refuse the call.
        </li>
      </ul>
      <Predict
        question={<p>A user has <code>s3:*</code> on <code>catalog/*</code> from one policy and a Deny of <code>s3:PutObject</code> on <code>catalog/*</code> from another. May it upload?</p>}
        options={['Yes — s3:* includes PutObject', 'No — the Deny wins', 'Only if the Allow policy was attached first']}
        answer={1}
        explanation={<p>Order does not matter. All matching statements are collected; one Deny is enough. Use Deny for guard rails that must hold even if someone later attaches a broad Allow.</p>}
      />

      <h2>Try the rules yourself</h2>
      <AccessPolicyEvaluator
        identities={[
          { user: 'catalog-reader', label: 'reader', policy: 'catalog-read' },
          { user: 'catalog-uploader', label: 'uploader', policy: 'uploads-write' },
          { user: 'catalog-app', label: 'app', policy: 'catalog-app' },
          { user: null, label: 'anyone (no keys)' },
        ]}
        userPolicies={POLICIES}
        bucketPolicy={{ name: 'public-read', policy: POLICIES['public-read'] }}
        keys={['invoices/2026-0042.pdf', 'invoices/2026-0043.pdf', 'uploads/photo.jpg', 'images/photo.jpg', 'public/logo.svg', 'note.txt']}
        prefixes={['', 'uploads/']}
        recorded={RECORDED}
      />

      <h2>Access keys for applications</h2>
      <p>
        A user can own several <strong>access keys</strong> (RustFS calls them service accounts). Each may carry its own policy, and its
        permissions are the overlap of the user’s and the key’s — never more than the user has:
      </p>
      <CodeBlock title="invoices-read.json — the key’s own policy" language="json" code={POLICY_FILES.invoicesRead} />
      <Terminal title="recorded: an invoice-reading key for catalog-app" steps={A.accessKey} />
      <p>
        The key could read an invoice but not upload, although its user may. In the console: {label('accessKeys', 'Access Keys')} →{' '}
        {label('accessKeys', 'Add Access Key')}, with {label('addAccessKey', 'Expiry')} and the switch {label('addAccessKey', 'Use main account policy')}.
      </p>
      <Callout tone="tip" title="Rotating keys without downtime">
        Create a second key, deploy it, check nothing uses the old key any more, then delete the old one. Keys with an expiry date make
        forgotten keys stop working on their own.
      </Callout>

      <h2>Bucket policies and public buckets</h2>
      <p>A policy attached to the bucket can name <code>"Principal": "*"</code> — everybody, including requests with no signature at all:</p>
      <CodeBlock title="public-read.json — anyone may read keys under public/" language="json" code={POLICY_FILES.publicRead} />
      <Terminal title="recorded: before and after the bucket policy" steps={A.bucketPolicy} />
      <p>
        Only <code>public/</code> became readable; invoices and listings stayed private. <code>rc</code> has a shortcut that writes such a policy
        for you (it replaces the whole bucket policy, as its warning says):
      </p>
      <Terminal title="recorded: rc bucket anonymous" steps={A.anonymous} />
      <Callout tone="warn" title="Public buckets are how data leaks">
        Many publicised data leaks were buckets made public by accident: a policy with <code>Principal "*"</code> on the wrong prefix, or{' '}
        <code>s3:ListBucket</code> granted to everyone so the whole content can be enumerated. Prefer presigned links; if something must be
        public, put it in a bucket or prefix that holds only public files, and never allow anonymous listing.
      </Callout>
      <p>A public access block is the safety catch: with it, public policies are ignored and new ones refused.</p>
      <Terminal title="recorded: the public access block" steps={A.publicBlock} />

      <h2>Presigned links: share one object, for a while</h2>
      <Flow
        title="A presigned link: your server signs, the browser uses it directly"
        cols={4}
        rows={2}
        rowHeight={74}
        nodes={[
          { id: 'browser', label: 'browser', sub: 'no keys', col: 0, row: 0, rowSpan: 2, hue: HUE.client, shape: 'actor' },
          { id: 'app', label: 'your app', sub: 'has the keys', col: 1, row: 0, hue: HUE.client },
          { id: 'sign', label: 'sign locally', sub: 'URL + expiry', col: 2, row: 0, hue: HUE.network },
          { id: 's3', label: 'RustFS', sub: 'checks signature, expiry, policy', col: 2, row: 1, span: 2, hue: HUE.server, shape: 'store' },
        ]}
        edges={[
          { from: 'browser', to: 'app', label: '1 ask', hue: HUE.client },
          { from: 'app', to: 'sign', label: '2', hue: HUE.network },
          { from: 'browser', to: 's3', label: '3 GET / PUT', hue: HUE.client, flow: true },
        ]}
        caption="The app decides who gets a link (it checks its own login and rules), but the bytes go straight between browser and storage."
      />
      <Terminal title="recorded: a link valid for 10 seconds" steps={A.presignGet} />
      <p>
        After expiry the same URL answers <code>AccessDenied — Request has expired</code>. For uploads, a link for <code>PUT</code> lets a browser
        send a file straight to the bucket. The aws CLI can only presign downloads, so a few lines of TypeScript made the link:
      </p>
      <CodeBlock title="presign.ts (the script that ran)" language="typescript" code={POLICY_FILES.presign} />
      <Terminal title="recorded: make a PUT link for image/jpeg" steps={A.presignPutUrl} />
      <Terminal title="recorded: upload with it — the right type, then another type" steps={A.presignPut} />
      <p>
        Because the content type was signed, the link only accepts <code>image/jpeg</code>; a <code>text/html</code> upload (a classic way to
        smuggle a web page into a bucket) failed the signature check. A link is also never stronger than its signer: signed with the reader’s
        keys, a PUT link is refused even though the signature is valid.
      </p>
      <Terminal title="recorded: a PUT link signed by catalog-reader" steps={[...A.presignBadUrl, ...A.presignBad]} />

      <h2>CORS: uploads from a web page</h2>
      <p>
        A browser only lets JavaScript on <code>http://localhost:5173</code> call <code>http://localhost:9000</code> if the server agrees. Before a
        PUT it sends a <strong>preflight</strong> <code>OPTIONS</code> request asking “may this origin PUT with a content-type header?”; the
        bucket’s CORS rules answer.
      </p>
      <CodeBlock title="cors.json" language="json" code={POLICY_FILES.cors} />
      <Terminal title="recorded: preflights before and after the CORS rules, and the upload itself" steps={A.cors} />
      <ul>
        <li>Without rules the preflight got 200 but no <code>access-control-allow-origin</code>: the browser would block the upload.</li>
        <li>With the rules, the allowed origin got the headers; another origin got 403.</li>
        <li><code>ExposeHeaders: ETag</code> lets the page read the ETag of what it uploaded.</li>
        <li>CORS is not security: it only instructs browsers. The signature and the policies still decide what any request may do.</li>
      </ul>

      <h2>Good habits</h2>
      <Table
        head={['Do', 'Why']}
        rows={[
          ['keep the root keys for administration; never put them in an application', 'a leak of root keys is a leak of everything'],
          ['one user or access key per application, with a policy for its job', 'least privilege: a bug or leak stays small'],
          ['Deny statements for things that must never happen (deleting invoices)', 'they hold even if someone adds a broad Allow later'],
          ['presigned links with short expiry instead of public buckets', 'access is per object and ends by itself'],
          ['public access block on buckets that must stay private', 'a mistaken policy cannot open them'],
          ['rotate keys; prefer keys with an expiry', 'old keys stop working on their own'],
        ]}
      />

      <Recap
        points={[
          'The root user can do anything; applications get users or access keys with a policy for exactly their job.',
          'A statement is Effect + Action + Resource (+ Condition); bucket ARNs and object ARNs are different resources.',
          'Decision: any matching Deny → denied; else any matching Allow → allowed; else denied by default.',
          'Bucket policies with Principal "*" make data public — use them rarely, never for listing; a public access block prevents accidents.',
          'Presigned links grant one request until they expire and never more than the signer may do; CORS lets browsers use them.',
        ]}
      />
    </>
  )
}
