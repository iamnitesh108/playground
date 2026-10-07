import { useEffect } from 'react'
import { lessonsOf, type ModuleRegistry } from '@/core/registry'
import { HomePage } from './pages/HomePage'
import { LessonPage } from './pages/LessonPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { paths } from './router/routes'
import { Redirect } from './router/Redirect'
import { useRoute } from './router/useRoute'

export function App({ registry }: { registry: ModuleRegistry }) {
  const route = useRoute()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [route])

  switch (route.name) {
    case 'home':
      return <HomePage modules={registry.all()} />

    case 'module': {
      const module = registry.find(route.moduleId)
      const first = module && lessonsOf(module)[0]
      if (!first) return <NotFoundPage />
      return <Redirect to={paths.lesson(module.id, first.slug)} />
    }

    case 'lesson': {
      const location = registry.locate(route.moduleId, route.slug)
      return location ? <LessonPage location={location} /> : <NotFoundPage />
    }
  }
}
