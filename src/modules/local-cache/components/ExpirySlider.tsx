import styles from './ExpirySlider.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

export function ExpirySlider({ label, value, min, max, step = 1, format = String, onChange }: SliderProps) {
  return (
    <label className={styles.slider}>
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{format(value)}</output>
    </label>
  )
}
