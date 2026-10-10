import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const SERVER = `import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.end('ok')
  } else if (req.url === '/orders/42') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ id: 42, status: 'PAID' }))
  } else if (req.url === '/report') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.write('part 1\\n')
    setTimeout(() => res.end('part 2\\n'), 20)
  } else if (req.method === 'POST') {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => { /* … respond 201 … */ })
  }
})
server.listen(3000)`

/** Shows CR LF line ends as they are on the wire. */
const wire = (text: string) => text.replace(/\r\n/g, '↵\n')

export default function Http() {
  const h = CAPTURE.http
  const [health, order, report, post] = h.exchanges
  return (
    <>
      <LessonGoals
        goals={[
          'read raw HTTP/1.1 requests and responses',
          'know when Node.js sends Content-Length and when it sends a chunked body',
          'explain keep-alive and the server’s timeouts',
          'receive a request body as a stream',
        ]}
        before="Lesson 7 — streams"
      />

      <h2>HTTP is text on a socket</h2>
      <p>
        An HTTP/1.1 request is lines of text ending in CR LF (↵), a blank line, then an optional body. The server below was spoken to over a raw TCP
        socket, so every byte is visible. All four requests used <strong>one</strong> connection.
      </p>
      <CodeBlock title="server.js" code={SERVER} />

      <h2>A response with a known length</h2>
      <div className={own.grid2}>
        <CodeBlock title="request — sent" code={wire(health.request)} />
        <CodeBlock title="response — recorded" code={wire(health.response)} />
      </div>
      <p>
        <code>res.end('ok')</code> with no headers written yet: Node.js knows the whole body, so it sends <code>Content-Length: 2</code>.{' '}
        <code>Connection: keep-alive</code> and <code>Keep-Alive: timeout=5</code> tell the client it may send the next request on this connection
        within 5 seconds.
      </p>

      <h2>Chunked bodies</h2>
      <Predict
        question={
          <p>
            The handler calls <code>res.writeHead(200, {'{'} 'content-type': … {'}'})</code> and then <code>res.end(body)</code>. Does the response carry a
            Content-Length?
          </p>
        }
        options={['Yes, Node.js computes it', 'No, it uses Transfer-Encoding: chunked']}
        answer={1}
        explanation="writeHead fixed the headers before the body was known, and none of them was a length — so Node.js chose chunked encoding. Recorded:"
      />
      <div className={own.grid2}>
        <CodeBlock title="request — sent" code={wire(order.request)} />
        <CodeBlock title="response — recorded" code={wire(order.response)} />
      </div>
      <p>
        A chunked body is a series of <code>size in hex ↵ data ↵</code>, ended by a chunk of size <code>0</code>. Here 0x19 = 25 bytes of JSON. Set{' '}
        <code>content-length</code> yourself (<code>Buffer.byteLength(body)</code>) if a client or proxy needs it.
      </p>
      <p>Chunked encoding is what makes streaming possible — the server can send part of a response before the rest exists:</p>
      <div className={own.grid2}>
        <CodeBlock title="request — sent" code={wire(report.request)} />
        <CodeBlock title="response — recorded (second chunk 20 ms later)" code={wire(report.response)} />
      </div>

      <h2>The request body is a stream</h2>
      <p>The client sent this POST in two TCP writes, 50 ms apart. The server saw:</p>
      <div className={own.grid2}>
        <CodeBlock title="request — sent" code={wire(post.request)} />
        <CodeBlock title="server events — recorded" code={h.events.join('\n')} />
      </div>
      <CodeBlock title="response — recorded" code={wire(post.response)} />
      <p>
        <code>req</code> is a Readable stream: the body arrives in as many <code>data</code> events as the network delivers. Collect until{' '}
        <code>end</code>, and cap the size — otherwise one large request can fill the memory. Frameworks do this for you, with a limit.
      </p>

      <h2>Timeouts that protect the server</h2>
      <Table
        head={['http.Server setting', 'recorded default', 'what it limits']}
        rows={[
          ['keepAliveTimeout', `${h.defaults.keepAliveTimeout} ms`, 'how long an idle keep-alive connection stays open'],
          ['headersTimeout', `${h.defaults.headersTimeout} ms`, 'time to receive the complete request headers'],
          ['requestTimeout', `${h.defaults.requestTimeout} ms`, 'time to receive the entire request'],
          ['http.maxHeaderSize', `${h.defaults.maxHeaderSize} bytes`, 'total size of request headers'],
        ]}
      />
      <Callout tone="warn" title="Behind a load balancer">
        If the load balancer keeps idle connections open longer than Node.js does (5 s), it may send a request on a connection Node.js is just
        closing, and the client gets a 502. Set <code>server.keepAliveTimeout</code> higher than the load balancer’s idle timeout (and{' '}
        <code>headersTimeout</code> a bit higher still).
      </Callout>

      <Recap
        points={[
          'HTTP/1.1 is text: request line, headers, blank line, body — many requests per keep-alive connection.',
          'res.end(body) alone sends Content-Length; after writeHead without a length, Node.js sends a chunked body.',
          'The request body is a stream of data events: collect it with a size limit.',
          'Tune keepAliveTimeout against your load balancer’s idle timeout.',
        ]}
      />
    </>
  )
}
