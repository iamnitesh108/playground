import { cx } from '@/shared/utils/cx'
import styles from './Segmented.module.css'

export interface SegmentedOption<T extends string | number> {
  value: T
  label: string
}

interface SegmentedProps<T extends string | number> {
  label?: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
}

export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.wrap}>
      {label && <span className={styles.label}>{label}</span>}
      <div className={styles.group} role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={cx(styles.option, option.value === value && styles.active)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
