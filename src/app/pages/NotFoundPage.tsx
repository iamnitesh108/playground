import { paths } from '../router/routes'
import styles from './NotFoundPage.module.css'

export function NotFoundPage() {
  return (
    <main className={styles.page}>
      <h1>Nothing here</h1>
      <p>This page does not exist, or the lesson was renamed.</p>
      <a href={paths.home()}>Back to all topics</a>
    </main>
  )
}
