import styles from './LoadingFigures.module.css'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  format?: (v: number) => string
  onChange: (v: number) => void
}

/** A labelled range input with its current value, for the playgrounds of this module's later lessons. */
export function LoadingSlider({ label, value, min, max, step = 1, format = String, onChange }: SliderProps) {
  return (
    <label className={styles.slider}>
      {label}
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>{format(value)}</output>
    </label>
  )
}
