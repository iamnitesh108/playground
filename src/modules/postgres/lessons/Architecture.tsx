import type { ReactNode } from 'react'
import { Box, Callout, CodeBlock, Connector, LessonGoals, Predict, Recap, Table, Walkthrough } from '@/shared/ui'
import { CAPTURE, PROCESSES } from '../data/captures'
import own from './lesson.module.css'

type Node = 'client' | 'backend' | 'buffers' | 'walbuf' | 'wal' | 'data'

const STEPS: { title: string; body: ReactNode; on: Node[]; edge?: string }[] = [
  {
    title: 'The client sends a statement',
    body: <p>Your application sends <code>UPDATE accounts SET balance = 150 WHERE id = 1</code> over its connection.</p>,
    on: ['client', 'backend'],
    edge: 'client-backend',
  },
  {
    title: 'A backend process runs it',
    body: <p>Each connection has its own <strong>backend process</strong>. It parses the SQL, plans it (here: use the primary-key index) and executes it.</p>,
    on: ['backend'],
  },
  {
    title: 'The page is found in shared buffers',
    body: <p>Tables are read in 8 KB <strong>pages</strong>. The executor asks for the page holding <code>id = 1</code>; if it is not in <strong>shared buffers</strong> yet, it is read from the data file first.</p>,
    on: ['backend', 'buffers'],
    edge: 'backend-buffers',
  },
  {
    title: 'The change is made in memory and logged',
    body: <p>The page is changed in shared buffers (it is now <em>dirty</em>), and a record describing the change goes into the <strong>WAL buffers</strong>. Neither is on disk yet.</p>,
    on: ['backend', 'buffers', 'walbuf'],
    edge: 'backend-walbuf',
  },
  {
    title: 'COMMIT flushes the WAL',
    body: <p>On COMMIT, the WAL up to the commit record is written and <code>fsync</code>ed to <code>pg_wal/</code>. Only then does the client get <code>COMMIT</code> back. This is what makes the change durable.</p>,
    on: ['walbuf', 'wal', 'client'],
    edge: 'walbuf-wal',
  },
  {
    title: 'The data file is updated later',
    body: <p>The dirty page reaches the table’s data file afterwards — written by the background writer or at the next checkpoint. If the server crashes before that, the WAL is replayed (lesson 8).</p>,
    on: ['buffers', 'data'],
    edge: 'buffers-data',
  },
]

function Path() {
  return (
    <Walkthrough title="One UPDATE and its COMMIT, end to end" steps={STEPS} intervalMs={2600}>
      {(i) => {
        const { on, edge } = STEPS[i]
        const a = (n: Node) => on.includes(n)
        return (
          <div className={own.flow}>
            <Box title="Client" caption="your app" active={a('client')} />
            <Connector active={edge === 'client-backend'} label="SQL" />
            <Box title="Backend" caption="one per connection" active={a('backend')} />
            <Connector active={edge === 'backend-buffers'} />
            <Box title="Shared buffers" caption="cached 8 KB pages" active={a('buffers')} />

            <span />
            <span />
            <Connector direction="down" active={edge === 'backend-walbuf'} label="log the change" />
            <span />
            <Connector direction="down" dashed active={edge === 'buffers-data'} label="later" />

            <span />
            <span />
            <Box title="WAL buffers" caption="memory" active={a('walbuf')} />
            <span />
            <Box title="Data files" caption="base/<db oid>/<table>" active={a('data')} />

            <span />
            <span />
            <Connector direction="down" active={edge === 'walbuf-wal'} label="fsync at COMMIT" />
            <span />
            <span />

            <span />
            <span />
            <Box title="WAL files" caption="pg_wal/" active={a('wal')} />
          </div>
        )
      }}
    </Walkthrough>
  )
}

export default function Architecture() {
  const h = CAPTURE.pageHeader
  return (
    <>
      <LessonGoals
        goals={[
          'name the processes of a running PostgreSQL server and what each does',
          'explain shared buffers, WAL buffers, data files and WAL files',
          'say exactly where a change is when COMMIT returns',
        ]}
      />

      <h2>A server is a family of processes</h2>
      <p>
        PostgreSQL uses processes, not threads. The first process (the <em>postmaster</em>) listens for connections and
        starts one <strong>backend</strong> per client connection, plus a set of background workers. This is the real
        process list of the PostgreSQL 18 server used for this module, with one client connected:
      </p>
      <CodeBlock title="ps -eo pid,ppid,cmd   (inside the server's container)" code={PROCESSES} />
      <Table
        head={['Process', 'Job']}
        rows={[
          ['postgres (postmaster)', 'Parent of everything: accepts connections, starts backends, restarts workers that die'],
          ['client backend', 'One per connection; runs that client’s SQL (not running here: it appears per connection)'],
          ['checkpointer', 'Writes all dirty pages at checkpoints and records the redo point (lesson 8)'],
          ['background writer', 'Trickles dirty pages to disk so backends rarely have to'],
          ['walwriter', 'Flushes WAL buffers to disk in the background'],
          ['autovacuum launcher', 'Starts autovacuum workers that clean up dead row versions (lesson 3)'],
          ['logical replication launcher', 'Starts workers for logical replication subscriptions'],
          ['io worker', 'New in PostgreSQL 18: performs reads for the asynchronous I/O subsystem (io_method = worker)'],
        ]}
      />
      <Callout tone="note" title="One process per connection">
        Every connection costs a process with its own memory. That is why <code>max_connections</code> is modest (default
        100) and applications use connection pools rather than thousands of connections.
      </Callout>

      <h2>Memory and files</h2>
      <ul>
        <li><strong>Shared buffers</strong> — the page cache shared by all backends (<code>shared_buffers</code>, default 128 MB; servers typically use about 25% of RAM).</li>
        <li><strong>WAL buffers</strong> — recently generated WAL not yet written (<code>wal_buffers</code>; 4 MB here, derived from shared_buffers).</li>
        <li><strong>Data files</strong> — every table and index is a file under <code>base/&lt;database oid&gt;/</code>, split into 1 GB segments.</li>
        <li><strong>WAL files</strong> — the write-ahead log in <code>pg_wal/</code>, written sequentially.</li>
      </ul>

      <h2>Everything is 8 KB pages</h2>
      <p>
        Files are read and written in pages of <code>block_size</code> = {CAPTURE.blockSize} bytes. For the two-row{' '}
        <code>accounts</code> table, <code>page_header()</code> reports <code>lower = {h.lower}</code> and{' '}
        <code>upper = {h.upper}</code>:
      </p>
      <ul>
        <li>a 24-byte page header, then one 4-byte <strong>line pointer</strong> per row: 24 + 2 × 4 = {h.lower} — <code>lower</code> marks where they end;</li>
        <li>the rows themselves (<strong>tuples</strong>) are stored from the <em>end</em> of the page backwards: two 32-byte tuples end at 8192 and start at {h.upper} — <code>upper</code>;</li>
        <li>the gap between <code>lower</code> and <code>upper</code> is free space. New rows fill it from both sides.</li>
      </ul>
      <p>A row’s address is its <strong>ctid</strong>: (page number, line pointer), e.g. <code>(0,1)</code>.</p>

      <Predict
        question={<p>A client runs an UPDATE and gets <code>COMMIT</code> back. Where is the change now guaranteed to be on disk?</p>}
        options={['In the table’s data file', 'In the WAL', 'In both', 'Nowhere yet']}
        answer={1}
        explanation={
          <>
            COMMIT waits only for the WAL to be flushed. The changed page sits in shared buffers and reaches the data file
            later — after a crash it is rebuilt from the WAL. Step through it:
          </>
        }
      />
      <Path />

      <Recap
        points={[
          'One backend process per connection, plus background processes: checkpointer, background writer, walwriter, autovacuum, I/O workers.',
          'All data lives in 8 KB pages: line pointers at the start, tuples from the end.',
          'COMMIT makes a change durable by flushing the WAL; data files catch up later.',
        ]}
      />
    </>
  )
}
