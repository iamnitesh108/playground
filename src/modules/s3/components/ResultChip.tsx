import { hue } from '@/shared/figures'
import { HUE } from './legend'
import styles from './ResultChip.module.css'

/** A recorded outcome as a small coloured chip that also says it in words. */
export function ResultChip({ ok, children }: { ok: boolean; children?: string }) {
  return (
    <span className={styles.chip} style={hue(ok ? HUE.ok : HUE.error)}>
      {children ?? (ok ? 'allowed' : 'denied')}
    </span>
  )
}
