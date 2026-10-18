// The three apps the multi-level caching lesson was recorded with (tools/redis-capture/tiered), imported as text
// so the lesson always shows the code that ran.
import javaCache from '../../../../tools/redis-capture/tiered/micronaut/src/main/java/demo/tiered/TieredProductCache.java?raw'
import javaConfig from '../../../../tools/redis-capture/tiered/micronaut/src/main/resources/application.yml?raw'
import javaBuild from '../../../../tools/redis-capture/tiered/micronaut/build.gradle?raw'
import tsCache from '../../../../tools/redis-capture/tiered/ts/cache.ts?raw'
import tsPackage from '../../../../tools/redis-capture/tiered/ts/package.json?raw'
import rustCache from '../../../../tools/redis-capture/tiered/rust/src/cache.rs?raw'
import rustCargo from '../../../../tools/redis-capture/tiered/rust/Cargo.toml?raw'

/** The text from `start` up to (not including) `end`, with the common indentation removed. */
function excerpt(source: string, start: string, end: string): string {
  const from = source.indexOf(start)
  const to = source.indexOf(end, from + start.length)
  if (from < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  const lines = source.slice(from, to).replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

export type Language = 'micronaut' | 'ts' | 'rust'

export interface Sources {
  label: string
  file: string
  l1: string
  read: string
  write: string
  listen: string
  setup: { title: string; language: string; code: string }[]
}

export const SOURCES: Record<Language, Sources> = {
  micronaut: {
    label: 'Micronaut + Caffeine',
    file: 'TieredProductCache.java',
    l1: 'Caffeine',
    read: `${excerpt(javaCache, '    /**\n     * L1 → L2 → Postgres.', '    /** The same read without')}\n\n${excerpt(javaCache, '    private Read loadBelowL1', '    /**\n     * The write path')}`,
    write: excerpt(javaCache, '    /**\n     * The write path', '    /** Makes a product cold'),
    listen: excerpt(javaCache, '    private Cache<Integer, Read> newL1()', '    public void onEvict'),
    setup: [
      { title: 'build.gradle (dependencies)', language: 'groovy', code: excerpt(javaBuild, 'dependencies {', 'application {') },
      { title: 'application.yml', language: 'yaml', code: javaConfig },
    ],
  },
  ts: {
    label: 'TypeScript + lru-cache',
    file: 'cache.ts',
    l1: 'lru-cache',
    read: `${excerpt(tsCache, '  /** L1 → L2 → Postgres', '  /** The same read without')}\n\n${excerpt(tsCache, '  private async loadBelowL1', '  private async load(')}`,
    write: excerpt(tsCache, '  /**\n   * The write path', '  /** Makes a product cold'),
    listen: excerpt(tsCache, '  private newL1()', '  /** L1 → L2 → Postgres'),
    setup: [{ title: 'package.json', language: 'json', code: tsPackage }],
  },
  rust: {
    label: 'Rust + moka',
    file: 'cache.rs',
    l1: 'moka',
    read: `${excerpt(rustCache, '    /// L1 → L2 → Postgres.', '    /// The same read without')}\n\n${excerpt(rustCache, '    async fn load_below_l1', '    async fn load(')}`,
    write: excerpt(rustCache, '    /// The write path', '    /// Makes a product cold'),
    listen: excerpt(rustCache, '    fn new_l1', '    /// L1 → L2 → Postgres.'),
    setup: [{ title: 'Cargo.toml', language: 'ini', code: rustCargo }],
  },
}
