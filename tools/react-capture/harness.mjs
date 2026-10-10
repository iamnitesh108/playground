// Runs one experiment in a jsdom document with the development build of React.
import { format } from 'node:util'
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true })
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'InputEvent', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle']) {
  Object.defineProperty(globalThis, key, { value: dom.window[key], configurable: true, writable: true })
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

export async function openRunner(root) {
  const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
  const React = await import('react')
  const { createRoot } = await import('react-dom/client')
  async function run(file) {
    const mod = await server.ssrLoadModule(file)
    const lines = []
    const log = (line) => lines.push(line)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    const render = (element) => React.act(() => root.render(element))
    const errors = []
    const onError = (...args) => errors.push(format(...args))
    const original = console.error
    console.error = onError
    try {
      const data = await mod.run({ render, act: React.act, log, container, root, React })
      return { log: lines, data, errors }
    } finally {
      console.error = original
      await React.act(() => root.unmount())
      container.remove()
    }
  }
  return { run, close: () => server.close(), React }
}
