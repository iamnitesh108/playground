import type { ComponentType } from 'react'

export type LessonComponent = ComponentType

export interface Lesson {
  /** URL-safe identifier, unique inside its module. */
  slug: string
  title: string
  summary: string
  /** Lazily loads the lesson so each module only costs bytes when opened. */
  load: () => Promise<{ default: LessonComponent }>
}

export interface LessonGroup {
  title: string
  lessons: Lesson[]
}

export interface LearningModule {
  /** URL-safe identifier, unique across the playground. */
  id: string
  title: string
  description: string
  tags: string[]
  groups: LessonGroup[]
}
