import { useState } from 'react'
import { Highlighted } from '@/shared/code'
import { cx } from '@/shared/utils/cx'
import styles from './Terminal.module.css'

export interface TermStep {
  readonly cmd?: string
  readonly out?: string
  /** Exit code when the command failed. */
  readonly code?: number
  readonly note?: string
}

interface TerminalProps {
  steps: readonly TermStep[]
  title?: string
  prompt?: string
  /** Shows only the first lines of long outputs, with a button for the rest. */
  maxLines?: number
}

const languageOf = (out: string) => {
  const t = out.trimStart()
  if (t.startsWith('{') || t.startsWith('[')) return 'json'
  if (t.startsWith('<?xml') || t.startsWith('<')) return 'xml'
  return 'output'
}

function Output({ out, failed, maxLines }: { out: string; failed: boolean; maxLines: number }) {
  const lines = out.split('\n')
  const [open, setOpen] = useState(false)
  const long = lines.length > maxLines + 2
  const shown = long && !open ? lines.slice(0, maxLines).join('\n') : out
  return (
    <>
      <pre className={cx(styles.out, failed && styles.failed)}>
        <Highlighted language={languageOf(out)} code={shown} />
      </pre>
      {long && (
        <button type="button" className={styles.more} onClick={() => setOpen((o) => !o)}>
          {open ? 'show less' : `show all ${lines.length} lines`}
        </button>
      )}
    </>
  )
}

/** A recorded shell session: commands exactly as they ran, output exactly as printed. */
export function Terminal({ steps, title = 'recorded session', prompt = '$', maxLines = 24 }: TerminalProps) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(steps.filter((s) => s.cmd).map((s) => s.cmd).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <figure className={styles.terminal}>
      <figcaption className={styles.head}>
        <span>{title}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy commands'}
        </button>
      </figcaption>
      <div className={styles.body}>
        {steps.map((s, i) =>
          s.cmd === undefined ? (
            <div key={i} className={styles.note}>{s.note}</div>
          ) : (
            <div key={i} className={styles.step}>
              <div className={styles.cmd}>
                <span className={styles.prompt}>{prompt}</span> <Highlighted code={s.cmd} language="cli" />
              </div>
              {s.out ? <Output out={s.out} failed={Boolean(s.code)} maxLines={maxLines} /> : null}
              {s.code ? <div className={styles.exit}>exit code {s.code}</div> : null}
            </div>
          ),
        )}
      </div>
    </figure>
  )
}
