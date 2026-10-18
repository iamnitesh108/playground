/*
 * When autovacuum picks a table (PostgreSQL 18 formulas, see "The Autovacuum Daemon"),
 * and where an xid age sits on the way to wraparound.
 */

export interface AutovacuumSettings {
  threshold: number // autovacuum_vacuum_threshold
  scaleFactor: number // autovacuum_vacuum_scale_factor
  maxThreshold: number // autovacuum_vacuum_max_threshold (new in 18; -1 disables)
  insertThreshold: number // autovacuum_vacuum_insert_threshold
  insertScaleFactor: number // autovacuum_vacuum_insert_scale_factor
  analyzeThreshold: number // autovacuum_analyze_threshold
  analyzeScaleFactor: number // autovacuum_analyze_scale_factor
}

export const DEFAULTS: AutovacuumSettings = {
  threshold: 50,
  scaleFactor: 0.2,
  maxThreshold: 100_000_000,
  insertThreshold: 1000,
  insertScaleFactor: 0.2,
  analyzeThreshold: 50,
  analyzeScaleFactor: 0.1,
}

/** Dead tuples a table may collect before autovacuum vacuums it. */
export function vacuumThreshold(reltuples: number, s: AutovacuumSettings = DEFAULTS): number {
  const t = s.threshold + s.scaleFactor * reltuples
  return s.maxThreshold < 0 ? t : Math.min(s.maxThreshold, t)
}

/** Inserts since the last vacuum that trigger one; only the unfrozen part of the table counts (18). */
export function insertThreshold(reltuples: number, frozenFraction: number, s: AutovacuumSettings = DEFAULTS): number {
  return s.insertThreshold + s.insertScaleFactor * reltuples * (1 - frozenFraction)
}

/** Rows inserted, updated or deleted since the last ANALYZE that trigger one. */
export function analyzeThreshold(reltuples: number, s: AutovacuumSettings = DEFAULTS): number {
  return s.analyzeThreshold + s.analyzeScaleFactor * reltuples
}

// ---------------------------------------------------------------- wraparound

export const XID_SPACE = 2 ** 32
/** Half the circle: how far back an xid can be compared. */
export const XID_HORIZON = 2 ** 31
export const WARN_REMAINING = 40_000_000
export const STOP_REMAINING = 3_000_000

export type AgeZone = 'normal' | 'aggressive' | 'warning' | 'stopped'

/** What the server does when the oldest unfrozen xid in a database is `age` transactions old. */
export function ageZone(age: number, freezeMaxAge = 200_000_000): AgeZone {
  const remaining = XID_HORIZON - age
  if (remaining < STOP_REMAINING) return 'stopped'
  if (remaining < WARN_REMAINING) return 'warning'
  if (age > freezeMaxAge) return 'aggressive'
  return 'normal'
}
