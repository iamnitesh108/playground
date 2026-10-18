import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, Tabs, TermList } from '@/shared/ui'
import { Flow, Proportion, StatTiles, Timeline } from '@/shared/figures'
import { CliSession, LogLines } from '../components'
import { K8S } from '../data/kubernetes'
import { MANIFESTS } from '../data/kubernetesManifests'
import { Highlighted } from '@/shared/code'

const MAXMEMORY_MB = Number(K8S.config[0].split(' ')[1]) / 1024 / 1024
const LOAD_S = K8S.loading.readyAfterSeconds
const probeLine = (pod: string, kind: string, r: { exit: number; out: string }) => ({
  shell: true,
  cmd: `kubectl exec ${pod} -- sh /etc/redis/probe.sh ${kind}; echo "exit $?"`,
  out: `${r.out ? `${r.out}\n` : ''}exit ${r.exit}`,
})

export default function Kubernetes() {
  return (
    <>
      <LessonGoals
        goals={[
          'run Redis as a StatefulSet with a headless Service and one PersistentVolumeClaim per pod',
          'keep configuration in a ConfigMap and users in a Secret',
          'leave memory headroom between maxmemory and the container limit — and know what OOMKilled means',
          'write liveness and readiness probes that do not restart a server that is loading',
          'choose between Sentinel and Cluster in pods, protect them with a PodDisruptionBudget, and back them up',
        ]}
        before="Replication and Sentinel, Redis Cluster, and Securing Redis"
      />
      <Callout tone="note" title="What was recorded here">
        No Kubernetes cluster was used. The manifests below were validated against the Kubernetes {`1.34`} schemas with kubeconform, and their
        files — redis.conf, the scripts, the ACL file — were mounted into containers of the same image ({K8S.image}) the way a pod mounts them.
        Everything shown as “recorded” ran there; <code>kubectl</code> lines are the commands to adapt.
      </Callout>
      <CodeBlock title="kubeconform -strict on the five manifest files (recorded)" code={K8S.kubeconform?.out ?? ''} />
      <p>The skipped resource is the VolumeSnapshot: it is a CustomResource, so kubeconform has no built-in schema for it.</p>

      <h2>Why a StatefulSet</h2>
      <p>A Redis pod is not interchangeable: it has its own data and other pods must find it by name.</p>
      <p>
        A Deployment gives pods random names and shares or drops their volumes. A <strong>StatefulSet</strong> gives each pod a fixed ordinal —{' '}
        <code>redis-0</code>, <code>redis-1</code>, <code>redis-2</code> — its own volume that follows it to any node, and starts them in order.
      </p>
      <TermList
        items={[
          { term: 'StatefulSet', definition: 'A controller for pods with a stable name, stable storage and ordered start and stop.' },
          { term: 'headless Service', definition: <>A Service with <code>clusterIP: None</code>: no load balancing, but a DNS name per pod, <code>redis-0.redis-headless.&lt;namespace&gt;.svc.cluster.local</code>.</> },
          { term: 'PersistentVolumeClaim (PVC)', definition: 'A request for storage. volumeClaimTemplates make one per pod, named data-redis-0, data-redis-1, …' },
          { term: 'ConfigMap / Secret', definition: 'Files or values mounted into pods. Secrets are for passwords; they are base64-encoded, not encrypted, unless the cluster encrypts them at rest.' },
          { term: 'probe', definition: 'A check the kubelet runs in the pod. Liveness failing restarts the container; readiness failing removes it from Services.' },
        ]}
      />
      <Flow
        title="The pieces of a Redis StatefulSet"
        cols={4}
        rows={3}
        rowHeight={88}
        nodes={[
          { id: 'app', label: 'application pods', sub: 'redis-client=true', col: 0, row: 0, hue: 1, shape: 'actor' },
          { id: 'svc', label: 'redis-primary', sub: 'Service → redis-0', col: 1, row: 0, hue: 7 },
          { id: 'hl', label: 'redis-headless', sub: 'DNS per pod', col: 1, row: 2, hue: 7 },
          { id: 'r0', label: 'redis-0', sub: 'primary', col: 2, row: 0, hue: 2 },
          { id: 'r1', label: 'redis-1', sub: 'replica', col: 2, row: 1, hue: 5 },
          { id: 'r2', label: 'redis-2', sub: 'replica', col: 2, row: 2, hue: 5 },
          { id: 'p0', label: 'data-redis-0', sub: 'PVC 10Gi', col: 3, row: 0, hue: 4, shape: 'store' },
          { id: 'p1', label: 'data-redis-1', sub: 'PVC 10Gi', col: 3, row: 1, hue: 4, shape: 'store' },
          { id: 'p2', label: 'data-redis-2', sub: 'PVC 10Gi', col: 3, row: 2, hue: 4, shape: 'store' },
        ]}
        edges={[
          { from: 'app', to: 'svc', label: 'writes', hue: 1, flow: true },
          { from: 'svc', to: 'r0', hue: 7 },
          { from: 'r0', to: 'r1', hue: 5, flow: true },
          { from: 'hl', to: 'r1', hue: 7, dashed: true },
          { from: 'hl', to: 'r2', hue: 7, dashed: true },
          { from: 'r0', to: 'p0', hue: 4 },
          { from: 'r1', to: 'p1', hue: 4 },
          { from: 'r2', to: 'p2', hue: 4 },
        ]}
        caption="Both replicas copy redis-0’s data (one replication arrow drawn). The headless Service (dashed) gives every pod its own DNS name."
      />
      <Tabs
        items={[
          { label: 'StatefulSet', content: <CodeBlock title="statefulset.yaml — the StatefulSet (validated)" language="yaml" code={MANIFESTS.statefulset} /> },
          { label: 'Services', content: <CodeBlock title="statefulset.yaml — the two Services (validated)" language="yaml" code={`${MANIFESTS.headless}\n---\n${MANIFESTS.primary}`} /> },
        ]}
      />
      <Callout tone="tip" title="publishNotReadyAddresses">
        A replica is not ready until it has synced — but it must resolve <code>redis-0</code>’s name to sync. With{' '}
        <code>publishNotReadyAddresses: true</code> the headless Service publishes DNS names for pods that are not ready yet.
      </Callout>

      <h2>Configuration in a ConfigMap, users in a Secret</h2>
      <p>The image stays stock; everything specific to your installation is mounted as files.</p>
      <Tabs
        items={[
          { label: 'ConfigMap', content: <CodeBlock title="configmap.yaml (validated; its files were mounted and ran)" language="yaml" code={MANIFESTS.configmap} /> },
          { label: 'Secret', content: <CodeBlock title="secret.yaml (validated; example values)" language="yaml" code={MANIFESTS.secret} /> },
        ]}
      />
      <p>
        <code>start.sh</code> decides the role from the pod’s ordinal: <code>redis-0</code> is the primary, the rest call <code>--replicaof</code>{' '}
        with <code>redis-0</code>’s DNS name. Each replica announces its own DNS name instead of its pod IP, which changes on every restart. With
        those files mounted into two containers named like the pods:
      </p>
      <Table
        head={['On', 'INFO replication (recorded)']}
        rows={[
          [<code key="c0">redis-0</code>, <pre key="c1"><Highlighted language="output" code={K8S.primaryReplication.join('\n')} /></pre>],
          [<code key="c2">redis-1</code>, <pre key="c3"><Highlighted language="output" code={K8S.replicaReplication.join('\n')} /></pre>],
        ]}
      />
      <CliSession
        title="the users from the Secret at work, on redis-0 (recorded)"
        prompt="$"
        steps={[
          { shell: true, cmd: 'redis-cli PING                       # the default user is off', out: K8S.defaultUser },
          ...K8S.appUser.map((s) => ({ shell: true, cmd: `redis-cli --user app ${s.cmd}`, out: s.out })),
          { shell: true, cmd: 'redis-cli -h redis-1.redis-headless --user app GET orders:42   # read from the replica', out: K8S.replicaRead },
        ]}
      />
      <Callout tone="warn" title="exec, or Redis never hears SIGTERM">
        <code>start.sh</code> ends with <code>exec redis-server</code>. Without <code>exec</code>, the shell stays process 1, the kubelet’s SIGTERM goes
        to the shell, and after the grace period Redis is killed without saving. With it, a stop looked like this:
      </Callout>
      <LogLines title="redis-0 receiving SIGTERM (recorded)" lines={K8S.shutdownLog} highlight={/SIGTERM|fsync|Saving/} />

      <h2>Memory: limits, maxmemory and OOMKilled</h2>
      <p>The container’s memory limit is a hard wall; maxmemory is only a target for your data.</p>
      <p>
        When a container goes over its limit, the kernel kills it: the pod shows <code>OOMKilled</code>, exit code 137, and restarts — loading its
        whole dataset again. Redis uses memory that <code>maxmemory</code> does not count, so the limit must be well above it.
      </p>
      <Predict
        question={
          <p>
            A pod has <code>limits.memory: 1Gi</code> and Redis has <code>maxmemory 1gb</code>. The dataset reaches 1 GB and Redis starts a background
            save while clients keep writing. What happens?
          </p>
        }
        options={['Redis evicts keys and keeps running', 'The save waits until memory is freed', 'The pod is OOMKilled and restarts']}
        answer={2}
        explanation="The forked child shares memory with the parent, but every page the parent changes during the save is copied — and the copies count against the same container limit. Add client buffers and fragmentation, and the kernel kills the container. maxmemory never sees those bytes."
      />
      <Proportion
        title="Where a 1Gi limit goes (schematic; maxmemory from the recording)"
        unit=" MiB"
        parts={[
          { label: 'maxmemory: your data', value: Math.round(MAXMEMORY_MB), hue: 3 },
          { label: 'fork copy-on-write', value: 200, hue: 4, display: 'up to ~200' },
          { label: 'client and replica buffers', value: 100, hue: 7, display: '~100' },
          { label: 'fragmentation, Lua, overhead', value: 1024 - Math.round(MAXMEMORY_MB) - 300, hue: 8, display: `~${1024 - Math.round(MAXMEMORY_MB) - 300}` },
        ]}
      />
      <Table
        head={['Outside maxmemory', 'How big', 'See']}
        rows={[
          ['Copy-on-write during BGSAVE / AOF rewrite', 'Up to the pages changed during the save — worst case the whole dataset', <code key="c4">rdb_last_cow_size</code>],
          ['Replica output buffers', <span key="c5">Up to <code>client-output-buffer-limit replica 256mb</code> per replica during a sync</span>, <code key="c6">CLIENT LIST</code>],
          ['Client query and output buffers', 'Big replies, slow Pub/Sub subscribers', <code key="c7">mem_clients_normal</code>],
          ['Replication backlog', <code key="c8">repl-backlog-size</code>, <code key="c9">mem_replication_backlog</code>],
          ['Fragmentation', 'Often 10–50 % on top of the data', <code key="c10">mem_fragmentation_ratio</code>],
        ]}
      />
      <StatTiles
        title="The numbers in this lesson’s StatefulSet"
        stats={[
          { label: 'container limit', value: '1Gi', sub: 'requests = limits: Guaranteed QoS for memory', hue: 7 },
          { label: 'maxmemory (recorded)', value: `${MAXMEMORY_MB} MiB`, sub: `CONFIG GET → ${K8S.config[0].split(' ')[1]}`, hue: 3 },
          { label: 'headroom', value: `${Math.round((1 - MAXMEMORY_MB / 1024) * 100)} %`, sub: 'for forks, buffers, fragmentation', hue: 6 },
        ]}
      />
      <Callout tone="tip" title="CPU: request, but do not limit">
        A CPU limit throttles the whole container for the rest of each 100 ms period once it is used up — a latency spike for every client.
        Give Redis a CPU request so it is scheduled fairly, and no CPU limit.
      </Callout>

      <h2>Liveness and readiness probes</h2>
      <p>A probe must tell “Redis is dead” apart from “Redis is busy loading its data”.</p>
      <p>
        The obvious probe, <code>redis-cli ping</code>, has two problems. redis-cli exits with 0 even when the reply is an error, so it never fails
        while the process answers. And if you fix that by requiring <code>PONG</code> in a liveness probe, a server that takes longer to load than
        the probe allows is restarted — and starts loading again, forever. Recorded while redis-0 loaded {K8S.loading.keys.toLocaleString()} keys:
      </p>
      <CliSession
        title="during loading (recorded)"
        prompt="$"
        steps={[
          { shell: true, cmd: 'redis-cli --user probe PING; echo "exit code $?"', out: K8S.loading.naive.replace(/\n\n/, '\n') },
          probeLine('redis-0', 'live', K8S.loading.live),
          probeLine('redis-0', 'ready', K8S.loading.ready),
        ]}
      />
      <Timeline
        title={`One pod restarting with ${K8S.loading.keys.toLocaleString()} keys to load (recorded, loading slowed down on purpose)`}
        unit=" s"
        end={Math.ceil(LOAD_S + 4)}
        lanes={[
          { id: 'redis', label: 'redis-0' },
          { id: 'live', label: 'liveness' },
          { id: 'ready', label: 'readiness' },
        ]}
        segments={[
          { lane: 'redis', from: 0, to: LOAD_S, label: 'LOADING', hue: 4 },
          { lane: 'redis', from: LOAD_S, to: Math.ceil(LOAD_S + 4), label: 'serving', hue: 6 },
          { lane: 'live', from: 0, to: Math.ceil(LOAD_S + 4), label: 'passes: LOADING is alive', hue: 6 },
          { lane: 'ready', from: 0, to: LOAD_S, hue: 8, striped: true },
          { lane: 'ready', from: LOAD_S, to: Math.ceil(LOAD_S + 4), label: 'passes', hue: 6 },
        ]}
        events={[
          { lane: 'ready', at: 0, label: 'fails: kept out of the Service', hue: 8 },
          { lane: 'ready', at: LOAD_S, label: `ready after ${LOAD_S} s`, hue: 6 },
        ]}
      />
      <p>
        The loading was slowed with <code>key-load-delay</code> so it could be watched; a real multi-gigabyte dataset can take minutes. A replica
        is also kept out of the Service until it is linked to its primary:
      </p>
      <CliSession
        title="probes on the running pair (recorded)"
        prompt="$"
        steps={[
          probeLine('redis-1', 'ready', K8S.probesBeforeSync['redis-1'].ready),
          { note: '(a moment later, after the first sync)' },
          probeLine('redis-0', 'live', K8S.probes['redis-0'].live),
          probeLine('redis-0', 'ready', K8S.probes['redis-0'].ready),
          probeLine('redis-1', 'ready', K8S.probes['redis-1'].ready),
        ]}
      />
      <Table
        head={['Probe', 'Checks', 'On failure', 'Tune']}
        rows={[
          ['liveness', <span key="c11">the process answers at all (<code>PONG</code>, <code>LOADING</code>, <code>MASTERDOWN</code>)</span>, 'container restarted', 'generous: 3 × 10 s, 5 s timeout'],
          ['readiness', <span key="c12"><code>PONG</code>, and for a replica <code>master_link_status:up</code></span>, 'removed from Services, not restarted', 'quick: 5 s period'],
          ['startup (optional)', 'same as liveness', 'holds back the other probes while it runs', 'for very slow starts'],
        ]}
      />

      <h2>Sentinel or Cluster in pods</h2>
      <p>Both need to tell clients where a node is, and in Kubernetes pod IPs are not stable — so use DNS names.</p>
      <p>
        The StatefulSet above has replicas but no automatic failover: if <code>redis-0</code> is lost, someone must promote a replica. For that,
        add Sentinel, or shard with Cluster. Both recorded locally with names instead of IPs:
      </p>
      <CodeBlock title="sentinel.conf used for the recording (local, with localhost standing in for a pod name)" code={K8S.sentinel.conf.join('\n')} />
      <CliSession title="redis-cli -p 26379 SENTINEL GET-MASTER-ADDR-BY-NAME orders (recorded)" steps={[{ cmd: 'SENTINEL GET-MASTER-ADDR-BY-NAME orders', out: K8S.sentinel.addr }]} prompt="127.0.0.1:26379>" />
      <CliSession
        title="a node started with --cluster-announce-hostname and --cluster-preferred-endpoint-type hostname (recorded)"
        steps={[{ cmd: 'CLUSTER SLOTS', out: K8S.clusterSlots }]}
      />
      <Table
        head={['', 'Sentinel', 'Cluster']}
        rows={[
          ['Shape in Kubernetes', 'StatefulSet of Redis + 3 Sentinel pods (or a sidecar in each)', 'StatefulSet of 6+ pods: primaries and replicas'],
          ['Settings for DNS names', <span key="c13"><code>replica-announce-ip &lt;pod DNS&gt;</code>, <code>sentinel resolve-hostnames yes</code>, <code>sentinel announce-hostnames yes</code></span>, <span key="c14"><code>cluster-announce-hostname</code>, <code>cluster-preferred-endpoint-type hostname</code></span>],
          ['After a pod restart', 'Same name, new IP — fine with hostnames', <span key="c15">Same name; <code>nodes.conf</code> must be on the PVC so the node keeps its id</span>],
          ['Clients', 'Sentinel-aware client asks for the primary', 'Cluster-aware client follows MOVED / ASK'],
          ['From outside Kubernetes', 'Hard: the announced names must resolve there too', <span key="c16">Hard: needs <code>cluster-announce-*</code> per node pointing at reachable addresses</span>],
        ]}
      />
      <Callout tone="warn" title="Do not put a load-balancing Service in front of a Cluster">
        A Cluster client must reach every node by the address the node announces. A single ClusterIP that spreads connections over all nodes just
        produces <code>MOVED</code> redirections to addresses the client may not reach.
      </Callout>

      <h2>PodDisruptionBudget and anti-affinity</h2>
      <p>Kubernetes moves pods on purpose — drains, upgrades, autoscaling — and these two settings stop it from taking out all of Redis at once.</p>
      <CodeBlock title="statefulset.yaml — the PodDisruptionBudget (validated)" language="yaml" code={MANIFESTS.pdb} />
      <Table
        head={['Setting', 'Protects against']}
        rows={[
          [<span key="c17">PodDisruptionBudget <code>maxUnavailable: 1</code></span>, <span key="c18">A <code>kubectl drain</code> evicting two Redis pods at the same time. Involuntary failures (a node dies) are not covered.</span>],
          [<span key="c19">podAntiAffinity on <code>kubernetes.io/hostname</code></span>, 'Primary and replicas on one node, lost together. “preferred” still schedules on a small cluster; “required” leaves pods Pending.'],
          [<span key="c20">topology zones (<code>topology.kubernetes.io/zone</code>)</span>, 'A whole zone going down — but a PVC is usually tied to its zone, so the pod can only restart there.'],
          [<code key="c21">terminationGracePeriodSeconds: 60</code>, 'A stop that kills Redis before it has fsynced the AOF or written its final snapshot.'],
        ]}
      />

      <h2>Backups from a PVC</h2>
      <p>A PersistentVolume survives a pod restart, not a deleted namespace, a broken disk or a bad <code>FLUSHALL</code> — that needs a copy elsewhere.</p>
      <CodeBlock title="backup.yaml — nightly CronJob (validated)" language="yaml" code={MANIFESTS.cronjob} />
      <p>
        <code>redis-cli --rdb</code> asks the server for a snapshot over the replication protocol and writes it to a file, so it needs only the{' '}
        <code>backup</code> user’s <code>+sync</code> rights. The same command, run against <code>redis-1</code>:
      </p>
      <CodeBlock title="ls -l /backup after the job (recorded)" code={K8S.backup.out} />
      <CodeBlock title="backup.yaml — or a CSI VolumeSnapshot (schema not checked: CustomResource)" language="yaml" code={MANIFESTS.snapshot} />
      <Table
        head={['', 'redis-cli --rdb', 'VolumeSnapshot']}
        rows={[
          ['What you get', 'A consistent RDB file', 'A crash-consistent copy of the whole volume (AOF + RDB)'],
          ['Needs', 'A user with +sync, a place to put the file', 'A CSI driver with snapshots'],
          ['Cost on Redis', 'A fork on the source, like BGSAVE', 'None in Redis; storage-dependent'],
          ['Restore', <span key="c22">Empty data dir, file as <code>dump.rdb</code>, first start with <code>appendonly no</code> (see below)</span>, <span key="c23">New PVC with <code>dataSource</code> pointing at the snapshot</span>],
        ]}
      />
      <Callout tone="warn" title="Restoring an RDB when AOF is on">
        Checked on Redis 8.8: with <code>appendonly yes</code> and no AOF files, Redis creates a new, empty AOF on start and ignores{' '}
        <code>dump.rdb</code> — the restore silently loads nothing. Start once with <code>appendonly no</code>, check the keys, then run{' '}
        <code>CONFIG SET appendonly yes</code>, which writes a fresh AOF from memory, and turn it back on in the config.
      </Callout>
      <Callout tone="tip">Copy backups out of the cluster, and practise a restore. A backup nobody has restored is a hope.</Callout>

      <h2>Operators</h2>
      <p>An operator is a controller you install that runs Redis for you from a short custom resource.</p>
      <p>
        Instead of the files in this lesson, you write something like “three nodes, Sentinel, 1Gi each” and the operator creates the StatefulSets,
        Services, Secrets and probes, and handles failover and upgrades. Several open-source and commercial operators exist.
      </p>
      <Table
        head={['Use an operator when', 'Write the manifests yourself when']}
        rows={[
          ['You run many Redis instances or clusters', 'You run one or two, with simple needs'],
          ['You want failover, scaling and upgrades automated', 'You want to understand and control every setting'],
          ['The operator is actively maintained and supports your Redis version', 'The operator lags behind the Redis version you need'],
        ]}
      />
      <p>Either way, the checks in this lesson stay yours: headroom, probes, disruption budgets, backups and security.</p>

      <h2>Checklist</h2>
      <p>Before Redis on Kubernetes holds data you need:</p>
      <Table
        head={['Area', 'Do']}
        rows={[
          ['Workload', 'StatefulSet + headless Service + volumeClaimTemplates; persistence on'],
          ['Process', <span key="c24"><code>exec redis-server</code>, non-root user, grace period long enough to save</span>],
          ['Memory', <span key="c25">requests = limits; <code>maxmemory</code> about 60–75 % of the limit; alert on OOMKilled</span>],
          ['CPU', 'A request, no limit'],
          ['Probes', 'Liveness tolerates LOADING; readiness wants PONG and a linked replica; check the reply text'],
          ['High availability', 'Sentinel or Cluster with hostnames; PDB maxUnavailable 1; anti-affinity'],
          ['Security', 'Secret-mounted aclfile with hashes, default user off, NetworkPolicy, TLS where needed'],
          ['Backups', 'Scheduled, copied out of the cluster, restore tested'],
        ]}
      />

      <Recap
        points={[
          'A StatefulSet gives Redis pods stable names (via a headless Service) and their own PVCs.',
          'Configuration comes from a ConfigMap, users and passwords from a Secret; the image stays stock.',
          <>The memory limit must leave room for forks, buffers and fragmentation above <code>maxmemory</code>, or the pod is OOMKilled.</>,
          <>redis-cli exits 0 on error replies; liveness must accept <code>LOADING</code>, readiness must not.</>,
          'Sentinel and Cluster need DNS names, not pod IPs; a PDB and anti-affinity keep disruptions to one pod.',
          'Back up out of the volume — redis-cli --rdb or snapshots — and test the restore.',
        ]}
      />
    </>
  )
}
