import type { ReactNode } from 'react'
import { Box, Callout, Connector, Row, Table, Walkthrough } from '@/shared/ui'
import own from './lesson.module.css'

type Node = 'app' | 'kafka' | 'pg' | 'connect' | 'consumer'

const STEPS: { title: string; body: ReactNode; on: Node[]; edge?: string }[] = [
  { title: 'Kafka at the centre', body: <p>Brokers store the topics; controllers keep the cluster metadata. Every other piece is a client of Kafka.</p>, on: ['kafka'] },
  { title: 'Pub-sub: an application produces', body: <p>Your service sends records to a topic with a producer client.</p>, on: ['app', 'kafka'], edge: 'app-kafka' },
  { title: 'Pub-sub: applications consume', body: <p>Consumer groups read the topic, each at its own pace, committing their progress.</p>, on: ['kafka', 'consumer'], edge: 'kafka-consumer' },
  { title: 'CDC: the database changes', body: <p>A row is inserted, updated or deleted in Postgres; the change is written to its write-ahead log.</p>, on: ['pg'] },
  { title: 'CDC: Kafka Connect runs Debezium', body: <p>A Connect worker runs the Debezium connector, which reads the WAL through a replication slot and writes change events into Kafka.</p>, on: ['pg', 'connect', 'kafka'], edge: 'pg-connect' },
  { title: 'CDC: applications consume changes', body: <p>Consumers apply each change — to a search index, a cache, another service’s data.</p>, on: ['kafka', 'consumer'], edge: 'kafka-consumer' },
]

function Architecture() {
  return (
    <Walkthrough title="The components and how data flows" steps={STEPS} intervalMs={2400}>
      {(i) => {
        const { on, edge } = STEPS[i]
        const a = (n: Node) => on.includes(n)
        return (
          <div className={own.pipeline}>
            <Row>
              <Box title="Producer apps" caption="pub-sub" active={a('app')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'app-kafka'} label="9092" /></div>
              <Box title="Kafka cluster" caption="controllers + brokers" active={a('kafka')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'kafka-consumer'} label="poll" /></div>
              <Box title="Consumer apps" caption="consumer groups" active={a('consumer')} className={own.anchor} />
            </Row>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Connector direction="up" active={edge === 'pg-connect'} label="writes" />
            </div>
            <Row>
              <Box title="PostgreSQL" caption="wal_level=logical" active={a('pg')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'pg-connect'} label="replication slot" /></div>
              <Box title="Kafka Connect" caption="+ Debezium plugin" active={a('connect')} className={own.anchor} />
              <div className={own.edge} />
              <div style={{ width: 150 }} />
            </Row>
          </div>
        )
      }}
    </Walkthrough>
  )
}

export default function Overview() {
  return (
    <>
      <p>
        This module sets up Kafka, Kafka Connect and Debezium the way operations teams do it — once directly on Linux
        servers with systemd, once with Docker — explains every configuration file line by line, and then uses the
        result from Java for both pub-sub and change data capture. Every command, file and output shown was run on the
        versions below.
      </p>

      <Architecture />

      <h2>What you are installing</h2>
      <Table
        head={['Component', 'What it is', 'Port']}
        rows={[
          ['Kafka controller', 'Keeps cluster metadata in a Raft quorum (KRaft); elects partition leaders', '9093'],
          ['Kafka broker', 'Stores topic partitions on disk, serves producers and consumers', '9092'],
          ['Kafka Connect worker', 'A separate JVM process that runs connectors; managed over REST', '8083'],
          ['Debezium Postgres connector', 'A plugin (JAR files) loaded by Connect; reads the Postgres WAL', '—'],
          ['PostgreSQL', 'The source database for CDC', '5432'],
        ]}
      />

      <h2>Two ways to run it</h2>
      <Table
        head={['', 'On the OS (Ubuntu + systemd)', 'In containers (Docker)']}
        rows={[
          ['Typical place', 'VMs or bare-metal servers', 'Container hosts, CI, developer machines; Kubernetes via an operator'],
          ['Configuration', 'Files in /etc/kafka', 'Environment variables (KAFKA_*) or mounted files'],
          ['Process supervision', 'systemd units', 'Container runtime (restart policies, health checks)'],
          ['Data', '/var/lib/kafka on dedicated disks', 'Named volumes or host paths on dedicated disks'],
          ['Upgrades', 'New version directory + symlink switch, rolling restart', 'New image tag, rolling recreate'],
        ]}
      />
      <p>
        The Kafka configuration is the same either way — only how it is delivered differs. Learn the properties once
        (next lesson), then pick the installation lesson you need. On Kubernetes, teams normally use an operator such as
        Strimzi, which generates the same configuration from custom resources.
      </p>

      <h2>Topology</h2>
      <Table
        head={['', 'Single node', 'Production']}
        rows={[
          ['Kafka', '1 process, broker + controller', '3 dedicated controllers + 3 or more brokers, on separate machines'],
          ['Replication', 'factor 1 (no redundancy)', 'factor 3, min.insync.replicas 2: survives losing one broker'],
          ['Kafka Connect', '1 worker', '2 or more workers with the same group.id: tasks fail over'],
          ['Use for', 'Development, CI, learning', 'Anything whose data matters'],
        ]}
      />
      <Callout tone="note" title="Why dedicated controllers">
        Controllers hold the metadata; if a majority is lost, the cluster can no longer change leaders or create topics.
        Keeping them on their own small machines means a busy or failing broker cannot take the quorum down with it.
        Three controllers tolerate one failure, five tolerate two.
      </Callout>

      <h2>Server sizing basics</h2>
      <ul>
        <li><strong>Disks</strong>: dedicated data disks for <code>log.dirs</code>, XFS, mounted with <code>noatime</code>. Disk throughput is usually the bottleneck.</li>
        <li><strong>Memory</strong>: a modest JVM heap (4–6 GB on a busy broker); the rest of the RAM becomes page cache, which is where Kafka’s speed comes from.</li>
        <li><strong>File descriptors</strong>: at least 100,000 for the Kafka process.</li>
        <li><strong>Network</strong>: low latency between brokers; put controllers and brokers in the same data centre or region.</li>
      </ul>

      <h2>Versions used</h2>
      <Table
        head={['Component', 'Version', 'Requirement']}
        rows={[
          ['Apache Kafka', '4.3.1', 'Brokers, controllers and Connect run on Java 17, 21 or 25'],
          ['Debezium Postgres connector', '3.7.0.Final', 'Java 17+, Kafka Connect 3.1+'],
          ['PostgreSQL', '16 (Ubuntu 24.04) / 18 (Docker)', 'Debezium supports 14–18; pgoutput is built in'],
          ['Ubuntu', '24.04 LTS', 'OpenJDK 21 from the Ubuntu archive'],
          ['Java client (kafka-clients)', '4.3.1', 'Java 11+; examples use Java 17'],
        ]}
      />
    </>
  )
}
