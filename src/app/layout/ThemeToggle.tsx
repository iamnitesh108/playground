import { useTheme } from '../state/theme'
import styles from './ThemeToggle.module.css'

const LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' } as const

export function ThemeToggle() {
  const theme = useTheme()
  return (
    <button type="button" className={styles.toggle} onClick={() => theme.cycle()} title="Change theme">
      <span className={styles.icon} data-theme-icon={theme.current} aria-hidden />
      {LABEL[theme.current]}
    </button>
  )
}
