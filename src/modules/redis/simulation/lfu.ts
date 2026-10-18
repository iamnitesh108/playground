/*
 * The LFU counter of a key: 8 bits that grow logarithmically and decay with time.
 * A port of LFULogIncr / LFUDecrAndReturn from evict.c.
 */

export const LFU_INIT_VAL = 5

/** One access: the higher the counter, the less likely it grows. */
export function lfuIncrement(counter: number, logFactor: number, random: () => number): number {
  if (counter === 255) return 255
  const base = Math.max(0, counter - LFU_INIT_VAL)
  const p = 1 / (base * logFactor + 1)
  return random() < p ? counter + 1 : counter
}

/** The counter after `idleMinutes` without access: minus one per `decayTime` minutes. */
export function lfuDecay(counter: number, idleMinutes: number, decayTime: number): number {
  if (decayTime === 0) return counter
  return Math.max(0, counter - Math.floor(idleMinutes / decayTime))
}

/** Counter after n accesses of a new key (one run, seeded). */
export function lfuAfter(accesses: number, logFactor: number, random: () => number): number {
  let c = LFU_INIT_VAL
  for (let i = 0; i < accesses; i++) {
    c = lfuIncrement(c, logFactor, random)
    if (c === 255) break
  }
  return c
}
