import { useMemo, useState } from 'react'
import { lessonsOf } from '@/core/registry'
import { Flow, Proportion, type Hue } from '@/shared/figures'
import { Callout, Recap, Table, Tabs } from '@/shared/ui'
import { s3Module } from '..'
import { HUE } from '../components/legend'
import { CHEATS, MORE } from '../data/cheats'
import { GLOSSARY } from '../glossary'
import own from '../components/Glossary.module.css'

const LESSON_TITLES = new Map(lessonsOf(s3Module).map((lesson) => [lesson.slug, lesson.title]))

/** Which part of the module (sidebar group) each lesson belongs to, and how many terms each part defines. */
const GROUP_OF = new Map(s3Module.groups.flatMap((g) => g.lessons.map((l) => [l.slug, g.title] as const)))
const TERMS_PER_GROUP = s3Module.groups
  .map((g) => ({ title: g.title, count: GLOSSARY.filter((e) => GROUP_OF.get(e.lesson) === g.title).length }))
  .filter((g) => g.count > 0)
const HUE_OF: Record<string, Hue> = { Basics: HUE.data, 'How it works': HUE.network, 'Keeping data safe': HUE.disk, 'In production': HUE.client }
const count = (title: string) => TERMS_PER_GROUP.find((g) => g.title === title)?.count ?? 0
const code = (v: string) => (v === '—' ? v : <code>{v}</code>)

export default function Glossary() {
  const [query, setQuery] = useState('')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }))
    return q ? sorted.filter((e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q)) : sorted
  }, [query])

  return (
    <>
      <p>
        Every term this module introduces, in one searchable list, each with a link to the lesson that explains it — and, at the end, the commands
        and API calls you will use most.
      </p>
      <Callout tone="analogy" title="Analogy: a phrasebook">
        Like a phrasebook for a country you visit often: you do not read it front to back, you look up the word you just heard. Search for a term
        you met in a log, an error or a colleague’s message.
      </Callout>
      <Flow
        title="How the parts of the module build on each other (terms defined in each part)"
        cols={4}
        rows={2}
        rowHeight={78}
        nodes={[
          { id: 'basics', label: 'Basics', sub: `objects, buckets, clients · ${count('Basics')} terms`, col: 0, row: 0, span: 2, hue: HUE_OF.Basics },
          { id: 'how', label: 'How it works', sub: `requests, parts, access · ${count('How it works')} terms`, col: 2, row: 0, span: 2, hue: HUE_OF['How it works'] },
          { id: 'safe', label: 'Keeping data safe', sub: `versions, erasure coding · ${count('Keeping data safe')} terms`, col: 0, row: 1, span: 2, hue: HUE_OF['Keeping data safe'] },
          { id: 'prod', label: 'In production', sub: `patterns, operations · ${count('In production')} terms`, col: 2, row: 1, span: 2, hue: HUE_OF['In production'] },
        ]}
        edges={[
          { from: 'basics', to: 'how', hue: HUE.network, flow: true },
          { from: 'basics', to: 'safe', hue: HUE.disk },
          { from: 'how', to: 'prod', hue: HUE.client },
          { from: 'safe', to: 'prod', hue: HUE.client, dashed: true },
        ]}
      />
      <Proportion title={`${GLOSSARY.length} terms, by part of the module`} parts={TERMS_PER_GROUP.map((g) => ({ label: g.title, value: g.count, hue: HUE_OF[g.title] ?? HUE.data }))} />
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
              <a className={own.link} href={`#/${s3Module.id}/${entry.lesson}`}>
                {LESSON_TITLES.get(entry.lesson)} →
              </a>
            </dd>
          </div>
        ))}
        {entries.length === 0 && <p className={own.empty}>No terms match “{query}”.</p>}
      </dl>

      <h2>Cheat sheet</h2>
      <p>The everyday jobs in each tool, as used in the recordings, and the commands from the later lessons.</p>
      <Tabs
        items={[
          { label: 'Command line', content: <Table head={['Job', 'Console', 'aws CLI', 'rc']} rows={CHEATS.map((c) => [c.job, c.console, code(c.aws), code(c.rc)])} /> },
          { label: 'In code', content: <Table head={['Job', 'Micronaut / Java', 'TypeScript', 'Rust']} rows={CHEATS.map((c) => [c.job, code(c.java), code(c.ts), code(c.rust)])} /> },
          {
            label: 'Beyond the basics',
            content: (
              <Table
                head={['Job', 'Command', 'Lesson']}
                rows={MORE.map((m) => [m.job, <code key="c">{m.command}</code>, <a key="l" href={`#/${s3Module.id}/${m.lesson}`}>{LESSON_TITLES.get(m.lesson)}</a>])}
              />
            ),
          },
          {
            label: 'Client settings',
            content: (
              <Table
                head={['Setting', 'aws CLI (~/.aws/config)', 'Micronaut (application.yml)', 'TypeScript', 'Rust']}
                rows={[
                  ['endpoint', code('endpoint_url'), code('aws.services.s3.endpoint-override'), code('endpoint'), code('.endpoint_url(…)')],
                  ['path-style', code('s3 = addressing_style = path'), code('aws.s3.path-style-access-enabled'), code('forcePathStyle: true'), code('.force_path_style(true)')],
                  ['region', code('region'), code('aws.region'), code('region'), code('.region(Region::new(…))')],
                  ['keys', code('~/.aws/credentials'), code('aws.access-key-id / aws.secret-key'), code('credentials'), code('.credentials_provider(…)')],
                ]}
              />
            ),
          },
        ]}
      />

      <Recap
        points={[
          'Objects (key + bytes + metadata) live in buckets; keys are flat names; folders are listings.',
          'Every action is a signed HTTP request; clients for a non-AWS server need an endpoint, region, keys and path-style.',
          'Policies decide access (deny wins); presigned links share single objects; versioning and object lock undo and prevent loss.',
          'Erasure coding across drives and servers survives failures; it is not a backup.',
        ]}
      />
    </>
  )
}
