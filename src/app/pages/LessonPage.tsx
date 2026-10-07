import { createElement, Suspense, useEffect, useState } from 'react'
import type { Lesson } from '@/core/module'
import type { LessonLocation } from '@/core/registry'
import { lessonsOf } from '@/core/registry'
import { Button, ErrorBoundary } from '@/shared/ui'
import { ModuleSidebar } from '../layout/ModuleSidebar'
import { ThemeToggle } from '../layout/ThemeToggle'
import { paths } from '../router/routes'
import { progress } from '../state/progress'
import { lazyLesson } from './lazyLesson'
import styles from './LessonPage.module.css'

/** Renders a lazily loaded lesson; lazyLesson caches, so identity stays stable. */
function LessonOutlet({ lesson }: { lesson: Lesson }) {
  return createElement(lazyLesson(lesson))
}

export function LessonPage({ location }: { location: LessonLocation }) {
  const { module, lesson, index, previous, next } = location
  const [menuOpen, setMenuOpen] = useState(false)
  const total = lessonsOf(module).length

  useEffect(() => {
    progress.markVisited(module.id, lesson.slug)
    document.title = `${lesson.title} · ${module.title} · Playground`
  }, [module, lesson])

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar} data-open={menuOpen}>
        <ModuleSidebar module={module} activeSlug={lesson.slug} onNavigate={() => setMenuOpen(false)} />
      </aside>

      <div className={styles.main}>
        <header className={styles.top}>
          <button type="button" className={styles.menuButton} onClick={() => setMenuOpen((open) => !open)}>
            {menuOpen ? 'Close' : 'Lessons'}
          </button>
          <span className={styles.crumb}>
            {module.title} · Lesson {index + 1} of {total}
          </span>
          <ThemeToggle />
        </header>

        <article className={styles.article}>
          <h1>{lesson.title}</h1>
          <p className={styles.summary}>{lesson.summary}</p>
          <ErrorBoundary key={lesson.slug} fallback={(error) => <LessonError message={error.message} />}>
            <Suspense fallback={<p className={styles.loading}>Loading lesson…</p>}>
              <LessonOutlet lesson={lesson} />
            </Suspense>
          </ErrorBoundary>
        </article>

        <nav className={styles.pager} aria-label="Lesson navigation">
          {previous ? (
            <a className={styles.pagerLink} href={paths.lesson(module.id, previous.slug)}>
              <span className={styles.pagerLabel}>Previous</span>
              {previous.title}
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a className={`${styles.pagerLink} ${styles.pagerNext}`} href={paths.lesson(module.id, next.slug)}>
              <span className={styles.pagerLabel}>Next</span>
              {next.title}
            </a>
          )}
        </nav>
      </div>
    </div>
  )
}

function LessonError({ message }: { message: string }) {
  return (
    <div className={styles.error}>
      <p>This lesson could not be loaded. If the site was just updated, reloading fetches the new version.</p>
      <p className={styles.errorDetail}>{message}</p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  )
}
