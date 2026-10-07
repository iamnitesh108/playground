import { useState } from 'react'
import { Button, Callout, Demo, Segmented, TermList } from '@/shared/ui'
import { PartitionLog } from '../components'
import { useObservable } from '@/shared/hooks/useObservable'
import { KafkaCluster } from '../simulation'
import styles from './lesson.module.css'

const SERVICES = ['Checkout', 'Inventory', 'Accounts']
const READERS = ['Email', 'Analytics', 'Search']

type View = 'direct' | 'log'

function CouplingDiagram({ view }: { view: View }) {
  const left = 30
  const right = 470
  const ys = [40, 110, 180]
  const node = (x: number, y: number, label: string) => (
    <g key={`${x}-${label}`}>
      <rect x={x - 52} y={y - 16} width={104} height={32} rx={5} style={{ fill: 'var(--surface)', stroke: 'var(--border-strong)' }} />
      <text x={x} y={y + 4} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 12 }}>
        {label}
      </text>
    </g>
  )

  return (
    <svg viewBox="0 0 560 220" className={styles.svg} role="img" aria-label="Service connection diagram">
      {view === 'direct'
        ? ys.flatMap((y1) =>
            ys.map((y2) => (
              <line
                key={`${y1}-${y2}`}
                x1={left + 82}
                y1={y1}
                x2={right - 22}
                y2={y2}
                className={styles.drawLine}
                style={{ stroke: 'var(--danger)', strokeWidth: 1.2 }}
              />
            )),
          )
        : ys.flatMap((y) => [
            <line key={`l${y}`} x1={left + 82} y1={y} x2={220} y2={110} className={styles.drawLine} style={{ stroke: 'var(--accent)' }} />,
            <line key={`r${y}`} x1={340} y1={110} x2={right - 22} y2={y} className={styles.drawLine} style={{ stroke: 'var(--accent)' }} />,
          ])}
      {view === 'log' && (
        <g>
          <rect x={220} y={80} width={120} height={60} rx={6} style={{ fill: 'var(--accent-soft)', stroke: 'var(--accent)' }} />
          <text x={280} y={106} textAnchor="middle" style={{ fill: 'var(--text)', fontSize: 13, fontWeight: 600 }}>
            Kafka
          </text>
          <text x={280} y={124} textAnchor="middle" style={{ fill: 'var(--text-muted)', fontSize: 10 }}>
            shared event log
          </text>
        </g>
      )}
      {ys.map((y, i) => node(left + 30, y, SERVICES[i]))}
      {ys.map((y, i) => node(right + 30, y, READERS[i]))}
    </svg>
  )
}

function createLogDemo() {
  const cluster = new KafkaCluster({ topic: 'orders', partitions: 1 })
  cluster.addGroup('email')
  cluster.addGroup('analytics')
  cluster.addConsumer('email')
  cluster.addConsumer('analytics')
  ;['order-1', 'order-2', 'order-3'].forEach((key) => cluster.produce(key, 'placed'))
  return cluster
}

function IndependentReaders() {
  const cluster = useObservable(createLogDemo)
  const [next, setNext] = useState(4)
  const groups = cluster.groups

  return (
    <Demo
      title="One log, many independent readers"
      hint="Append events, then let each service read at its own pace. Reading never removes anything."
      controls={
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              cluster.produce(`order-${next}`, 'placed')
              setNext(next + 1)
            }}
          >
            Append event
          </Button>
          {groups.map((group) => (
            <Button key={group.id} size="sm" onClick={() => cluster.consume(group.id, group.members[0].id)}>
              {group.id} reads next
            </Button>
          ))}
        </>
      }
    >
      <PartitionLog
        label="orders"
        cells={cluster.topic.records(0)}
        markers={groups.map((group, i) => ({ offset: group.positionOf(0), label: group.id, tone: i }))}
      />
      <p className={styles.demoNote}>
        Each ▲ marks where that reader will read next. Email can be far ahead of Analytics — they never block each other.
      </p>
    </Demo>
  )
}

export default function WhyKafka() {
  const [view, setView] = useState<View>('direct')

  return (
    <>
      <p>
        Picture an online shop. When someone places an order, many things must happen: send a confirmation email,
        update stock, record revenue, refresh search results. The simplest approach is for the checkout service to{' '}
        <em>call</em> each of those services directly.
      </p>
      <p>It works — until it doesn't:</p>
      <ul>
        <li>
          <strong>Every sender must know every receiver.</strong> Add a new reader and you must change and redeploy
          the senders.
        </li>
        <li>
          <strong>If a receiver is down, data is lost</strong> or the sender has to build its own retry logic.
        </li>
        <li>
          <strong>Speed is tied together.</strong> A slow analytics service slows checkout.
        </li>
      </ul>

      <Demo
        title="Point-to-point vs a shared log"
        hint="Switch between the two designs and count the connections."
        controls={
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'direct', label: 'Direct calls' },
              { value: 'log', label: 'With Kafka' },
            ]}
          />
        }
      >
        <CouplingDiagram view={view} />
        <p className={styles.demoNote}>
          {view === 'direct'
            ? '3 senders × 3 receivers = 9 connections, each one a place to fail.'
            : '3 + 3 = 6 connections, and nobody needs to know who is on the other side.'}
        </p>
      </Demo>

      <h2>The big idea: a log</h2>
      <p>
        Kafka is, at heart, a <strong>log</strong>: a list of events where new entries are only ever added at the
        end. Nothing is edited, nothing is inserted in the middle. Each entry gets a sequence number called an{' '}
        <strong>offset</strong>.
      </p>
      <p>
        Services that have something to say (<strong>producers</strong>) append events to the log. Services that care
        (<strong>consumers</strong>) read from it. The crucial difference from a classic message queue:{' '}
        <strong>reading does not delete</strong>. Every consumer keeps its own bookmark, so any number of them can
        read the same events at their own speed — even replay history from the beginning.
      </p>

      <Callout tone="analogy">
        A classic queue is a mailbox: once you take the letter out, it is gone. Kafka is a newspaper archive: the
        papers stay on the shelf, and every reader keeps a note of which issue they read last.
      </Callout>

      <IndependentReaders />

      <h2>What people use it for</h2>
      <ul>
        <li>
          <strong>Decoupling microservices</strong> — services publish facts (“order placed”) instead of calling each
          other.
        </li>
        <li>
          <strong>Change data capture</strong> — streaming every database change to other systems (lessons 12–13).
        </li>
        <li>
          <strong>Activity and metrics pipelines</strong> — clicks, logs and telemetry at millions of events per
          second.
        </li>
        <li>
          <strong>Stream processing</strong> — computing live aggregates such as fraud scores or dashboards.
        </li>
      </ul>

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Event', definition: 'A fact that something happened, e.g. “order 42 was paid”. Kafka stores events.' },
          { term: 'Log', definition: 'An ordered, append-only sequence of events. The core data structure of Kafka.' },
          { term: 'Producer', definition: 'Any application that writes events to Kafka.' },
          { term: 'Consumer', definition: 'Any application that reads events from Kafka.' },
          { term: 'Offset', definition: 'The position number of an event in the log: 0, 1, 2, …' },
          { term: 'Decoupling', definition: 'Senders and receivers no longer know about, or wait for, each other.' },
        ]}
      />
    </>
  )
}
