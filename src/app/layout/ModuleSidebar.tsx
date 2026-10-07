import type { LearningModule } from '@/core/module'
import { cx } from '@/shared/utils/cx'
import { paths } from '../router/routes'
import { useProgress } from '../state/progress'
import styles from './ModuleSidebar.module.css'

interface ModuleSidebarProps {
  module: LearningModule
  activeSlug: string
  onNavigate?: () => void
}

export function ModuleSidebar({ module, activeSlug, onNavigate }: ModuleSidebarProps) {
  const progress = useProgress()
  let number = 0

  return (
    <nav className={styles.nav} aria-label={`${module.title} lessons`}>
      <a className={styles.back} href={paths.home()}>
        ← All topics
      </a>
      <div className={styles.moduleTitle}>{module.title}</div>
      {module.groups.map((group) => (
        <div key={group.title} className={styles.group}>
          <div className={styles.groupTitle}>{group.title}</div>
          <ol className={styles.list}>
            {group.lessons.map((lesson) => {
              number++
              const active = lesson.slug === activeSlug
              const visited = progress.isVisited(module.id, lesson.slug)
              return (
                <li key={lesson.slug}>
                  <a
                    href={paths.lesson(module.id, lesson.slug)}
                    className={cx(styles.link, active && styles.active)}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <span className={cx(styles.number, visited && styles.visited)}>{number}</span>
                    {lesson.title}
                  </a>
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </nav>
  )
}
