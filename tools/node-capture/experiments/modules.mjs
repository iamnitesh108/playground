// CommonJS and ES modules side by side, in a throwaway directory.
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const dir = mkdtempSync(join(tmpdir(), 'modules-'))
const files = {
  'counter.cjs': `let count = 0\nmodule.exports = { next: () => ++count }\nconsole.log('counter.cjs evaluated')`,
  'cache.cjs': `const a = require('./counter.cjs')\nconst b = require('./counter.cjs')\nconsole.log('same object:', a === b)\nconsole.log(a.next(), b.next(), a.next())`,
  'math.cjs': `exports.add = (x, y) => x + y\nexports.version = '1.0'`,
  'import-cjs.mjs': `import { add } from './math.cjs'\nimport math from './math.cjs'\nconsole.log(add(2, 3), math.version)`,
  'money.mjs': `export const format = (cents) => (cents / 100).toFixed(2)\nexport default 'money'`,
  'require-esm.cjs': `const money = require('./money.mjs')\nconsole.log(Object.keys(money), money.format(2500), money.default)`,
  'slow.mjs': `await new Promise((r) => setTimeout(r, 10))\nexport const ready = true`,
  'require-tla.cjs': `require('./slow.mjs')`,
  'paths.mjs': `console.log(import.meta.dirname === undefined ? 'no dirname' : 'import.meta.dirname ok', typeof import.meta.filename)\nconsole.log(__dirname)`,
  'pkg/package.json': JSON.stringify({ type: 'module' }),
  'pkg/index.js': `console.log(typeof require === 'undefined' ? '.js is an ES module here' : '.js is CommonJS here')`,
  'detect/index.js': `import { platform } from 'node:os'\nconsole.log('ESM syntax detected, platform:', typeof platform())`,
  'plain/index.js': `console.log(typeof require === 'undefined' ? '.js is an ES module here' : '.js is CommonJS here')`,
}
mkdirSync(join(dir, 'pkg'))
mkdirSync(join(dir, 'plain'))
mkdirSync(join(dir, 'detect'))
for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text)
const run = (file) => {
  const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8' })
  const clean = (t) => t.replaceAll(dir, '/app').replace(/\n\s+at .+/g, '').replace(/\n\s+code: .+\n}/, '').replace(/\nNode\.js v[\d.]+\n?/, '').trim()
  return { file, stdout: clean(r.stdout), stderr: clean(r.stderr), exit: r.status }
}
console.log(JSON.stringify({ sources: Object.fromEntries(Object.entries(files).filter(([n]) => !n.endsWith('package.json'))), runs: ['cache.cjs', 'import-cjs.mjs', 'require-esm.cjs', 'require-tla.cjs', 'paths.mjs', 'pkg/index.js', 'plain/index.js', 'detect/index.js'].map(run) }))
