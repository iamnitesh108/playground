// Runs every experiment against the development build of React and writes the lesson data file.
// Usage (from this directory): node capture.mjs ../../src/modules/react/data/captures.ts
import { writeFileSync } from 'node:fs'
import { openRunner } from './harness.mjs'
import { compile } from './compile.mjs'

const [, , outFile] = process.argv
const root = new URL('../../', import.meta.url).pathname
const runner = await openRunner(root)
const EXPERIMENTS = ['elements', 'rerender', 'batching', 'keys', 'effects', 'hooks', 'memoization', 'reconcile', 'concurrent', 'hydration']
const capture = { react: runner.React.version, compiled: await compile() }
for (const name of EXPERIMENTS) {
  const r = await runner.run(`/tools/react-capture/experiments/${name}.jsx`)
  const consoleErrors = r.errors.map((e) => e.replaceAll(root, "/"))
  capture[name] = Array.isArray(r.data) ? r.data : { ...r.data, ...(consoleErrors.length ? { consoleErrors } : {}) }
}
await runner.close()
const header = `// Recorded with React ${capture.react} (development build, react-dom/client in jsdom) by tools/react-capture — do not edit by hand.\n\n`
writeFileSync(outFile, `${header}export const CAPTURE = ${JSON.stringify(capture, null, 1)} as const\n`)
console.log('wrote', outFile)
