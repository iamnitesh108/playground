import { useMemo, useState } from 'react'
import { lessonsOf } from '@/core/registry'
import { kafkaModule } from '..'
import { GLOSSARY } from '../glossary'
import own from './Glossary.module.css'

const LESSON_TITLES = new Map(lessonsOf(kafkaModule).map((lesson) => [lesson.slug, lesson.title]))

export default function Glossary() {
  const [query, setQuery] = useState('')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...GLOSSARY].sort((a, b) => a.term.replace(/^_+/, '').localeCompare(b.term.replace(/^_+/, ''), 'en', { sensitivity: 'base' }))
    return q ? sorted.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)) : sorted
  }, [query])

  return (
    <>
      <input
        className={own.search}
        type="search"
        placeholder={`Search ${GLOSSARY.length} terms…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the glossary"
      />
      <dl className={own.list}>
        {entries.map((entry) => (
          <div key={entry.term} className={own.entry}>
            <dt className={own.term}>{entry.term}</dt>
            <dd className={own.definition}>
              {entry.definition}{' '}
              <a className={own.link} href={`#/${kafkaModule.id}/${entry.lesson}`}>
                {LESSON_TITLES.get(entry.lesson)} →
              </a>
            </dd>
          </div>
        ))}
        {entries.length === 0 && <p className={own.empty}>No terms match “{query}”.</p>}
      </dl>
    </>
  )
}
