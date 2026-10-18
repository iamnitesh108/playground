import { Flow } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { consoleLabel as label } from '../components/consoleLabel'
import { HUE } from '../components/legend'
import { Output } from '../components/Output'
import { Terminal, type TermStep } from '../components/Terminal'
import { CONSOLE } from '../data/console'
import { outputSection } from '../data/sources'
import { USING } from '../data/using'
import { code, FULL_SOURCES, LANG_INFO, LANGS, SECTION, type Task } from '../data/usingSources'
import { CHEATS } from '../data/cheats'
import styles from '../components/Using.module.css'

const V = USING.versions

/** One task in the three programs: the code that ran and what it printed. */
function InCode({ task }: { task: Task }) {
  return (
    <Tabs
      items={LANGS.map((lang) => ({
        label: LANG_INFO[lang].label,
        content: (
          <>
            <CodeBlock title={`${LANG_INFO[lang].file} (excerpt, the code that ran)`} language={LANG_INFO[lang].language} code={code(lang, task)} />
            <Output text={outputSection(USING.apps[lang], SECTION[task])} />
          </>
        ),
      }))}
    />
  )
}

/** One task on the command line: the aws CLI and rc side by side. */
function OnTheCli({ aws, rc, what }: { aws: readonly TermStep[]; rc?: readonly TermStep[]; what: string }) {
  return (
    <Tabs
      items={[
        { label: 'aws CLI', content: <Terminal title={`recorded: ${what} with the aws CLI`} steps={aws} /> },
        ...(rc ? [{ label: 'rc', content: <Terminal title={`recorded: ${what} with rc`} steps={rc} /> }] : []),
      ]}
    />
  )
}


const consoleSteps = [
  { id: 'login', title: 'Log in', body: <p>{label('login', 'Key Login')} with the access key as {label('login', 'Account')} and the secret key as {label('login', 'Key')}.</p> },
  {
    id: 'bucket',
    title: 'Create a bucket',
    body: (
      <p>
        In the {label('buckets', 'Browser')} press {label('buckets', 'Create Bucket')}, type a name such as <code>catalog</code> and press{' '}
        {label('createBucket', 'Create')}. Leave {label('createBucket', 'Version')}, {label('createBucket', 'Object Lock')} and{' '}
        {label('createBucket', 'Bucket Quota')} off for now.
      </p>
    ),
  },
  {
    id: 'upload',
    title: 'Upload files',
    body: (
      <p>
        Open the bucket, press {label('bucket', 'Upload File/Folder')}, then {label('upload', 'Select File')} or {label('upload', 'Select Folder')}{' '}
        (or drag files in), optionally type a prefix, and {label('upload', 'Start Upload')}. The dialog says what it can do: “
        {CONSOLE.pages.upload.find((l) => l.startsWith('Single file'))}” and “{CONSOLE.pages.upload.find((l) => l.startsWith('Up to'))}”.
      </p>
    ),
  },
  { id: 'browse', title: 'Browse', body: <p>Prefixes show as folders; click one to go in. {label('folder', 'Copy Path')} copies the current prefix.</p> },
  {
    id: 'object',
    title: 'Look at an object',
    body: (
      <p>
        Click an object: the details panel offers {label('object', 'Download')}, {label('object', 'Preview')}, {label('object', 'Set Tags')},{' '}
        {label('object', 'Versions')}, {label('object', 'Info')} (size, type, ETag) and {label('object', 'Metadata')}.
      </p>
    ),
  },
  {
    id: 'share',
    title: 'Share a link',
    body: (
      <p>
        Under {label('object', 'Temporary URL Expiration')} choose days, hours and minutes and press {label('object', 'Generate URL')}: the console
        makes a presigned link (the same thing as <code>aws s3 presign</code> below). The default shown is “
        {CONSOLE.pages.object.find((l) => l.startsWith('Total Duration'))}”.
      </p>
    ),
  },
]

export default function Using() {
  return (
    <>
      <LessonGoals
        goals={[
          'create buckets, upload, list, download, copy, move and delete objects from the web console',
          'do the same — plus syncing a folder and sharing a link — with the aws CLI and with rc',
          'configure an S3 client for a non-AWS server in Micronaut, TypeScript and Rust',
          'write the everyday calls in all three languages, and read the errors they raise',
        ]}
        before={<>Lesson <a href="#/s3/run">Running RustFS</a> (a running server, the aws CLI and rc set up).</>}
      />

      <h2>Three ways to do the same thing</h2>
      <p>
        Everything you can do with S3, you can do in three ways: click in the web console, type a command, or call a library from your program.
        All three send the same HTTP requests to the same server. This page shows each everyday task in all of them, all recorded on RustFS{' '}
        {USING.version}.
      </p>
      <Callout tone="analogy" title="Analogy: a library">
        You can borrow a book by walking to the desk (the console), by phoning in your request (the command line) or through the library’s app
        (your code). The book and the shelf are the same; only how you ask differs. Walk to the desk when exploring, phone when you know exactly
        what you want, and use the app for things that happen every day.
      </Callout>
      <Flow
        title="One server, three ways in"
        cols={3}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'console', label: 'web console', sub: 'click, no code', col: 0, row: 0, hue: HUE.client, shape: 'actor' },
          { id: 'cli', label: 'aws CLI · rc', sub: 'commands, scripts', col: 0, row: 1, hue: HUE.client, shape: 'actor' },
          { id: 'sdk', label: 'your program', sub: 'Micronaut · TS · Rust', col: 0, row: 2, hue: HUE.client, shape: 'actor' },
          { id: 'api', label: 'S3 API', sub: 'signed HTTP', col: 1, row: 0, rowSpan: 3, hue: HUE.network },
          { id: 'rustfs', label: 'RustFS', sub: 'bucket catalog', col: 2, row: 0, rowSpan: 3, hue: HUE.server, shape: 'store' },
        ]}
        edges={[
          { from: 'console', to: 'api', hue: HUE.client },
          { from: 'cli', to: 'api', hue: HUE.client, flow: true },
          { from: 'sdk', to: 'api', hue: HUE.client, flow: true },
          { from: 'api', to: 'rustfs', hue: HUE.network, flow: true },
        ]}
      />
      <TermList
        items={[
          { term: 'SDK', definition: 'Software development kit: the library a language uses to talk to S3 (AWS SDK for Java, for JavaScript, for Rust). The AWS SDKs work with any S3 server.' },
          { term: 'client', definition: 'The object in your program that holds the endpoint, region and keys, and sends requests. Create it once and reuse it.' },
          { term: 'content type', definition: 'What kind of file an object is (image/jpeg, application/pdf). Browsers use it to decide how to show a download; set it when you upload.' },
          { term: 'paginator', definition: 'A helper that keeps asking for the next page of a listing until there is none; one list request returns at most 1,000 keys.' },
          { term: 'presigned URL', definition: 'A link that carries its own signature and expiry time, so anyone who has it can download (or upload) one object without keys.' },
          { term: 'sync / mirror', definition: 'Copy only what differs between a folder and a prefix, optionally deleting what is gone — like a backup that does not start over each time.' },
        ]}
      />

      <h2>No code: the web console</h2>
      <p>
        Open <code>{CONSOLE.url}</code>. The figure walks through the everyday clicks; every highlighted word is the console’s own label, recorded
        from RustFS {CONSOLE.version}.
      </p>
      <Flow
        title="The everyday path through the console"
        cols={3}
        rows={2}
        rowHeight={74}
        nodes={[
          { id: 'login', label: 'Key Login', sub: 'access key + secret', col: 0, row: 0, hue: HUE.identity },
          { id: 'bucket', label: 'Create Bucket', sub: 'name, options', col: 1, row: 0, hue: HUE.data },
          { id: 'upload', label: 'Upload File/Folder', sub: 'files or folders', col: 2, row: 0, hue: HUE.client },
          { id: 'browse', label: 'folders', sub: 'prefixes', col: 2, row: 1, hue: HUE.data },
          { id: 'object', label: 'Object Details', sub: 'download, info', col: 1, row: 1, hue: HUE.data },
          { id: 'share', label: 'Generate URL', sub: 'temporary link', col: 0, row: 1, hue: HUE.network },
        ]}
        edges={[
          { from: 'login', to: 'bucket', hue: HUE.identity },
          { from: 'bucket', to: 'upload', hue: HUE.data },
          { from: 'upload', to: 'browse', hue: HUE.client },
          { from: 'browse', to: 'object', hue: HUE.data },
          { from: 'object', to: 'share', hue: HUE.network },
        ]}
        steps={consoleSteps.map((s, i) => ({ title: s.title, body: s.body, active: [s.id, ...(i > 0 ? [`${consoleSteps[i - 1].id}>${s.id}`] : [])] }))}
      />
      <p>
        Deleting works from the bucket list (each bucket has {label('buckets', 'Settings')} and {label('buckets', 'Delete')}) and from the object
        list. The console is the quickest way to look around; anything you will do twice belongs in a command or code, where it can be repeated
        and reviewed.
      </p>

      <h2>On the command line</h2>
      <p>
        The recordings below use the <code>aws</code> CLI {V.awsCli} (configured as in “Running RustFS”) and RustFS’s <code>rc</code> {V.rc} with
        the alias <code>lab</code>. <code>aws s3 …</code> commands are the friendly ones; <code>aws s3api …</code> map one-to-one to API calls.
      </p>

      <h3>Buckets</h3>
      <OnTheCli what="create and list buckets" aws={USING.cli.bucket} rc={USING.rc.bucket} />

      <h3>Upload: files, folders, content type and metadata</h3>
      <OnTheCli what="upload one file, then a whole folder" aws={USING.cli.upload} rc={USING.rc.upload} />
      <p>
        A folder upload is just many single uploads, each file’s path becoming the end of its key. Set <code>--content-type</code> when the type
        matters: the CLI guesses from the file extension, and a wrong type makes browsers download a picture instead of showing it.
      </p>

      <h3>List</h3>
      <OnTheCli what="list a level, list everything" aws={USING.cli.list} rc={USING.rc.list} />

      <h3>Download and inspect</h3>
      <OnTheCli what="download, print, stat" aws={[...USING.cli.download, ...USING.cli.metadata]} rc={USING.rc.download} />
      <p>
        A <code>-</code> as the target prints the object instead of saving it. <code>head-object</code> (<code>rc object stat</code>) returns the
        metadata without the bytes — cheap, even for a 5 GB video.
      </p>

      <h3>Copy, move and delete</h3>
      <OnTheCli what="copy, move, delete" aws={[...USING.cli.copy, ...USING.cli.move, ...USING.cli.delete]} rc={USING.rc.change} />
      <p>
        Copies happen inside the server: the bytes do not travel to your machine and back. Moves are copy + delete (lesson 1). Deleting a
        “folder” means deleting every key under the prefix — <code>--recursive</code> does that one key at a time.
      </p>

      <h3>Sync a folder</h3>
      <OnTheCli what="sync a website folder" aws={USING.cli.sync} rc={USING.rc.mirror.slice(0, 1)} />
      <p>
        The second <code>sync</code> uploaded nothing: it compares size and modification time and only sends what changed.{' '}
        <code>--dryrun</code> shows what would happen; <code>--delete</code> also removes objects whose file is gone. That makes{' '}
        <code>sync --delete</code> powerful and dangerous — always look at a dry run first.
      </p>
      <Predict
        question={<p>You run <code>aws s3 sync site s3://catalog/site/ --delete</code> from an empty <code>site</code> folder by mistake. What happens?</p>}
        options={['Nothing: sync never deletes', 'Every object under site/ in the bucket is deleted', 'The command refuses because the folder is empty']}
        answer={1}
        explanation={<p>Sync makes the destination look like the source, and an empty source means “delete everything”. Versioning (lesson “Versioning”) is the safety net for exactly this mistake.</p>}
      />

      <h3>Share a link</h3>
      <OnTheCli what="presign a link and use it" aws={USING.cli.presign} rc={USING.rc.mirror.slice(1)} />
      <p>
        The bucket is private: plain <code>curl</code> got <code>AccessDenied</code>. The presigned link worked without any keys, because its
        query string carries a signature made with the secret key and an expiry (<code>X-Amz-Expires=600</code> seconds). Making the link needs
        no request to the server — it is computed on your machine. Lesson “Access, policies and sharing” shows a link expiring.
      </p>

      <h2>In code: setting up the client</h2>
      <p>
        The three programs below ran the same tasks against the lab server: Micronaut {V.micronaut} with micronaut-object-storage-aws {V.objectStorage}{' '}
        (AWS SDK for Java {V.javaSdk}), TypeScript on Node {V.node} with @aws-sdk/client-s3 {V.clientS3}, and Rust with aws-sdk-s3 {V.rustSdk}. Each
        used a bucket of its own (<code>catalog-java</code>, <code>catalog-ts</code>, <code>catalog-rust</code>).
      </p>
      <Tabs
        items={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          content: (
            <>
              {LANG_INFO[lang].setup.map((s) => (
                <CodeBlock key={s.title} title={s.title} language={s.language} code={s.code} />
              ))}
            </>
          ),
        }))}
      />
      <p>Every SDK needs the same four settings for a server that is not AWS:</p>
      <Table
        head={['Setting', 'Micronaut (application.yml)', 'TypeScript (S3Client)', 'Rust (Config::builder)']}
        rows={[
          ['endpoint', <code key="a">aws.services.s3.endpoint-override</code>, <code key="b">endpoint</code>, <code key="c">.endpoint_url(…)</code>],
          ['path-style', <code key="d">aws.s3.path-style-access-enabled: true</code>, <code key="e">forcePathStyle: true</code>, <code key="f">.force_path_style(true)</code>],
          ['region', <code key="g">aws.region</code>, <code key="h">region</code>, <code key="i">.region(Region::new(…))</code>],
          ['keys', <code key="j">aws.access-key-id, aws.secret-key</code>, <code key="k">credentials</code>, <code key="l">.credentials_provider(…)</code>],
        ]}
      />
      <Callout tone="tip" title="Keys from the environment, not from code">
        The programs read the endpoint and keys from environment variables (<code>S3_ENDPOINT</code>, <code>S3_ACCESS_KEY</code>,{' '}
        <code>S3_SECRET_KEY</code>) with lab defaults. In production give each application its own access key with only the permissions it
        needs (lesson “Access, policies and sharing”), injected from a secret store.
      </Callout>
      <p>
        Micronaut gives you two levels. <code>ObjectStorageOperations</code> (from micronaut-object-storage) covers upload, retrieve, delete, list
        and copy for one configured bucket, with the same interface for AWS, Azure, Google Cloud and Oracle storage. For everything else — other
        buckets, prefixes and delimiters, metadata, presigning — inject the AWS SDK’s <code>S3Client</code>, which Micronaut configures from the
        same file.
      </p>

      <h2>In code: the everyday tasks</h2>
      <h3>Create a bucket</h3>
      <InCode task="create-bucket" />
      <p>
        Creating a bucket that exists and is yours fails on AWS with <code>BucketAlreadyOwnedByYou</code> (in most regions), so each program treats
        that error as “fine”. RustFS simply answered OK when lesson 1 created <code>catalog</code> twice.
      </p>
      <h3>Upload</h3>
      <InCode task="upload" />
      <p>
        The ETag of the 28-byte readme is the same in all three languages and in lesson 1’s CLI recording: for a simple upload it is the MD5 of the
        bytes. User metadata keys (<code>color</code>, <code>sku</code>) travel as <code>x-amz-meta-…</code> headers.
      </p>
      <h3>List</h3>
      <InCode task="list" />
      <p>
        A list request returns at most 1,000 keys and says whether more exist (<code>IsTruncated</code>); the paginators keep asking until the
        last page. Here the page size was 2 so the paging shows.
      </p>
      <h3>Download</h3>
      <InCode task="download" />
      <h3>Metadata</h3>
      <InCode task="metadata" />
      <h3>Copy and move</h3>
      <InCode task="copy" />
      <InCode task="move" />
      <h3>Delete</h3>
      <InCode task="delete" />
      <p>
        The batch delete reported <code>no/such/key.txt</code> as deleted although it never existed: in S3, deleting is <strong>idempotent</strong>{' '}
        — “make sure it is gone” — so retries are always safe.
      </p>
      <h3>When the key does not exist</h3>
      <InCode task="missing" />
      <p>
        A missing object is HTTP 404 with the error code <code>NoSuchKey</code>. Micronaut’s <code>retrieve</code> turns it into an empty{' '}
        <code>Optional</code>; the SDKs raise a typed error you can catch.
      </p>
      <h3>Share a link</h3>
      <InCode task="presign" />
      <p>
        All three made a link valid for 600 seconds, signed locally. The TypeScript SDK adds <code>x-amz-checksum-mode=ENABLED</code> and{' '}
        <code>x-id=GetObject</code> to the query string; the server ignores what it does not need. On a real deployment the host in the link must
        be one the person opening it can reach — not <code>localhost</code>.
      </p>

      <h2>Cheat sheet</h2>
      <p>The same jobs across all five ways of doing them.</p>
      <div className={styles.cheats}>
        <Table head={['Job', 'Console', 'aws CLI', 'rc', 'Micronaut / Java', 'TypeScript', 'Rust']} rows={CHEATS.map((c) => [c.job, c.console, c.aws, c.rc, c.java, c.ts, c.rust].map((v, i) => (i === 0 || v === '—' ? v : <code key={i}>{v}</code>)))} />
      </div>

      <h2>The programs that made the recordings</h2>
      <p>The complete files, as they ran:</p>
      <Tabs
        items={LANGS.map((lang) => ({
          label: LANG_INFO[lang].label,
          content: (
            <Tabs items={FULL_SOURCES[lang].map((f) => ({ label: f.title, content: <CodeBlock title={f.title} language={f.language} code={f.code} /> }))} />
          ),
        }))}
      />
      <Output title="recorded output of the Micronaut program (the whole run)" text={USING.apps.java.join('\n')} />

      <Recap
        points={[
          'The console, the CLI and an SDK all send the same signed HTTP requests; pick the console to explore, the CLI for scripts, an SDK for applications.',
          'For a non-AWS server every client needs an endpoint, a region, keys and path-style addressing.',
          'aws s3 cp / ls / mv / rm / sync / presign (or rc put / get / object … / mirror / share) cover everyday work.',
          'In code: put, get, head, list (with a paginator), copy, delete; missing keys are 404 NoSuchKey; deletes are idempotent.',
          'A presigned URL is computed locally from your secret key and works without keys until it expires.',
        ]}
      />
    </>
  )
}
