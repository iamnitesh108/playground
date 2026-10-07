import type { LearningModule, Lesson } from './module'

export interface LessonLocation {
  module: LearningModule
  lesson: Lesson
  index: number
  previous?: Lesson
  next?: Lesson
}

/**
 * Read-only catalogue of modules. The app depends on this abstraction,
 * never on concrete modules, so new topics plug in without touching it.
 */
export class ModuleRegistry {
  private readonly byId: Map<string, LearningModule>

  constructor(modules: readonly LearningModule[]) {
    this.byId = new Map()
    for (const module of modules) {
      if (this.byId.has(module.id)) throw new Error(`Duplicate module id "${module.id}"`)
      this.byId.set(module.id, module)
    }
  }

  all(): LearningModule[] {
    return [...this.byId.values()]
  }

  find(id: string): LearningModule | undefined {
    return this.byId.get(id)
  }

  locate(moduleId: string, slug: string): LessonLocation | undefined {
    const module = this.find(moduleId)
    if (!module) return undefined
    const lessons = lessonsOf(module)
    const index = lessons.findIndex((lesson) => lesson.slug === slug)
    if (index < 0) return undefined
    return {
      module,
      lesson: lessons[index],
      index,
      previous: lessons[index - 1],
      next: lessons[index + 1],
    }
  }
}

export function lessonsOf(module: LearningModule): Lesson[] {
  return module.groups.flatMap((group) => group.lessons)
}
