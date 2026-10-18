import { useState } from 'react'
import { Callout, CodeBlock, Demo, Segmented, Table, TermList, Walkthrough, type WalkthroughStep } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { Flow, Timeline } from '@/shared/figures'
import { PartitionLog } from '../components/PartitionLog'
import styles from './lesson.module.css'

type Strategy = 'commit-first' | 'process-first'

interface Frame {
  position: number
  committed: number
  processed: number[]
  crashed?: boolean
}

const CELLS = [0, 1, 2, 3, 4].map((offset) => ({ offset, key: `pay-${offset}` }))

const SCENARIOS: Record<Strategy, { steps: WalkthroughStep[]; frames: Frame[]; verdict: string; ok: boolean }> = {
  'commit-first': {
    steps: [
      { title: 'Poll offset 2', body: <p>Offsets 0 and 1 are done and committed. The consumer fetches offset 2.</p> },
      { title: 'Commit 3 first', body: <p>It commits offset 3 straight away — “I’m done with 2” — before doing any work.</p> },
      { title: 'Crash while processing', body: <p>The process dies halfway through handling offset 2. The payment was never recorded.</p> },
      { title: 'Restart from 3', body: <p>The replacement consumer resumes at the committed offset, 3. Offset 2 is skipped forever.</p> },
    ],
    frames: [
      { position: 3, committed: 2, processed: [0, 1] },
      { position: 3, committed: 3, processed: [0, 1] },
      { position: 3, committed: 3, processed: [0, 1], crashed: true },
      { position: 4, committed: 4, processed: [0, 1, 3] },
    ],
    verdict: 'At-most-once: offset 2 was lost. Nothing is ever processed twice, but things can disappear.',
    ok: false,
  },
  'process-first': {
    steps: [
      { title: 'Poll offset 2', body: <p>Offsets 0 and 1 are done and committed. The consumer fetches offset 2.</p> },
      { title: 'Process it', body: <p>It records the payment for offset 2 in the database. The side effect has happened.</p> },
      { title: 'Crash before commit', body: <p>The process dies before it can commit offset 3. Kafka still thinks the group is at 2.</p> },
      { title: 'Restart from 2', body: <p>The replacement consumer resumes at 2 and processes it again. Unless the handler is idempotent, the payment is recorded twice.</p> },
    ],
    frames: [
      { position: 3, committed: 2, processed: [0, 1] },
      { position: 3, committed: 2, processed: [0, 1, 2] },
      { position: 3, committed: 2, processed: [0, 1, 2], crashed: true },
      { position: 3, committed: 3, processed: [0, 1, 2, 2] },
    ],
    verdict: 'At-least-once: offset 2 was processed twice. Nothing is lost — make the handler idempotent and duplicates become harmless.',
    ok: true,
  },
}

function CommitOrderDemo() {
  const [strategy, setStrategy] = useState<Strategy>('process-first')
  const scenario = SCENARIOS[strategy]

  return (
    <Demo
      title="When you commit decides what a crash costs"
      hint="Pick an order, then step through a crash."
      controls={
        <Segmented
          value={strategy}
          onChange={setStrategy}
          options={[
            { value: 'commit-first', label: 'Commit, then process' },
            { value: 'process-first', label: 'Process, then commit' },
          ]}
        />
      }
    >
      <Walkthrough key={strategy} title={strategy === 'commit-first' ? 'Commit first' : 'Process first'} steps={scenario.steps} intervalMs={1800}>
        {(step) => {
          const frame = scenario.frames[step]
          return (
            <>
              <PartitionLog
                label="payments-0"
                cells={CELLS}
                showNext={false}
                markers={[{ offset: frame.committed, label: 'committed', tone: 2 }]}
                highlight={step < 3 ? 2 : undefined}
              />
              <div className={styles.result}>
                <span className={styles.label}>processed so far </span>
                <span className={styles.mono}>{frame.processed.map((o) => `#${o}`).join(' ')}</span>
                {frame.crashed && <strong style={{ color: 'var(--danger)', marginLeft: 12 }}>✕ consumer crashed</strong>}
              </div>
              {step === 3 && <div className={cx(styles.result, scenario.ok ? styles.resultOk : styles.resultBad)}>{scenario.verdict}</div>}
            </>
          )
        }}
      </Walkthrough>
    </Demo>
  )
}

export default function Delivery() {
  return (
    <>
      <p>
        Processing a record and committing its offset are two separate actions. A crash can land between them. Which
        one you do first decides what you get after a failure — and that is what “delivery guarantees” means.
      </p>

      <h2>Auto-commit vs manual commit</h2>
      <ul>
        <li>
          <strong>Auto-commit</strong> (<code>enable.auto.commit=true</code>, the default): every{' '}
          <code>auto.commit.interval.ms</code> (5 s), inside the next <code>poll()</code>, the client commits the
          positions of records the previous poll returned. In a simple loop that finishes each batch before polling again
          this is at-least-once: a crash repeats up to a few seconds of records. If you hand records to other threads and
          poll again before they finish, auto-commit can commit records that were never processed — and a crash loses
          them.
        </li>
        <li>
          <strong>Manual commit</strong>: you call <code>commitSync()</code>/<code>commitAsync()</code>, or{' '}
          <code>ack()</code> in frameworks like Spring or Micronaut, <em>after</em> the work is done. You control
          exactly what is considered finished.
        </li>
      </ul>

      <CommitOrderDemo />

      <Timeline
        title="Commit, then process: the crash lands after the commit (at-most-once)"
        lanes={[
          { id: 'consumer', label: 'consumer' },
          { id: 'kafka', label: 'committed' },
          { id: 'db', label: 'database' },
        ]}
        segments={[
          { lane: 'consumer', from: 0, to: 10, label: 'poll #2', hue: 1 },
          { lane: 'consumer', from: 20, to: 45, label: 'processing #2', hue: 1 },
          { lane: 'kafka', from: 0, to: 12, label: '2', hue: 5 },
          { lane: 'kafka', from: 12, to: 100, label: '3 — “#2 is done”', hue: 5 },
          { lane: 'db', from: 45, to: 100, label: 'payment #2 never written', hue: 8, striped: true },
          { lane: 'consumer', from: 70, to: 100, label: 'restart: reads #3', hue: 1 },
        ]}
        events={[{ lane: 'kafka', at: 12, label: 'commit 3', hue: 5 }, { lane: 'consumer', at: 45, label: 'crash', hue: 8 }]}
        end={100}
        unit="ms"
        playable
      />
      <Timeline
        title="Process, then commit: the crash lands before the commit (at-least-once) — after the restart the payment may be written twice"
        lanes={[
          { id: 'consumer', label: 'consumer' },
          { id: 'kafka', label: 'committed' },
          { id: 'db', label: 'database' },
        ]}
        segments={[
          { lane: 'consumer', from: 0, to: 10, label: 'poll #2', hue: 1 },
          { lane: 'consumer', from: 12, to: 35, label: 'processing #2', hue: 1 },
          { lane: 'kafka', from: 0, to: 100, label: '2 — never moved', hue: 5 },
          { lane: 'db', from: 35, to: 100, label: 'payment #2 written', hue: 6 },
          { lane: 'consumer', from: 70, to: 95, label: 'restart: #2 again', hue: 1 },
        ]}
        events={[{ lane: 'consumer', at: 40, label: 'crash', hue: 8 }, { lane: 'db', at: 85, label: 'duplicate?', hue: 8 }]}
        end={100}
        unit="ms"
        playable
      />
      <p>
        The only difference is the order of two calls. Commit first and a crash loses the record; process first and a crash repeats it — which an
        idempotent handler turns into “already done”.
      </p>

      <h2>The three guarantees</h2>
      <Table
        head={['Guarantee', 'How', 'After a crash']}
        rows={[
          ['At-most-once', 'Commit before processing', 'Records may be lost, never duplicated'],
          ['At-least-once', 'Process, then commit', 'Nothing lost; records may repeat'],
          ['Exactly-once', 'Transactions, or at-least-once + idempotent handling', 'Effect happens once'],
        ]}
      />
      <p>
        Inside Kafka (read from topic A, write to topic B) <strong>exactly-once</strong> is available: the producer
        writes output records and the consumer’s offsets in one transaction, and downstream consumers use{' '}
        <code>isolation.level=read_committed</code>. Once a side effect leaves Kafka — a database row, an email, an
        HTTP call — Kafka can no longer make it atomic. The practical recipe is:
      </p>
      <Flow
        title="Exactly-once inside Kafka: read, process, write — in one transaction"
        cols={3}
        rows={3}
        rowHeight={80}
        nodes={[
          { id: 'in', label: 'payments', sub: 'input topic', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'app', label: 'read-process-write', sub: 'consumer + transactional producer', col: 1, row: 0, hue: 1 },
          { id: 'out', label: 'balances', sub: 'output topic', col: 2, row: 0, hue: 3, shape: 'log' },
          { id: 'off', label: '__consumer_offsets', sub: 'offsets inside the txn', col: 0, row: 2, hue: 3, shape: 'log' },
          { id: 'tx', label: 'transaction coordinator', sub: 'a broker', col: 1, row: 2, hue: 5 },
          { id: 'down', label: 'downstream consumer', sub: 'isolation.level=read_committed', col: 2, row: 2, hue: 2, shape: 'actor' },
        ]}
        edges={[
          { from: 'in', to: 'app', flow: true, hue: 3 },
          { from: 'app', to: 'out', flow: true, hue: 1 },
          { from: 'app', to: 'tx', label: 'begin / commit', hue: 5 },
          { from: 'app', to: 'off', label: 'offsets', hue: 5, dashed: true },
          { from: 'out', to: 'down', label: 'only committed', flow: true, hue: 2 },
        ]}
        steps={[
          { title: 'Begin', body: <p>The app polls a batch from <code>payments</code> and begins a transaction with its <code>transactional.id</code>.</p>, active: ['in', 'app', 'tx', 'in>app', 'app>tx'] },
          { title: 'Write output', body: <p>Results go to <code>balances</code> — written to the log but marked as part of an open transaction.</p>, active: ['app', 'out', 'app>out'] },
          { title: 'Offsets join the transaction', body: <p>The consumed offsets are sent to the same transaction instead of a normal commit, so “processed” and “output written” become one fact.</p>, active: ['app', 'off', 'app>off'] },
          { title: 'Commit — or abort', body: <p>The coordinator writes commit markers to every partition involved. On a crash the transaction aborts: the output and the offsets are aborted together. The aborted records stay in the log, but <code>read_committed</code> readers skip them, the offsets never take effect, and the batch is processed again.</p>, active: ['tx', 'out', 'off', 'app>tx'] },
          { title: 'Readers see only committed data', body: <p>Downstream consumers with <code>isolation.level=read_committed</code> skip aborted records, so each payment is applied to the balances exactly once.</p>, active: ['out', 'down', 'out>down'] },
        ]}
      />
      <Callout tone="tip" title="At-least-once + idempotent consumer">
        Commit after processing, and make processing safe to repeat. Typical tricks: a unique constraint on a business
        ID (a duplicate insert fails and you treat that as “already done”), a “processed events” table, or upserts
        instead of inserts.
      </Callout>

      <h2>Handling failures without blocking</h2>
      <p>
        A record that always fails (bad data, a bug) is called a <strong>poison pill</strong>. If you never commit
        past it, the whole partition stalls. Common strategies:
      </p>
      <ul>
        <li>
          <strong>Dead letter queue (DLQ)</strong>: publish the failing record to a separate topic for inspection, then
          commit and move on.
        </li>
        <li>
          <strong>Retry topics</strong>: re-publish to <code>orders.retry.1m</code>, <code>orders.retry.10m</code>…
          with growing delays.
        </li>
        <li>
          <strong>Park it in a table</strong>: store the failed ID and error in a database table that a job or the
          outbox (see <a href="#/kafka/outbox">the outbox pattern</a>) will send again later.
        </li>
      </ul>
      <Flow
        title="Retry topics and a dead letter queue: the partition keeps moving"
        cols={4}
        rows={3}
        nodes={[
          { id: 'orders', label: 'orders', sub: 'main topic', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'main', label: 'consumer', sub: 'group billing', col: 1, row: 0, hue: 1 },
          { id: 'db', label: 'database', sub: 'success', col: 3, row: 0, hue: 6, shape: 'store' },
          { id: 'r1', label: 'orders.retry.1m', sub: 'retry topic', col: 1, row: 1, hue: 3, shape: 'log' },
          { id: 'retry', label: 'retry consumer', sub: 'waits, then tries', col: 3, row: 1, hue: 1 },
          { id: 'dlq', label: 'orders.dlq', sub: 'for a human', col: 3, row: 2, hue: 8, shape: 'log' },
        ]}
        edges={[
          { from: 'orders', to: 'main', flow: true, hue: 3 },
          { from: 'main', to: 'db', label: 'ok → commit', flow: true, hue: 6 },
          { from: 'main', to: 'r1', label: 'fails', hue: 8 },
          { from: 'r1', to: 'retry', flow: true, hue: 3 },
          { from: 'retry', to: 'db', label: 'ok', hue: 6 },
          { from: 'retry', to: 'dlq', label: 'still failing', hue: 8 },
        ]}
        caption="Every failing record is copied somewhere else and its offset committed, so one bad record never stalls the records behind it."
      />
      <CodeBlock
        title="a manual-ack listener that never blocks its partition"
        code={`
void onMessage(ConsumerRecord<String, byte[]> record, Acknowledgement ack) {
    try {
        balances.apply(record.key(), parse(record.value()));  // one DB transaction
        ack.ack();
    } catch (DuplicateKeyException alreadyDone) {
        ack.ack();                                          // idempotency: seen it before
    } catch (Exception failure) {
        retries.park(record.key(), failure.getMessage());   // try again later
        ack.ack();                                          // keep the partition moving
    }
}
`}
      />

      <h2>Words from this lesson</h2>
      <TermList
        items={[
          { term: 'Commit', definition: 'Saving a group’s position for a partition so it resumes there.' },
          { term: 'Auto-commit', definition: 'Client commits polled positions periodically in the background.' },
          { term: 'Manual commit / ack', definition: 'Application commits explicitly after processing.' },
          { term: 'At-most-once', definition: 'No duplicates, possible loss.' },
          { term: 'At-least-once', definition: 'No loss, possible duplicates.' },
          { term: 'Exactly-once (EOS)', definition: 'Each record’s effect happens once; via transactions inside Kafka.' },
          { term: 'read_committed', definition: 'Consumer isolation level that hides aborted transactional records.' },
          { term: 'Idempotent consumer', definition: 'A handler for which processing the same record twice has the same effect as once.' },
          { term: 'Poison pill', definition: 'A record that fails every time it is processed.' },
          { term: 'Dead letter queue', definition: 'A topic where unprocessable records are sent for later inspection.' },
        ]}
      />
    </>
  )
}
