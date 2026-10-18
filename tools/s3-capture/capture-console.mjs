// Records the text of the RustFS web console (labels, menus, dialogs) by driving it in a headless Firefox,
// so lessons can describe the no-code steps with the console's own words.
//   node capture-console.mjs           (needs firefox on the PATH)
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { openBrowser } from './lib/browser.mjs'
import { dropWorkspace, LAB, removeContainer, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'

const CONSOLE = `http://localhost:${LAB.console}/rustfs/console`
const lines = (text) => text.split('\n').map((l) => l.trim()).filter(Boolean)
const w = workspace('console')
let b
try {
  await startServer()
  // something to look at: one bucket with one object
  writeFileSync(join(w, 'welcome.txt'), 'Welcome to the catalog.\n')
  const s = new Session({ cwd: w })
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3 cp welcome.txt s3://catalog/docs/welcome.txt')

  b = await openBrowser()
  const pages = {}
  const dialog = async () => lines(await b.text('[role=dialog]'))
  const main = async () => lines(await b.text('main'))

  await b.go(`${CONSOLE}/`)
  pages.login = lines(await b.text('body'))
  const loginInputs = await b.inputs()
  await b.fill('#accessKey', LAB.access)
  await b.fill('#secretKey', LAB.secret)
  await b.click('Login', 3000)
  const menu = JSON.parse(await b.evaluate(`JSON.stringify([...document.querySelectorAll('[data-sidebar=menu]')].map((ul) => [...ul.querySelectorAll('[data-sidebar=menu-button]')].map((a) => a.innerText.trim())))`))
  pages.buckets = await main()
  await b.click('Create Bucket')
  pages.createBucket = await dialog()
  await b.go(`${CONSOLE}/browser/?bucket=catalog`)
  pages.bucket = await main()
  await b.click('Upload File/Folder')
  pages.upload = await dialog()
  await b.go(`${CONSOLE}/browser/?bucket=catalog&key=docs%2F`)
  pages.folder = await main()
  await b.click('welcome.txt')
  pages.object = await dialog()

  await b.go(`${CONSOLE}/access-keys/`)
  pages.accessKeys = await main()
  await b.click('Add Access Key')
  pages.addAccessKey = await dialog()
  await b.go(`${CONSOLE}/policies/`)
  pages.policies = await main()
  await b.go(`${CONSOLE}/users/`)
  pages.users = await main()
  await b.click('Add User')
  pages.addUser = await dialog()

  writeData('console.ts', 'CONSOLE', { version: version(), url: 'http://localhost:9001/rustfs/console/', loginInputs, menu, pages }, { script: 'capture-console.mjs' })
} finally {
  await b?.close()
  removeContainer(LAB.name)
  dropWorkspace(w)
}
