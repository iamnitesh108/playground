import { Callout, CodeBlock, LessonGoals, Predict, Recap, Table } from '@/shared/ui'
import { CAPTURE } from '../data/captures'
import own from './lesson.module.css'

const { sources, runs } = CAPTURE.modules
type File = keyof typeof sources

const result = (file: string) => {
  const r = runs.find((x) => x.file === file)!
  return `$ node ${file}\n${[r.stdout, r.stderr].filter(Boolean).join('\n')}${r.exit ? `\n(exit code ${r.exit})` : ''}`
}

function Example({ files, run }: { files: File[]; run: string }) {
  return (
    <div className={own.grid2}>
      <div>
        {files.map((f) => (
          <CodeBlock key={f} title={f} code={sources[f]} />
        ))}
      </div>
      <CodeBlock title="recorded" code={result(run)} />
    </div>
  )
}

export default function Modules() {
  return (
    <>
      <LessonGoals
        goals={[
          'read and write both module systems',
          'know when a module’s code runs, and that it runs once',
          'predict whether Node.js treats a .js file as CommonJS or ESM',
          'mix the two, and know the one case that fails',
        ]}
      />

      <h2>Two module systems</h2>
      <Table
        head={['', 'CommonJS (CJS)', 'ES modules (ESM)']}
        rows={[
          ['import', <code key="a">const x = require('./x')</code>, <code key="b">import x from './x.js'</code>],
          ['export', <code key="a">module.exports = …</code>, <code key="b">export const … / export default …</code>],
          ['loading', 'synchronous, when require() runs', 'parsed first, linked, then evaluated; may use top-level await'],
          ['file path variables', <code key="a">__dirname, __filename</code>, <code key="b">import.meta.dirname, import.meta.filename</code>],
          ['origin', 'Node.js’s own system since 2009', 'the JavaScript standard; also in browsers'],
        ]}
      />
      <p>New code is usually ESM, but most npm packages and older services are CommonJS, so you will read both. Each example below was run with Node.js {CAPTURE.node}.</p>

      <h2>A module runs once</h2>
      <Predict
        question={<p>Two files require the same module. How many times does the module’s top-level code run?</p>}
        options={['Once per require()', 'Once per process', 'Once per file that requires it']}
        answer={1}
        explanation="The first require() runs the module and stores its exports in a cache; later calls return the same object. ESM caches the same way."
      />
      <Example files={['counter.cjs', 'cache.cjs']} run="cache.cjs" />
      <p>
        Because the exports object is shared, a module is a natural place for a single shared thing — a connection pool, a configuration. And a
        module with state shares that state with every importer.
      </p>

      <h2>Which system does a file use?</h2>
      <Table
        head={['File', 'Treated as']}
        rows={[
          [<code key="f">.mjs</code>, 'ESM, always'],
          [<code key="f">.cjs</code>, 'CommonJS, always'],
          [<code key="f">.js</code>, 'the "type" of the nearest package.json: "module" → ESM, "commonjs" or none → CommonJS …'],
          ['', '… except a .js file with no "type" whose code uses import/export syntax: Node.js 22.12+ detects it and runs it as ESM'],
        ]}
      />
      <div className={own.grid2}>
        <CodeBlock title="recorded: pkg/ has package.json with &quot;type&quot;: &quot;module&quot;" code={result('pkg/index.js')} />
        <CodeBlock title="recorded: plain/ has no package.json" code={result('plain/index.js')} />
      </div>
      <Example files={['detect/index.js']} run="detect/index.js" />
      <Callout tone="tip">
        Set <code>"type"</code> explicitly in every package.json. Detection costs a second parse when the first guess fails, and an explicit type
        tells readers and tools what to expect.
      </Callout>

      <h2>Mixing them</h2>
      <h3>ESM importing CommonJS — works</h3>
      <Example files={['math.cjs', 'import-cjs.mjs']} run="import-cjs.mjs" />
      <p>
        <code>module.exports</code> becomes the default export. Named imports work when Node.js can find the names by scanning the CommonJS source (it
        could here: <code>exports.add = …</code>).
      </p>
      <h3>CommonJS requiring ESM — works since Node.js 22.12 and 20.19</h3>
      <Example files={['money.mjs', 'require-esm.cjs']} run="require-esm.cjs" />
      <p>require() returns the module namespace object: the named exports, plus <code>default</code>.</p>
      <h3>…unless the ES module uses top-level await</h3>
      <Example files={['slow.mjs', 'require-tla.cjs']} run="require-tla.cjs" />
      <p>require() is synchronous and cannot wait. Use <code>await import('./slow.mjs')</code> from CommonJS instead.</p>

      <h2>__dirname in ES modules</h2>
      <Example files={['paths.mjs']} run="paths.mjs" />
      <p>
        Use <code>import.meta.dirname</code> and <code>import.meta.filename</code> (Node.js 20.11+). Older code builds them with{' '}
        <code>fileURLToPath(import.meta.url)</code>.
      </p>

      <Recap
        points={[
          'A module’s top level runs once; every importer gets the same cached exports.',
          '.mjs is ESM, .cjs is CommonJS, .js follows package.json "type" (or syntax detection when there is none).',
          'ESM can import CommonJS; CommonJS can require ESM unless it uses top-level await.',
          'In ESM, use import.meta.dirname instead of __dirname.',
        ]}
      />
    </>
  )
}
