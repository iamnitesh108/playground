import { useSyncExternalStore } from 'react'
import { Observable } from '@/shared/utils/observable'
import { safeStorage } from '@/shared/utils/storage'

export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'playground.theme'
const ORDER: ThemePreference[] = ['system', 'light', 'dark']

class ThemeStore extends Observable {
  private preference: ThemePreference = safeStorage.read<ThemePreference>(STORAGE_KEY, 'system')

  constructor() {
    super()
    this.apply()
  }

  get current(): ThemePreference {
    return this.preference
  }

  cycle(): void {
    this.preference = ORDER[(ORDER.indexOf(this.preference) + 1) % ORDER.length]
    safeStorage.write(STORAGE_KEY, this.preference)
    this.apply()
    this.notify()
  }

  private apply(): void {
    const root = document.documentElement
    if (this.preference === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', this.preference)
  }
}

export const theme = new ThemeStore()

export function useTheme(): ThemeStore {
  useSyncExternalStore(theme.subscribe, theme.getRevision, theme.getRevision)
  return theme
}
