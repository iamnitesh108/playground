import { useMemo, useState } from 'react'
import { lessonsOf } from '@/core/registry'
import { Proportion, type Hue } from '@/shared/figures'
import { localCacheModule } from '..'
import { GLOSSARY } from '../glossary'
import styles from './ProductionGlossary.module.css'

const LESSON_TITLES = new Map(lessonsOf(localCacheModule).map((lesson) => [lesson.slug, lesson.title]))
const GROUP_OF = new Map(localCacheModule.groups.flatMap((g) => g.lessons.map((l) => [l.slug, g.title] as const)))
const GROUP_HUE: Hue[] = [1, 7, 5, 6]

/** Every term of the module, searchable, each linked to the lesson that explains it. */
export function ProductionGlossary() {
  const [query, setQuery] = useState('')
  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
    return q ? sorted.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)) : sorted
  }, [query])
  const perGroup = localCacheModule.groups
    .map((g, i) => ({ label: g.title, value: GLOSSARY.filter((e) => GROUP_OF.get(e.lesson) === g.title).length, hue: GROUP_HUE[i % GROUP_HUE.length] }))
    .filter((g) => g.value > 0)
  return (
    <>
      <Proportion title={`${GLOSSARY.length} terms, by part of the module`} parts={perGroup} />
      <input
        className={styles.search}
        type="search"
        placeholder={`Search ${GLOSSARY.length} terms…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the glossary"
      />
      <dl className={styles.list}>
        {entries.map((entry) => (
          <div key={entry.term} className={styles.entry}>
            <dt className={styles.term}>{entry.term}</dt>
            <dd className={styles.definition}>
              {entry.definition}{' '}
              <a className={styles.link} href={`#/${localCacheModule.id}/${entry.lesson}`}>
                {LESSON_TITLES.get(entry.lesson)} →
              </a>
            </dd>
          </div>
        ))}
        {entries.length === 0 && <p className={styles.empty}>No terms match “{query}”.</p>}
      </dl>
    </>
  )
}
