// The programs the eviction and expiry lessons were recorded with (tools/local-cache-capture/policies-*), imported
// as text so the lessons always show the code that ran.
import javaOrder from '../../../../tools/local-cache-capture/policies-java/src/main/java/demo/policies/Order.java?raw'
import javaReplay from '../../../../tools/local-cache-capture/policies-java/src/main/java/demo/policies/Replay.java?raw'
import javaLifetimes from '../../../../tools/local-cache-capture/policies-java/src/main/java/demo/policies/Lifetimes.java?raw'
import javaRefresh from '../../../../tools/local-cache-capture/policies-java/src/main/java/demo/policies/Refresh.java?raw'
import javaJitter from '../../../../tools/local-cache-capture/policies-java/src/main/java/demo/policies/Jitter.java?raw'
import javaBuild from '../../../../tools/local-cache-capture/policies-java/build.gradle?raw'
import tsOrder from '../../../../tools/local-cache-capture/policies-ts/order.ts?raw'
import tsReplay from '../../../../tools/local-cache-capture/policies-ts/replay.ts?raw'
import tsLifetimes from '../../../../tools/local-cache-capture/policies-ts/lifetimes.ts?raw'
import tsFetch from '../../../../tools/local-cache-capture/policies-ts/fetch.ts?raw'
import tsPackage from '../../../../tools/local-cache-capture/policies-ts/package.json?raw'
import rustOrder from '../../../../tools/local-cache-capture/policies-rust/src/order.rs?raw'
import rustReplay from '../../../../tools/local-cache-capture/policies-rust/src/replay.rs?raw'
import rustLifetimes from '../../../../tools/local-cache-capture/policies-rust/src/lifetimes.rs?raw'
import rustReload from '../../../../tools/local-cache-capture/policies-rust/src/reload.rs?raw'
import rustCargo from '../../../../tools/local-cache-capture/policies-rust/Cargo.toml?raw'

/** The text from `start` up to (not including) `end` (or the end of the file), with the common indentation removed. */
function excerpt(source: string, start: string, end?: string): string {
  const from = source.indexOf(start)
  const to = end === undefined ? source.length : source.indexOf(end, from + start.length)
  if (from < 0 || to < 0) throw new Error(`excerpt not found: ${start}`)
  const lines = source.slice(from, to).replace(/\s+$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

export type Lib = 'caffeine' | 'lruCache' | 'moka'

export interface Snippet {
  title: string
  language: string
  code: string
}

export const LIB_LABEL: Record<Lib, string> = { caffeine: 'Java · Caffeine', lruCache: 'TypeScript · lru-cache', moka: 'Rust · moka' }

/** Eviction: a tiny cache and a few requests; the replay loop; the dependency. */
export const EVICTION_CODE: Record<Lib, Snippet[]> = {
  caffeine: [
    { title: 'Order.java — a tiny cache, step by step', language: 'java', code: excerpt(javaOrder, '    static void run', '    private Order()') },
    { title: 'Replay.java — one trace through Caffeine', language: 'java', code: excerpt(javaReplay, '    static void replay(', '    static int[] read') },
    { title: 'build.gradle', language: 'groovy', code: javaBuild.trim() },
  ],
  lruCache: [
    { title: 'order.ts — a tiny cache, step by step', language: 'ts', code: excerpt(tsOrder, '/** A few') },
    { title: 'replay.ts — one trace through lru-cache', language: 'ts', code: excerpt(tsReplay, 'export function replay') },
    { title: 'package.json', language: 'json', code: tsPackage.trim() },
  ],
  moka: [
    { title: 'order.rs — a tiny cache, step by step', language: 'rust', code: excerpt(rustOrder, '/// A few') },
    { title: 'replay.rs — one trace through moka, TinyLFU and LRU', language: 'rust', code: excerpt(rustReplay, '/// Replays') },
    { title: 'Cargo.toml', language: 'ini', code: rustCargo.trim() },
  ],
}

/** Expiry: lifetimes, lazy cleanup, refresh, jitter. */
export const EXPIRY_CODE = {
  lifetimes: {
    caffeine: { title: 'Lifetimes.java — write vs access', language: 'java', code: excerpt(javaLifetimes, '    /** One entry, read every 2 s', '    /** A different lifetime') },
    lruCache: { title: 'lifetimes.ts — ttl with and without updateAgeOnGet', language: 'ts', code: excerpt(tsLifetimes, '/** One entry read every 200 ms') },
    moka: { title: 'lifetimes.rs — time_to_live vs time_to_idle', language: 'rust', code: excerpt(rustLifetimes, '/// One entry read every 200 ms', '/// A different lifetime') },
  },
  lazy: {
    caffeine: { title: 'Lifetimes.java — expired, but still there?', language: 'java', code: excerpt(javaLifetimes, '    /** expireAfterWrite with a hand-moved clock', '    private static void step') },
    lruCache: { title: 'lifetimes.ts — expired, but still there?', language: 'ts', code: excerpt(tsLifetimes, '/** ttl without ttlAutopurge', '/** ttlAutopurge') },
    moka: { title: 'lifetimes.rs — expired, but still there?', language: 'rust', code: excerpt(rustLifetimes, '/// time_to_live without calling', '/// An idle cache') },
  },
  cleaner: {
    caffeine: { title: 'Lifetimes.java — an idle cache, with and without a Scheduler', language: 'java', code: excerpt(javaLifetimes, '    private static void record', '    /** One entry, read every 2 s') },
    lruCache: { title: 'lifetimes.ts — ttlAutopurge', language: 'ts', code: excerpt(tsLifetimes, '/** ttlAutopurge', '/** One entry read every 200 ms') },
    moka: { title: 'lifetimes.rs — an idle cache', language: 'rust', code: excerpt(rustLifetimes, '/// An idle cache', '/// One entry read every 200 ms') },
  },
  perEntry: {
    caffeine: { title: 'Lifetimes.java — a lifetime per entry (Expiry)', language: 'java', code: excerpt(javaLifetimes, '    /** A different lifetime per entry', '    private Lifetimes()') },
    moka: { title: 'lifetimes.rs — a lifetime per entry (Expiry trait)', language: 'rust', code: excerpt(rustLifetimes, '/// A different lifetime per entry') },
  },
  refresh: {
    caffeine: { title: 'Refresh.java — refreshAfterWrite vs expireAfterWrite', language: 'java', code: excerpt(javaRefresh, '    private static void measure', '    private static long elapsedMs') },
    lruCache: { title: 'fetch.ts — fetch() with and without allowStale', language: 'ts', code: excerpt(tsFetch, '/**') },
    moka: { title: 'reload.rs — get_with after time_to_live', language: 'rust', code: excerpt(rustReload, '/// One reader') },
  },
  jitter: { title: 'Jitter.java — the same 60 s for everyone vs 60 s ± 10 %', language: 'java', code: excerpt(javaJitter, '    static void run()', '    private Jitter()') },
} as const
