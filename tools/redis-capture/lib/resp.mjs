// A minimal RESP2 client (no dependencies): enough to script several
// connections against a real server and keep the exact replies.
import net from 'node:net'

export class ReplyError extends Error {}

/** Encodes one command as a RESP array of bulk strings. */
export function encode(args) {
  let out = `*${args.length}\r\n`
  for (const a of args) {
    const s = Buffer.isBuffer(a) ? a : Buffer.from(String(a))
    out += `$${s.length}\r\n${s.toString('latin1')}\r\n`
  }
  return Buffer.from(out, 'latin1')
}

/** Parses one reply from buf at pos. Returns [reply, nextPos] or null if incomplete. */
export function parse(buf, pos = 0) {
  const eol = buf.indexOf('\r\n', pos)
  if (eol < 0) return null
  const type = String.fromCharCode(buf[pos])
  const line = buf.toString('latin1', pos + 1, eol)
  const next = eol + 2
  switch (type) {
    case '+': return [{ type: 'status', value: line }, next]
    case '-': return [{ type: 'error', value: line }, next]
    case ':': return [{ type: 'integer', value: BigInt(line) }, next]
    case '$': {
      const len = Number(line)
      if (len < 0) return [{ type: 'nil' }, next]
      if (buf.length < next + len + 2) return null
      return [{ type: 'bulk', value: buf.subarray(next, next + len) }, next + len + 2]
    }
    case '*': {
      const n = Number(line)
      if (n < 0) return [{ type: 'nil-array' }, next]
      const items = []
      let p = next
      for (let i = 0; i < n; i++) {
        const r = parse(buf, p)
        if (!r) return null
        items.push(r[0])
        p = r[1]
      }
      return [{ type: 'array', value: items }, p]
    }
    default:
      throw new Error(`unexpected RESP type byte ${JSON.stringify(type)}`)
  }
}

/** Plain JS value of a reply (errors become ReplyError instances, not throws). */
export function plain(r) {
  switch (r.type) {
    case 'status': return r.value
    case 'error': return new ReplyError(r.value)
    case 'integer': return Number(r.value)
    case 'bulk': return r.value.toString('utf8')
    case 'nil': case 'nil-array': return null
    case 'array': return r.value.map(plain)
  }
}

export class Client {
  constructor(port, host = '127.0.0.1') {
    this.port = port
    this.host = host
    this.buf = Buffer.alloc(0)
    this.waiting = []
    this.pushes = []        // pub/sub messages that arrive without a request
    this.onPush = null
    this.rawLog = null       // when an array, raw bytes in and out are appended
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.sock = net.createConnection({ port: this.port, host: this.host }, resolve)
      this.sock.setNoDelay(true)
      this.sock.on('error', (e) => { for (const w of this.waiting.splice(0)) w.reject(e); reject(e) })
      this.sock.on('data', (d) => this.#data(d))
      this.sock.on('close', () => { this.closed = true; for (const w of this.waiting.splice(0)) w.reject(new Error('connection closed')) })
    })
  }

  #data(d) {
    this.rawLog?.push({ dir: 'in', bytes: d.toString('latin1') })
    this.buf = Buffer.concat([this.buf, d])
    for (;;) {
      const r = parse(this.buf)
      if (!r) break
      this.buf = this.buf.subarray(r[1])
      const w = this.waiting.shift()
      if (w) w.resolve(r[0])
      else { this.pushes.push(r[0]); this.onPush?.(r[0]) }
    }
  }

  /** Sends one command and resolves with the raw reply object. */
  send(...args) {
    if (this.closed) return Promise.reject(new Error('connection closed'))
    const bytes = encode(args)
    this.rawLog?.push({ dir: 'out', bytes: bytes.toString('latin1') })
    return new Promise((resolve, reject) => {
      this.waiting.push({ resolve, reject })
      this.sock.write(bytes)
    })
  }

  /** Sends one command and resolves with a plain JS value; throws on an error reply. */
  async call(...args) {
    const v = plain(await this.send(...args))
    if (v instanceof ReplyError) throw v
    return v
  }

  /** Sends many commands in one write (a pipeline) and resolves with all replies. */
  pipeline(commands) {
    const bytes = Buffer.concat(commands.map(encode))
    const promises = commands.map(() => new Promise((resolve, reject) => this.waiting.push({ resolve, reject })))
    this.sock.write(bytes)
    return Promise.all(promises)
  }

  /** Waits for the next unsolicited message (pub/sub). */
  nextPush(timeoutMs = 2000) {
    if (this.pushes.length) return Promise.resolve(this.pushes.shift())
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => { this.onPush = null; reject(new Error('no push message')) }, timeoutMs)
      this.onPush = (m) => { clearTimeout(t); this.onPush = null; this.pushes.splice(this.pushes.indexOf(m), 1); resolve(m) }
    })
  }

  close() { this.sock?.destroy() }
}

export async function connect(port) {
  const c = new Client(port)
  await c.connect()
  return c
}
