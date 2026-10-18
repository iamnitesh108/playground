import { useSyncExternalStore } from 'react'
import { Observable } from '@/shared/utils/observable'
import { safeStorage } from '@/shared/utils/storage'

const STORAGE_KEY = 'playground.sidebarCollapsed'

/** Whether the lesson sidebar is collapsed on wide screens; remembered across visits. */
class SidebarStore extends Observable {
  private collapsedNow = safeStorage.read<boolean>(STORAGE_KEY, false)

  get collapsed(): boolean {
    return this.collapsedNow
  }

  toggle(): void {
    this.collapsedNow = !this.collapsedNow
    safeStorage.write(STORAGE_KEY, this.collapsedNow)
    this.notify()
  }
}

export const sidebar = new SidebarStore()

export function useSidebar(): SidebarStore {
  useSyncExternalStore(sidebar.subscribe, sidebar.getRevision, sidebar.getRevision)
  return sidebar
}
