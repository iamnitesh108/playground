// Formats replies exactly as an interactive redis-cli (TTY mode) prints them,
// and splits a command line into arguments the way redis-cli does.
// capture.mjs checks both against the real redis-cli before recording anything.

function repr(buf) {
  let s = '"'
  for (const b of buf) {
    const c = String.fromCharCode(b)
    if (c === '\\' || c === '"') s += '\\' + c
    else if (c === '\n') s += '\\n'
    else if (c === '\r') s += '\\r'
    else if (c === '\t') s += '\\t'
    else if (b === 7) s += '\\a'
    else if (b === 8) s += '\\b'
    else if (b >= 32 && b < 127) s += c
    else s += '\\x' + b.toString(16).padStart(2, '0')
  }
  return s + '"'
}

export function formatReply(r, prefix = '') {
  switch (r.type) {
    case 'status': return r.value + '\n'
    case 'error': return '(error) ' + r.value + '\n'
    case 'integer': return '(integer) ' + r.value + '\n'
    case 'bulk': return repr(r.value) + '\n'
    case 'nil': case 'nil-array': return '(nil)\n'
    case 'array': {
      if (r.value.length === 0) return '(empty array)\n'
      const idxlen = String(r.value.length).length
      const inner = prefix + ' '.repeat(idxlen + 2)
      let out = ''
      r.value.forEach((item, i) => {
        out += (i === 0 ? '' : prefix) + String(i + 1).padStart(idxlen) + ') '
        out += formatReply(item, inner)
      })
      return out
    }
  }
}

/** redis-cli style argument splitting: spaces separate, "double" and 'single' quotes group. */
export function splitArgs(line) {
  const args = []
  let i = 0
  while (i < line.length) {
    while (line[i] === ' ') i++
    if (i >= line.length) break
    let cur = ''
    if (line[i] === '"') {
      i++
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && i + 1 < line.length) {
          const n = line[++i]
          cur += n === 'n' ? '\n' : n === 't' ? '\t' : n === 'r' ? '\r' : n
        } else cur += line[i]
        i++
      }
      i++
    } else if (line[i] === "'") {
      i++
      while (i < line.length && line[i] !== "'") cur += line[i++]
      i++
    } else {
      while (i < line.length && line[i] !== ' ') cur += line[i++]
    }
    args.push(cur)
  }
  return args
}
