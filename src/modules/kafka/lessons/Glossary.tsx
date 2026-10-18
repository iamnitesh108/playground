import { useMemo, useState } from 'react'
import { lessonsOf } from '@/core/registry'
import { kafkaModule } from '..'
import { Flow, Proportion, type Hue } from '@/shared/figures'
import { GLOSSARY } from '../glossary'
import own from './Glossary.module.css'

const LESSON_TITLES = new Map(lessonsOf(kafkaModule).map((lesson) => [lesson.slug, lesson.title]))

/** Which part of the module (sidebar group) each lesson belongs to, and how many terms each part defines. */
const GROUP_OF = new Map(kafkaModule.groups.flatMap((g) => g.lessons.map((l) => [l.slug, g.title] as const)))
const TERMS_PER_GROUP = kafkaModule.groups
  .map((g) => ({ title: g.title, count: GLOSSARY.filter((e) => GROUP_OF.get(e.lesson) === g.title).length }))
  .filter((g) => g.count > 0)
const HUE_OF: Record<string, Hue> = { Foundations: 3, 'Producing and consuming': 7, Durability: 5, Ecosystem: 4 }
const count = (title: string) => TERMS_PER_GROUP.find((g) => g.title === title)?.count ?? 0

export default function Glossary() {
  const [query, setQuery] = useState('')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...GLOSSARY].sort((a, b) => a.term.replace(/^_+/, '').localeCompare(b.term.replace(/^_+/, ''), 'en', { sensitivity: 'base' }))
    return q ? sorted.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)) : sorted
  }, [query])

  return (
    <>
      <Flow
        title="How the big ideas connect (terms defined in each part)"
        cols={4}
        rows={2}
        nodes={[
          { id: 'found', label: 'Foundations', sub: `${count('Foundations')} terms`, col: 0, row: 0, hue: HUE_OF.Foundations },
          { id: 'pc', label: 'Producing & consuming', sub: `${count('Producing and consuming')} terms`, col: 1, row: 0, span: 2, hue: HUE_OF['Producing and consuming'] },
          { id: 'dur', label: 'Durability', sub: `${count('Durability')} terms`, col: 3, row: 0, hue: HUE_OF.Durability },
          { id: 'eco', label: 'Ecosystem', sub: `Connect, Debezium, outbox · ${count('Ecosystem')} terms`, col: 1, row: 1, span: 2, hue: HUE_OF.Ecosystem },
        ]}
        edges={[
          { from: 'found', to: 'pc', hue: 3, flow: true },
          { from: 'pc', to: 'dur', hue: 5 },
          { from: 'eco', to: 'pc', label: 'built on', hue: 4, dashed: true },
        ]}
        caption="Foundations feed producing and consuming, durability keeps those records safe, and the ecosystem is built on top."
      />
      <Proportion
        title={`${GLOSSARY.length} terms, by part of the module`}
        parts={TERMS_PER_GROUP.map((g) => ({ label: g.title, value: g.count, hue: HUE_OF[g.title] ?? 1 }))}
      />
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
