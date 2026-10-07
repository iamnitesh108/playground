/**
 * localStorage that never throws: private windows and blocked storage
 * simply behave as if nothing was saved.
 */
export const safeStorage = {
  read<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? fallback : (JSON.parse(raw) as T)
    } catch {
      return fallback
    }
  },
  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      /* storage unavailable — keep working in memory */
    }
  },
}
