import { useSyncExternalStore } from 'react'
import { parseRoute, type Route } from './routes'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

const getHash = () => window.location.hash

/** Hash-based routing keeps the app static-host friendly with zero dependencies. */
export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, getHash, getHash))
}

export function redirect(href: string): void {
  window.location.replace(href)
}
