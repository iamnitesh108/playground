import type { Frame, SessionId } from '../data/types'
import { SCENARIOS } from '../data/scenarios'

/** A recorded scenario by name. */
export const scenario = (name: string): readonly Frame[] => SCENARIOS[name]

/** The transaction id a session held after the given step, as recorded. */
export const xidAt = (frames: readonly Frame[], step: number, session: SessionId): string => frames[step].sessions[session].xid ?? '?'

/** The xmin of the tuple at a line pointer after the given step, as recorded. */
export const xminAt = (frames: readonly Frame[], step: number, lp: number): string => frames[step].page.find((t) => t.lp === lp)?.xmin ?? '?'

/** The xmax of the tuple at a line pointer after the given step, as recorded. */
export const xmaxAt = (frames: readonly Frame[], step: number, lp: number): string => frames[step].page.find((t) => t.lp === lp)?.xmax ?? '?'
