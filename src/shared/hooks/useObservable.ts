import { useState, useSyncExternalStore } from 'react'
import type { Observable } from '@/shared/utils/observable'

/**
 * Creates a model once and re-renders whenever it notifies.
 * The model stays mutable; React only tracks its revision number.
 */
export function useObservable<T extends Observable>(create: () => T): T {
  const [model] = useState(create)
  useSyncExternalStore(model.subscribe, model.getRevision, model.getRevision)
  return model
}
