import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, StatTiles } from '@/shared/figures'
import { CliSession, LogLines } from '../components'
import { SECURITY as S } from '../data/security'
import { MANIFESTS } from '../data/kubernetesManifests'

/** The recorded ACL steps from the one starting with `from` up to (not including) the one starting with `to`. */
function aclSteps(from: string, to?: string) {
  const steps = S.acl
  const a = steps.findIndex((s) => s.cmd.startsWith(from))
  const b = to ? steps.findIndex((s) => s.cmd.startsWith(to)) : steps.length
  return steps.slice(a, b)
}

/** Recorded shell steps with the column padding before their comments removed. */
const tidy = (steps: readonly { shell: boolean; cmd: string; out: string }[]) => steps.map((s) => ({ ...s, cmd: s.cmd.replace(/\s{2,}#/, '   #') }))

const aclUserRules = MANIFESTS.secret
  .split('\n')
  .filter((l) => l.trim().startsWith('user '))
  .map((l) => l.trim().replace(/#[0-9a-f]{64}/, (m) => `${m.slice(0, 9)}…`))
  .join('\n')

export default function Security() {
  return (
    <>
      <LessonGoals
        goals={[
          'know what an attacker does with an open Redis, and which default stops each step',
          'read protected mode’s refusal and know the only two ways past it',
          'write least-privilege ACL users with key patterns, read/write splits, channels and selectors — and test them with ACL DRYRUN',
          'turn on TLS with your own certificate authority, including client certificates',
          'keep secrets out of images and config files, and close the network around Redis',
        ]}
        before="Run it in production — the ACL basics section"
      />

      <h2>What an attacker does with an open Redis</h2>
      <p>Redis was built for a trusted network: anyone who can reach the port and log in can run any command the user is allowed.</p>
      <p>
        Scanners look for port 6379 on the internet all day. When they find one that answers without a password, the playbook is short and
        well known. Each step below is a real attack that has been used against exposed servers.
      </p>
      <Flow
        title="The classic attack on an exposed Redis (schematic)"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'attacker', label: 'scanner', sub: 'anywhere online', col: 0, row: 0, hue: 8, shape: 'actor' },
          { id: 'port', label: 'port 6379', sub: 'open, no password', col: 1, row: 0, hue: 7 },
          { id: 'redis', label: 'Redis', sub: 'runs every command', col: 2, row: 0, hue: 2 },
          { id: 'data', label: 'your keys', sub: 'read, then deleted', col: 3, row: 0, hue: 3, shape: 'store' },
          { id: 'disk', label: 'a file on disk', sub: 'CONFIG SET dir + SAVE', col: 2, row: 1, hue: 4, shape: 'log' },
          { id: 'module', label: 'native code', sub: 'MODULE LOAD x.so', col: 3, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'attacker', to: 'port', label: 'connect', hue: 8, flow: true },
          { from: 'port', to: 'redis', hue: 7 },
          { from: 'redis', to: 'data', label: 'SCAN', hue: 3 },
          { from: 'redis', to: 'disk', label: 'write', hue: 4, dashed: true },
          { from: 'redis', to: 'module', hue: 8, dashed: true },
        ]}
        steps={[
          { title: '1. Find and connect', body: <p>A scanner finds a reachable port that answers <code>PING</code> without asking who you are.</p>, active: ['attacker', 'port', 'redis', 'attacker>port', 'port>redis'] },
          { title: '2. Steal the data', body: <p><code>SCAN</code> and <code>GET</code> everything: sessions, tokens, personal data. Then often <code>FLUSHALL</code> and a ransom note left in a key.</p>, active: ['redis', 'data', 'redis>data'] },
          { title: '3. Write a file anywhere', body: <p>The old trick: <code>CONFIG SET dir /root/.ssh</code>, <code>CONFIG SET dbfilename authorized_keys</code>, put a public key in a value, <code>SAVE</code>. The snapshot is now a login file. The same works with cron directories.</p>, active: ['redis', 'disk', 'redis>disk'] },
          { title: '4. Run native code', body: <p><code>MODULE LOAD</code> loads a shared library into the Redis process — after step 3 has written one to disk. Now the attacker runs code as the Redis user.</p>, active: ['redis', 'module', 'redis>module'] },
        ]}
        caption="Schematic. Steps 3 and 4 are blocked by default since Redis 7 — recorded below. Steps 1 and 2 are stopped only by you."
      />
      <TermList
        items={[
          { term: 'attack surface', definition: 'Everything an attacker can reach: here the port, the commands and the configuration.' },
          { term: 'protected config', definition: 'A setting such as dir or dbfilename that CONFIG SET refuses to change unless enable-protected-configs allows it.' },
          { term: 'least privilege', definition: 'Each client gets only the commands, keys and channels it needs, nothing more.' },
          { term: 'defence in depth', definition: 'Several independent layers — network, TLS, password, permissions — so one mistake is not a breach.' },
        ]}
      />
      <p>Since Redis 7 the file-writing and module tricks are off by default. Recorded on a server started with no options at all:</p>
      <CliSession title="a default server refuses the dangerous changes (recorded)" steps={S.offByDefault} />
      <Table
        head={['Setting', 'Default', 'What it blocks']}
        rows={[
          [<code key="c0">enable-protected-configs</code>, 'no', <span key="c1">Changing <code>dir</code>, <code>dbfilename</code> and similar paths at runtime — step 3</span>],
          [<code key="c2">enable-module-command</code>, 'no', <span key="c3"><code>MODULE LOAD</code> — step 4. Load modules from the config file instead.</span>],
          [<code key="c4">enable-debug-command</code>, 'no', <span key="c5"><code>DEBUG</code>, which can crash or stall the server on purpose</span>],
          [<code key="c6">protected-mode</code>, 'yes', 'Clients from other machines while the default user has no password — next section'],
        ]}
      />
      <p>
        Each of these also accepts <code>local</code>: allowed from a loopback connection only. Ordinary settings such as <code>maxmemory</code>{' '}
        stay changeable, which is why who can run <code>CONFIG</code> at all still matters.
      </p>
      <Callout tone="warn" title="These defaults do not stop step 2">
        Nothing in the defaults stops a client that got in from reading and deleting your data. That is the job of the network, a password and
        ACL users.
      </Callout>

      <h2>Bind and protected mode</h2>
      <p>Protected mode is the safety net for a fresh install: no password means no clients from other machines.</p>
      <p>
        Out of the box Redis listens on every interface (<code>bind {S.protectedConfig.bind}</code>) with <code>protected-mode{' '}
        {S.protectedConfig['protected-mode']}</code>. While the <code>default</code> user has no password, it answers only connections from
        loopback (127.0.0.1 and ::1) and refuses everyone else.
      </p>
      <Predict
        question={
          <p>
            You start <code>redis-server</code> with no config file and run <code>redis-cli -h 192.168.1.20 PING</code> from another machine on the same
            network. What comes back?
          </p>
        }
        options={['PONG', 'Connection refused', 'An error that explains protected mode', 'NOAUTH Authentication required']}
        answer={2}
        explanation="The TCP connection succeeds — Redis is listening on all interfaces — but the server answers with a DENIED error and closes it. Recorded from a second address of the same machine:"
      />
      <CliSession title="protected mode, from another address (recorded)" steps={tidy(S.protectedMode ?? [])} prompt="$" />
      <p>The error lists the ways out. Recorded, from the same remote address:</p>
      <Table
        head={['What you change', 'Remote PING', 'Verdict']}
        rows={[
          [<code key="c7">--bind 0.0.0.0</code>, <code key="c8">{(S.bindOnly?.out ?? '').split(' ').slice(0, 2).join(' ')} …</code>, 'An explicit bind does not switch protection off'],
          [<code key="c9">--protected-mode no</code>, <code key="c10">{S.unprotected?.out}</code>, 'Open to anyone who can reach the port: never do this'],
          [<span key="c11">a password for <code>default</code></span>, <code key="c12">{S.protectedWithPassword?.[0]?.out}</code>, 'Protection is replaced by authentication'],
        ]}
      />
      <CliSession title="after CONFIG SET requirepass (recorded)" steps={S.protectedWithPassword ?? []} prompt="$" />
      <Flow
        title="Who gets in: protected mode, then authentication"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'conn', label: 'new connection', sub: 'from some address', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'check', label: 'protected?', sub: 'default user nopass', col: 1, row: 0, hue: 2 },
          { id: 'denied', label: 'DENIED', sub: 'non-loopback', col: 1, row: 1, hue: 8 },
          { id: 'auth', label: 'AUTH needed?', sub: 'password or ACL user', col: 2, row: 0, hue: 2 },
          { id: 'noauth', label: 'NOAUTH', sub: 'until AUTH succeeds', col: 2, row: 1, hue: 8 },
          { id: 'ok', label: 'commands run', sub: 'within the ACL', col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'conn', to: 'check', hue: 1, flow: true },
          { from: 'check', to: 'denied', label: 'remote', hue: 8 },
          { from: 'check', to: 'auth', hue: 2 },
          { from: 'auth', to: 'noauth', hue: 8 },
          { from: 'auth', to: 'ok', label: 'AUTH ok', hue: 6 },
        ]}
        caption="Protected mode applies only while protected-mode is yes and the default user has no password; loopback is always let through."
      />
      <Callout tone="tip" title="Bind to what you mean">
        <code>bind</code> still matters: on a machine with a public and a private interface, <code>bind 10.0.4.5 127.0.0.1</code> keeps the public
        one silent at the socket level. Protected mode is a safety net, not a firewall.
      </Callout>

      <h2>ACL users in depth</h2>
      <p>An ACL user is a name, one or more passwords, and three allow-lists: commands, keys and Pub/Sub channels.</p>
      <p>
        Every connection starts as the <code>default</code> user. <code>AUTH name password</code> switches to another one. The rules below are
        applied left to right, so a later rule can take back what an earlier one gave.
      </p>
      <Table
        head={['Rule', 'Meaning', 'Example']}
        rows={[
          [<span key="c13"><code>on</code> / <code>off</code></span>, 'The user can or cannot log in (existing connections stay)', <code key="c14">off</code>],
          [<span key="c15"><code>&gt;pass</code> / <code>#sha256</code></span>, 'Add a password in clear text or as its SHA-256 hash', <code key="c16">&gt;s3cret-orders</code>],
          [<span key="c17"><code>+cmd</code> / <code>-cmd</code></span>, 'Allow or deny one command, or a subcommand', <span key="c18"><code>+info</code>, <code>-config|set</code></span>],
          [<span key="c19"><code>+@cat</code> / <code>-@cat</code></span>, `Allow or deny a whole category (this server has ${S.aclCategories})`, <span key="c20"><code>+@read</code>, <code>-@dangerous</code></span>],
          [<code key="c21">~pattern</code>, 'Keys the user may read and write (glob)', <code key="c22">~orders:*</code>],
          [<span key="c23"><code>%R~pattern</code> / <code>%W~pattern</code></span>, 'Keys the user may only read / only write', <code key="c24">%R~catalog:*</code>],
          [<code key="c25">&amp;pattern</code>, 'Pub/Sub channels the user may use', <code key="c26">&amp;orders.*</code>],
          [<code key="c27">resetkeys</code>, 'Drop all key patterns given so far', <code key="c28">resetkeys ~orders:*</code>],
          [<code key="c29">( … )</code>, 'A selector: a second, separate set of rules that may also allow a command', <code key="c30">(~audit:* +@write)</code>],
        ]}
      />
      <TermList
        items={[
          { term: 'category', definition: <>A named group of commands, such as <code>@read</code>, <code>@write</code>, <code>@dangerous</code>, <code>@admin</code>. <code>ACL CAT</code> lists them; <code>ACL CAT read</code> lists one’s commands.</> },
          { term: 'key permission', definition: <>A glob of key names the user may touch. <code>%R~</code> and <code>%W~</code> restrict a pattern to reading or writing.</> },
          { term: 'selector', definition: 'An extra rule set in parentheses. A command is allowed if the root rules or any one selector allow it completely.' },
          { term: 'ACL DRYRUN', definition: 'Asks “would this user be allowed to run this command?” without running it.' },
          { term: 'ACL LOG', definition: 'The most recent denied commands, keys, channels and failed logins, with the client that tried.' },
        ]}
      />
      <p>
        A user for an orders service: full access to <code>orders:*</code>, read-only access to <code>catalog:*</code>, its own Pub/Sub channels,
        and nothing dangerous. Before giving it to anyone, ask the server what it would allow:
      </p>
      <CliSession title="create the user and test it with ACL DRYRUN (recorded)" steps={aclSteps('ACL SETUSER orders-api', 'AUTH orders-api wrong')} prompts={{ admin: 'admin>' }} />
      <Flow
        title="How Redis decides whether a command may run"
        cols={5}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'cmd', label: 'command', sub: 'SET k v', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'cmds', label: 'commands', sub: '+@… / -@…', col: 1, row: 0, hue: 2 },
          { id: 'keys', label: 'keys', sub: '~ %R~ %W~', col: 2, row: 0, hue: 3 },
          { id: 'chans', label: 'channels', sub: '& patterns', col: 3, row: 0, hue: 7 },
          { id: 'run', label: 'runs', sub: 'reply as usual', col: 4, row: 0, hue: 6 },
          { id: 'sel', label: 'selectors', sub: 'one by one', col: 3, row: 1, hue: 2 },
          { id: 'deny', label: 'NOPERM', sub: '+ ACL LOG', col: 4, row: 1, hue: 8 },
        ]}
        edges={[
          { from: 'cmd', to: 'cmds', hue: 1, flow: true },
          { from: 'cmds', to: 'keys', hue: 2 },
          { from: 'keys', to: 'chans', hue: 3 },
          { from: 'chans', to: 'run', hue: 6 },
          { from: 'keys', to: 'sel', label: 'denied', hue: 8, dashed: true },
          { from: 'sel', to: 'deny', label: 'none allow', hue: 8 },
          { from: 'sel', to: 'run', hue: 6, dashed: true },
        ]}
        steps={[
          { title: 'The command itself', body: <p>Is the command (or <code>command|subcommand</code>) allowed by the <code>+</code>/<code>-</code> rules? <code>FLUSHDB</code> is in <code>@dangerous</code>, so it stops here.</p>, active: ['cmd', 'cmds', 'cmd>cmds'] },
          { title: 'Every key it touches', body: <p>Each key argument must match a pattern with the right access: <code>GET catalog:7</code> needs read access, <code>SET catalog:7</code> needs write access, and <code>%R~catalog:*</code> gives only read.</p>, active: ['cmds', 'keys', 'cmds>keys'] },
          { title: 'Channels for Pub/Sub', body: <p><code>PUBLISH</code> and <code>SUBSCRIBE</code> check the channel name against the <code>&amp;</code> patterns.</p>, active: ['keys', 'chans', 'run', 'keys>chans', 'chans>run'] },
          { title: 'Selectors get a second chance', body: <p>If the root rules deny, each selector is checked as a whole. Only when none allows it does the client get <code>NOPERM</code>, and the denial is written to <code>ACL LOG</code>.</p>, active: ['keys', 'sel', 'deny', 'run', 'keys>sel', 'sel>deny', 'sel>run'] },
        ]}
      />
      <p>Now the same rules from the application’s own connection:</p>
      <CliSession title="the orders-api user at work (recorded)" steps={aclSteps('AUTH orders-api wrong', 'ACL LOG')} prompts={{ app: 'app>' }} />
      <p>
        Notice the two kinds of denial. A missing <strong>command</strong> names it (<code>'keys' command</code>); a missing <strong>key</strong> or{' '}
        <strong>channel</strong> only says “a key” or “a channel”, so the reply does not tell a stranger which keys exist. The full story is in{' '}
        <code>ACL LOG</code>:
      </p>
      <CliSession title="ACL LOG: what was denied, to whom, and why (recorded; newest first)" steps={aclSteps('ACL LOG', 'ACL SETUSER reporting')} prompts={{ admin: 'admin>' }} />
      <p>
        <code>reason</code> is <code>command</code>, <code>key</code>, <code>channel</code> or <code>auth</code>; <code>object</code> is what was
        refused. Repeated identical denials raise <code>count</code> instead of adding rows. Watch it after every deploy: a new <code>NOPERM</code>{' '}
        usually means the application changed and the user did not.
      </p>

      <h3>Selectors: a second rule set</h3>
      <p>
        A reporting job should read everything and write only its own <code>audit:*</code> keys. Root rules cannot say “read anywhere, write
        here”; a selector can:
      </p>
      <CliSession title="root rules read everything; the selector writes audit:* (recorded)" steps={aclSteps('ACL SETUSER reporting', 'ACL SETUSER default off')} prompts={{ admin: 'admin>' }} />

      <h3>Turn the default user off</h3>
      <p>
        Once real users exist, the passwordless <code>default</code> user is the weak spot. Switch it <code>off</code> (or give it a password).
        <code>ACL LIST</code> shows every user exactly as it would be saved — passwords only as hashes:
      </p>
      <CliSession title="(recorded)" steps={aclSteps('ACL SETUSER default off')} prompts={{ admin: 'admin>' }} />

      <h3>Where users are saved: aclfile or redis.conf</h3>
      <p>Users made with ACL SETUSER live only in memory until you save them, and there are two places they can go — never both.</p>
      <Table
        head={['', <code key="a">aclfile users.acl</code>, <span key="b">users in <code>redis.conf</code></span>]}
        rows={[
          ['save with', <code key="c31">ACL SAVE</code>, <code key="c32">CONFIG REWRITE</code>],
          ['reload with', <code key="c33">ACL LOAD</code>, 'a restart'],
          ['the other command', <span key="c34">CONFIG REWRITE saves settings, not users</span>, <span key="c35">ACL SAVE fails: no aclfile</span>],
        ]}
      />
      <div>
        <CliSession title="with an aclfile (recorded)" steps={S.aclfile.steps} />
        <CodeBlock title="users.acl after ACL SAVE (recorded; hash shortened)" code={S.aclfile.file.join('\n')} />
        <CliSession title="without an aclfile, users go into redis.conf (recorded)" steps={S.aclConf.steps} />
        <CodeBlock title="the user lines CONFIG REWRITE wrote into redis.conf (recorded)" code={S.aclConf.file.join('\n')} />
      </div>
      <Callout tone="tip" title="Prefer an aclfile">
        A separate file can come from a secret store, be replaced and applied with <code>ACL LOAD</code> without a restart, and keeps
        passwords out of the main config. <code>ACL LOAD</code> is all-or-nothing: if one line is invalid, the old users stay.
      </Callout>

      <h2>rename-command vs ACL</h2>
      <p>rename-command is the old way to hide a command: it changes or removes the name for every client at once.</p>
      <CliSession title="redis-server --rename-command FLUSHALL &quot;&quot; --rename-command CONFIG CONFIG_b9f2c1 (recorded)" steps={S.rename} />
      <Table
        head={['', 'rename-command', 'ACL']}
        rows={[
          ['Scope', 'Every client, including admins', 'Per user'],
          ['Change at runtime', 'No — config file only, then restart', <span key="c36">Yes — <code>ACL SETUSER</code>, <code>ACL LOAD</code></span>],
          ['Audit', 'None', <span key="c37"><code>ACL LOG</code></span>],
          ['Side effects', 'Breaks tools that expect the name; renamed commands still go to replicas and the AOF under the new name', 'None'],
          ['Use it for', 'Old versions only', 'Everything else'],
        ]}
      />
      <Callout tone="note">
        Renaming is security by obscurity: anyone who reads the config file learns the new name. A user with <code>-@dangerous</code> simply cannot run
        <code> FLUSHALL</code>, whatever it is called.
      </Callout>

      <h2>TLS: encrypt the connection</h2>
      <p>Without TLS, passwords and data cross the network as plain text that anyone on the path can read.</p>
      <p>
        Redis speaks TLS on its own port. Here a private certificate authority (CA) signs a certificate for the server and one for a client; then
        the server is started with TLS only. Every command below ran.
      </p>
      <CodeBlock title="a private CA, a server and a client certificate (recorded commands)" language="bash" code={S.tlsCerts.join('\n')} />
      <CodeBlock title="start Redis with TLS only (recorded)" language="bash" code={S.tlsServerCommand.replaceAll(' --', ' \\\n  --')} />
      <TermList
        items={[
          { term: 'CA certificate', definition: 'The authority both sides trust. A certificate it signed is accepted; anything else is not.' },
          { term: 'subjectAltName', definition: 'The host names and IPs a certificate is valid for. Clients compare it with the address they dialled.' },
          { term: 'mutual TLS', definition: <>The client also presents a certificate. Redis asks for one when <code>tls-auth-clients yes</code> (the default).</> },
        ]}
      />
      <CliSession title="three clients against the TLS port (recorded)" steps={tidy(S.tls)} prompt="$" />
      <LogLines title="the server log for those connections (recorded)" lines={S.tlsLog} highlight={/Error/} />
      <Flow
        title="One TLS connection with client certificates"
        cols={4}
        rows={2}
        rowHeight={92}
        nodes={[
          { id: 'client', label: 'client', sub: 'client.crt + key', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'hs', label: 'TLS handshake', sub: 'both show certificates', col: 1, row: 0, hue: 7 },
          { id: 'ca', label: 'ca.crt', sub: 'trusted by both', col: 1, row: 1, hue: 4, shape: 'store' },
          { id: 'redis', label: 'Redis', sub: 'tls-port 6379', col: 2, row: 0, hue: 2 },
          { id: 'auth', label: 'AUTH / ACL', sub: 'still required', col: 3, row: 0, hue: 6 },
        ]}
        edges={[
          { from: 'client', to: 'hs', label: 'ClientHello', hue: 1, flow: true },
          { from: 'hs', to: 'redis', hue: 7 },
          { from: 'ca', to: 'hs', label: 'verify', hue: 4, dashed: true },
          { from: 'redis', to: 'auth', hue: 6 },
        ]}
        caption="TLS proves which machine you talk to and hides the traffic. It does not replace ACL users: a client certificate gets you a connection, not permissions."
      />
      <Table
        head={['Setting', 'Purpose']}
        rows={[
          [<code key="c38">port 0</code>, 'Close the plain-text port; otherwise both run side by side'],
          [<code key="c39">tls-port 6379</code>, 'Listen for TLS connections'],
          [<span key="c40"><code>tls-cert-file</code>, <code>tls-key-file</code></span>, 'The server’s certificate and private key'],
          [<code key="c41">tls-ca-cert-file</code>, 'The CA used to check client (and replica) certificates'],
          [<code key="c42">tls-auth-clients yes|optional|no</code>, 'Demand, accept or ignore client certificates'],
          [<code key="c43">tls-replication yes</code>, 'Replicas connect to their primary over TLS'],
          [<code key="c44">tls-cluster yes</code>, 'The cluster bus between nodes uses TLS'],
        ]}
      />
      <Callout tone="warn" title="TLS costs CPU">
        Encryption runs on the server’s threads. Expect lower throughput per core and more latency for new connections; long-lived pooled
        connections hide most of it. Enable <code>io-threads</code> on busy servers. Certificates expire: put the renewal date in your monitoring.
      </Callout>

      <h2>Secrets and the network around Redis</h2>
      <p>The safest Redis is one that most of your network cannot reach, with passwords nobody has to write down.</p>
      <ul>
        <li>
          <strong>Hash passwords in files.</strong> Use <code>#&lt;sha256&gt;</code> in the aclfile, not <code>&gt;password</code>. Redis stores only
          hashes anyway, as <code>ACL LIST</code> showed.
        </li>
        <li>
          <strong>Give passwords to applications at runtime</strong> — environment variables or mounted files from a secret store — never in the
          image or the repository.
        </li>
        <li>
          <strong>One user per application</strong>, so you can rotate or disable one without touching the others. A user can hold two passwords at
          once: add the new one, roll out the clients, then remove the old one with <code>&lt;oldpass</code>.
        </li>
        <li>
          <strong>redis-cli</strong> reads the password from <code>REDISCLI_AUTH</code>; <code>-a</code> puts it in the shell history and the process
          list.
        </li>
      </ul>
      <p>On Kubernetes, a NetworkPolicy lets only the pods that need Redis reach it. Validated with kubeconform; not run on a cluster:</p>
      <CodeBlock title="networkpolicy.yaml (validated, not recorded on a cluster)" language="yaml" code={MANIFESTS.networkpolicy} />
      <CodeBlock title="the ACL file the Kubernetes lesson mounts from a Secret (hashes shortened here)" code={aclUserRules} />
      <StatTiles
        title="What each layer stops"
        stats={[
          { label: 'network policy / firewall', value: 'no route', sub: 'scanner never connects', hue: 7 },
          { label: 'protected mode', value: 'DENIED', sub: 'nopass + remote client', hue: 2 },
          { label: 'password / ACL user', value: 'NOAUTH', sub: 'until AUTH succeeds', hue: 8 },
          { label: 'ACL rules', value: 'NOPERM', sub: 'wrong command, key or channel', hue: 3 },
          { label: 'TLS', value: 'handshake', sub: 'no cert, no connection', hue: 4 },
          { label: 'protected configs', value: 'refused', sub: 'CONFIG SET dir, MODULE LOAD', hue: 6 },
        ]}
      />

      <h2>Checklist</h2>
      <p>Go through this before a Redis server holds anything you would mind losing or leaking.</p>
      <Table
        head={['Area', 'Do', 'Check with']}
        rows={[
          ['Network', 'Reachable only from the application subnet or pods; never from the internet', <span key="c45">a port scan from outside; the NetworkPolicy</span>],
          ['Bind', <span key="c46"><code>bind</code> to the private interface and loopback</span>, <code key="c47">CONFIG GET bind</code>],
          ['Default user', <span key="c48"><code>user default off</code>, or a strong password</span>, <code key="c49">ACL GETUSER default</code>],
          ['Users', 'One per application, key prefixes, no @dangerous, no @admin', <code key="c50">ACL DRYRUN</code>],
          ['Audit', 'Alert on new ACL LOG entries', <code key="c51">ACL LOG</code>],
          ['Persistence of users', <span key="c52">An aclfile with hashed passwords</span>, <span key="c53"><code>ACL SAVE</code> / <code>ACL LOAD</code></span>],
          ['Dangerous features', <span key="c54">Keep <code>enable-protected-configs</code>, <code>enable-module-command</code>, <code>enable-debug-command</code> at <code>no</code></span>, <code key="c55">CONFIG GET enable-*</code>],
          ['Transport', <span key="c56">TLS with <code>port 0</code>, client certificates where possible, and for replication and the cluster bus</span>, <code key="c57">redis-cli --tls</code>],
          ['Secrets', 'From a secret store at runtime; rotate with two passwords per user', 'repository and image scans'],
          ['Process', 'Run as a non-root user; data directory not writable by others', <code key="c58">ps</code>],
        ]}
      />

      <Recap
        points={[
          <>An exposed Redis is read, wiped and — on old versions — turned into a file writer. Since Redis 7, protected configs and <code>MODULE LOAD</code> are off by default.</>,
          <>Protected mode refuses remote clients while the default user has no password; <code>bind 0.0.0.0</code> alone does not change that.</>,
          <>ACL users combine command rules (<code>+@read</code>, <code>-@dangerous</code>), key rules (<code>~</code>, <code>%R~</code>, <code>%W~</code>), channel rules (<code>&amp;</code>) and selectors.</>,
          <>Test with <code>ACL DRYRUN</code>, watch <code>ACL LOG</code>, save with <code>ACL SAVE</code> to an aclfile (or <code>CONFIG REWRITE</code> without one).</>,
          <>TLS hides the traffic and proves identities; it is on top of ACL users, not instead of them.</>,
          'Keep Redis off the internet, passwords out of files and images, and one user per application.',
        ]}
      />
    </>
  )
}
