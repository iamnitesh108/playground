// Runs two-session scenarios against a real PostgreSQL and records what happened at every step.
import pg from 'pg'

const conn = { host: '127.0.0.1', port: 55432, user: 'postgres', password: 'lab', database: 'lab' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function describe(res) {
  if (Array.isArray(res)) res = res[res.length - 1]
  if (res.command === 'SELECT' && res.fields?.length) return { kind: 'rows', columns: res.fields.map((f) => f.name), rows: res.rows.map((r) => res.fields.map((f) => r[f.name])) }
  const tag = res.command === 'INSERT' ? `INSERT 0 ${res.rowCount}` : res.rowCount !== null && res.rowCount !== undefined && ['UPDATE', 'DELETE', 'SELECT'].includes(res.command) ? `${res.command} ${res.rowCount}` : res.command
  return { kind: 'tag', tag }
}

const errorOf = (e) => ({ kind: 'error', code: e.code, message: e.message, detail: e.detail ?? null })

/** Decodes one int4 or bool stored in a bytea (little endian). */
const INSPECT_ROWS = (table, columns) => `
SELECT lp, lp_flags, lp_off, (t_infomask2 & 16384) <> 0 AS hot_updated, (t_infomask2 & 32768) <> 0 AS heap_only, t_xmin::text AS xmin, t_xmax::text AS xmax, t_ctid::text AS ctid,
       (t_infomask & 1024) <> 0 AS xmax_invalid_hint,
       ${columns
         .map(
           (c, i) =>
             c.type === 'int'
               ? `CASE WHEN t_data IS NULL THEN NULL ELSE (SELECT get_byte(b,0) + get_byte(b,1)*256 + get_byte(b,2)*65536 + get_byte(b,3)*16777216 FROM (SELECT (tuple_data_split('${table}'::regclass, t_data, t_infomask, t_infomask2, t_bits))[${i + 1}] AS b) s) END AS ${c.name}`
               : `CASE WHEN t_data IS NULL THEN NULL ELSE (SELECT get_byte(b,0) = 1 FROM (SELECT (tuple_data_split('${table}'::regclass, t_data, t_infomask, t_infomask2, t_bits))[${i + 1}] AS b) s) END AS ${c.name}`,
         )
         .join(',\n       ')}
FROM heap_page_items(get_raw_page('${table}', 0)) ORDER BY lp`

export async function runScenario({ name, setup, steps, table, columns, settleMs = 400 }) {
  const admin = new pg.Client(conn)
  await admin.connect()
  for (const sql of setup) await admin.query(sql)
  const sessions = { A: new pg.Client(conn), B: new pg.Client(conn) }
  await sessions.A.connect()
  await sessions.B.connect()
  const pids = {}
  for (const s of ['A', 'B']) pids[s] = (await sessions[s].query('SELECT pg_backend_pid() AS p')).rows[0].p
  const pending = {}
  const frames = []
  const seenXids = new Set()

  const inspect = async (events) => {
    const act = await admin.query(`SELECT pid, backend_xid::text AS xid, state, wait_event_type FROM pg_stat_activity WHERE pid = ANY($1)`, [[pids.A, pids.B]])
    const bySession = {}
    for (const s of ['A', 'B']) {
      const row = act.rows.find((r) => r.pid === pids[s])
      bySession[s] = { xid: row?.xid ?? null, state: row?.state ?? null, waiting: row?.wait_event_type === 'Lock' }
      if (row?.xid) seenXids.add(row.xid)
    }
    let page = null
    if (table) {
      page = (await admin.query(INSPECT_ROWS(table, columns))).rows
      for (const t of page) {
        if (t.xmin && t.xmin !== '0') seenXids.add(t.xmin)
        if (t.xmax && t.xmax !== '0') seenXids.add(t.xmax)
      }
    }
    const xids = {}
    for (const x of seenXids) xids[x] = (await admin.query(`SELECT pg_xact_status($1::xid8) AS s`, [x])).rows[0].s
    frames.push({ ...events, sessions: bySession, page, xids })
  }

  await inspect({ step: null, results: {} })
  for (const step of steps) {
    const results = {}
    if (step.sql) {
      const p = sessions[step.s].query(step.sql).then(describe, errorOf)
      const settled = await Promise.race([p.then((r) => ({ r })), sleep(step.wait ?? settleMs).then(() => null)])
      if (settled) results[step.s] = settled.r
      else {
        results[step.s] = { kind: 'blocked' }
        pending[step.s] = p
      }
    }
    if (step.sleep) await sleep(step.sleep)
    await sleep(150)
    // Did a statement waiting in the other session finish because of this step?
    for (const s of Object.keys(pending)) {
      if (s === step.s && results[s]?.kind === 'blocked') continue
      const done = await Promise.race([pending[s].then((r) => ({ r })), sleep(50).then(() => null)])
      if (done) {
        results[s] = { ...done.r, unblocked: true }
        delete pending[s]
      }
    }
    await inspect({ step, results })
  }
  for (const s of Object.keys(pending)) await pending[s].catch(() => {})
  await sessions.A.end()
  await sessions.B.end()
  await admin.end()
  return { name, frames }
}
