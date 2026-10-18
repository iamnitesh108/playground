import { Flow } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Terminal } from '../components'
import { SecurityAclGrid } from '../components/SecurityAclGrid'
import { SecurityProtocolMatrix } from '../components/SecurityProtocolMatrix'
import { OPS } from '../data/ops'

const S = OPS.security

/** A recorded step, found by the start of its label. */
function step(label: string) {
  const s = S.steps.find((x) => x.label.startsWith(label))
  if (!s) throw new Error(`no recorded step "${label}"`)
  return s
}

function AuthFlow() {
  return (
    <Flow
      title="One produce request through a secured listener"
      cols={5}
      rows={2}
      rowHeight={92}
      nodes={[
        { id: 'client', label: 'client', sub: 'producer', col: 0, row: 0, hue: 7, shape: 'actor' },
        { id: 'listener', label: 'listener', sub: 'SASL_SSL :9094', col: 1, row: 0, hue: 3 },
        { id: 'scram', label: 'SASL check', sub: 'SCRAM-SHA-512', col: 2, row: 0, hue: 3 },
        { id: 'authz', label: 'authorizer', sub: 'ACL lookup', col: 3, row: 0, hue: 5 },
        { id: 'log', label: 'orders', sub: 'partition log', col: 4, row: 0, hue: 3, shape: 'log' },
        { id: 'meta', label: 'cluster metadata', sub: 'SCRAM users + ACLs', col: 2, row: 1, span: 2, hue: 5, shape: 'store' },
        { id: 'denied', label: 'denied', sub: 'error to client', col: 4, row: 1, hue: 8 },
      ]}
      edges={[
        { from: 'client', to: 'listener', label: 'TLS', hue: 7, flow: true },
        { from: 'listener', to: 'scram', hue: 3 },
        { from: 'scram', to: 'authz', hue: 3 },
        { from: 'authz', to: 'log', label: 'allow', hue: 3, flow: true },
        { from: 'authz', to: 'denied', hue: 8, dashed: true },
        { from: 'meta', to: 'scram', hue: 5, dashed: true },
        { from: 'meta', to: 'authz', hue: 5, dashed: true },
      ]}
      steps={[
        {
          title: '1 · Encryption',
          body: <p>The client opens a TCP connection and runs a TLS handshake. It checks the broker certificate against its truststore; from now on every byte is encrypted.</p>,
          active: ['client', 'listener', 'client>listener'],
        },
        {
          title: '2 · Authentication',
          body: <p>Inside the encrypted channel the client runs SASL. With SCRAM it proves it knows the password without sending it; the broker compares against the salted hash stored in the cluster metadata.</p>,
          active: ['listener', 'scram', 'meta', 'listener>scram', 'meta>scram'],
        },
        {
          title: '3 · A principal',
          body: <p>The connection now has an identity, the <strong>principal</strong> <code>User:app</code>. Every request on this connection is made by that principal.</p>,
          active: ['scram', 'authz', 'scram>authz'],
        },
        {
          title: '4 · Authorisation, per request',
          body: <p>For each request the authorizer asks: may <code>User:app</code> do WRITE on Topic <code>orders</code>? It answers from ACLs held in memory, replicated from the cluster metadata.</p>,
          active: ['authz', 'meta', 'meta>authz'],
        },
        {
          title: '5 · Allowed or denied',
          body: <p>With a matching ALLOW (and no DENY) the batch is appended to the log. Otherwise the client gets an authorisation error — the connection stays open, only that request fails.</p>,
          active: ['authz', 'log', 'denied', 'authz>log', 'authz>denied'],
        },
      ]}
    />
  )
}

export default function Security() {
  return (
    <>
      <LessonGoals
        goals={[
          'choose a listener protocol: PLAINTEXT, SSL, SASL_PLAINTEXT or SASL_SSL',
          'set up TLS and SCRAM users, and know where PLAIN and mTLS fit',
          'grant exactly the ACLs a producer and a consumer need, and read the errors when one is missing',
        ]}
        before="Brokers and listeners (lesson 3), consumer groups"
      />

      <h2>Three separate questions</h2>
      <p>Kafka security is three independent settings, and a cluster can have any mix of them.</p>
      <ul>
        <li><strong>Encryption</strong> — can someone on the network read the records? Solved with TLS.</li>
        <li><strong>Authentication</strong> — who is this client? Solved with SASL or client certificates.</li>
        <li><strong>Authorisation</strong> — may this client do this? Solved with ACLs.</li>
      </ul>
      <p>
        An out-of-the-box broker has none of them: anyone who reaches port 9092 can read and write every topic. Everything below was recorded on a
        real Kafka {OPS.version} broker set up with all three.
      </p>
      <TermList
        items={[
          { term: 'listener', definition: 'A port the broker accepts connections on, with a name and a security protocol (listeners=NAME://host:port).' },
          { term: 'security protocol', definition: 'One of PLAINTEXT, SSL, SASL_PLAINTEXT, SASL_SSL — chosen per listener in listener.security.protocol.map.' },
          { term: 'SASL mechanism', definition: 'How a SASL client proves who it is: PLAIN, SCRAM-SHA-256/512, OAUTHBEARER or GSSAPI (Kerberos).' },
          { term: 'principal', definition: 'The authenticated identity of a connection, such as User:app. ACLs are written for principals.' },
          { term: 'ACL', definition: 'A rule: principal P is ALLOWed (or DENYed) operation O on resource R, from host H.' },
          { term: 'super user', definition: 'A principal listed in super.users; the authorizer allows it everything.' },
        ]}
      />

      <h2>Listeners and protocols</h2>
      <p>Each listener speaks exactly one security protocol, so one broker can offer several at once — for example TLS for applications and something else for a private network.</p>
      <SecurityProtocolMatrix />
      <p>
        A broker always has an <strong>inter-broker listener</strong> (replication between brokers) and, in KRaft, a <strong>controller listener</strong>.
        Both are listeners like any other and can be secured the same way. The recorded broker had three:
      </p>
      <Table
        head={['Listener', 'Protocol', 'Port (shown)', 'Used by']}
        rows={[
          ['SASL_PLAINTEXT', 'SASL_PLAINTEXT', '9092', 'clients in the recording, and broker-to-broker traffic'],
          ['SASL_SSL', 'SASL_SSL', '9094', 'the TLS part of the recording'],
          ['CONTROLLER', 'PLAINTEXT', '9093', 'the KRaft controller (one node acting as both)'],
        ]}
      />
      <CodeBlock title="server.properties (the file the recorded broker ran with)" language="properties" code={S.files['server.properties']} />
      <Callout tone="warn" title="Why User:ANONYMOUS is a super user here">
        The controller listener is PLAINTEXT, so requests arriving on it carry the principal <code>User:ANONYMOUS</code>; with
        <code> allow.everyone.if.no.acl.found=false</code> the authorizer would refuse them. Listing it in <code>super.users</code> keeps a lab node working.
        In production, put the controller listener on SASL or mTLS too and list that principal instead.
      </Callout>

      <h2>Encryption with TLS</h2>
      <p>TLS needs one thing on the broker — a key and a certificate — and one thing on every client — a way to trust that certificate.</p>
      <ul>
        <li><strong>Keystore</strong> (broker): its private key plus its certificate chain.</li>
        <li><strong>Truststore</strong> (client): the certificate authorities it trusts. Without one, Java uses the JDK’s public CAs.</li>
      </ul>
      <p>
        Kafka reads JKS, PKCS12 or <strong>PEM</strong> files. The recording used PEM and a private CA made with <code>openssl</code>:
      </p>
      <Terminal title="recorded: a private CA and a broker certificate" steps={S.tls.map((t) => ({ label: t.label, cmd: t.cmd, out: t.out || undefined }))} />
      <p>
        The broker’s listener uses <code>ssl.keystore.type=PEM</code> and <code>ssl.keystore.location</code> pointing at <em>broker-chain.pem</em>.
        The certificate’s subject alternative name must match the host name the client connects to (here <code>localhost</code>), or the client
        rejects it — host name checking is on by default (<code>ssl.endpoint.identification.algorithm=https</code>).
      </p>
      <Terminal
        title="recorded: the same broker, with and without trusting the CA"
        steps={[step('TLS: a client that does not trust'), step('TLS: a client with the CA')]}
      />
      <CodeBlock title="tls.properties (client)" language="properties" code={S.files['tls.properties']} />
      <p>What the client and the broker agreed on, seen with openssl:</p>
      <Terminal title="recorded" steps={[S.handshake]} />

      <h3>Mutual TLS (mTLS)</h3>
      <p>
        With <code>ssl.client.auth=required</code> on an SSL listener, the broker also asks the <em>client</em> for a certificate signed by a CA in the broker’s
        truststore. The certificate then is the identity: the principal is the subject, e.g. <code>User:CN=app,O=example</code>, which{' '}
        <code>ssl.principal.mapping.rules</code> can shorten to <code>User:app</code>. No passwords exist at all, but each client needs a key pair and
        certificates must be rotated before they expire. <em>Not recorded.</em>
      </p>

      <h2>Authentication with SASL</h2>
      <p>SASL is a framework: the listener says “SASL”, and <code>sasl.enabled.mechanisms</code> says which ways of proving identity it accepts.</p>
      <Table
        head={['Mechanism', 'Where the users live', 'On the wire', 'Change users']}
        rows={[
          ['PLAIN', 'the broker’s JAAS config (user_alice="…") or a custom callback', 'the password itself — only with TLS', 'edit config, restart (static)'],
          ['SCRAM-SHA-256 / 512', 'cluster metadata, salted and hashed', 'a challenge–response proof, never the password', 'kafka-configs at runtime'],
          ['OAUTHBEARER', 'an external identity provider', 'a signed token', 'in the provider'],
          ['GSSAPI', 'Kerberos', 'Kerberos tickets', 'in Kerberos'],
        ]}
      />
      <p>
        In KRaft there is a chicken-and-egg problem: the broker needs a SCRAM user to talk to itself before any tool can create users. The answer is to
        add the first user while formatting the storage:
      </p>
      <Terminal title="recorded: bootstrap the first SCRAM user" steps={[step('a cluster id'), step('format the storage')]} />
      <p>Once the broker runs, the admin creates further users without a restart:</p>
      <Terminal
        title="recorded: what clients see"
        steps={[step('a client with no credentials'), step('a wrong password'), step('the admin (a super user)'), step('the admin creates'), step('users are listed')]}
      />
      <p>
        Note the first one: a PLAINTEXT client against a SASL listener gets no clear “not allowed” — the handshake never makes sense to it, so it just
        times out. A wrong password, on the other hand, is reported plainly.
      </p>
      <CodeBlock title="app.properties (client)" language="properties" code={S.files['app.properties']} />
      <p>
        These three properties are all a Java client needs; with TLS add <code>security.protocol=SASL_SSL</code> and the truststore lines. Other
        clients (librdkafka, Go, Python) use the same names: <code>security.protocol</code>, <code>sasl.mechanism</code>, and a user name and password.
      </p>
      <AuthFlow />

      <h2>Authorisation with ACLs</h2>
      <p>Once a client is known, the authorizer decides per request what it may do.</p>
      <p>
        In KRaft the authorizer is <code>org.apache.kafka.metadata.authorizer.StandardAuthorizer</code>. ACLs are stored in the cluster metadata log, so
        every broker and controller has them in memory. With <code>allow.everyone.if.no.acl.found=false</code> the rule is <strong>deny by default</strong>:
        no matching ALLOW, no access. A DENY always wins over an ALLOW.
      </p>
      <Predict
        question={
          <p>
            User <code>app</code> may WRITE to topic <code>orders</code> and READ it. It starts a console consumer with <code>--group billing</code>. What
            happens?
          </p>
        }
        options={['It reads the records', 'It fails: it is not allowed to use the group billing', 'It reads, but cannot commit offsets']}
        answer={1}
        explanation="A group consumer must join its group before it fetches anything, and joining needs READ on the group. The recording shows the group error even before the topic one."
      />
      <Terminal
        title="recorded: the producer, denied and then allowed"
        steps={[step('app is authenticated'), step('allow app to WRITE'), { ...step('the same producer'), out: '> order-1\n> order-2' }]}
      />
      <Terminal
        title="recorded: the consumer needs two ACLs"
        steps={[step('consuming with a group'), step('allow app to READ the group'), step('now denied on the topic'), step('allow app to READ the topic'), step('with both READ ACLs'), step('every ACL on the cluster')]}
      />
      <SecurityAclGrid />
      <p>Useful shortcuts and options of <code>kafka-acls.sh</code>:</p>
      <Table
        head={['Option', 'Effect']}
        rows={[
          [<code key="p">--producer --topic T</code>, 'WRITE, DESCRIBE and CREATE on topic T'],
          [<code key="c">--consumer --topic T --group G</code>, 'READ and DESCRIBE on T, READ on G'],
          [<code key="r">--resource-pattern-type prefixed</code>, 'the rule matches every name starting with the given text (orders. → orders.eu, orders.us…)'],
          [<code key="d">--deny-principal</code>, 'an explicit DENY — beats any ALLOW'],
          [<code key="h">--allow-host 10.0.0.5</code>, 'only from that address (default: every host, *)'],
        ]}
      />
      <p>
        The broker writes failed authentications to its log (and with the authorizer logger at INFO or DEBUG, every decision). Recorded from{' '}
        <em>server.log</em> during the run above:
      </p>
      <CodeBlock title="server.log (recorded, two lines)" code={S.brokerLog.join('\n')} />

      <h2>Design rules</h2>
      <ul>
        <li>Use <strong>SASL_SSL</strong> or <strong>SSL with mTLS</strong> for every listener that leaves one machine — including inter-broker and controller listeners.</li>
        <li>Prefer <strong>SCRAM</strong> (or OAUTHBEARER) to PLAIN: users can be added and rotated without restarts, and passwords are never stored in clear.</li>
        <li>One principal per application, not one shared “kafka” user — ACLs and audit logs then say which application did what.</li>
        <li>Deny by default; grant the smallest set: WRITE for producers, READ on topic and group for consumers. Use prefixed ACLs for families of topics.</li>
        <li>Keep <code>super.users</code> to the admin and the brokers themselves.</li>
        <li>Keep secrets out of files checked into git: pass <code>sasl.jaas.config</code> from a secret store or environment, and rotate certificates before expiry.</li>
      </ul>

      <Recap
        points={[
          'Encryption (TLS), authentication (SASL or mTLS) and authorisation (ACLs) are three separate settings; each listener picks one of four protocols.',
          'SCRAM users live in the cluster metadata; in KRaft the first one is added with kafka-storage format --add-scram, the rest with kafka-configs.',
          'With deny-by-default, a producer needs WRITE on the topic, a group consumer needs READ on the topic and READ on the group.',
          'Errors tell you which part failed: timeouts or SSL handshake (protocol/TLS), SaslAuthenticationException (credentials), Topic/GroupAuthorizationException (ACLs).',
        ]}
      />
    </>
  )
}
