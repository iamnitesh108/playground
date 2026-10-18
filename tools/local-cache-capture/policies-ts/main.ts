// One entry point, one experiment per command; every experiment prints JSON lines.
import { replay } from './replay.ts'
import { order } from './order.ts'
import { lazy, autopurge, ageOnGet } from './lifetimes.ts'
import { staleWhileRevalidate } from './fetch.ts'

const [command, ...args] = process.argv.slice(2)
const commands: Record<string, () => unknown> = {
  replay: () => replay(args[0], args.slice(1).map(Number)),
  order: () => order(Number(args[0]), args.slice(1)),
  lazy,
  autopurge,
  'age-on-get': ageOnGet,
  fetch: staleWhileRevalidate,
}
if (!commands[command]) throw new Error(`unknown command ${command}`)
await commands[command]()
