// A tiny WebDriver BiDi driver for a throwaway headless Firefox, used to read the RustFS web console.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function openBrowser() {
  const port = 9300 + Math.floor(Math.random() * 500)
  const profile = mkdtempSync(join(tmpdir(), 's3cap-ff-'))
  const ff = spawn('firefox', ['--headless', '--profile', profile, '--remote-debugging-port', String(port)], { stdio: 'ignore', env: { ...process.env, TZ: 'UTC' } })
  let ws
  for (let i = 0; i < 60 && !ws; i++) {
    try {
      const s = new WebSocket(`ws://127.0.0.1:${port}/session`)
      await new Promise((ok, fail) => { s.onopen = ok; s.onerror = fail })
      ws = s
    } catch {
      await sleep(250)
    }
  }
  if (!ws) throw new Error('Firefox did not start')
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  }
  const send = (method, params) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await send('session.new', { capabilities: {} })
  const context = (await send('browsingContext.create', { type: 'tab' })).result.context
  await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 900 } })
  const evaluate = async (expression) => (await send('script.evaluate', { expression, target: { context }, awaitPromise: true })).result?.result?.value
  return {
    async go(url) { await send('browsingContext.navigate', { context, url, wait: 'complete' }); await sleep(2500) },
    async fill(css, value) {
      await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(css)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })) })()`)
    },
    /** Clicks every button, link or row whose visible text is exactly `text`; returns how many. */
    async click(text, wait = 1500) {
      const n = await evaluate(`(() => { const b = [...document.querySelectorAll('button, a, [role=button], [role=menuitem], [role=tab]')].filter((b) => b.innerText?.trim() === ${JSON.stringify(text)}); b.forEach((x) => x.click()); return b.length })()`)
      await sleep(wait)
      if (!n) throw new Error(`nothing to click: ${text}`)
    },
    text: (css = 'body') => evaluate(`document.querySelector(${JSON.stringify(css)})?.innerText ?? ''`),
    inputs: () => evaluate(`JSON.stringify([...document.querySelectorAll('input:not([type=hidden]),textarea')].map((i) => ({ id: i.id, name: i.name, placeholder: i.placeholder, type: i.type })))`).then(JSON.parse),
    evaluate,
    async close() { ws.close(); ff.kill(); await sleep(400); rmSync(profile, { recursive: true, force: true }) },
  }
}
