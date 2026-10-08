import { useState } from 'react'
import { cx } from '@/shared/utils/cx'
import { lineFor, renderConfig, type ConfigEntry, type ConfigFormat } from './configFormat'
import styles from './ConfigExplorer.module.css'

interface ConfigExplorerProps {
  file: string
  format: ConfigFormat
  entries: readonly ConfigEntry[]
}

/**
 * A config file you can read like a document: every line is clickable and
 * opens a panel explaining that key, its value, default and options.
 */
export function ConfigExplorer({ file, format, entries }: ConfigExplorerProps) {
  const [selected, setSelected] = useState(0)
  const [copied, setCopied] = useState(false)
  const entry = entries[selected]

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(renderConfig(format, entries))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <figure className={styles.explorer}>
      <figcaption className={styles.header}>
        <span>{file}</span>
        <span className={styles.hint}>click a line</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy file'}
        </button>
      </figcaption>
      <div className={styles.body}>
        <div className={styles.file} role="listbox" aria-label={file}>
          {format === 'json' && <div className={styles.brace}>{'{'}</div>}
          {entries.map((e, i) => (
            <div key={`${e.key}-${i}`}>
              {e.section && <div className={styles.section}>{format === 'properties' ? `# ${e.section}` : format === 'json' ? `── ${e.section}` : e.section}</div>}
              <button
                type="button"
                role="option"
                aria-selected={i === selected}
                className={cx(styles.line, i === selected && styles.active)}
                onClick={() => setSelected(i)}
              >
                {lineFor(e, format, i === entries.length - 1)}
              </button>
            </div>
          ))}
          {format === 'json' && <div className={styles.brace}>{'}'}</div>}
        </div>
        <aside className={styles.detail} aria-live="polite">
          <div className={styles.key}>{entry.key}</div>
          {entry.value !== undefined && (
            <div className={styles.meta}>
              <span>value</span> <code>{entry.value || '(empty)'}</code>
            </div>
          )}
          {entry.defaultValue !== undefined && (
            <div className={styles.meta}>
              <span>default</span> <code>{entry.defaultValue}</code>
            </div>
          )}
          {entry.options && (
            <div className={styles.meta}>
              <span>options</span> <code>{entry.options}</code>
            </div>
          )}
          <div className={styles.explain}>{entry.explain}</div>
          <div className={styles.nav}>
            <button type="button" disabled={selected === 0} onClick={() => setSelected(selected - 1)}>
              ← previous
            </button>
            <span>
              {selected + 1} / {entries.length}
            </span>
            <button type="button" disabled={selected === entries.length - 1} onClick={() => setSelected(selected + 1)}>
              next →
            </button>
          </div>
        </aside>
      </div>
    </figure>
  )
}
