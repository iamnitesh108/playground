import { Flow, StatTiles } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { HUE } from '../components/legend'
import { RunConsoleMap } from '../components/RunConsoleMap'
import { RunDiskLayout } from '../components/RunDiskLayout'
import { RunTopologies } from '../components/RunTopologies'
import { Terminal } from '../components/Terminal'
import { UrlStyles } from '../components/UrlStyles'
import { CONSOLE } from '../data/console'
import { consoleLabel as label } from '../components/consoleLabel'
import { RUN } from '../data/run'
import { RUN_SOURCES } from '../data/runSources'

const stepOut = (steps: readonly { cmd?: string; out?: string }[], start: string) => steps.find((s) => s.cmd?.startsWith(start))?.out ?? ''

// objects (from the listing after the restart) and their files on disk (du -b)
const OBJECTS = stepOut(RUN.persist, 'aws s3 ls')
  .split('\n')
  .map((l) => l.trim().split(/\s+/))
  .map((p) => ({ key: p[3], size: Number(p[2]) }))
const FILES = stepOut(RUN.disk, 'podman exec s3-lab sh -c "du')
  .split('\n')
  .map((l) => l.split('\t'))
  .map(([bytes, path]) => ({ bytes: Number(bytes), path }))
const ORDER = ['readme.txt', 'images/photo.jpg', 'videos/demo.mp4']
const ready = JSON.parse(stepOut(RUN.health, 'curl -s http://localhost:9000/health/ready')) as { ready: boolean; details: { storage: { readQuorum: boolean; writeQuorum: boolean } } }
const cluster = stepOut(RUN.drives, 'rc admin info cluster')
const parity = cluster.match(/EC Parity:\s+(\d+)/)?.[1]
const disks = cluster.match(/Disks:\s+(\d+)/)?.[1]

const AWS_ALIAS = `# run the aws CLI from its official image; ~/.aws holds the config shown below
alias aws='podman run --rm -it --network host -v ~/.aws:/root/.aws:ro -v "$PWD":/aws -w /aws docker.io/amazon/aws-cli'`

export default function Run() {
  return (
    <>
      <LessonGoals
        goals={[
          'start an S3 server on your own machine with one command, and know what every part of that command does',
          'check that it is healthy, and log in to its web console',
          'set up two command-line clients (the aws CLI and rc) for a server that is not AWS',
          'find where your objects really live on disk, and keep them when the container is replaced',
          'write a compose file, and know when one drive is not enough',
        ]}
        before={<>Lesson <a href="#/s3/what">What object storage is</a>. You need podman or docker installed; the commands are the same for both.</>}
      />

      <h2>Your own S3 server</h2>
      <p>
        AWS S3 is a paid service on the internet. For learning, testing and many real systems you run your own S3-compatible server instead. This
        module uses <strong>RustFS</strong> {RUN.version}: open source (Apache 2.0), one program, distributed as a container image. Everything you do
        with it works the same against AWS S3 or any other S3 server.
      </p>
      <Callout tone="analogy" title="Analogy: opening your own cloakroom">
        Running a server is like opening the cloakroom yourself. You need a room (the <em>container</em>), a counter where guests hand things in
        (the <em>S3 port</em>, 9000), an office window for the manager (the <em>console port</em>, 9001), a master key (the <em>access key and
        secret key</em>) and a storeroom that survives when you repaint the room (a <em>volume</em> for <code>/data</code>).
      </Callout>
      <TermList
        items={[
          { term: 'container', definition: 'A program packaged with everything it needs, started from an image. podman and docker run containers.' },
          { term: 'image', definition: 'The package a container starts from, here docker.io/rustfs/rustfs:latest.' },
          { term: 'port', definition: 'A numbered door on a machine. RustFS listens on 9000 for S3 requests and 9001 for the web console.' },
          { term: 'volume', definition: 'Storage that lives outside the container, so data survives when the container is removed and started again.' },
          { term: 'access key / secret key', definition: 'A user name and a password for programs. The access key is sent with requests; the secret key never leaves your side — it is used to sign requests.' },
          { term: 'endpoint', definition: 'The address of an S3 server, for example http://localhost:9000. Tools default to AWS; for your own server you always set it.' },
        ]}
      />

      <h2>Start it</h2>
      <p>One volume for the data and one command for the server:</p>
      <Terminal title="recorded: start RustFS with podman (docker takes the same arguments)" steps={RUN.start} />
      <Table
        head={['Part of the command', 'What it does']}
        rows={[
          [<code key="a">-d --name s3-lab</code>, 'run in the background under a name you can use later (logs, stop, exec)'],
          [<code key="b">-p 9000:9000</code>, 'publish the S3 API: your machine’s port 9000 → the container’s port 9000'],
          [<code key="c">-p 9001:9001</code>, 'publish the web console'],
          [<code key="d">-e RUSTFS_ACCESS_KEY=… -e RUSTFS_SECRET_KEY=…</code>, 'the root credentials: the first and most powerful user (choose your own; these are lab values)'],
          [<code key="e">-v s3-lab-data:/data</code>, 'keep /data, where RustFS writes objects, in a named volume'],
          [<code key="f">docker.io/rustfs/rustfs:latest</code>, `the image; this recording ran ${RUN.version}. Pin a version (rustfs/rustfs:${RUN.version}) for anything that matters`],
        ]}
      />
      <Flow
        title="What that command set up"
        cols={4}
        rows={3}
        rowHeight={70}
        nodes={[
          { id: 'cli', label: 'aws CLI, SDKs', sub: 'your programs', col: 0, row: 0, hue: HUE.client, shape: 'actor' },
          { id: 'browser', label: 'browser', sub: 'the console', col: 0, row: 2, hue: HUE.client, shape: 'actor' },
          { id: 'api', label: 'port 9000', sub: 'S3 API', col: 1, row: 0, hue: HUE.network },
          { id: 'con', label: 'port 9001', sub: 'web console', col: 1, row: 2, hue: HUE.network },
          { id: 'rustfs', label: 'rustfs', sub: 'container s3-lab', col: 2, row: 0, rowSpan: 3, hue: HUE.server },
          { id: 'data', label: '/data', sub: 'volume s3-lab-data', col: 3, row: 1, hue: HUE.disk, shape: 'store' },
        ]}
        edges={[
          { from: 'cli', to: 'api', hue: HUE.client, flow: true },
          { from: 'browser', to: 'con', hue: HUE.client },
          { from: 'api', to: 'rustfs', hue: HUE.network, flow: true },
          { from: 'con', to: 'rustfs', hue: HUE.network },
          { from: 'rustfs', to: 'data', hue: HUE.disk, both: true },
        ]}
        caption="The console is a web app that itself talks to the S3 API; both end up in the same server and the same /data."
      />
      <Callout tone="warn" title="Always set your own keys">
        Without <code>RUSTFS_ACCESS_KEY</code> and <code>RUSTFS_SECRET_KEY</code> the image prints a warning and RustFS falls back to its built-in
        default, <code>rustfsadmin</code> / <code>rustfsadmin</code> — which everyone who has read the documentation knows. For real servers, pass
        the keys as files (<code>RUSTFS_ACCESS_KEY_FILE</code>, <code>RUSTFS_SECRET_KEY_FILE</code>) from a secret store rather than on the
        command line.
      </Callout>
      <Callout tone="note" title="Folders instead of a named volume">
        The container runs as user id 10001. If you mount a folder of your own (<code>-v ./data:/data</code>), that user must be able to write to
        it: <code>chown -R 10001:10001 data</code> for docker, or add <code>:U</code> to the mount with podman (<code>-v ./data:/data:Z,U</code>).
      </Callout>

      <h2>Is it running?</h2>
      <p>RustFS answers three health URLs without any login. Monitoring and container orchestrators use them.</p>
      <Terminal title="recorded: liveness, readiness and the console" steps={RUN.health} />
      <StatTiles
        stats={[
          { label: '/health', value: 'alive', sub: 'the process answers', hue: HUE.ok },
          { label: '/health/ready', value: ready.ready ? 'ready' : 'not ready', sub: `read quorum ${ready.details.storage.readQuorum ? 'yes' : 'no'}, write quorum ${ready.details.storage.writeQuorum ? 'yes' : 'no'}`, hue: HUE.ok },
          { label: 'console /rustfs/console/health', value: 'ok', sub: 'port 9001', hue: HUE.ok },
        ]}
      />
      <p>
        <em>Alive</em> means the process runs; <em>ready</em> means it can also read and write data (its drives are reachable). A load balancer
        should only send traffic to ready servers. Everything else needs credentials — even listing buckets:
      </p>
      <Terminal title="recorded: an anonymous request" steps={RUN.anonymous} />
      <p>
        The answer is an S3 error in XML, the same shape AWS uses. Every real request carries a <strong>signature</strong> made with your secret
        key; lesson <a href="#/s3/requests">The S3 API on the wire</a> builds one by hand.
      </p>

      <h2>The web console</h2>
      <p>
        Open <code>{CONSOLE.url}</code> in a browser. These steps use the console’s own labels, recorded from RustFS {CONSOLE.version}:
      </p>
      <ol>
        <li>
          On the login page choose {label('login', 'Key Login')}. Type the access key into {label('login', 'Account')} and the secret key into{' '}
          {label('login', 'Key')}, then press {label('login', 'Login')}.
        </li>
        <li>
          You land in the {label('buckets', 'Browser')}, which lists buckets with their {label('buckets', 'Object Count')}, {label('buckets', 'Size')}{' '}
          and {label('buckets', 'Access Policy')}. {label('buckets', 'Create Bucket')} asks for a name and offers {label('createBucket', 'Version')},{' '}
          {label('createBucket', 'Object Lock')} and {label('createBucket', 'Bucket Quota')} — all explained later in this module.
        </li>
        <li>
          Click a bucket to see its objects; prefixes appear as folders. {label('bucket', 'Upload File/Folder')} uploads files or whole folders
          from your computer.
        </li>
        <li>Click an object to see its details, download it, or make a temporary link to share — lesson “Using S3 day to day” walks through it.</li>
      </ol>
      <RunConsoleMap menu={CONSOLE.menu} />
      <p>
        The console is convenient for looking around and for one-off jobs. Anything you do repeatedly belongs in a script or in code, where it can
        be reviewed and repeated — the rest of this lesson sets that up.
      </p>

      <h2>A command-line client: the aws CLI</h2>
      <p>
        The official AWS command-line tool works with any S3 server. You can install it, or run it from its container image like this (the
        recordings ran the same image attached to the server’s network):
      </p>
      <CodeBlock title="~/.bashrc or ~/.zshrc" language="bash" code={AWS_ALIAS} />
      <p>It needs to know three things that differ from AWS: where the server is, which keys to use, and how to write bucket addresses.</p>
      <CodeBlock title="~/.aws/config (the file the recordings used)" language="ini" code={RUN_SOURCES.awsConfig} />
      <CodeBlock title="~/.aws/credentials" language="ini" code={RUN_SOURCES.awsCredentials} />
      <Table
        head={['Setting', 'Value here', 'Why']}
        rows={[
          [<code key="a">endpoint_url</code>, 'http://localhost:9000', 'without it the CLI talks to Amazon’s servers'],
          [<code key="b">region</code>, 'us-east-1', 'part of every signature; AWS insists on the bucket’s real region, the lab RustFS accepted any (lesson “The S3 API on the wire”)'],
          [<code key="c">addressing_style = path</code>, 'path', 'put the bucket in the path, not in the host name (see below)'],
          [<code key="d">aws_access_key_id / aws_secret_access_key</code>, 'the lab keys', 'who you are; can also come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY'],
        ]}
      />
      <Terminal title="recorded: the CLI against RustFS" steps={RUN.awsCli} />
      <h3>Path-style and virtual-hosted-style addresses</h3>
      <p>S3 clients can put the bucket name in two places in a URL:</p>
      <UrlStyles />
      <Terminal title="recorded: the same listing with addressing_style = virtual" steps={RUN.virtual} />
      <p>
        With virtual-hosted style the CLI asked for <code>catalog.localhost</code>, a host name that does not exist. RustFS only understands
        virtual-hosted requests when you tell it its domain with <code>RUSTFS_SERVER_DOMAINS</code> (and DNS sends <code>*.your-domain</code> to it).
        For your own server, <strong>path-style is the simple, safe choice</strong>; every SDK has a switch for it, shown in the next lesson.
      </p>

      <h3>RustFS’s own client: rc</h3>
      <p>
        RustFS also publishes <code>rc</code> (image <code>docker.io/rustfs/rc</code>), a client in the style of MinIO’s <code>mc</code>: you save a
        server under a short <em>alias</em> once, then write <code>lab/bucket/key</code>. It also speaks the RustFS admin API (users, policies,
        server info), which the aws CLI does not.
      </p>
      <Terminal title="recorded: rc with an alias called lab" steps={RUN.rcCli} />

      <h2>Where your data really lives</h2>
      <p>Two more files were uploaded — a 300 KiB photo and a 20 MiB video — and then the data directory was opened up:</p>
      <Terminal title="recorded: uploads" steps={RUN.moreUploads} />
      <Terminal title="recorded: inside /data" steps={RUN.disk} maxLines={40} />
      <RunDiskLayout objects={ORDER.map((k) => OBJECTS.find((o) => o.key === k)!)} files={FILES} />
      <ul>
        <li>
          Every <strong>bucket is a folder</strong> and every <strong>key is a folder</strong> inside it (that is why RustFS refuses keys with{' '}
          <code>..</code>). <code>.rustfs.sys</code> holds the server’s own configuration, users and policies.
        </li>
        <li>
          <code>xl.meta</code> describes the object: size, content type, ETag, checksums, where the data is. It is a binary format shared with
          MinIO (the <code>x-minio-internal-…</code> fields in the recording). Small objects are stored <strong>inline</strong>, inside{' '}
          <code>xl.meta</code> itself — the last bytes of <code>readme.txt</code>’s file are the text.
        </li>
        <li>
          Larger objects get a data folder with <code>part.N</code> files. The CLI uploaded the video in three parts (8 + 8 + 4 MiB; lesson
          “Large files” explains why), and the parts stay separate on disk.
        </li>
        <li>
          Each part file is slightly larger than its data: RustFS stores a 32-byte checksum (HighwayHash) after every 1 MiB block, so a flipped
          bit on the disk is noticed when the block is read.
        </li>
      </ul>
      <Callout tone="warn" title="Look, don’t touch">
        Never copy, edit or delete files under <code>/data</code> by hand, and never back it up with a plain file copy while the server runs: the
        files of one object must stay consistent with each other. Read and write through the S3 API; back up with S3 tools (lesson “Patterns and
        operations”).
      </Callout>
      <Predict
        question={<p>You remove the container with <code>podman rm -f s3-lab</code> and start it again with the same command. Are the objects still there?</p>}
        options={['No — removing a container deletes its data', 'Yes — /data is in the volume s3-lab-data, which was not removed']}
        answer={1}
        explanation={<p>Recorded below. Without <code>-v s3-lab-data:/data</code> the data would have lived inside the container and been deleted with it.</p>}
      />
      <Terminal title="recorded: replace the container, keep the volume" steps={RUN.persist} />

      <h2>The same with a compose file</h2>
      <p>A compose file writes the command down, so the setup is repeatable and can live next to your project:</p>
      <CodeBlock title="compose.yaml (the file the recording ran)" language="yaml" code={RUN_SOURCES.compose} />
      <Terminal title={`recorded: up, status (health check: ${RUN.composeHealth}), down`} steps={RUN.compose} />
      <p>
        <code>down -v</code> also deletes the volume — and with it every object. Leave out <code>-v</code> to keep the data. The health check uses
        the <code>/health</code> URL from above, so <code>ps</code> shows <code>(healthy)</code> once RustFS answers.
      </p>

      <h2>One drive, many drives, many servers</h2>
      <p>
        So far RustFS wrote everything to one folder on one disk. When that disk dies, the data is gone. Real deployments give RustFS several
        drives, and usually several servers, and let it spread every object over them with <strong>erasure coding</strong>: extra “parity”
        pieces from which lost pieces can be rebuilt.
      </p>
      <RunTopologies />
      <Terminal title="recorded: one server with four drives" steps={RUN.drives} maxLines={30} />
      <p>
        The first start <strong>refused</strong> to run: the four “drives” were folders on the same disk, and erasure coding across one disk
        protects nothing. <code>RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true</code> allows it for a lab, as here. The server then reported{' '}
        {disks} disks and <strong>EC parity {parity}</strong>: every object is cut into {Number(disks) - Number(parity)} data and {parity} parity
        pieces, so any {parity} of the four drives may fail. Lesson <a href="#/s3/durability">Surviving disk failures</a> breaks drives on purpose
        and shows the maths.
      </p>
      <Table
        head={['Layout', 'Use it for', 'Note']}
        rows={[
          ['single node, single drive', 'development, tests, CI, a laptop', 'cannot be grown into the others later; move the data through S3 instead'],
          ['single node, several drives', 'a small server with 4+ disks', 'survives broken disks, not a broken machine'],
          ['several nodes, several drives', 'production', 'survives broken disks and servers; all nodes list all drives in RUSTFS_VOLUMES'],
        ]}
      />

      <h2>Settings worth knowing</h2>
      <p>Every option is an environment variable (or a command-line flag). From <code>rustfs server --help</code> of {RUN.version}:</p>
      <Table
        head={['Variable', 'Default', 'What it sets']}
        rows={[
          [<code key="a">RUSTFS_VOLUMES</code>, '/data', 'the drives; {0...3} expands to four paths, http://node{1...4}:9000/data/… for several servers'],
          [<code key="b">RUSTFS_ADDRESS</code>, ':9000', 'where the S3 API listens'],
          [<code key="c">RUSTFS_CONSOLE_ENABLE</code>, 'true', 'turn the web console on or off'],
          [<code key="d">RUSTFS_CONSOLE_ADDRESS</code>, ':9001', 'where the console listens'],
          [<code key="e">RUSTFS_ACCESS_KEY(_FILE)</code>, 'rustfsadmin', 'root access key, or a file that contains it'],
          [<code key="f">RUSTFS_SECRET_KEY(_FILE)</code>, 'rustfsadmin', 'root secret key, or a file that contains it'],
          [<code key="g">RUSTFS_SERVER_DOMAINS</code>, '(none)', 'domain(s) for virtual-hosted-style URLs; without it only path-style works'],
          [<code key="h">RUSTFS_REGION</code>, '(us-east-1)', 'the region clients must sign for'],
          [<code key="i">RUSTFS_TLS_PATH</code>, '(none)', 'a folder with rustfs_cert.pem and rustfs_key.pem: serve HTTPS'],
          [<code key="j">RUSTFS_OBS_ENDPOINT</code>, '(none)', 'an OpenTelemetry collector for logs, metrics and traces'],
        ]}
      />
      <Callout tone="note" title="Coming from another S3 server?">
        Your applications only need a new endpoint and new keys. The data itself is best moved through the S3 API with a sync tool — recorded in
        lesson “Patterns and operations”. RustFS also accepts MinIO’s environment names for the root credentials (<code>MINIO_ROOT_USER</code>,{' '}
        <code>MINIO_ROOT_PASSWORD</code>), which helps when you reuse an existing deployment file.
      </Callout>

      <Recap
        points={[
          'One podman/docker command runs RustFS: port 9000 for S3, 9001 for the console, root keys in two environment variables, /data in a volume.',
          '/health says the process is alive, /health/ready that it can read and write; everything else needs signed requests.',
          'Clients need an endpoint, a region, keys and path-style addressing to talk to a server that is not AWS.',
          'On disk, buckets and keys are folders; xl.meta describes each object; small objects live inline, big ones in part files with checksums.',
          'One drive protects nothing. Several drives (and servers) with erasure coding survive failures — lesson “Surviving disk failures”.',
        ]}
      />
    </>
  )
}
