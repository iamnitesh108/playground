import { useSyncExternalStore } from 'react'
import { Observable } from '@/shared/utils/observable'
import { safeStorage } from '@/shared/utils/storage'

type VisitedMap = Record<string, string[]>

const STORAGE_KEY = 'playground.progress'

/** Remembers which lessons the reader has opened, per module. */
class ProgressStore extends Observable {
  private visited: VisitedMap = safeStorage.read<VisitedMap>(STORAGE_KEY, {})

  markVisited(moduleId: string, slug: string): void {
    const list = this.visited[moduleId] ?? []
    if (list.includes(slug)) return
    this.visited = { ...this.visited, [moduleId]: [...list, slug] }
    safeStorage.write(STORAGE_KEY, this.visited)
    this.notify()
  }

  isVisited(moduleId: string, slug: string): boolean {
    return this.visited[moduleId]?.includes(slug) ?? false
  }

  visitedCount(moduleId: string): number {
    return this.visited[moduleId]?.length ?? 0
  }
}

export const progress = new ProgressStore()

export function useProgress(): ProgressStore {
  useSyncExternalStore(progress.subscribe, progress.getRevision, progress.getRevision)
  return progress
}
