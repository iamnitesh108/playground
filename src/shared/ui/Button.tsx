import type { ButtonHTMLAttributes } from 'react'
import { cx } from '@/shared/utils/cx'
import styles from './Button.module.css'

type Variant = 'default' | 'primary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md'
}

export function Button({ variant = 'default', size = 'md', className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={cx(styles.button, styles[variant], styles[size], className)} {...rest} />
}
