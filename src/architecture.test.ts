/*
 * Architecture tests: the conventions that let a module or lesson be added without editing shared files.
 * Modules and glossary terms are discovered, so these checks are what keeps the discovery honest.
 */
import { describe, expect, it } from 'vitest'
import { lessonsOf } from '@/core/registry'
import { registry } from '@/modules'

/** Every source file as text, keyed by its path from src (e.g. "modules/kafka/index.ts"). */
const SOURCES = Object.fromEntries(
  Object.entries(import.meta.glob<string>('./**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })).map(([path, text]) => [path.slice(2), text]),
)
const files = (re: RegExp) => Object.keys(SOURCES).filter((p) => re.test(p))
const modules = registry.all()

/** slug → lesson component file name, read from a module's index.ts (`load: () => import('./lessons/X')`). */
function lessonFiles(moduleId: string) {
  const index = SOURCES[`modules/${moduleId}/index.ts`]
  return new Map([...index.matchAll(/slug: '([^']+)'[\s\S]*?import\('\.\/lessons\/(\w+)'\)/g)].map((m) => [m[1], m[2]]))
}

describe('modules', () => {
  it('every module folder is discovered', () => {
    const folders = new Set(files(/^modules\/[^/]+\/index\.ts$/).map((p) => p.split('/')[1]))
    expect(modules.map((m) => m.id).sort()).toEqual([...folders].sort())
  })

  it('ids and home-page order are unique', () => {
    expect(new Set(modules.map((m) => m.id)).size).toBe(modules.length)
    expect(new Set(modules.map((m) => m.order)).size).toBe(modules.length)
  })

  it.each(modules.map((m) => [m.id, m] as const))('%s: lesson slugs are unique and each has a lesson file', (id, module) => {
    const slugs = lessonsOf(module).map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
    const byFile = lessonFiles(id)
    for (const slug of slugs) expect(SOURCES[`modules/${id}/lessons/${byFile.get(slug)}.tsx`], `${id}/${slug}`).toBeDefined()
  })
})

describe('links', () => {
  it('every #/module/lesson link points at a real page', () => {
    const pages = new Set(modules.flatMap((m) => [m.id, ...lessonsOf(m).map((l) => `${m.id}/${l.slug}`)]))
    const broken = files(/\.tsx?$/).flatMap((p) => [...SOURCES[p].matchAll(/["'`]#\/([\w-]+(?:\/[\w-]+)?)["'`]/g)].map((m) => m[1]).filter((to) => !pages.has(to)).map((to) => `${p} → #/${to}`))
    expect(broken).toEqual([])
  })
})

describe('glossary terms', () => {
  it('every terms file sits next to a lesson and names that lesson', () => {
    const wrong: string[] = []
    for (const path of files(/^modules\/[^/]+\/lessons\/\w+\.terms\.ts$/)) {
      const [, id, , file] = path.split('/')
      const slug = [...lessonFiles(id)].find(([, f]) => `${f}.terms.ts` === file)?.[0]
      if (!slug) wrong.push(`${path}: no lesson ${file.replace('.terms.ts', '')} in ${id}/index.ts`)
      for (const m of SOURCES[path].matchAll(/lesson: '([^']+)'/g)) if (m[1] !== slug) wrong.push(`${path}: term for '${m[1]}', lesson is '${slug}'`)
    }
    expect(wrong).toEqual([])
  })
})

describe('dependency direction', () => {
  it('core and shared never import a module', () => {
    const bad = files(/^(core|shared)\//).filter((p) => /from '(@\/modules|\.\.\/(\.\.\/)*modules)/.test(SOURCES[p]))
    expect(bad).toEqual([])
  })

  it('simulations are pure TypeScript (no React)', () => {
    const bad = files(/^modules\/[^/]+\/simulation\//).filter((p) => /from 'react|\.tsx'|\.css'/.test(SOURCES[p]) || p.endsWith('.tsx'))
    expect(bad).toEqual([])
  })

  it('folders have no re-export-only index.ts (import the file that defines the name)', () => {
    const facades = new Set(['modules/kafka/components/stage/index.ts'])
    const barrels = files(/^modules\/[^/]+\/.+\/index\.ts$/).filter((p) => !facades.has(p) && SOURCES[p].split('\n').every((l) => !l.trim() || /^export .* from '/.test(l)))
    expect(barrels).toEqual([])
  })
})
