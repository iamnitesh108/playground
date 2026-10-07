import { useState } from 'react'
import { Callout, CodeBlock, Demo, Segmented, Table, TermList, Walkthrough, type WalkthroughStep } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { PartitionLog } from '../components'
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
      <Callout tone="tip" title="At-least-once + idempotent consumer">
        Commit after processing, and make processing safe to repeat. Typical tricks: a unique constraint on a business
        ID (a duplicate insert fails and you treat that as “already done”), an “processed events” table, or upserts
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
          outbox (lesson 13) will send again later.
        </li>
      </ul>
      <CodeBlock
        title="a manual-ack listener that never blocks its partition"
        code={`
void onMessage(ConsumerRecord<String, byte[]> record, Acknowledgement ack) {
    try {
        ledger.apply(record.key(), parse(record.value()));  // one DB transaction
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
