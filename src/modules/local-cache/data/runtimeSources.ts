// The programs the "Under load" and "In production" lessons were recorded with (tools/local-cache-capture/runtime-*),
// imported as text so the lessons always show the code that ran. Each excerpt is a "#region <name>" … "#endregion" block.
import javaSingleFlight from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/SingleFlight.java?raw'
import javaWeight from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/Weight.java?raw'
import javaSoft from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/SoftValues.java?raw'
import javaStats from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/Stats.java?raw'
import javaPitfalls from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/Pitfalls.java?raw'
import javaThroughput from '../../../../tools/local-cache-capture/runtime-java/src/main/java/demo/runtime/Throughput.java?raw'
import javaBuild from '../../../../tools/local-cache-capture/runtime-java/build.gradle?raw'
import tsSingleFlight from '../../../../tools/local-cache-capture/runtime-ts/singleflight.ts?raw'
import tsMemory from '../../../../tools/local-cache-capture/runtime-ts/memory.ts?raw'
import tsStats from '../../../../tools/local-cache-capture/runtime-ts/stats.ts?raw'
import tsPackage from '../../../../tools/local-cache-capture/runtime-ts/package.json?raw'
import tsPitfalls from '../../../../tools/local-cache-capture/runtime-ts/pitfalls.ts?raw'
import rustSingleFlight from '../../../../tools/local-cache-capture/runtime-rust/src/single_flight.rs?raw'
import rustMemory from '../../../../tools/local-cache-capture/runtime-rust/src/memory.rs?raw'
import rustStats from '../../../../tools/local-cache-capture/runtime-rust/src/stats.rs?raw'
import rustPitfalls from '../../../../tools/local-cache-capture/runtime-rust/src/pitfalls.rs?raw'
import rustCargo from '../../../../tools/local-cache-capture/runtime-rust/Cargo.toml?raw'
import mnService from '../../../../tools/local-cache-capture/runtime-micronaut/src/main/java/demo/cached/ProductService.java?raw'
import mnConfig from '../../../../tools/local-cache-capture/runtime-micronaut/src/main/resources/application.yml?raw'
import mnBuild from '../../../../tools/local-cache-capture/runtime-micronaut/build.gradle?raw'

/** The lines between "#region name" and the next "#endregion", with the common indentation removed. */
function region(source: string, name: string): string {
  const lines = source.split('\n')
  const from = lines.findIndex((l) => l.trim() === `// #region ${name}`)
  const to = lines.findIndex((l, i) => i > from && l.trim() === '// #endregion')
  if (from < 0 || to < 0) throw new Error(`region not found: ${name}`)
  const body = lines.slice(from + 1, to)
  const indent = Math.min(...body.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return body.map((l) => l.slice(indent)).join('\n')
}

/** The text from the line containing `start` up to (not including) the line containing `end`. */
function between(source: string, start: string, end: string): string {
  const lines = source.split('\n')
  const from = lines.findIndex((l) => l.includes(start))
  const to = lines.findIndex((l, i) => i > from && l.includes(end))
  if (from < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  return lines.slice(from, to).join('\n').replace(/\s+$/, '')
}

export type Lang = 'java' | 'ts' | 'rust'
export const LANGS: readonly Lang[] = ['java', 'ts', 'rust']
export const LANG_INFO: Record<Lang, { label: string; library: string; language: string }> = {
  java: { label: 'Java · Caffeine', library: 'Caffeine', language: 'java' },
  ts: { label: 'TypeScript · lru-cache', library: 'lru-cache', language: 'ts' },
  rust: { label: 'Rust · moka', library: 'moka', language: 'rust' },
}

/** One code excerpt with the file it came from. */
export interface Excerpt {
  file: string
  code: string
}
const ex = (file: string, source: string, name: string): Excerpt => ({ file, code: region(source, name) })

export const LOADING: Record<'naive' | 'singleflight' | 'failing' | 'absent' | 'recursive', Record<Lang, Excerpt[]>> = {
  naive: {
    java: [ex('SingleFlight.java', javaSingleFlight, 'naive')],
    ts: [ex('singleflight.ts', tsSingleFlight, 'naive')],
    rust: [ex('single_flight.rs', rustSingleFlight, 'naive')],
  },
  singleflight: {
    java: [ex('SingleFlight.java', javaSingleFlight, 'singleflight'), ex('SingleFlight.java', javaSingleFlight, 'async')],
    ts: [ex('singleflight.ts', tsSingleFlight, 'singleflight')],
    rust: [ex('single_flight.rs', rustSingleFlight, 'singleflight'), ex('single_flight.rs', rustSingleFlight, 'future')],
  },
  failing: {
    java: [ex('SingleFlight.java', javaSingleFlight, 'failing'), ex('SingleFlight.java', javaSingleFlight, 'failingCall')],
    ts: [ex('singleflight.ts', tsSingleFlight, 'failing')],
    rust: [ex('single_flight.rs', rustSingleFlight, 'failing')],
  },
  absent: {
    java: [ex('SingleFlight.java', javaSingleFlight, 'absent')],
    ts: [ex('singleflight.ts', tsSingleFlight, 'absent')],
    rust: [ex('single_flight.rs', rustSingleFlight, 'absent')],
  },
  recursive: {
    java: [ex('SingleFlight.java', javaSingleFlight, 'recursive')],
    ts: [ex('singleflight.ts', tsSingleFlight, 'recursive')],
    rust: [ex('single_flight.rs', rustSingleFlight, 'recursive')],
  },
}

export const BULK: Excerpt = ex('SingleFlight.java', javaSingleFlight, 'bulk')
export const REFRESH: { java: Excerpt; ts: Excerpt } = {
  java: ex('SingleFlight.java', javaSingleFlight, 'refresh'),
  ts: ex('singleflight.ts', tsSingleFlight, 'refresh'),
}
export const SYNCHRONIZED_LRU: Excerpt = ex('Throughput.java', javaThroughput, 'lru')

export const WEIGHT: Record<Lang, Excerpt> = {
  java: ex('Weight.java', javaWeight, 'weight'),
  ts: ex('memory.ts', tsMemory, 'weight'),
  rust: ex('memory.rs', rustMemory, 'weight'),
}
export const SOFT: Excerpt = ex('SoftValues.java', javaSoft, 'soft')

export const STATS: Record<Lang, Excerpt[]> = {
  java: [ex('Stats.java', javaStats, 'stats'), ex('Stats.java', javaStats, 'statsRead')],
  ts: [ex('stats.ts', tsStats, 'stats')],
  rust: [ex('stats.rs', rustStats, 'stats')],
}
export const MEMO: Excerpt = ex('stats.ts', tsStats, 'memo')

export const PITFALLS = {
  mutation: {
    java: [ex('Pitfalls.java', javaPitfalls, 'mutation')],
    ts: [ex('pitfalls.ts', tsPitfalls, 'mutation')],
    rust: [ex('pitfalls.rs', rustPitfalls, 'mutation'), ex('pitfalls.rs', rustPitfalls, 'shared')],
  } satisfies Record<Lang, Excerpt[]>,
  badKey: {
    java: ex('Pitfalls.java', javaPitfalls, 'badKey'),
    ts: ex('pitfalls.ts', tsPitfalls, 'badKey'),
  },
}

export const MICRONAUT = {
  service: mnService.slice(mnService.indexOf('@Singleton')).replace(/\s+$/, ''),
  config: mnConfig.replace(/\s+$/, ''),
  build: between(mnBuild, 'dependencies {', 'application {'),
}

export const SETUP: Record<Lang, { title: string; language: string; code: string }> = {
  java: { title: 'build.gradle', language: 'groovy', code: between(javaBuild, 'dependencies {', 'java {') },
  ts: { title: 'package.json', language: 'json', code: tsPackage.replace(/\s+$/, '') },
  rust: { title: 'Cargo.toml', language: 'ini', code: between(rustCargo, '[dependencies]', '[profile.release]') },
}
