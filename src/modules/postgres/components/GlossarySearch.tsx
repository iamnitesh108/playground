import { useMemo, useState } from 'react'
import { hue, type Hue } from '@/shared/figures'
import { cx } from '@/shared/utils/cx'
import type { GlossaryEntry } from '../glossary'
import styles from './GlossarySearch.module.css'

interface GlossarySearchProps {
  entries: readonly GlossaryEntry[]
  /** Module part (sidebar group) of each lesson slug, with its colour. */
  partOf: (lesson: string) => { title: string; hue: Hue } | undefined
  parts: readonly { title: string; hue: Hue }[]
  lessonTitle: (lesson: string) => string | undefined
  moduleId: string
}

const sortKey = (term: string) => term.replace(/^[^a-z0-9]+/i, '')

/** Every term of the module, searchable by text and filterable by part. */
export function GlossarySearch({ entries, partOf, parts, lessonTitle, moduleId }: GlossarySearchProps) {
  const [query, setQuery] = useState('')
  const [part, setPart] = useState<string | null>(null)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...entries]
      .sort((a, b) => sortKey(a.term).localeCompare(sortKey(b.term), 'en', { sensitivity: 'base' }))
      .filter((e) => !part || partOf(e.lesson)?.title === part)
      .filter((e) => !q || e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q))
  }, [entries, query, part, partOf])

  return (
    <section>
      <input
        className={styles.search}
        type="search"
        placeholder={`Search ${entries.length} terms…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search the glossary"
      />
      <div className={styles.chips} role="group" aria-label="Filter by part of the module">
        <button type="button" className={cx(styles.chip, part === null && styles.on)} onClick={() => setPart(null)}>
          all
        </button>
        {parts.map((p) => (
          <button key={p.title} type="button" style={hue(p.hue)} className={cx(styles.chip, part === p.title && styles.on)} onClick={() => setPart(part === p.title ? null : p.title)}>
            <span className={styles.swatch} /> {p.title}
          </button>
        ))}
      </div>
      <p className={styles.count} aria-live="polite">
        {shown.length} of {entries.length} terms
      </p>
      <dl className={styles.list}>
        {shown.map((e) => {
          const p = partOf(e.lesson)
          return (
            <div key={e.term} className={styles.entry} style={hue(p?.hue)}>
              <dt className={styles.term}>{e.term}</dt>
              <dd className={styles.definition}>
                {e.definition}{' '}
                <a className={styles.link} href={`#/${moduleId}/${e.lesson}`}>
                  {lessonTitle(e.lesson)} →
                </a>
              </dd>
            </div>
          )
        })}
        {shown.length === 0 && <p className={styles.empty}>No terms match “{query}”.</p>}
      </dl>
    </section>
  )
}
