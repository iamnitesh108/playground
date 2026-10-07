import { useCallback, useState } from 'react'
import { useInterval } from './useInterval'

export interface Stepper {
  index: number
  count: number
  playing: boolean
  isFirst: boolean
  isLast: boolean
  next: () => void
  previous: () => void
  goTo: (index: number) => void
  reset: () => void
  togglePlay: () => void
}

/** Drives any step-by-step walkthrough, with optional autoplay. */
export function useStepper(count: number, intervalMs = 2200): Stepper {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const isLast = index >= count - 1

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, count - 1)), [count])
  const previous = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), [])
  const goTo = useCallback((i: number) => setIndex(Math.max(0, Math.min(i, count - 1))), [count])
  const reset = useCallback(() => {
    setIndex(0)
    setPlaying(false)
  }, [])

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (!p && isLast) setIndex(0)
      return !p
    })
  }, [isLast])

  useInterval(
    () => {
      if (isLast) setPlaying(false)
      else next()
    },
    playing ? intervalMs : null,
  )

  return { index, count, playing, isFirst: index === 0, isLast, next, previous, goTo, reset, togglePlay }
}
