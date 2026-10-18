import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table, TermList } from '@/shared/ui'
import { Flow, StatTiles } from '@/shared/figures'
import { Terminal } from '../components/Terminal'
import { Practical4LogCells, type LogCellSpec } from '../components/Practical4LogCells'
import { parseOffsets } from '../components/PracticalParse'
import { MORE } from '../data/more'
import { USING_APP } from '../data/usingApp'

const T = MORE.tx

/* ------------------------------------------------------------ the partition, from kafka-dump-log */

interface Entry { offset: number; key?: string; value?: string; marker?: 'COMMIT' | 'ABORT'; epoch: number }
const entries: Entry[] = []
{
  let epoch = 0
  for (const l of T.dump.out.split('\n')) {
    if (l.startsWith('baseOffset')) epoch = Number(l.match(/producerEpoch: (\d+)/)?.[1] ?? 0)
    const rec = l.match(/^\| offset: (\d+)(?: key: (\S+))?(?: endTxnMarker: (\w+))?(?: payload: (.*))?$/)
    if (rec) entries.push({ offset: Number(rec[1]), key: rec[2], marker: rec[3] as Entry['marker'], value: rec[4], epoch })
  }
}
/** A data record belongs to the transaction closed by the next marker after it. */
const outcome = (offset: number) => entries.find((e) => e.marker && e.offset > offset)?.marker
const CELLS: LogCellSpec[] = entries.map((e) =>
  e.marker
    ? { offset: e.offset, text: e.marker, note: `marker · epoch ${e.epoch}`, hue: 5, striped: true }
    : { offset: e.offset, text: e.value ?? '', note: `${outcome(e.offset) === 'COMMIT' ? 'committed' : 'aborted'} · epoch ${e.epoch}`, hue: outcome(e.offset) === 'COMMIT' ? 7 : 8 },
)
const delivered = (out: string) =>
  Object.fromEntries(out.split('\n').map((l) => l.match(/^Offset:(\d+)\t/)).filter((m) => m !== null).map((m) => [Number(m[1]), 'delivered']))
const UNCOMMITTED = delivered(T.uncommitted.out)
const COMMITTED = delivered(T.committed.out)
const endOffset = Number(T.endOffsets.out.split(':').pop())
const dataCount = entries.filter((e) => !e.marker).length
const checker = parseOffsets(T.checkGroup.out)[0]

export default function Practical4() {
  return (
    <>
      <LessonGoals
        goals={[
          'write several records atomically with a transactional producer — all visible, or none',
          'see committed and aborted transactions, and the markers that take offsets in the log',
          'read with read_uncommitted and read_committed, and build an exactly-once read-process-write step',
        ]}
        before="Practical 3, and the producer lesson (idempotence)"
      />

      <h2>All or nothing across records</h2>
      <p>
        A transfer is two records — a debit and a credit — and a reader must never see one without the other. A <strong>transaction</strong>{' '}
        makes a group of writes, possibly to several partitions and topics, become visible together or not at all.
      </p>
      <TermList
        items={[
          { term: 'transactional.id', definition: 'A name you choose per producer instance, stable across restarts. It ties a producer to its transactions.' },
          { term: 'producer id / epoch', definition: 'The broker’s number for the producer, and a counter that grows. A higher epoch fences off older instances with the same transactional.id.' },
          { term: 'transaction coordinator', definition: 'The broker that owns this transactional.id. It keeps the transaction state in the internal topic __transaction_state.' },
          { term: 'transaction marker', definition: 'A control record (COMMIT or ABORT) written into every partition the transaction touched. It takes an offset, but is never given to your code.' },
          { term: 'isolation.level', definition: 'read_uncommitted (default) delivers every record; read_committed only records of committed transactions.' },
          { term: 'last stable offset (LSO)', definition: 'The first offset of the oldest still-open transaction. read_committed consumers never read past it.' },
        ]}
      />
      <Flow
        title="One transaction, step by step"
        cols={4}
        rows={3}
        rowHeight={88}
        nodes={[
          { id: 'prod', label: 'producer', sub: 'id transfers-1', col: 0, row: 0, rowSpan: 2, hue: 7, shape: 'actor' },
          { id: 'coord', label: 'transaction coordinator', sub: 'a broker', col: 2, row: 0, span: 2, hue: 5 },
          { id: 'state', label: '__transaction_state', sub: 'Ongoing → PrepareCommit → CompleteCommit', col: 2, row: 2, span: 2, hue: 5, shape: 'store' },
          { id: 'log', label: 'transfers-0', sub: 'records + markers', col: 1, row: 1, span: 2, hue: 3, shape: 'log' },
          { id: 'cons', label: 'consumer', sub: 'read_committed', col: 0, row: 2, hue: 1 },
        ]}
        edges={[
          { from: 'prod', to: 'coord', label: 'init / end' },
          { from: 'coord', to: 'state' },
          { from: 'prod', to: 'log', flow: true, hue: 7 },
          { from: 'coord', to: 'log', label: 'marker', dashed: true },
          { from: 'log', to: 'cons', flow: true, hue: 1 },
        ]}
        steps={[
          { title: '1. initTransactions()', body: <p>The producer finds the coordinator of its transactional.id and gets its producer id and a new epoch. Any older instance with the same id is now fenced: its writes are refused.</p>, active: ['prod', 'coord', 'prod>coord'] },
          { title: '2. beginTransaction() and send()', body: <p><code>beginTransaction</code> only changes state inside the producer. The sends write records to the partition at once, flagged as transactional — they are in the log, but not committed yet. The coordinator records which partitions the transaction touched.</p>, active: ['prod', 'log', 'prod>log', 'coord'] },
          { title: '3. commitTransaction()', body: <p>The coordinator writes PrepareCommit to <code>__transaction_state</code> — from here the commit cannot be undone — then a COMMIT marker into every touched partition, then CompleteCommit.</p>, active: ['prod', 'coord', 'state', 'log', 'prod>coord', 'coord>state', 'coord>log'] },
          { title: '4. Readers', body: <p>A read_committed consumer delivers the records once it reaches the COMMIT marker. For an abort, the marker says ABORT and the records are skipped.</p>, active: ['log', 'cons', 'log>cons'] },
        ]}
      />

      <h2>Two transactions: one committed, one aborted</h2>
      <p>The program below runs two transactions from one producer: a 30 transfer it commits and a 500 transfer it aborts.</p>
      <Terminal steps={[...T.setup, T.features]} />
      <CodeBlock code={USING_APP['PayTransactionally.java']} title="PayTransactionally.java" language="java" />
      <Terminal steps={[T.pay]} title="recorded run" />
      <Callout tone="note" title="Nothing to switch on">
        Transactions need no broker setting on Kafka 4.x: <code>transaction.version</code> is finalized (level 2) on a new cluster. On a single
        test broker you only lower <code>transaction.state.log.replication.factor</code> and <code>transaction.state.log.min.isr</code> to 1,
        because the internal topic otherwise wants three replicas.
      </Callout>

      <h2>Markers take offsets</h2>
      <p>Each transaction ends with a marker record in the partition, and the marker uses an offset like any record.</p>
      <Predict
        question={<p>The producer wrote {dataCount} records in two transactions to an empty partition. What is the partition’s end offset now?</p>}
        options={[String(dataCount), String(dataCount + 2), String(dataCount / 2)]}
        answer={1}
        explanation={<>One marker per transaction per partition: {dataCount} records + 2 markers = {endOffset}. Here is the recording:</>}
      />
      <Terminal steps={[T.endOffsets, { ...T.dump, label: 'the segment file itself (fields trimmed to the interesting ones)' }]} />
      <Practical4LogCells
        title="transfers-0 as recorded by kafka-dump-log, and what each isolation level delivered"
        partition="transfers-0"
        cells={CELLS}
        readers={[
          { label: 'read_uncommitted', hue: 2, got: UNCOMMITTED },
          { label: 'read_committed', hue: 1, got: COMMITTED },
        ]}
        caption={
          <>
            Each cell says whether its record was committed or aborted; hatched cells are the markers written by the coordinator. Neither consumer
            is ever handed a marker, so offsets {entries.filter((e) => e.marker).map((e) => e.offset).join(' and ')} never appear in their output: a
            consumer must not assume offsets are contiguous.
          </>
        }
      />
      <StatTiles
        stats={[
          { label: 'records written', value: dataCount, hue: 7 },
          { label: 'offsets used', value: endOffset, hue: 3, sub: 'records + 2 markers' },
          { label: 'read_uncommitted got', value: Object.keys(UNCOMMITTED).length, hue: 2, sub: 'including the aborted 500' },
          { label: 'read_committed got', value: Object.keys(COMMITTED).length, hue: 1, sub: 'only the committed 30' },
        ]}
      />
      <p>
        The producer epoch grows by one at every transaction end (the markers carry the new epoch): this is how Kafka 4’s transaction
        protocol (<code>transaction.version=2</code>) fences a producer that is still sending after its transaction was finished.
      </p>

      <h2>Reading: read_uncommitted vs read_committed</h2>
      <p>The isolation level is a consumer setting; the console consumer takes it as <code>--isolation-level</code>.</p>
      <Terminal steps={[T.uncommitted, T.committed]} />
      <CodeBlock code={USING_APP['ReadTransfers.java']} title="ReadTransfers.java" language="java" />
      <Terminal steps={[T.javaUncommitted, T.javaCommitted]} title="recorded runs" />
      <p>
        Both end at position {endOffset}: the read_committed consumer skipped the aborted records and both markers, but it did move past them.
      </p>
      <Callout tone="warn" title="An open transaction holds read_committed readers back (not recorded)">
        While a transaction is open, read_committed consumers of that partition stop at the last stable offset — even records of{' '}
        <em>other</em> producers after it wait. A producer that crashes mid-transaction blocks them until <code>transaction.timeout.ms</code>{' '}
        (the recorded one shows its default, 60000) expires and the coordinator aborts it. Keep transactions short.
      </Callout>

      <h2>Inspecting transactions</h2>
      <p><code>kafka-transactions.sh</code> shows what the coordinator knows: every transactional id, its producer id, epoch and state.</p>
      <Terminal steps={[T.txList, T.txDescribe]} />
      <p>
        It can also <code>find-hanging</code> transactions and <code>abort</code> one by hand — the repair tool for a partition whose LSO is
        stuck behind a transaction that will never finish.
      </p>

      <h2>Read-process-write, exactly once</h2>
      <p>
        The classic use: read input, write output, and commit the input offsets <strong>in the same transaction</strong>, so a crash can never
        produce output twice or lose the position.
      </p>
      <Flow
        title="Offsets travel inside the transaction"
        cols={4}
        rows={2}
        rowHeight={88}
        nodes={[
          { id: 'in', label: 'transfers', sub: 'input', col: 0, row: 0, hue: 3, shape: 'log' },
          { id: 'app', label: 'CheckTransfers', sub: 'consumer + transactional producer', col: 1, row: 0, span: 2, hue: 1 },
          { id: 'out', label: 'transfers-checked', sub: 'output', col: 3, row: 0, hue: 3, shape: 'log' },
          { id: 'coord', label: 'transaction coordinator', col: 1, row: 1, span: 2, hue: 5 },
          { id: 'offs', label: '__consumer_offsets', sub: 'group transfer-checker', col: 3, row: 1, hue: 5, shape: 'store' },
        ]}
        edges={[
          { from: 'in', to: 'app', flow: true, hue: 1 },
          { from: 'app', to: 'out', flow: true, hue: 7 },
          { from: 'app', to: 'coord', label: 'offsets + commit' },
          { from: 'coord', to: 'offs', dashed: true },
        ]}
        steps={[
          { title: '1. Poll', body: <p>The consumer reads with <code>isolation.level=read_committed</code>, so aborted input is never processed. Auto-commit is off.</p>, active: ['in', 'app', 'in>app'] },
          { title: '2. Write the output', body: <p>Inside <code>beginTransaction()</code> the results are sent to the output topic.</p>, active: ['app', 'out', 'app>out'] },
          { title: '3. Offsets join the transaction', body: <p><code>sendOffsetsToTransaction(offsets, consumer.groupMetadata())</code> — the <em>producer</em> commits the consumer’s position, as part of the transaction.</p>, active: ['app', 'coord', 'offs', 'app>coord', 'coord>offs'] },
          { title: '4. Commit', body: <p>One <code>commitTransaction()</code> makes the output and the new position visible together. A crash before it aborts both: the input is read again, the half-written output is skipped by read_committed readers.</p>, active: ['in', 'app', 'out', 'coord', 'offs'] },
        ]}
      />
      <CodeBlock code={USING_APP['CheckTransfers.java']} title="CheckTransfers.java" language="java" />
      <Terminal steps={[T.check, T.checkGroup, T.checkedOut, T.checkedOffsets, T.txList2]} title="recorded run and checks" />
      <Callout tone="warn" title="Why the group shows lag after reading everything">
        The group committed offset {checker.current}: the record after the last one it processed. Offsets {checker.current}–{checker.end - 1}{' '}
        are a marker, two aborted records and a marker — nothing the program would ever receive — yet the lag reads {checker.lag}. To make lag
        reach 0 on transactional input, commit <code>consumer.position(partition)</code> instead of <code>lastOffset + 1</code>.
      </Callout>
      <Callout tone="analogy" title="Where “exactly once” stops">
        The guarantee covers what happens <em>inside Kafka</em>: input offsets, output records, together. A side effect outside Kafka — a
        database row, an e-mail, an HTTP call — is not rolled back by an abort. For those, make the effect idempotent (a unique key per record)
        or write it through an outbox.
      </Callout>

      <h2>Design rules</h2>
      <p>Transactions are cheap per record but not free per transaction; use them deliberately.</p>
      <Table
        head={['Rule', 'Why']}
        rows={[
          ['One transactional.id per producer instance, stable across restarts', 'The id is what fences a zombie: a restarted instance with the same id bumps the epoch, the old one is refused.'],
          ['Every consumer of transactional topics uses read_committed', 'The default read_uncommitted delivers aborted records too — the recording shows the 500 transfer.'],
          ['Batch several records per transaction', 'Each commit costs coordinator writes and one marker per partition.'],
          ['Keep transactions short', 'An open transaction holds back every read_committed reader of its partitions.'],
          ['Do not assume consecutive offsets', 'Markers take offsets that are never delivered.'],
          ['Handle ProducerFencedException by closing the producer', 'Another instance owns the id now; this one must stop.'],
        ]}
      />

      <Recap
        points={[
          'initTransactions → beginTransaction → send → commitTransaction or abortTransaction; records are in the log before the commit.',
          'The coordinator ends each transaction with a COMMIT or ABORT marker in every touched partition; markers take offsets.',
          'read_committed delivers only committed records and stops at the last stable offset; read_uncommitted delivers everything.',
          'sendOffsetsToTransaction commits the consumer position atomically with the output: exactly-once read-process-write inside Kafka.',
        ]}
      />
    </>
  )
}
