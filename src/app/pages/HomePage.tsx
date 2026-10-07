import type { LearningModule } from '@/core/module'
import { lessonsOf } from '@/core/registry'
import { ThemeToggle } from '../layout/ThemeToggle'
import { paths } from '../router/routes'
import { useProgress } from '../state/progress'
import styles from './HomePage.module.css'

export function HomePage({ modules }: { modules: LearningModule[] }) {
  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span className={styles.brand}>Playground</span>
        <ThemeToggle />
      </header>

      <section className={styles.intro}>
        <h1>Learn systems by playing with them.</h1>
        <p>
          Each topic is a short course of lessons with diagrams you can step through and small simulators you can poke
          at. Start from zero; every term is explained the first time it appears.
        </p>
      </section>

      <section className={styles.grid}>
        {modules.map((module) => (
          <ModuleCard key={module.id} module={module} />
        ))}
        <div className={styles.placeholder}>More topics soon</div>
      </section>
    </div>
  )
}

function ModuleCard({ module }: { module: LearningModule }) {
  const progress = useProgress()
  const total = lessonsOf(module).length
  const done = progress.visitedCount(module.id)

  return (
    <a className={styles.card} href={paths.module(module.id)}>
      <h2 className={styles.cardTitle}>{module.title}</h2>
      <p className={styles.cardText}>{module.description}</p>
      <div className={styles.tags}>
        {module.tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className={styles.meta}>
        <span>{total} lessons</span>
        {done > 0 && (
          <span>
            {done}/{total} opened
          </span>
        )}
      </div>
      <div className={styles.bar}>
        <div className={styles.barFill} style={{ width: `${(done / total) * 100}%` }} />
      </div>
    </a>
  )
}
