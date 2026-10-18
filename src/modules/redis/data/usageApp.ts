// The Micronaut + Lettuce app the "using Redis" lessons were recorded with: its real source files
// (tools/redis-capture/usage-app), imported as text so the lessons always show what ran.
import application from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/Application.java?raw'
import asyncDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/AsyncDemo.java?raw'
import out from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/Out.java?raw'
import pipelineDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/PipelineDemo.java?raw'
import pubSubDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/PubSubDemo.java?raw'
import reconnectDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/ReconnectDemo.java?raw'
import timeoutDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/TimeoutDemo.java?raw'
import usageDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/UsageDemo.java?raw'
import watchDemo from '../../../../tools/redis-capture/usage-app/src/main/java/demo/usage/WatchDemo.java?raw'
import applicationYml from '../../../../tools/redis-capture/usage-app/src/main/resources/application.yml?raw'
import buildGradle from '../../../../tools/redis-capture/usage-app/build.gradle?raw'

export const USAGE_APP = {
  'build.gradle': buildGradle,
  'application.yml': applicationYml,
  'Application.java': application,
  'Out.java': out,
  'UsageDemo.java': usageDemo,
  'AsyncDemo.java': asyncDemo,
  'PubSubDemo.java': pubSubDemo,
  'PipelineDemo.java': pipelineDemo,
  'WatchDemo.java': watchDemo,
  'TimeoutDemo.java': timeoutDemo,
  'ReconnectDemo.java': reconnectDemo,
} as const

export type UsageFile = keyof typeof USAGE_APP

/** The Java lines of UsageDemo between say("<name>") and the next say(…), indentation removed. */
export function javaSection(name: string): string {
  const lines = usageDemo.split('\n')
  const start = lines.findIndex((l) => l.includes(`say("${name}")`))
  if (start < 0) throw new Error(`no section ${name}`)
  const end = lines.findIndex((l, i) => i > start && (l.includes('say("') || /^ {4}}/.test(l)))
  return lines.slice(start + 1, end).map((l) => l.replace(/^ {8}/, '')).join('\n').trim()
}

/** The recorded output lines of one section ("# <name>" up to the next "# …"). */
export function outputSection(lines: readonly string[], name: string): string[] {
  const start = lines.indexOf(`# ${name}`)
  if (start < 0) throw new Error(`no output section ${name}`)
  const end = lines.findIndex((l, i) => i > start && l.startsWith('# '))
  return lines.slice(start + 1, end < 0 ? undefined : end)
}
