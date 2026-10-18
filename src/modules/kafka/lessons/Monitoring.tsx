import { Flow, StatTiles, type Hue, type Stat } from '@/shared/figures'
import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Terminal } from '../components'
import { MonitoringSeriesChart } from '../components/MonitoringSeriesChart'
import { OPS } from '../data/ops'

const M = OPS.monitoring
/** The producer’s own end-to-end average, from the perf tool summary line. */
const producerAvgMs = M.perf.out.match(/([\d.]+) ms avg latency/)?.[1] ?? "?"

/** The `object:attribute=value` lines kafka-jmx.sh prints in properties format. */
function jmxValues(out: string) {
  const values = new Map<string, number>()
  for (const line of out.split('\n')) {
    const at = line.lastIndexOf('=')
    if (at > 0 && line.includes(':')) values.set(line.slice(0, at), Number(line.slice(at + 1)))
  }
  return (needle: string) => {
    for (const [k, v] of values) if (k.includes(needle)) return v
    throw new Error(`no recorded JMX value for ${needle}`)
  }
}

const health = jmxValues(M.healthAfter.out)
const produce = jmxValues(M.produceTimes.out)
const fetch = jmxValues(M.fetchTimes.out)
const flush = jmxValues(M.flush.out)

const metric = (list: readonly { name: string; value: number | null }[], name: string) => list.find((m) => m.name === name)?.value ?? 0
const ms = (v: number) => (v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(0))

const HEALTH: readonly { label: string; needle: string; sub: string; hue: Hue }[] = [
  { label: 'UnderReplicatedPartitions', needle: 'UnderReplicatedPartitions', sub: 'alert if > 0 for minutes', hue: 3 },
  { label: 'UnderMinIsrPartitionCount', needle: 'UnderMinIsrPartitionCount', sub: 'acks=all writes fail: page', hue: 3 },
  { label: 'OfflinePartitionsCount', needle: 'OfflinePartitionsCount', sub: 'no leader: page', hue: 5 },
  { label: 'ActiveControllerCount', needle: 'ActiveControllerCount', sub: 'sum over controllers must be 1', hue: 5 },
]

function RequestPath() {
  const t = (name: string) => `${ms(produce(`name=${name},request=Produce:Mean`))} ms`
  return (
    <Flow
      title="Where a produce request spends its time — and the metric for each stage"
      cols={5}
      rows={2}
      rowHeight={96}
      nodes={[
        { id: 'client', label: 'producer', sub: 'client side', col: 0, row: 0, hue: 7, shape: 'actor' },
        { id: 'net', label: 'network thread', sub: 'reads the socket', col: 1, row: 0, hue: 3 },
        { id: 'queue', label: 'request queue', sub: `queue ${t('RequestQueueTimeMs')}`, col: 2, row: 0, hue: 3, shape: 'queue' },
        { id: 'handler', label: 'handler thread', sub: `local ${t('LocalTimeMs')}`, col: 3, row: 0, hue: 3 },
        { id: 'log', label: 'partition log', sub: 'page cache', col: 4, row: 0, hue: 3, shape: 'log' },
        { id: 'purg', label: 'purgatory', sub: `remote ${t('RemoteTimeMs')}`, col: 3, row: 1, hue: 5 },
        { id: 'resp', label: 'response queue', sub: `send ${t('ResponseSendTimeMs')}`, col: 1, row: 1, span: 2, hue: 3, shape: 'queue' },
      ]}
      edges={[
        { from: 'client', to: 'net', hue: 7, flow: true },
        { from: 'net', to: 'queue', hue: 3 },
        { from: 'queue', to: 'handler', hue: 3 },
        { from: 'handler', to: 'log', hue: 3, flow: true },
        { from: 'handler', to: 'purg', hue: 5, dashed: true },
        { from: 'purg', to: 'resp', hue: 5 },
        { from: 'resp', to: 'client', hue: 3, dashed: true },
      ]}
      steps={[
        {
          title: 'Network thread',
          body: <p>The producer sends a batch. A network (processor) thread reads the request from the socket and puts it on the shared request queue. <code>NetworkProcessorAvgIdlePercent</code> says how idle these threads are.</p>,
          active: ['client', 'net', 'client>net', 'net>queue'],
        },
        {
          title: 'Request queue',
          body: <p>The request waits for a free I/O (handler) thread. <code>RequestQueueTimeMs</code> grows when all handlers are busy — the first sign of an overloaded broker.</p>,
          active: ['queue', 'queue>handler'],
        },
        {
          title: 'Handler thread',
          body: <p>A handler validates the batch and appends it to the log (into the page cache, not to disk). That is <code>LocalTimeMs</code>; <code>RequestHandlerAvgIdlePercent</code> says how idle the handlers are.</p>,
          active: ['handler', 'log', 'handler>log'],
        },
        {
          title: 'Purgatory',
          body: <p>With <code>acks=all</code> the request waits in purgatory until the followers in the ISR have the batch: <code>RemoteTimeMs</code>. On this one-broker lab it is 0 — there are no followers. On a real cluster it is usually the largest part.</p>,
          active: ['purg', 'handler>purg'],
        },
        {
          title: 'Response',
          body: <p>The response goes back through the response queue and a network thread (<code>ResponseQueueTimeMs</code>, <code>ResponseSendTimeMs</code>). <code>TotalTimeMs</code> is the sum of every stage — recorded mean {ms(produce('name=TotalTimeMs,request=Produce:Mean'))} ms, 99th percentile {ms(produce('name=TotalTimeMs,request=Produce:99thPercentile'))} ms.</p>,
          active: ['purg', 'resp', 'client', 'purg>resp', 'resp>client'],
        },
      ]}
    />
  )
}

export default function Monitoring() {
  const lagPoints = M.lag.series.map((p) => ({ t: p.t, v: p.lag }))
  const maxLag = Math.max(...lagPoints.map((p) => p.v))
  const busy = M.load.filter((p) => p.msgsPerSec > 0)
  const peak = Math.max(...M.load.map((p) => p.msgsPerSec))
  const minIdle = Math.min(...M.load.map((p) => p.handlerIdlePct))
  const pm = M.producerMetrics
  const cm = M.consumerMetrics
  const producerStats: Stat[] = [
    { label: 'record-error-rate', value: metric(pm, 'record-error-rate'), sub: 'records/s that failed — alert on > 0', hue: 8 },
    { label: 'record-retry-rate', value: metric(pm, 'record-retry-rate'), sub: 'retries/s — rising means a struggling broker', hue: 7 },
    { label: 'request-latency-avg', value: `${metric(pm, 'request-latency-avg')} ms`, sub: `max ${metric(pm, 'request-latency-max')} ms`, hue: 7 },
    { label: 'batch-size-avg', value: `${Math.round(metric(pm, 'batch-size-avg')).toLocaleString()} B`, sub: 'of batch.size 16,384 B: nearly full', hue: 7, bar: { value: metric(pm, 'batch-size-avg'), max: 16384 } },
    { label: 'records-per-request-avg', value: Math.round(metric(pm, 'records-per-request-avg')), sub: 'records in one produce request', hue: 7 },
    { label: 'bufferpool-wait-ratio', value: metric(pm, 'bufferpool-wait-ratio'), sub: 'share of time send() blocked on a full buffer', hue: 7 },
  ]
  const consumerStats: Stat[] = [
    { label: 'records-lag-max', value: metric(cm, 'records-lag-max'), sub: 'records behind, worst partition', hue: 1 },
    { label: 'fetch-latency-avg', value: `${metric(cm, 'fetch-latency-avg')} ms`, sub: 'one fetch request, round trip', hue: 1 },
    { label: 'fetch-size-avg', value: `${(metric(cm, 'fetch-size-avg') / 1e6).toFixed(1)} MB`, sub: 'bytes returned per fetch', hue: 1 },
    { label: 'rebalance-total', value: metric(cm, 'rebalance-total'), sub: `took ${metric(cm, 'rebalance-latency-avg')} ms`, hue: 5 },
    { label: 'commit-rate', value: metric(cm, 'commit-rate'), sub: 'this tool does not commit — an app with a stuck commit looks the same', hue: 1 },
    { label: 'last-poll-seconds-ago', value: metric(cm, 'last-poll-seconds-ago'), sub: 'grows when processing hangs', hue: 1 },
  ]

  return (
    <>
      <LessonGoals
        goals={[
          'know the handful of broker metrics that say whether a cluster is healthy',
          'read producer and consumer client metrics, and measure consumer lag',
          'collect metrics with JMX and Prometheus, and set useful alerts',
        ]}
        before="Replication and ISR, consumer groups and offsets"
      />

      <h2>What to watch</h2>
      <p>Monitoring Kafka means answering four questions, each with a few numbers.</p>
      <Table
        head={['Question', 'Look at']}
        rows={[
          ['Is any data at risk?', 'UnderReplicatedPartitions, UnderMinIsrPartitionCount, OfflinePartitionsCount'],
          ['Is the cluster in charge of itself?', 'ActiveControllerCount, leader elections'],
          ['Is the broker keeping up?', 'request times (TotalTimeMs, RequestQueueTimeMs), handler and network idle %, bytes in/out'],
          ['Are applications keeping up?', 'producer errors and latency, consumer lag'],
        ]}
      />
      <TermList
        items={[
          { term: 'JMX', definition: 'Java Management Extensions: how a JVM publishes metrics as MBeans. Every Kafka broker and Java client exposes its metrics this way.' },
          { term: 'MBean', definition: 'One named object, e.g. kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions, with attributes such as Value, Count, Mean.' },
          { term: 'gauge / meter / histogram', definition: 'A current value (Value) / a counter with rates (Count, OneMinuteRate) / a distribution (Mean, 99thPercentile).' },
          { term: 'consumer lag', definition: 'Per partition: the end offset (high watermark) minus the group’s committed offset — records written but not yet processed.' },
        ]}
      />
      <p>
        All numbers in this lesson were recorded from a real Kafka {OPS.version} broker (one node) with JMX open, while it was put under load.
      </p>

      <h2>Reading JMX</h2>
      <p>A broker opens JMX on a port when it is started with <code>JMX_PORT</code> set (in the official image: <code>KAFKA_JMX_PORT</code>).</p>
      <CodeBlock title="environment of the recorded container" code={M.jmxEnv} />
      <p>Kafka ships a small reader, <code>kafka-jmx.sh</code>. It is the quickest way to check a value by hand:</p>
      <Terminal title="recorded: the health gauges of an idle broker" steps={[M.health]} />
      <p>
        Production setups do not poll by hand; they run an exporter that turns MBeans into Prometheus metrics (next sections). The MBean names stay the
        same, so everything you learn here applies there.
      </p>

      <h2>Broker health: is data at risk?</h2>
      <p>These four gauges should be boring. Any change in them is worth an alert.</p>
      <StatTiles
        title={`Recorded after the load test (one broker, ${OPS.version})`}
        stats={HEALTH.map((h) => ({ label: h.label, value: health(h.needle), sub: h.sub, hue: h.hue }))}
      />
      <Table
        head={['Metric', 'What it means when it is not 0 (or 1)']}
        rows={[
          [<code key="1">UnderReplicatedPartitions</code>, 'partitions led by this broker with fewer in-sync replicas than replicas: a follower is down or too slow. Data is still safe, but has fewer copies.'],
          [<code key="2">UnderMinIsrPartitionCount</code>, 'the ISR is below min.insync.replicas: producers with acks=all get NotEnoughReplicas errors. Writes are failing now.'],
          [<code key="3">OfflinePartitionsCount</code>, '(controller) partitions with no leader at all: nobody can read or write them.'],
          [<code key="4">ActiveControllerCount</code>, 'should be 1 on exactly one controller; the sum over the controller quorum must be 1.'],
        ]}
      />
      <Callout tone="note" title="Not recorded: an under-replicated partition">
        The lab broker is a single node with replication factor 1, so it cannot show an under-replicated partition. On a three-broker cluster, stopping
        one broker makes <code>UnderReplicatedPartitions</code> rise on the others for every partition that had a replica there, until the broker
        returns and catches up.
      </Callout>

      <h2>Broker load: is it keeping up?</h2>
      <p>The next set of metrics says how busy the broker is and how long requests take.</p>
      <p>One producer sent four million 100-byte records as fast as it could, while <code>kafka-jmx.sh</code> sampled the broker once a second:</p>
      <Terminal title="recorded: the load" steps={[M.perf]} />
      <MonitoringSeriesChart
        title="MessagesInPerSec on the broker, per second (recorded)"
        points={M.load.map((p) => ({ t: p.t, v: p.msgsPerSec }))}
        unit="msg/s"
        hue={7}
        caption={`The count of the meter, differenced once per second. Peak ${peak.toLocaleString()} msg/s; the load lasted about ${busy.length} s.`}
      />
      <MonitoringSeriesChart
        title="RequestHandlerAvgIdlePercent, per second (recorded)"
        points={M.load.map((p) => ({ t: p.t, v: p.handlerIdlePct }))}
        unit="% idle"
        hue={3}
        max={100}
        caption={`Lowest ${minIdle}% idle. One producer barely loads one broker; alert when this stays below about 30% (the handlers are saturated and requests start to queue).`}
      />
      <Predict
        question={<p>During that burst, the broker’s produce requests took how long on average, from arrival to response (TotalTimeMs)?</p>}
        options={['under 1 ms', 'about 10 ms', `about ${Math.round(Number(producerAvgMs))} ms — the latency the producer reported`]}
        answer={0}
        explanation={`The broker measured a mean of ${ms(produce('name=TotalTimeMs,request=Produce:Mean'))} ms. The ${producerAvgMs} ms the perf tool reports is end-to-end per record: it includes the time records wait in the producer’s own buffer for a batch to be sent. When producers are slow but TotalTimeMs is low, the bottleneck is on the client side.`}
      />
      <RequestPath />
      <Table
        head={['Request', 'Requests', 'TotalTimeMs mean', '99th pct', 'Note']}
        rows={[
          ['Produce', produce('name=TotalTimeMs,request=Produce:Count').toLocaleString(), `${ms(produce('name=TotalTimeMs,request=Produce:Mean'))} ms`, `${ms(produce('name=TotalTimeMs,request=Produce:99thPercentile'))} ms`, 'one broker, no replicas to wait for'],
          ['FetchConsumer', fetch('name=TotalTimeMs,request=FetchConsumer:Count').toLocaleString(), `${ms(fetch('name=TotalTimeMs,request=FetchConsumer:Mean'))} ms`, `${ms(fetch('name=TotalTimeMs,request=FetchConsumer:99thPercentile'))} ms`, 'includes up to fetch.max.wait.ms (500 ms) of waiting for data'],
        ]}
      />
      <p>
        That last note matters: a fetch with nothing new to return waits in purgatory up to <code>fetch.max.wait.ms</code>, so high fetch times on a
        quiet topic are normal (recorded FetchConsumer <code>RemoteTimeMs</code> 99th percentile: {ms(fetch('name=RemoteTimeMs,request=FetchConsumer:99thPercentile'))} ms).
        Alert on produce times and on <code>RequestQueueTimeMs</code>, not on fetch totals.
      </p>
      <Callout tone="tip" title="Disk flushes are not a Kafka bottleneck by default">
        Kafka writes into the OS page cache and lets the OS flush; durability comes from replication, not fsync. The recorded{' '}
        <code>LogFlushRateAndTimeMs</code> count after the whole run was {flush('Count')} (mean {ms(flush('Mean'))} ms) for millions of records — flushes happen
        when segments roll, not per write. Watch disk usage and I/O wait at the OS level instead.
      </Callout>

      <h2>Client metrics</h2>
      <p>Producers and consumers have their own metrics, published over JMX in the application’s JVM — the broker cannot see them.</p>
      <Terminal title="recorded: the same load test printed its producer metrics" steps={[{ cmd: M.perf.cmd, out: undefined }]} />
      <StatTiles title="Producer metrics (recorded, --print-metrics)" stats={producerStats} />
      <Terminal title="recorded: a consumer reading the four million records" steps={[M.consumerPerf]} />
      <StatTiles title="Consumer metrics (recorded, --print-metrics)" stats={consumerStats} />
      <p>
        Rates like <code>record-send-rate</code> are averaged over a 30-second window, so a short burst looks smaller than it was; totals and maxima are
        exact. In an application, read them from JMX, or with Micrometer / Spring Boot Actuator, which publish the same client metrics under
        <code> kafka.producer.*</code> and <code>kafka.consumer.*</code> names.
      </p>

      <h2>Consumer lag over time</h2>
      <p>Lag is the one number that says whether consumers keep up, and it is measured from the outside, with the group’s committed offsets.</p>
      <p>
        A producer wrote {M.lag.rate.toLocaleString()} records a second to topic <code>payments</code>. A consumer in group <code>reports</code> read
        them, then was stopped, then started again. Every second the lag was taken from <code>kafka-consumer-groups.sh --describe</code>:
      </p>
      <MonitoringSeriesChart
        title="Lag of group reports, summed over 3 partitions (recorded)"
        points={lagPoints}
        events={M.lag.events}
        unit="records"
        hue={1}
        caption={`While the consumer runs, lag saw-tooths between 0 and about ${M.lag.rate.toLocaleString()}: it commits once a second (auto.commit.interval.ms=1000). Stopped, lag grows by the producer rate; restarted, it drops in one or two samples.`}
      />
      <Terminal title={`recorded: the group at its largest lag (${maxLag.toLocaleString()} records, ${M.lag.atMax.t} s)`} steps={[M.lag.atMax]} />
      <Table
        head={['Command (recorded)', '']}
        rows={[
          [<code key="p">{M.lagCommands.producer}</code>, 'steady load'],
          [<code key="c">{M.lagCommands.consumer}</code>, 'the consumer'],
          [<code key="d">{M.lagCommands.describe}</code>, 'sampled every second'],
        ]}
      />
      <p>Lag in records is hard to judge on its own. Two ways to make it meaningful:</p>
      <ul>
        <li><strong>Trend:</strong> lag that keeps growing is a problem at any size; lag that rises and falls with traffic is normal.</li>
        <li><strong>Time:</strong> divide lag by the consume rate to get “minutes behind”, or use a lag exporter that estimates time lag (e.g. Burrow, kafka-lag-exporter, kafka_exporter).</li>
      </ul>

      <h2>Prometheus and the JMX exporter</h2>
      <p>The common setup runs the Prometheus JMX exporter as a Java agent inside every broker, which serves the MBeans as Prometheus metrics over HTTP.</p>
      <CodeBlock
        title="broker environment — not recorded, adapt paths and versions"
        code={`KAFKA_OPTS=-javaagent:/opt/jmx_prometheus_javaagent.jar=7071:/opt/kafka-jmx.yml
# Prometheus then scrapes http://<broker>:7071/metrics`}
      />
      <CodeBlock
        title="kafka-jmx.yml — not recorded, a minimal rule set"
        language="yaml"
        code={`lowercaseOutputName: true
rules:
  # gauges: kafka.server<type=ReplicaManager, name=UnderReplicatedPartitions><>Value
  - pattern: 'kafka.(server|controller)<type=(.+), name=(.+)><>Value'
    name: kafka_$1_$2_$3
    type: GAUGE
  # meters: kafka.server<type=BrokerTopicMetrics, name=MessagesInPerSec><>Count
  - pattern: 'kafka.server<type=(.+), name=(.+)PerSec\\w*><>Count'
    name: kafka_server_$1_$2_total
    type: COUNTER
  # request times by request type
  - pattern: 'kafka.network<type=RequestMetrics, name=(.+), request=(.+)><>(\\d+)thPercentile'
    name: kafka_network_requestmetrics_$1
    labels: { request: $2, quantile: '0.$3' }
    type: GAUGE`}
      />
      <p>
        The exporter project ships a complete example configuration for Kafka; start from that rather than writing rules from scratch. Lag is not a
        broker MBean, so it comes from a separate lag exporter or from the consumers’ own <code>records-lag-max</code>.
      </p>

      <h2>Signals in the logs</h2>
      <p>Some events are easier to spot in the broker log than in a metric.</p>
      <Table
        head={['Log line contains', 'Means']}
        rows={[
          [<code key="a">Failed authentication with</code>, 'a client used wrong credentials or a bad TLS setup (recorded in the security lesson)'],
          [<code key="b">Shrinking ISR / Expanding ISR</code>, 'a follower fell out of / rejoined the in-sync set — pairs with UnderReplicatedPartitions'],
          [<code key="c">Preparing to rebalance group</code>, 'a classic consumer group rebalances; frequent ones mean flapping consumers'],
          [<code key="d">OutOfMemoryError, No space left on device</code>, 'the broker is about to fail'],
        ]}
      />
      <p>The last three are typical lines, <em>not recorded</em> here; the exact wording changes between versions, so match loosely.</p>

      <h2>Checklist: alerts to set</h2>
      <Table
        head={['Alert', 'Condition', 'Severity']}
        rows={[
          ['Offline partitions', 'OfflinePartitionsCount > 0', 'page'],
          ['Writes failing', 'UnderMinIsrPartitionCount > 0', 'page'],
          ['No controller', 'sum(ActiveControllerCount) != 1 for 1 min', 'page'],
          ['Under-replicated', 'UnderReplicatedPartitions > 0 for 5–10 min', 'ticket, page if it grows'],
          ['Broker saturated', 'RequestHandlerAvgIdlePercent < 0.3 or NetworkProcessorAvgIdlePercent < 0.3 for 10 min', 'ticket'],
          ['Slow produce', 'Produce TotalTimeMs p99 above your SLO', 'ticket'],
          ['Consumer behind', 'lag growing for 10 min, or time lag above the SLO', 'page the owning team'],
          ['Producer errors', 'record-error-rate > 0', 'page the owning team'],
          ['Disk', 'log directory over 80% full', 'ticket, page at 90%'],
        ]}
      />
      <Callout tone="warn" title="Units">
        The idle-percent MBeans report a fraction between 0 and 1 (0.3 = 30%), even though they are named “Percent”.
      </Callout>

      <Recap
        points={[
          'Data at risk: UnderReplicatedPartitions, UnderMinIsrPartitionCount and OfflinePartitionsCount should be 0; one active controller.',
          'Broker load: TotalTimeMs splits into queue, local, remote (waiting for replicas) and response time; idle % of handler and network threads shows saturation.',
          'Client metrics live in the application: record-error-rate and request latency for producers, records-lag-max and fetch rate for consumers.',
          'Lag = log-end offset − committed offset; watch its trend or time lag, collected from outside the consumer.',
          'In production, export JMX to Prometheus with the JMX exporter agent and alert on the checklist above.',
        ]}
      />
    </>
  )
}
