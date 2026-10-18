import { Highlighted } from '@/shared/code'
import styles from './Output.module.css'

/** What a program printed, exactly as recorded. */
export function Output({ text, title = 'recorded output' }: { text: string; title?: string }) {
  return (
    <figure className={styles.output}>
      <figcaption className={styles.head}>{title}</figcaption>
      <pre className={styles.body}>
        <Highlighted language="output" code={text} />
      </pre>
    </figure>
  )
}
