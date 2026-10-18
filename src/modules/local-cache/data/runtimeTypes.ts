// Shapes of the events in runtime.ts (one JSON line printed by an experiment = one event).

export type RuntimeApp = 'java' | 'micronaut' | 'ts' | 'rust'
export interface RuntimeEvent {
  exp: string
  [field: string]: unknown
}
export type RuntimeRecording = Record<RuntimeApp, readonly RuntimeEvent[]>

export interface StampedeEvent { lib: string; mode: string; callers: number; loaderMs: number; loaderCalls: number; waits: number[]; errors: number; distinctFutures?: number }
export interface FailureEvent { lib: string; mode: string; callers: number; loaderCalls: number; errors: number; error: string; cachedAfter: boolean; waits: number[]; totalMs: number; sameErrorArc?: number }
export interface AbsentEvent { lib: string; reads: number; nullLoaderCalls: number; nullSize: number; optionalLoaderCalls: number; optionalSize: number }
export interface RefreshEvent { lib: string; mode: string; afterMs: number; loaderMs: number; reads: { atMs: number; tookMs: number; value: string }[] }
export interface ThroughputEvent { lib: string; threads: number; readsPerSec: number; runs: number; cores: number }
export interface FootprintEvent { lib: string; structure: string; n: number; bytesPerEntry: number }
export interface WeightEvent { lib: string; op: string; key: string; bytes: number; present: string[]; weightedSize: number; evicted: string[] }
export interface SoftEvent { lib: string; mode: string; heapMb: number; samples: { inserted: number; entries: number; gcs: number }[]; outcome: string; gcs: number }
export interface GcEvent { entries: number; valueBytes: number; liveHeapMb: number; heapMaxMb: number; seconds: number; requests: number; hitRatio: number; collections: Record<string, { count: number; ms: number }>; maxPauseMs: number }
export interface BenchEvent { lib: string; op: string; opsPerSec: number; passes: number }
export interface MutationEvent { lib: string; mode?: string; sameObject: boolean; otherSees: string; originalTotal: number }
export interface BadKeyEvent { lib: string; reads: number; distinctProducts: number; badHits: number; badSize: number; goodHits: number; goodSize: number }
export interface MeterRow { name: string; type: string; tags: string; value: number; description: string }
