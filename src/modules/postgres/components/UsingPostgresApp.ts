// The Java (JDBC + HikariCP) and TypeScript (node-postgres) programs the "Using PostgreSQL" lesson shows,
// imported as text from tools/postgres-capture so the lesson always shows the code that ran.
import buildGradle from '../../../../tools/postgres-capture/start-app-java/build.gradle?raw'
import usageDemo from '../../../../tools/postgres-capture/start-app-java/src/main/java/demo/start/UsageDemo.java?raw'
import packageJson from '../../../../tools/postgres-capture/start-app-ts/package.json?raw'
import demoTs from '../../../../tools/postgres-capture/start-app-ts/demo.ts?raw'

export const START_APP = {
  java: { 'build.gradle': buildGradle, 'UsageDemo.java': usageDemo },
  ts: { 'package.json': packageJson, 'demo.ts': demoTs },
} as const

export type AppSection = 'connect' | 'insert' | 'select' | 'errors' | 'transaction' | 'batch' | 'upsert' | 'keyset'

/** Lines from a say("<name>") marker up to the next say(…) or the end of the block, indentation removed. */
function section(source: string, marker: RegExp, name: string, stop: RegExp): string {
  const lines = source.split('\n')
  const start = lines.findIndex((l) => marker.test(l) && l.includes(name))
  if (start < 0) throw new Error(`no section ${name}`)
  let end = lines.findIndex((l, i) => i > start && stop.test(l))
  if (end < 0) end = lines.length
  const body = lines.slice(start + 1, end)
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return body.map((l) => l.slice(indent)).join('\n').trim()
}

export const javaSection = (name: AppSection) => section(usageDemo, /say\("/, `say("${name}")`, /say\("|^ {8}}$/)
export const tsSection = (name: AppSection) => section(demoTs, /^say\('/, `say('${name}')`, /^say\('|^await pool\.end/)

/** The recorded output lines of one section ("# <name>" up to the next "# …"). */
export function outputSection(lines: readonly string[], name: AppSection): string {
  const start = lines.indexOf(`# ${name}`)
  if (start < 0) throw new Error(`no output section ${name}`)
  const end = lines.findIndex((l, i) => i > start && l.startsWith('# '))
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n')
}
