// Records lesson 7 "Versioning, object lock and lifecycle": versions and delete markers, restoring, object
// lock (governance, compliance, legal hold), lifecycle rules, and — on a second server where one lifecycle
// "day" is shortened to a few seconds (RUSTFS_ILM_DEBUG_DAY_SECS, a RustFS test setting) — expiry happening.
//   node capture-versioning.mjs
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { dropWorkspace, HERE, LAB, removeContainer, sleep, startServer, version, workspace } from './lib/lab.mjs'
import { Session, writeData } from './lib/record.mjs'
import { send, sign } from './lib/sigv4.mjs'

const w = workspace('versioning')
const versionsQuery = '--query "{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}"'
const put = (name, text) => writeFileSync(join(w, name), text)

try {
  await startServer()
  const s = new Session({ cwd: w })

  // ---- switch versioning on
  s.run('aws s3 mb s3://catalog')
  s.run('aws s3api get-bucket-versioning --bucket catalog')
  s.run('aws s3api put-bucket-versioning --bucket catalog --versioning-configuration Status=Enabled')
  s.run('aws s3api get-bucket-versioning --bucket catalog')
  const enable = s.take()

  // ---- three writes of the same key
  const ids = []
  for (const price of ['12.00', '12.50', '13.00']) {
    put('prices.csv', `sku,price\nMUG-350,${price}\n`)
    const r = s.run('aws s3api put-object --bucket catalog --key prices.csv --body prices.csv')
    ids.push(JSON.parse(r.out).VersionId)
  }
  s.run(`aws s3api list-object-versions --bucket catalog --prefix prices.csv ${versionsQuery}`)
  s.run('aws s3 cp s3://catalog/prices.csv -')
  s.run(`aws s3api get-object --bucket catalog --key prices.csv --version-id ${ids[0]} first.csv`)
  s.run('cat first.csv')
  const overwrite = s.take()

  // ---- delete: a delete marker
  s.run('aws s3 rm s3://catalog/prices.csv')
  s.run('aws s3 ls s3://catalog/')
  s.run('aws s3api head-object --bucket catalog --key prices.csv')
  const listed = s.run(`aws s3api list-object-versions --bucket catalog --prefix prices.csv ${versionsQuery}`)
  const markerId = JSON.parse(listed.out).deleteMarkers[0][0]
  const del = s.take()

  // ---- undo the delete by deleting the marker
  s.run(`aws s3api delete-object --bucket catalog --key prices.csv --version-id ${markerId}`)
  s.run('aws s3 cp s3://catalog/prices.csv -')
  const undelete = s.take()

  // ---- bring back an old version: copy it over the current one
  s.run(`aws s3api copy-object --bucket catalog --key prices.csv --copy-source "catalog/prices.csv?versionId=${ids[0]}"`)
  s.run('aws s3 cp s3://catalog/prices.csv -')
  s.run(`aws s3api list-object-versions --bucket catalog --prefix prices.csv ${versionsQuery}`)
  const restore = s.take()

  // ---- remove one version for good
  s.run(`aws s3api delete-object --bucket catalog --key prices.csv --version-id ${ids[1]}`)
  s.run(`aws s3api list-object-versions --bucket catalog --prefix prices.csv ${versionsQuery}`)
  s.run(`aws s3api get-object --bucket catalog --key prices.csv --version-id ${ids[1]} gone.csv`)
  const purge = s.take()

  // ---- rc undo: revert the last change of a key
  put('prices.csv', 'sku,price\nMUG-350,99.99\n')
  s.run('aws s3 cp prices.csv s3://catalog/prices.csv')
  s.run('rc alias set lab http://localhost:9000 labadmin labsecret123')
  s.run('rc undo lab/catalog/prices.csv --dry-run')
  s.run('rc undo lab/catalog/prices.csv')
  s.run('aws s3 cp s3://catalog/prices.csv -')
  const undo = s.take()

  // ---- object lock
  put('invoice.pdf', '%PDF-1.7\nInvoice 2026-0042\n')
  s.run('aws s3api create-bucket --bucket invoices --object-lock-enabled-for-bucket')
  s.run('aws s3api get-bucket-versioning --bucket invoices')
  s.run('aws s3api put-object-lock-configuration --bucket invoices --object-lock-configuration "{\\"ObjectLockEnabled\\": \\"Enabled\\", \\"Rule\\": {\\"DefaultRetention\\": {\\"Mode\\": \\"GOVERNANCE\\", \\"Days\\": 1}}}"')
  s.run('aws s3api get-object-lock-configuration --bucket invoices')
  const lockSetup = s.take()
  const g = s.run('aws s3api put-object --bucket invoices --key 2026/0042.pdf --body invoice.pdf')
  const gid = JSON.parse(g.out).VersionId
  s.run('aws s3api get-object-retention --bucket invoices --key 2026/0042.pdf')
  s.run(`aws s3api delete-object --bucket invoices --key 2026/0042.pdf --version-id ${gid}`)
  s.run(`aws s3api delete-object --bucket invoices --key 2026/0042.pdf --version-id ${gid} --bypass-governance-retention`)
  const governance = s.take()
  const until = new Date(Date.now() + 24 * 3600_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const c = s.run(`aws s3api put-object --bucket invoices --key 2026/0043.pdf --body invoice.pdf --object-lock-mode COMPLIANCE --object-lock-retain-until-date ${until}`)
  const cid = JSON.parse(c.out).VersionId
  s.run('aws s3api get-object-retention --bucket invoices --key 2026/0043.pdf')
  s.run(`aws s3api delete-object --bucket invoices --key 2026/0043.pdf --version-id ${cid} --bypass-governance-retention`)
  s.run(`aws s3api put-object-retention --bucket invoices --key 2026/0043.pdf --version-id ${cid} --retention "{\\"Mode\\": \\"COMPLIANCE\\", \\"RetainUntilDate\\": \\"2026-01-01T00:00:00Z\\"}"`)
  s.run('aws s3 rm s3://invoices/2026/0043.pdf')
  s.run(`aws s3api list-object-versions --bucket invoices --prefix 2026/0043.pdf ${versionsQuery}`)
  const compliance = s.take()
  const h = s.run('aws s3api put-object --bucket invoices --key 2026/0044.pdf --body invoice.pdf')
  const hid = JSON.parse(h.out).VersionId
  s.run(`aws s3api put-object-legal-hold --bucket invoices --key 2026/0044.pdf --version-id ${hid} --legal-hold Status=ON`)
  s.run(`aws s3api delete-object --bucket invoices --key 2026/0044.pdf --version-id ${hid} --bypass-governance-retention`)
  s.run(`aws s3api put-object-legal-hold --bucket invoices --key 2026/0044.pdf --version-id ${hid} --legal-hold Status=OFF`)
  s.run(`aws s3api delete-object --bucket invoices --key 2026/0044.pdf --version-id ${hid} --bypass-governance-retention`)
  const legalHold = s.take()
  s.run('aws s3api put-object-lock-configuration --bucket catalog --object-lock-configuration "{\\"ObjectLockEnabled\\": \\"Enabled\\"}"')
  const lockLater = s.take()

  // ---- lifecycle rules
  const lifecycle = {
    Rules: [
      { ID: 'expire-temp-files', Status: 'Enabled', Filter: { Prefix: 'tmp/' }, Expiration: { Days: 7 } },
      { ID: 'old-versions-after-30-days', Status: 'Enabled', Filter: { Prefix: '' }, NoncurrentVersionExpiration: { NoncurrentDays: 30, NewerNoncurrentVersions: 3 } },
      { ID: 'abort-stale-uploads', Status: 'Enabled', Filter: { Prefix: '' }, AbortIncompleteMultipartUpload: { DaysAfterInitiation: 3 } },
      { ID: 'remove-lonely-delete-markers', Status: 'Enabled', Filter: { Prefix: '' }, Expiration: { ExpiredObjectDeleteMarker: true } },
    ],
  }
  writeFileSync(join(HERE, 'policies/lifecycle.json'), JSON.stringify(lifecycle, null, 2) + '\n')
  writeFileSync(join(w, 'lifecycle.json'), JSON.stringify(lifecycle, null, 2) + '\n')
  put('export.csv', 'id,total\n1,12.00\n')
  s.run('aws s3api put-bucket-lifecycle-configuration --bucket catalog --lifecycle-configuration file://lifecycle.json')
  s.run('aws s3api get-bucket-lifecycle-configuration --bucket catalog --query "Rules[].ID"')
  s.run('aws s3api put-object --bucket catalog --key tmp/export.csv --body export.csv')
  s.run('aws s3api head-object --bucket catalog --key tmp/export.csv')
  const tiering = { Rules: [{ ID: 'to-archive', Status: 'Enabled', Filter: { Prefix: 'archive/' }, Transitions: [{ Days: 30, StorageClass: 'GLACIER' }] }] }
  writeFileSync(join(w, 'tiering.json'), JSON.stringify(tiering) + '\n')
  s.run('aws s3api put-bucket-lifecycle-configuration --bucket catalog --lifecycle-configuration file://tiering.json')
  s.run('aws s3api put-object --bucket catalog --key archive/x.csv --body export.csv --storage-class GLACIER')
  const rules = s.take()
  removeContainer(LAB.name)

  // ---- expiry happening: one lifecycle "day" = 5 seconds
  const DAY = 5
  await startServer({ env: { RUSTFS_ILM_DEBUG_DAY_SECS: String(DAY), RUSTFS_SCANNER_CYCLE: '1', RUSTFS_ILM_PROCESS_TIME: '1' } })
  const fast = { Rules: [
    { ID: 'expire-temp-after-1-day', Status: 'Enabled', Filter: { Prefix: 'tmp/' }, Expiration: { Days: 1 } },
    { ID: 'noncurrent-after-1-day', Status: 'Enabled', Filter: { Prefix: 'docs/' }, NoncurrentVersionExpiration: { NoncurrentDays: 1 } },
  ] }
  writeFileSync(join(w, 'fast.json'), JSON.stringify(fast, null, 2) + '\n')
  s.run('aws s3 mb s3://scratch')
  s.run('aws s3api put-bucket-versioning --bucket scratch --versioning-configuration Status=Enabled')
  s.run('aws s3api put-bucket-lifecycle-configuration --bucket scratch --lifecycle-configuration file://fast.json')
  put('v.txt', 'first\n')
  s.run('aws s3api put-object --bucket scratch --key docs/terms.txt --body v.txt')
  put('v.txt', 'second\n')
  s.run('aws s3api put-object --bucket scratch --key docs/terms.txt --body v.txt')
  s.run('aws s3api put-object --bucket scratch --key tmp/export.csv --body export.csv')
  s.run(`aws s3api list-object-versions --bucket scratch ${'--query "{versions: Versions[].[Key, IsLatest], deleteMarkers: DeleteMarkers[].[Key, IsLatest]}"'}`)
  const fastSetup = s.take()

  // poll the version list once a second (signed GET ?versions) and note every change
  const t0 = Date.now()
  const snapshot = async () => {
    const signed = sign({ method: 'GET', path: '/scratch', query: { versions: '' }, headers: { host: 'localhost:9000' }, accessKey: LAB.access, secretKey: LAB.secret })
    const res = await send({ port: LAB.api, method: 'GET', path: '/scratch', query: signed.query, headers: signed.headers })
    const entries = [...res.body.matchAll(/<(Version|DeleteMarker)>([\s\S]*?)<\/\1>/g)].map((m) => `${m[1] === 'Version' ? 'version' : 'delete marker'} of ${m[2].match(/<Key>([^<]+)<\/Key>/)[1]}${m[2].includes('<IsLatest>true') ? ' (latest)' : ''}`)
    return entries.sort().join(' | ')
  }
  const timeline = []
  let last = await snapshot()
  timeline.push({ at: 0, state: last })
  while (Date.now() - t0 < 90_000) {
    await sleep(1000)
    const now = await snapshot()
    if (now !== last) {
      timeline.push({ at: Math.round((Date.now() - t0) / 100) / 10, state: now })
      last = now
    }
    if (timeline.length >= 3 && Date.now() - t0 > 30_000) break
  }
  s.run(`aws s3api list-object-versions --bucket scratch ${'--query "{versions: Versions[].[Key, IsLatest], deleteMarkers: DeleteMarkers[].[Key, IsLatest]}"'}`)
  s.run('aws s3 ls s3://scratch/ --recursive')
  const fastAfter = s.take()

  writeData(
    'versioning.ts',
    'VERSIONING',
    { version: version(), ids, enable, overwrite, del, undelete, restore, purge, undo, lockSetup, governance, compliance, legalHold, lockLater, rules, lifecycle, fast: { daySeconds: DAY, rules: fast, setup: fastSetup, timeline, after: fastAfter } },
    { script: 'capture-versioning.mjs' },
  )
} finally {
  removeContainer(LAB.name)
  dropWorkspace(w)
}
