import { homedir, userInfo } from 'node:os'
// Records the "Getting started" lessons of the postgres module (Install and configure, Using PostgreSQL
// day to day, Schema design and data types) on a real PostgreSQL 18, and runs the Java and TypeScript
// apps those lessons show. Writes src/modules/postgres/data/start.ts.
//
//   podman run -d --name pg-start -p 55511:5432 -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab docker.io/library/postgres:18
//   (cd start-app-ts && npm install)
//   node capture-start.mjs [port] [container]
//
// psql transcripts are real psql output; the prompt in front of each command is added here (psql does not
// print prompts when it reads a script), following psql's own rules: db=> or db=# (superuser), with * inside
// a transaction and ! inside a failed one.
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { allSpecs, run, resultKey, toSql, CUSTOMERS, ORDERS } from '../../src/modules/postgres/simulation/usingPostgresQuery.ts'
import { addTenCents } from '../../src/modules/postgres/simulation/schemaDesignMoney.ts'

const PORT = Number(process.argv[2] ?? 55511)
const CONTAINER = process.argv[3] ?? 'pg-start'
const here = (p) => fileURLToPath(new URL(p, import.meta.url))
const pg = createRequire(here('./start-app-ts/'))('pg')
const OUT = here('../../src/modules/postgres/data/start.ts')
const APP_PASSWORD = 'app-secret'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- helpers ---------------------------------------------------------------------------------

/** Runs a shell command inside the container as the postgres OS user; returns stdout+stderr. */
function sh(cmd, env = {}) {
  const envArgs = Object.entries(env).flatMap(([k, v]) => ['-e', `${k}=${v}`])
  const r = spawnSync('podman', ['exec', '-u', 'postgres', '-w', '/tmp', ...envArgs, CONTAINER, 'bash', '-c', `${cmd} 2>&1`], { encoding: 'utf8' })
  return (r.stdout ?? '').replace(/\s+$/, '')
}

/** A recorded shell session: "$ cmd" followed by its output. */
function shell(steps, env = {}) {
  return steps.map((s) => {
    const cmd = typeof s === 'string' ? s : s.cmd
    const shown = typeof s === 'string' ? s : s.show ?? s.cmd
    const out = sh(cmd, env)
    return `$ ${shown}${out ? `\n${out}` : ''}`
  }).join('\n\n')
}

/**
 * One psql process reads every step of every section, so session state (transactions, \x) carries over.
 * Returns section name → transcript. Steps with hide: true run but are not shown.
 */
function psqlSession({ db, user, superuser = false, password }, sections) {
  const marker = (i) => `@@step-${i}@@`
  const flat = []
  for (const [section, steps] of Object.entries(sections)) for (const s of steps) flat.push({ section, ...(typeof s === 'string' ? { sql: s } : s) })
  const script = flat.map((s, i) => `\\echo ${marker(i)}\n${s.sql}\n`).join('')
  const args = ['exec', '-i', '-u', 'postgres', '-w', '/tmp', ...(password ? ['-e', `PGPASSWORD=${password}`] : []), CONTAINER, 'bash', '-c', `psql -X -h ${password ? 'localhost' : '/var/run/postgresql'} -U ${user} -d ${db} 2>&1`]
  const out = execFileSync('podman', args, { input: script, encoding: 'utf8' })
  const pieces = out.split(/^@@step-(\d+)@@\n?/m)
  const outputs = new Map()
  for (let i = 1; i < pieces.length; i += 2) outputs.set(Number(pieces[i]), pieces[i + 1].replace(/\s+$/, ''))
  const result = {}
  let tx = ''
  flat.forEach((s, i) => {
    const output = outputs.get(i) ?? ''
    const prompt = `${db}=${tx}${superuser ? '#' : '>'} `
    const head = s.sql.trim().toUpperCase()
    if (/^(BEGIN|START TRANSACTION)/.test(head)) tx = '*'
    else if (/^(COMMIT|ROLLBACK|END)\b/.test(head)) tx = ''
    else if (tx && /^ERROR:/m.test(output)) tx = '!'
    if (s.hide) return
    const pad = ' '.repeat(prompt.length)
    const lines = s.sql.trim().split('\n')
    // rows after COPY … FROM STDIN are data, typed without a prompt
    const copyData = /FROM STDIN/i.test(lines[0])
    const shown = [prompt + lines[0], ...lines.slice(1).map((l) => (copyData ? l : pad + l))].join('\n')
    result[s.section] = [...(result[s.section] ?? []), output ? `${shown}\n${output}` : shown]
  })
  for (const k of Object.keys(result)) result[k] = result[k].join('\n\n')
  return result
}

const client = async (database, user = 'postgres', password = 'lab') => {
  const c = new pg.Client({ host: '127.0.0.1', port: PORT, user, password, database })
  await c.connect()
  return c
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d

// ---- server preparation ------------------------------------------------------------------------

// TCP logins from inside the container need a password too (the image trusts 127.0.0.1 and ::1 by default)
sh(`sed -i -E 's/^(host +all +all +(127\\.0\\.0\\.1\\/32|::1\\/128) +)trust/\\1scram-sha-256/' /var/lib/postgresql/18/docker/pg_hba.conf && psql -qX -c 'SELECT pg_reload_conf()' >/dev/null`)
sh(`rm -f ~/.pgpass; psql -qX -d postgres -c 'DROP DATABASE IF EXISTS shop' -c 'DROP DATABASE IF EXISTS types' -c 'DROP ROLE IF EXISTS app' -c "CREATE ROLE app LOGIN PASSWORD '${APP_PASSWORD}'" -c 'CREATE DATABASE shop OWNER app' -c 'CREATE DATABASE types'`)

const out = { version: '', setup: {}, using: {}, schema: {} }
const admin = await client('lab')
out.version = (await admin.query('SHOW server_version')).rows[0].server_version

// ---- Install and configure ----------------------------------------------------------------------

out.setup.contexts = (await admin.query(`SELECT context, count(*)::int AS n FROM pg_settings GROUP BY context ORDER BY n DESC`)).rows
out.setup.settings = (
  await admin.query(
    `SELECT name, context FROM pg_settings WHERE name = ANY($1) ORDER BY array_position($1, name)`,
    [[
      'listen_addresses', 'port', 'max_connections', 'shared_buffers', 'effective_cache_size', 'work_mem', 'maintenance_work_mem', 'wal_level',
      'max_wal_size', 'io_method', 'idle_in_transaction_session_timeout', 'lock_timeout', 'statement_timeout', 'log_min_duration_statement',
      'log_lock_waits', 'log_connections', 'password_encryption', 'ssl',
    ]],
  )
).rows
out.setup.checksums = (await admin.query('SHOW data_checksums')).rows[0].data_checksums
out.setup.sessionSet = psqlSession({ db: 'lab', user: 'postgres', superuser: true }, {
  set: [
    'SET work_mem = \'64MB\';',
    'SHOW work_mem;',
    'SET shared_buffers = \'1GB\';',
    "SELECT name, setting, unit, context FROM pg_settings WHERE name IN ('work_mem', 'shared_buffers');",
  ],
}).set

// ---- Using PostgreSQL day to day -------------------------------------------------------------------

const app = { db: 'shop', user: 'app', password: APP_PASSWORD }
out.using.connect = shell(
  [
    { cmd: "psql -h localhost -U app -d shop -c 'SELECT current_user'", show: "psql -h localhost -U app -d shop -c 'SELECT current_user'        # no password available" },
    { cmd: `PGPASSWORD=${APP_PASSWORD} psql -h localhost -p 5432 -U app -d shop -c 'SELECT current_user, current_database()'` },
    { cmd: `psql "postgresql://app:${APP_PASSWORD}@localhost:5432/shop?sslmode=disable" -c 'SELECT version()'` },
  ],
)
out.using.pgpass = shell([
  { cmd: `echo 'localhost:5432:shop:app:${APP_PASSWORD}' > ~/.pgpass && chmod 600 ~/.pgpass`, show: `echo 'localhost:5432:shop:app:${APP_PASSWORD}' > ~/.pgpass && chmod 600 ~/.pgpass` },
  { cmd: 'PGHOST=localhost PGUSER=app PGDATABASE=shop psql -c \'\\conninfo\'', show: 'export PGHOST=localhost PGUSER=app PGDATABASE=shop\n$ psql -c \'\\conninfo\'' },
])
sh('rm -f ~/.pgpass')

const SEED_CUSTOMERS = CUSTOMERS.map((c) => `('${c.name}', '${c.name.toLowerCase()}@example.com', '${{ Ann: 'Lisbon', Ben: 'Oslo', Cara: 'Lisbon', Dev: 'Porto' }[c.name]}')`)
const PRODUCTS = [['Keyboard', '45.00'], ['Mouse', '20.00'], ['Monitor', '180.00'], ['Cable', '8.50']]
const ORDER_PRODUCT = { 1: [1, 1], 2: [4, 2], 3: [3, 1], 4: [2, 2], 5: [2, 1], 6: [3, 1], 7: [1, 2] } // order id → [product id, quantity]
for (const o of ORDERS) {
  const [p, q] = ORDER_PRODUCT[o.id]
  if (Number(PRODUCTS[p - 1][1]) * q !== Number(o.amount)) throw new Error(`order ${o.id}: amount does not match product price × quantity`)
}

const CREATE = [
  `CREATE TABLE customers (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL,
  email text NOT NULL UNIQUE,
  city  text NOT NULL
);`,
  `CREATE TABLE products (
  id    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name  text NOT NULL UNIQUE,
  price numeric(10,2) NOT NULL CHECK (price >= 0)
);`,
  `CREATE TABLE orders (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id bigint NOT NULL REFERENCES customers (id),
  product_id  bigint NOT NULL REFERENCES products (id),
  quantity    int NOT NULL CHECK (quantity > 0),
  amount      numeric(10,2) NOT NULL,
  status      text NOT NULL DEFAULT 'new',
  created_at  timestamptz NOT NULL DEFAULT now()
);`,
  'CREATE INDEX ON orders (customer_id);',
]
const INSERT = [
  `INSERT INTO customers (name, email, city) VALUES\n  ${SEED_CUSTOMERS.join(',\n  ')}\nRETURNING id, name;`,
  `INSERT INTO products (name, price)\nVALUES ${PRODUCTS.map(([n, p]) => `('${n}', ${p})`).join(', ')}\nRETURNING *;`,
  `INSERT INTO orders (customer_id, product_id, quantity, amount, status) VALUES\n  ${ORDERS.map((o) => `(${o.customer_id}, ${ORDER_PRODUCT[o.id][0]}, ${ORDER_PRODUCT[o.id][1]}, ${o.amount}, '${o.status}')`).join(',\n  ')}\nRETURNING id, amount, status;`,
]

Object.assign(
  out.using,
  psqlSession(app, {
    create: CREATE,
    insert: INSERT,
    meta: ['\\dt', '\\d orders'],
    expanded: ['\\x on', 'SELECT * FROM orders WHERE id = 3;', '\\x off', '\\timing on', 'SELECT count(*) FROM orders;', '\\timing off'],
    select: [
      "SELECT id, name, city FROM customers WHERE city = 'Lisbon' ORDER BY name;",
      "SELECT id, customer_id, amount\nFROM orders\nWHERE status = 'paid' AND amount > 20\nORDER BY amount DESC\nLIMIT 2;",
      "SELECT name, price FROM products WHERE name ILIKE 'm%' OR price < 10;",
    ],
    update: [
      "UPDATE customers SET city = 'Bergen' WHERE email = 'ben@example.com' RETURNING *;",
      "UPDATE products SET price = price * 1.10 WHERE name = 'Cable' RETURNING name, price;",
      "UPDATE products SET price = price * 1.10;",
    ],
    updateUndo: [{ sql: "UPDATE products SET price = round(price / 1.10, 2);", hide: true }, { sql: "UPDATE products SET price = 8.50 WHERE name = 'Cable';", hide: true }],
    delete: ['DELETE FROM customers WHERE id = 1;', "DELETE FROM customers WHERE email = 'nobody@example.com';"],
    join: [
      'SELECT c.name, o.id AS order_id, p.name AS product, o.quantity, o.amount\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nJOIN products p ON p.id = o.product_id\nORDER BY o.id;',
      'SELECT c.name, o.id AS order_id\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;',
    ],
    group: [
      'SELECT status, count(*) FROM orders GROUP BY status ORDER BY status;',
      'SELECT c.name, count(*) AS orders, sum(o.amount) AS total, round(avg(o.amount), 2) AS average\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nGROUP BY c.name\nHAVING sum(o.amount) > 100\nORDER BY total DESC;',
      'SELECT c.name, o.amount FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.name;',
    ],
    rollback: [
      'BEGIN;',
      "DELETE FROM orders WHERE status = 'new' RETURNING id;",
      "SELECT count(*) FROM orders WHERE status = 'new';",
      'ROLLBACK;',
      "SELECT count(*) FROM orders WHERE status = 'new';",
    ],
    aborted: [
      'BEGIN;',
      'INSERT INTO orders (customer_id, product_id, quantity, amount)\nVALUES (4, 2, 1, 20.00) RETURNING id;',
      'INSERT INTO orders (customer_id, product_id, quantity, amount)\nVALUES (4, 99, 1, 20.00);',
      "SELECT count(*) FROM orders;",
      'COMMIT;',
      'SELECT count(*) FROM orders WHERE customer_id = 4;',
    ],
    upsert: [
      'CREATE TABLE stock (\n  product_id bigint PRIMARY KEY REFERENCES products (id),\n  quantity   int NOT NULL\n);',
      'INSERT INTO stock VALUES (1, 10);',
      'INSERT INTO stock VALUES (1, 5);',
      'INSERT INTO stock VALUES (1, 5)\nON CONFLICT (product_id) DO UPDATE SET quantity = stock.quantity + EXCLUDED.quantity\nRETURNING old.quantity AS before, new.quantity AS after;',
      'INSERT INTO stock VALUES (1, 5) ON CONFLICT DO NOTHING RETURNING *;',
    ],
    copy: [
      'COPY products (name, price) FROM STDIN WITH (FORMAT csv);\nStand,30.00\nWebcam,55.00\n\\.',
      "\\copy (SELECT id, name, price FROM products ORDER BY id) TO 'products.csv' WITH (FORMAT csv, HEADER)",
      '\\! cat products.csv',
      '\\! rm products.csv',
    ],
  }),
)
delete out.using.updateUndo

// The query playground: every combination its controls allow, run on a fresh copy of the sample rows,
// and compared with the lesson's model. A mismatch stops the capture.
sh(`psql -qX -d postgres -c 'DROP DATABASE IF EXISTS play' -c 'CREATE DATABASE play'`)
const play = await client('play')
await play.query(`CREATE TABLE customers (id bigint PRIMARY KEY, name text NOT NULL);
  CREATE TABLE orders (id bigint PRIMARY KEY, customer_id bigint NOT NULL REFERENCES customers, status text NOT NULL, amount numeric(10,2) NOT NULL)`)
for (const c of CUSTOMERS) await play.query('INSERT INTO customers VALUES ($1, $2)', [c.id, c.name])
for (const o of ORDERS) await play.query('INSERT INTO orders VALUES ($1, $2, $3, $4)', [o.id, o.customer_id, o.status, o.amount])
out.using.playground = {}
for (const spec of allSpecs()) {
  const sql = toSql(spec)
  const res = await play.query({ text: sql, rowMode: 'array' })
  const rows = res.rows.map((r) => r.map((v) => (v === null ? 'NULL' : String(v))).join('|'))
  const model = resultKey(run(spec))
  if (JSON.stringify(rows) !== JSON.stringify(model)) throw new Error(`model differs from PostgreSQL for\n${sql}\nserver: ${JSON.stringify(rows)}\nmodel:  ${JSON.stringify(model)}`)
  out.using.playground[sql] = rows
}
await play.end()
console.log(`playground: ${allSpecs().length} queries match the model`)

// OFFSET vs keyset pagination on one million rows
await admin.query('DROP TABLE IF EXISTS events')
await admin.query('CREATE TABLE events (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL, payload text NOT NULL)')
await admin.query(`INSERT INTO events (created_at, payload) SELECT timestamptz '2026-01-01' + g * interval '1 second', md5(g::text) FROM generate_series(1, 1000000) g`)
await admin.query('VACUUM ANALYZE events')
const explain = async (sql) => (await admin.query(`EXPLAIN (ANALYZE, COSTS OFF) ${sql}`)).rows.map((r) => r['QUERY PLAN'])
const execMs = (plan) => Number(plan.find((l) => l.startsWith('Execution Time'))?.match(/[\d.]+/)[0])
const hits = (plan) => Number(plan.find((l) => /Buffers: shared/.test(l))?.match(/hit=(\d+)/)?.[1] ?? 0)
const offsetSql = (n) => `SELECT id, created_at FROM events ORDER BY id LIMIT 20 OFFSET ${n}`
const keysetSql = (n) => `SELECT id, created_at FROM events WHERE id > ${n} ORDER BY id LIMIT 20`
out.using.paging = { points: [] }
for (const n of [0, 10000, 100000, 500000, 900000]) {
  const point = { offset: n }
  for (const [kind, sql] of [['offset', offsetSql(n)], ['keyset', keysetSql(n)]]) {
    const runs = []
    let plan
    for (let i = 0; i < 5; i++) {
      plan = await explain(sql)
      runs.push(execMs(plan))
    }
    point[`${kind}Ms`] = round(median(runs), 3)
    point[`${kind}Buffers`] = hits(plan)
  }
  out.using.paging.points.push(point)
}
out.using.paging.offsetPlan = (await explain(offsetSql(500000))).join('\n')
out.using.paging.keysetPlan = (await explain(keysetSql(500000))).join('\n')
await admin.query('DROP TABLE events')

// The Java and TypeScript apps, run against the shop database as left by the psql session above
const java = spawnSync(
  process.env.GRADLE ?? 'gradle',
  ['--console=plain', '-q', 'run'],
  { cwd: here('./start-app-java'), encoding: 'utf8', env: { ...process.env, DB_URL: `jdbc:postgresql://localhost:${PORT}/shop`, DB_PASSWORD: APP_PASSWORD } },
)
if (java.status !== 0) throw new Error(`java app failed:\n${java.stdout}\n${java.stderr}`)
out.using.java = java.stdout.trimEnd().split('\n')
const ts = spawnSync('node', ['demo.ts'], {
  cwd: here('./start-app-ts'),
  encoding: 'utf8',
  env: { ...process.env, DATABASE_URL: `postgresql://app:${APP_PASSWORD}@localhost:${PORT}/shop` },
})
if (ts.status !== 0) throw new Error(`ts app failed:\n${ts.stdout}\n${ts.stderr}`)
out.using.ts = ts.stdout.trimEnd().split('\n')

// ---- Schema design and data types --------------------------------------------------------------------

const types = await client('types')
await types.query('SET max_parallel_workers_per_gather = 0')

// Stored sizes: one row per value, measured from the table (values on disk use 1-byte headers when short)
const SIZES = [
  ['boolean', 'true'],
  ['smallint', '32767'],
  ['integer', '2147483647'],
  ['bigint', '9223372036854775807'],
  ['real', '3.14'],
  ['double precision', '3.14'],
  ['numeric(12,2)', '1234.56'],
  ['numeric', '12345678901234567890.123456'],
  ['date', "'2026-10-18'"],
  ['timestamp', "'2026-10-18 09:30'"],
  ['timestamptz', "'2026-10-18 09:30+00'"],
  ['interval', "'1 day 2 hours'"],
  ['uuid', "'0199f2a4-6c1e-7cc2-9d1e-5a3f2b8c4d10'"],
  ['text', "'Lisbon'"],
  ['varchar(20)', "'Lisbon'"],
  ['char(20)', "'Lisbon'"],
  ['text', `repeat('x', 200)`],
  ['jsonb', `'{"size": "M", "color": "red"}'`],
  ['json', `'{"size": "M", "color": "red"}'`],
  ['integer[]', "'{1,2,3}'"],
  ['inet', "'10.0.1.20'"],
]
out.schema.sizes = []
for (const [type, literal] of SIZES) {
  await types.query('DROP TABLE IF EXISTS sz')
  await types.query(`CREATE TABLE sz (v ${type})`)
  await types.query(`INSERT INTO sz VALUES (${literal})`)
  const r = (await types.query('SELECT pg_column_size(v) AS bytes, v::text AS value FROM sz')).rows[0]
  if (type === 'inet') r.value = r.value.replace(/\/32$/, '')
  out.schema.sizes.push({ type, value: r.value.length > 40 ? `${r.value.slice(0, 12)}… (${r.value.length} chars)` : r.value, bytes: r.bytes })
}
await types.query('DROP TABLE sz')

// Column order and alignment padding
await types.query(`CREATE TABLE padded (a boolean, b bigint, c boolean, d bigint, e boolean, f bigint);
  CREATE TABLE packed (b bigint, d bigint, f bigint, a boolean, c boolean, e boolean);
  INSERT INTO padded VALUES (true, 1, true, 2, true, 3); INSERT INTO packed VALUES (1, 2, 3, true, true, true)`)
out.schema.padding = {
  padded: (await types.query('SELECT pg_column_size(p.*) AS n FROM padded p')).rows[0].n,
  packed: (await types.query('SELECT pg_column_size(p.*) AS n FROM packed p')).rows[0].n,
}

// Float vs numeric: adding 0.1 again and again
out.schema.money = psqlSession({ db: 'types', user: 'postgres', superuser: true }, {
  money: [
    'SELECT 0.1::float8 + 0.2::float8 AS float8,\n       0.1::numeric + 0.2::numeric AS numeric,\n       0.1::float8 + 0.2::float8 = 0.3 AS "float8 = 0.3";',
    'SELECT 0.1::real + 0.2::real AS real, 19.99::real * 3 AS "3 × 19.99 as real";',
    'SELECT 1.10::float8 * 3 AS float8, 1.10::numeric * 3 AS numeric;',
  ],
}).money
out.schema.sums = []
for (const n of [10, 100, 1000, 10000, 100000, 1000000]) {
  const r = (await types.query(`SELECT sum(0.1::float8)::text AS f, sum(0.1::numeric)::text AS n FROM generate_series(1, ${n})`)).rows[0]
  const model = addTenCents(n)
  if (model.float8 !== r.f || model.numeric !== r.n) throw new Error(`money model differs at ${n}: ${JSON.stringify(model)} vs ${JSON.stringify(r)}`)
  out.schema.sums.push({ n, float8: r.f, numeric: r.n })
}

// timestamp vs timestamptz: written in one time zone, read in another
await types.query('CREATE TABLE times (written_in text, ts timestamp, tstz timestamptz)')
for (const zone of ['UTC', 'Asia/Tokyo']) {
  await types.query(`SET TIME ZONE '${zone}'`)
  await types.query(`INSERT INTO times VALUES ($1, '2026-03-29 09:00', '2026-03-29 09:00')`, [zone])
}
out.schema.times = []
for (const zone of ['UTC', 'Europe/Lisbon', 'America/New_York', 'Asia/Tokyo']) {
  await types.query(`SET TIME ZONE '${zone}'`)
  for (const r of (await types.query('SELECT written_in, ts::text AS ts, tstz::text AS tstz FROM times ORDER BY written_in DESC')).rows) out.schema.times.push({ readIn: zone, ...r })
}
await types.query('RESET TIME ZONE')
out.schema.timesPsql = psqlSession({ db: 'types', user: 'postgres', superuser: true }, {
  t: [
    "SET TIME ZONE 'Europe/Lisbon';",
    "SELECT timestamptz '2026-03-29 00:30' + interval '1 day' AS \"plus 1 day\",\n       timestamptz '2026-03-29 00:30' + interval '24 hours' AS \"plus 24 hours\";",
  ],
}).t

// text, varchar, char, integers, identity, uuid, json, arrays, enums
out.schema.text = psqlSession({ db: 'types', user: 'postgres', superuser: true }, {
  text: [
    'CREATE TABLE names (code varchar(5), label char(5));',
    "INSERT INTO names VALUES ('ABCDEFG', 'x');",
    "SELECT 'ABCDEFG'::varchar(5) AS cast_cuts_silently;",
    "SELECT 'ab'::char(5) = 'ab   ' AS equal, length('ab'::char(5)), 'ab'::char(5) || '|' AS concat;",
  ],
  ints: [
    'SELECT 2147483647::int + 1;',
    'SELECT 2147483647::bigint + 1 AS bigint_ok;',
    'CREATE TABLE tickets (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, title text);',
    "INSERT INTO tickets (id, title) VALUES (42, 'manual id');",
    "INSERT INTO tickets (title) VALUES ('first'), ('second') RETURNING id;",
  ],
  uuid: [
    'SELECT gen_random_uuid() AS v4 FROM generate_series(1, 3);',
    'SELECT uuidv7() AS v7 FROM generate_series(1, 3);',
    'SELECT uuid_extract_timestamp(uuidv7()) IS NOT NULL AS has_time, uuid_extract_version(uuidv7()) AS version;',
  ],
  json: [
    `SELECT '{"b": 1, "a": 2, "a": 3}'::json  AS json,\n       '{"b": 1, "a": 2, "a": 3}'::jsonb AS jsonb;`,
    `SELECT attrs ->> 'color' AS color, attrs @> '{"size": "M"}' AS is_m\nFROM (VALUES ('{"size": "M", "color": "red"}'::jsonb)) v(attrs);`,
  ],
  arrays: [
    "CREATE TABLE posts (id int PRIMARY KEY, tags text[] NOT NULL DEFAULT '{}');",
    "INSERT INTO posts VALUES (1, '{sale,new}'), (2, '{new}'), (3, '{}');",
    "SELECT id, tags FROM posts WHERE 'sale' = ANY (tags);",
    "SELECT id, tags FROM posts WHERE tags @> '{new}' ORDER BY id;",
  ],
  enums: [
    "CREATE TYPE order_status AS ENUM ('new', 'paid', 'shipped');",
    "CREATE TABLE shipments (id int PRIMARY KEY, status order_status NOT NULL);",
    "INSERT INTO shipments VALUES (1, 'shipped'), (2, 'new'), (3, 'paid');",
    "INSERT INTO shipments VALUES (4, 'refunded');",
    "ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'paid';",
    "SELECT id, status FROM shipments ORDER BY status;",
    "ALTER TYPE order_status DROP VALUE 'new';",
  ],
})

// uuid v4 vs uuid v7 vs bigint keys: one million inserts each
out.schema.keys = []
for (const [label, ddl] of [
  ['bigint identity', 'id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY'],
  ['uuid v7', 'id uuid PRIMARY KEY DEFAULT uuidv7()'],
  ['uuid v4', 'id uuid PRIMARY KEY DEFAULT gen_random_uuid()'],
]) {
  await types.query('DROP TABLE IF EXISTS k')
  await types.query(`CREATE TABLE k (${ddl}, n int NOT NULL)`)
  await types.query('CHECKPOINT')
  const lsn0 = (await types.query('SELECT pg_current_wal_lsn() AS l')).rows[0].l
  const t0 = performance.now()
  await types.query('INSERT INTO k (n) SELECT g FROM generate_series(1, 1000000) g')
  const ms = performance.now() - t0
  const r = (await types.query(`SELECT pg_relation_size('k_pkey') AS idx, pg_relation_size('k') AS heap, pg_wal_lsn_diff(pg_current_wal_lsn(), $1) AS wal`, [lsn0])).rows[0]
  out.schema.keys.push({ label, ms: Math.round(ms), indexMB: round(Number(r.idx) / 1048576), heapMB: round(Number(r.heap) / 1048576), walMB: round(Number(r.wal) / 1048576) })
}
await types.query('DROP TABLE k')

// Constraints and ON DELETE choices
out.schema.constraints = psqlSession({ db: 'types', user: 'postgres', superuser: true }, {
  c: [
    `CREATE TABLE accounts (
  id      bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email   text NOT NULL UNIQUE,
  balance numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0)
);`,
    "INSERT INTO accounts (email) VALUES ('ann@example.com');",
    "INSERT INTO accounts (email) VALUES ('ann@example.com');",
    'INSERT INTO accounts (email) VALUES (NULL);',
    "UPDATE accounts SET balance = balance - 10 WHERE email = 'ann@example.com';",
  ],
}).c
out.schema.onDelete = {}
for (const action of ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL']) {
  const t = psqlSession({ db: 'types', user: 'postgres', superuser: true }, {
    setup: [
      { sql: 'DROP TABLE IF EXISTS orders, customers;', hide: true },
      { sql: "CREATE TABLE customers (id int PRIMARY KEY, name text); INSERT INTO customers VALUES (1, 'Ann'), (2, 'Ben');", hide: true },
      { sql: `CREATE TABLE orders (id int PRIMARY KEY, customer_id int REFERENCES customers ON DELETE ${action}); INSERT INTO orders VALUES (10, 1), (11, 1), (12, 2);`, hide: true },
    ],
    run: ['DELETE FROM customers WHERE id = 1;', 'SELECT id, customer_id FROM orders ORDER BY id;'],
  })
  out.schema.onDelete[action] = t.run
}
await types.query('DROP TABLE IF EXISTS orders, customers')

// Migrations on a one-million-row table: time, and whether the table file was rewritten
await types.query(`CREATE TABLE items (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, qty int NOT NULL, price numeric(10,2) NOT NULL, sku text)`)
await types.query(`INSERT INTO items (qty, price, sku) SELECT g % 50, (g % 1000) + 0.99, 'SKU-' || g FROM generate_series(1, 1000000) g`)
await types.query('VACUUM ANALYZE items')
const relfile = async () => (await types.query(`SELECT pg_relation_filenode('items') AS f`)).rows[0].f
out.schema.migrations = []
for (const [label, sql] of [
  ['ADD COLUMN, no default', 'ALTER TABLE items ADD COLUMN note text'],
  ['ADD COLUMN … DEFAULT false NOT NULL', 'ALTER TABLE items ADD COLUMN active boolean NOT NULL DEFAULT false'],
  ['ADD COLUMN … DEFAULT clock_timestamp()', 'ALTER TABLE items ADD COLUMN created_at timestamptz NOT NULL DEFAULT clock_timestamp()'],
  ['ALTER COLUMN qty TYPE bigint', 'ALTER TABLE items ALTER COLUMN qty TYPE bigint'],
  ['SET NOT NULL (scans)', 'ALTER TABLE items ALTER COLUMN sku SET NOT NULL'],
  ['ADD CHECK … NOT VALID', 'ALTER TABLE items ADD CONSTRAINT items_qty_check CHECK (qty >= 0) NOT VALID'],
  ['VALIDATE CONSTRAINT', 'ALTER TABLE items VALIDATE CONSTRAINT items_qty_check'],
  ['CREATE INDEX', 'CREATE INDEX items_sku_idx ON items (sku)'],
  ['CREATE INDEX CONCURRENTLY', 'CREATE INDEX CONCURRENTLY items_sku_idx2 ON items (sku)'],
]) {
  const before = await relfile()
  const t0 = performance.now()
  await types.query(sql)
  const ms = performance.now() - t0
  out.schema.migrations.push({ label, sql, ms: round(ms, 1), rewrite: before !== (await relfile()) })
}

// The lock queue: a long reader, an ALTER TABLE waiting for it, and every later query waiting behind the ALTER
const lockRun = async (lockTimeout) => {
  const [a, b, c, watch] = await Promise.all([client('types'), client('types'), client('types'), client('types')])
  const t0 = performance.now()
  const at = () => Math.round((performance.now() - t0) / 10) * 10
  const events = []
  const pids = {}
  for (const [k, cl] of Object.entries({ A: a, B: b, C: c })) pids[k] = (await cl.query('SELECT pg_backend_pid() AS p')).rows[0].p
  await a.query('BEGIN')
  await a.query('SELECT count(*) FROM items')
  events.push({ lane: 'A', at: at(), label: 'BEGIN; SELECT … (keeps its lock)' })
  await sleep(300)
  if (lockTimeout) await b.query(`SET lock_timeout = '${lockTimeout}'`)
  const bStart = at()
  events.push({ lane: 'B', at: bStart, label: 'ALTER TABLE items ADD COLUMN …' })
  const bDone = b.query('ALTER TABLE items ADD COLUMN extra int').then(
    () => ({ lane: 'B', at: at(), label: 'ALTER done', ok: true }),
    (e) => ({ lane: 'B', at: at(), label: `ERROR: ${e.message}`, ok: false }),
  )
  await sleep(300)
  const cStart = at()
  events.push({ lane: 'C', at: cStart, label: 'SELECT … WHERE id = 1' })
  const cDone = c.query('SELECT qty FROM items WHERE id = 1').then(() => ({ lane: 'C', at: at(), label: 'SELECT done', ok: true }))
  await sleep(300)
  const waits = (await watch.query(`SELECT pid, wait_event_type, wait_event, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid = ANY($1)`, [[pids.B, pids.C]])).rows
  const name = (pid) => Object.keys(pids).find((k) => pids[k] === pid)
  const waiting = waits.map((w) => ({ session: name(w.pid), wait: w.wait_event_type ? `${w.wait_event_type}:${w.wait_event}` : null, blockedBy: w.blockers.map(name) }))
  await sleep(1500)
  const commitAt = at()
  await a.query('COMMIT')
  events.push({ lane: 'A', at: commitAt, label: 'COMMIT' })
  const done = await Promise.all([bDone, cDone])
  events.push(...done)
  await types.query('ALTER TABLE items DROP COLUMN IF EXISTS extra')
  await Promise.all([a, b, c, watch].map((x) => x.end()))
  return { events: events.sort((x, y) => x.at - y.at), waiting, bStart, cStart, commitAt, end: Math.max(...events.map((e) => e.at)) }
}
out.schema.lockQueue = await lockRun(null)
out.schema.lockTimeout = await lockRun('200ms')
await types.end()

// ---- write --------------------------------------------------------------------------------------------

await admin.end()
const text = JSON.stringify(out, null, 2)
for (const bad of ['/home/', homedir(), userInfo().username, String(PORT)]) if (text.includes(bad)) throw new Error(`refusing to write: output contains "${bad}"`)
writeFileSync(
  OUT,
  `// Recorded on PostgreSQL ${out.version} (postgres:18 image) by tools/postgres-capture/capture-start.mjs — do not edit by hand.\n` +
    `// Lessons: Install and configure, Using PostgreSQL day to day, Schema design and data types.\n\n` +
    `export const START = ${text}\n`,
)
console.log(`wrote ${OUT}`)
