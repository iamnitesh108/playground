import type { EncodingLimits } from '../simulation/encoding'
import { CAPTURE } from './captures'

const cfg = CAPTURE.types.config

/** Encoding limits of the recorded server (CONFIG GET), plus the two derived from its behaviour. */
export const LIMITS: EncodingLimits = {
  hashEntries: Number(cfg['hash-max-listpack-entries']),
  hashValue: Number(cfg['hash-max-listpack-value']),
  setIntsetEntries: Number(cfg['set-max-intset-entries']),
  setListpackEntries: Number(cfg['set-max-listpack-entries']),
  setValue: Number(cfg['set-max-listpack-value']),
  zsetEntries: Number(cfg['zset-max-listpack-entries']),
  zsetValue: Number(cfg['zset-max-listpack-value']),
  /** list-max-listpack-size -2 = 8 KB per node */
  listNodeBytes: 8192,
  /** key + value bytes of the longest embstr seen: 1 + 40, 11 + 30, 26 + 15 */
  embstrKeyPlusValue: 41,
}
