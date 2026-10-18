// The programs the basics lessons were recorded with (tools/local-cache-capture/basics-*), imported as text so the
// lessons always show the code that ran. Each task is a "#region <name>" … "#endregion" block in the source.
import javaUsing from '../../../../tools/local-cache-capture/basics-java/src/main/java/basics/Using.java?raw'
import javaWhy from '../../../../tools/local-cache-capture/basics-java/src/main/java/basics/Why.java?raw'
import javaBuild from '../../../../tools/local-cache-capture/basics-java/build.gradle?raw'
import tsUsing from '../../../../tools/local-cache-capture/basics-ts/using.ts?raw'
import tsWhy from '../../../../tools/local-cache-capture/basics-ts/why.ts?raw'
import tsPackage from '../../../../tools/local-cache-capture/basics-ts/package.json?raw'
import rustUsing from '../../../../tools/local-cache-capture/basics-rust/src/bin/using.rs?raw'
import rustWhy from '../../../../tools/local-cache-capture/basics-rust/src/bin/why.rs?raw'
import rustCargo from '../../../../tools/local-cache-capture/basics-rust/Cargo.toml?raw'
import mnService from '../../../../tools/local-cache-capture/basics-micronaut/src/main/java/basics/micronaut/ProductService.java?raw'
import mnConfig from '../../../../tools/local-cache-capture/basics-micronaut/src/main/resources/application.yml?raw'
import mnBuild from '../../../../tools/local-cache-capture/basics-micronaut/build.gradle?raw'

/** The lines between "#region name" and "#endregion", with the common indentation removed. */
function region(source: string, name: string): string {
  const lines = source.split('\n')
  const from = lines.findIndex((l) => l.trim().endsWith(`#region ${name}`))
  const to = lines.findIndex((l, i) => i > from && l.trim().endsWith('#endregion'))
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

export const LANG_INFO: Record<Lang, { label: string; library: string; file: string; language: string }> = {
  java: { label: 'Java · Caffeine', library: 'Caffeine', file: 'Using.java', language: 'java' },
  ts: { label: 'TypeScript · lru-cache', library: 'lru-cache', file: 'using.ts', language: 'ts' },
  rust: { label: 'Rust · moka', library: 'moka', file: 'using.rs', language: 'rust' },
}

const USING: Record<Lang, string> = { java: javaUsing, ts: tsUsing, rust: rustUsing }

/** The code of one task of the API tour, per language. */
export const usingCode = (lang: Lang, task: string) => region(USING[lang], task)

/** The heap-growth loop of the "why" programs. */
export const heapCode: Record<Lang, string> = {
  java: region(javaWhy, 'heap'),
  ts: region(tsWhy, 'heap'),
  rust: region(rustWhy, 'heap'),
}

export const setup: Record<Lang, { title: string; language: string; code: string }> = {
  java: { title: 'build.gradle', language: 'groovy', code: between(javaBuild, 'dependencies {', 'java {') },
  ts: { title: 'package.json', language: 'json', code: tsPackage },
  rust: { title: 'Cargo.toml', language: 'ini', code: between(rustCargo, '[dependencies]', 'tokio') + '\n' + rustCargo.split('\n').find((l) => l.startsWith('tokio'))! },
}

export const micronaut = {
  service: mnService.slice(mnService.indexOf('/**')),
  config: mnConfig,
  build: between(mnBuild, 'dependencies {', 'application {'),
}
