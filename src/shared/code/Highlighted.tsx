import { useEffect, useState } from 'react'

type Highlighter = typeof import('./highlighter')

// highlight.js loads on first use, in its own chunk, so pages without code do not pay for it
let loading: Promise<Highlighter> | null = null
let loaded: Highlighter | null = null
const load = () => (loading ??= import('./highlighter').then((m) => (loaded = m)))

/** Code with syntax colours; shows the plain text until the highlighter has loaded, or if it cannot tell the language. */
export function Highlighted({ code, language }: { code: string; language?: string }) {
  const [, setReady] = useState(loaded !== null)
  useEffect(() => {
    if (!loaded) void load().then(() => setReady(true))
  }, [])
  const html = loaded?.highlight(code, language) ?? null
  return html === null ? <>{code}</> : <span dangerouslySetInnerHTML={{ __html: html }} />
}
