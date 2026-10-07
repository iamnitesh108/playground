import { lazy, type LazyExoticComponent } from 'react'
import type { Lesson, LessonComponent } from '@/core/module'

const cache = new WeakMap<Lesson, LazyExoticComponent<LessonComponent>>()

/** One lazy component per lesson, so revisiting a lesson never reloads it. */
export function lazyLesson(lesson: Lesson): LazyExoticComponent<LessonComponent> {
  let component = cache.get(lesson)
  if (!component) {
    component = lazy(lesson.load)
    cache.set(lesson, component)
  }
  return component
}
