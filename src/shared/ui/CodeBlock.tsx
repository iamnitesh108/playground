import { useState } from 'react'
import styles from './CodeBlock.module.css'

interface CodeBlockProps {
  code: string
  title?: string
  language?: string
}

export function CodeBlock({ code, title, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked — nothing to do */
    }
  }

  return (
    <figure className={styles.block}>
      <figcaption className={styles.header}>
        <span>{title ?? language ?? 'code'}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </figcaption>
      <pre className={styles.pre}>
        <code>{code.trim()}</code>
      </pre>
    </figure>
  )
}
