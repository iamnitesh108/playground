import type { ReactNode } from 'react'
import { Box, Callout, Connector, Row, Table, Walkthrough } from '@/shared/ui'
import own from './lesson.module.css'

type Node = 'app' | 'kafka' | 'pg' | 'connect' | 'consumer'

const STEPS: { title: string; body: ReactNode; on: Node[]; edge?: string }[] = [
  {
    title: 'Kafka first',
    body: <p>One container runs Kafka in KRaft mode — broker and controller in one process. Everything else is a client of it.</p>,
    on: ['kafka'],
  },
  {
    title: 'Pub-sub: your code produces',
    body: <p>A Java producer sends records to the <code>payments</code> topic through <code>localhost:9092</code>.</p>,
    on: ['app', 'kafka'],
    edge: 'app-kafka',
  },
  {
    title: 'Pub-sub: your code consumes',
    body: <p>A Java consumer in the group <code>billing</code> reads them and commits its progress.</p>,
    on: ['kafka', 'consumer'],
    edge: 'kafka-consumer',
  },
  {
    title: 'CDC: the database changes',
    body: <p>Something inserts, updates or deletes a row in Postgres <code>shop.public.orders</code>. Postgres logs it in its WAL.</p>,
    on: ['pg'],
  },
  {
    title: 'CDC: Debezium reads the WAL',
    body: <p>Kafka Connect runs the Debezium connector. It streams the change from a replication slot and writes a change event to <code>shop.public.orders</code>.</p>,
    on: ['pg', 'connect', 'kafka'],
    edge: 'pg-connect',
  },
  {
    title: 'CDC: your code consumes the change',
    body: <p>A Java consumer in the group <code>order-projection</code> applies each change to its own copy of the data.</p>,
    on: ['kafka', 'consumer'],
    edge: 'kafka-consumer',
  },
]

function Architecture() {
  return (
    <Walkthrough title="The stack and the two ways data flows through it" steps={STEPS} intervalMs={2400}>
      {(i) => {
        const { on, edge } = STEPS[i]
        const a = (n: Node) => on.includes(n)
        return (
          <div className={own.pipeline}>
            <Row>
              <Box title="Your producer" caption="Java · pub-sub" active={a('app')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'app-kafka'} label="9092" /></div>
              <Box title="Kafka 4.3" caption="broker + controller" active={a('kafka')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'kafka-consumer'} label="poll" /></div>
              <Box title="Your consumers" caption="billing · order-projection" active={a('consumer')} className={own.anchor} />
            </Row>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Connector direction="up" active={edge === 'pg-connect'} label="writes" />
            </div>
            <Row>
              <Box title="Postgres 18" caption="wal_level=logical" active={a('pg')} className={own.anchor} />
              <div className={own.edge}><Connector active={edge === 'pg-connect'} label="replication slot" /></div>
              <Box title="Kafka Connect" caption="+ Debezium 3.7" active={a('connect')} className={own.anchor} />
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
        By the end of this module you will have, on your own machine: a Kafka broker, a Postgres database, Kafka Connect
        running Debezium, and three small Java programs — and you will know what every line of configuration does. Every
        file and command here was run against exactly this stack; the outputs shown are real.
      </p>

      <Architecture />

      <h2>Two patterns</h2>
      <Table
        head={['', 'Pub-sub', 'CDC (change data capture)']}
        rows={[
          ['Who writes to Kafka', 'Your code, with a producer', 'Debezium, from the database log'],
          ['Your code does', 'producer.send(...)', 'Ordinary SQL: INSERT / UPDATE / DELETE'],
          ['Event means', 'Whatever your app decides ("payment made")', '"This row changed: before → after"'],
          ['Use when', 'Services announce facts to each other', 'Other systems must follow a database: search, cache, analytics, other services'],
        ]}
      />

      <h2>Versions used</h2>
      <Table
        head={['Component', 'Version', 'Notes']}
        rows={[
          ['Apache Kafka', '4.3.1', 'Image apache/kafka:4.3.1. Brokers and Connect need Java 17+ (the image ships Java 21).'],
          ['Debezium Postgres connector', '3.7.0.Final', 'Needs Java 17+ and Kafka Connect 3.1 or newer.'],
          ['PostgreSQL', '18', 'Debezium supports 14–18. pgoutput is built in.'],
          ['Java client (kafka-clients)', '4.3.1', 'Clients need Java 11+; the examples use Java 17.'],
          ['Docker Compose or Podman Compose', 'any recent', 'docker compose … and podman compose … accept the same file.'],
        ]}
      />

      <h2>The order you will follow</h2>
      <ol>
        <li><strong>Project layout and Compose</strong> — create the folder and the compose file.</li>
        <li><strong>Kafka broker</strong> — <code>server.properties</code>, start it, create a topic.</li>
        <li><strong>Postgres</strong> — make it CDC-ready.</li>
        <li><strong>Kafka Connect</strong> — install Debezium, <code>connect-distributed.properties</code>, start it.</li>
        <li><strong>Debezium connector</strong> — register it and see the first change events.</li>
        <li><strong>Code</strong> — client settings, then pub-sub and CDC programs in Java.</li>
      </ol>

      <Callout tone="note" title="Without Docker?">
        Everything also works with the plain Kafka download (<code>kafka_2.13-4.3.1.tgz</code>) and a local Postgres. Each
        lesson notes the few values that change — mostly hostnames, which become <code>localhost</code>.
      </Callout>
    </>
  )
}
