import { useMemo, useState } from 'react'
import { hue } from '@/shared/figures/palette'
import { Demo } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import { buildIndex, DOCS, search } from '../simulation/indexTypesGin'
import styles from './IndexTypes.module.css'

/** Six product descriptions, their GIN index (word → rows), and a search that intersects posting lists. */
export function IndexTypesGinView() {
  const index = useMemo(() => buildIndex(DOCS), [])
  const [terms, setTerms] = useState<string[]>(['waterproof', 'wool'])
  const result = search(index, terms)
  const hits = new Set(result)
  const toggle = (t: string) => setTerms((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]))

  return (
    <Demo
      title="A GIN index: every word points to its rows"
      hint="Click words to search for rows containing all of them (search @@ 'waterproof & wool'). Simplified: the real index stores stemmed words (skiing → ski)."
    >
      <div className={styles.ginLayout}>
        <div>
          <div className={styles.ginHead} style={hue(3)}>
            table rows
          </div>
          {DOCS.map((d) => (
            <div key={d.id} className={cx(styles.ginDoc, hits.has(d.id) && styles.ginHit)} style={hue(3)}>
              <span className={styles.ginId}>{d.id}</span>
              {d.text}
            </div>
          ))}
        </div>
        <div>
          <div className={styles.ginHead} style={hue(7)}>
            GIN index: key → posting list
          </div>
          <div className={styles.ginKeys}>
            {[...index.entries()].map(([word, ids]) => (
              <button
                type="button"
                key={word}
                className={cx(styles.ginKey, terms.includes(word) && styles.ginKeyOn)}
                style={hue(7)}
                aria-pressed={terms.includes(word)}
                onClick={() => toggle(word)}
              >
                <span className={styles.ginWord}>{word}</span>
                <span className={styles.ginList}>{ids.join(', ')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.ginResult} aria-live="polite">
        {terms.length === 0 ? (
          'Pick at least one word.'
        ) : (
          <>
            {terms.map((t) => `${t} → {${(index.get(t) ?? []).join(', ')}}`).join('  ∩  ')} = <strong>{result.length ? `rows ${result.join(', ')}` : 'no rows'}</strong>
          </>
        )}
      </div>
    </Demo>
  )
}
