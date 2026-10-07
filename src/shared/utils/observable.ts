export type Listener = () => void

/**
 * Minimal observer base class. Models extend it and call `notify()` after
 * every mutation; React binds through `useObservable`.
 */
export abstract class Observable {
  private readonly listeners = new Set<Listener>()
  private revision = 0

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getRevision = (): number => this.revision

  protected notify(): void {
    this.revision++
    for (const listener of this.listeners) listener()
  }
}
