/** Request lines, response lines and body of a recorded `curl -v` exchange, separated by blank lines. */
export function parseWire(wire: string) {
  const lines = wire.split('\n')
  const reqEnd = lines.indexOf('')
  let i = reqEnd
  while (lines[i] === '') i++
  const resStart = i
  while (i < lines.length && lines[i] !== '') i++
  const resEnd = i
  while (lines[i] === '') i++
  return { request: lines.slice(0, reqEnd), response: lines.slice(resStart, resEnd), body: lines.slice(i).join('\n') }
}
