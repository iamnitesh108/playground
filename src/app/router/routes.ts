export type Route =
  | { name: 'home' }
  | { name: 'module'; moduleId: string }
  | { name: 'lesson'; moduleId: string; slug: string }

export const paths = {
  home: () => '#/',
  module: (moduleId: string) => `#/${moduleId}`,
  lesson: (moduleId: string, slug: string) => `#/${moduleId}/${slug}`,
}

export function parseRoute(hash: string): Route {
  const [moduleId, slug] = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  if (!moduleId) return { name: 'home' }
  if (!slug) return { name: 'module', moduleId }
  return { name: 'lesson', moduleId, slug }
}
