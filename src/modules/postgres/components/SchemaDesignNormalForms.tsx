import { hue } from '@/shared/figures'
import { Walkthrough } from '@/shared/ui'
import { cx } from '@/shared/utils/cx'
import styles from './SchemaDesignFigures.module.css'

interface Sheet {
  name: string
  columns: readonly string[]
  key: readonly string[]
  rows: readonly (readonly string[])[]
  /** Columns whose values are repeated or packed: the problem this step fixes next. */
  problem?: readonly string[]
}

interface Step {
  title: string
  body: string
  sheets: readonly Sheet[]
}

const STEPS: readonly Step[] = [
  {
    title: 'A spreadsheet: one row per order',
    body: 'All items of an order are packed into one cell. You cannot index, sum or constrain them, and finding “every order with a Monitor” means parsing text.',
    sheets: [
      {
        name: 'order_sheet',
        columns: ['order', 'customer', 'email', 'city', 'items'],
        key: ['order'],
        rows: [
          ['1', 'Ann', 'ann@…', 'Lisbon', 'Keyboard 45.00 ×1, Cable 8.50 ×2'],
          ['6', 'Ann', 'ann@…', 'Lisbon', 'Monitor 180.00 ×1'],
          ['3', 'Ben', 'ben@…', 'Oslo', 'Monitor 180.00 ×1'],
        ],
        problem: ['items'],
      },
    ],
  },
  {
    title: '1NF: one value per cell',
    body: 'Each item gets its own row; the key becomes (order, product). But the customer is repeated on every line, and a product’s price on every line that sells it: these depend on only part of the key.',
    sheets: [
      {
        name: 'order_lines',
        columns: ['order', 'product', 'qty', 'price', 'customer', 'email', 'city'],
        key: ['order', 'product'],
        rows: [
          ['1', 'Keyboard', '1', '45.00', 'Ann', 'ann@…', 'Lisbon'],
          ['1', 'Cable', '2', '8.50', 'Ann', 'ann@…', 'Lisbon'],
          ['6', 'Monitor', '1', '180.00', 'Ann', 'ann@…', 'Lisbon'],
          ['3', 'Monitor', '1', '180.00', 'Ben', 'ben@…', 'Oslo'],
        ],
        problem: ['price', 'customer', 'email', 'city'],
      },
    ],
  },
  {
    title: '2NF: every column depends on the whole key',
    body: 'Order facts move to orders (key: order), product facts to products (key: product); order_items keeps only what needs both. Still, Ann’s email and city repeat for each of her orders: they depend on the customer, not on the order.',
    sheets: [
      { name: 'orders', columns: ['order', 'customer', 'email', 'city'], key: ['order'], rows: [['1', 'Ann', 'ann@…', 'Lisbon'], ['6', 'Ann', 'ann@…', 'Lisbon'], ['3', 'Ben', 'ben@…', 'Oslo']], problem: ['email', 'city'] },
      { name: 'order_items', columns: ['order', 'product', 'qty'], key: ['order', 'product'], rows: [['1', 'Keyboard', '1'], ['1', 'Cable', '2'], ['6', 'Monitor', '1'], ['3', 'Monitor', '1']] },
      { name: 'products', columns: ['product', 'price'], key: ['product'], rows: [['Keyboard', '45.00'], ['Cable', '8.50'], ['Monitor', '180.00']] },
    ],
  },
  {
    title: '3NF: nothing depends on a non-key column',
    body: 'Customers get their own table and an id; orders point to it. Each fact now lives in exactly one row: changing Ann’s email is one UPDATE. unit_price in order_items is deliberate: it records what was charged, which must not change when the catalogue price does.',
    sheets: [
      { name: 'customers', columns: ['id', 'name', 'email', 'city'], key: ['id'], rows: [['1', 'Ann', 'ann@…', 'Lisbon'], ['2', 'Ben', 'ben@…', 'Oslo']] },
      { name: 'orders', columns: ['id', 'customer_id'], key: ['id'], rows: [['1', '1'], ['6', '1'], ['3', '2']] },
      { name: 'order_items', columns: ['order_id', 'product_id', 'qty', 'unit_price'], key: ['order_id', 'product_id'], rows: [['1', '1', '1', '45.00'], ['1', '4', '2', '8.50'], ['6', '3', '1', '180.00'], ['3', '3', '1', '180.00']] },
      { name: 'products', columns: ['id', 'name', 'price'], key: ['id'], rows: [['1', 'Keyboard', '45.00'], ['3', 'Monitor', '180.00'], ['4', 'Cable', '8.50']] },
    ],
  },
]

function SheetView({ sheet }: { sheet: Sheet }) {
  return (
    <div className={styles.sheet}>
      <div className={styles.sheetName}>{sheet.name}</div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {sheet.columns.map((c) => (
                <th key={c} className={cx(sheet.key.includes(c) && styles.keyCol, sheet.problem?.includes(c) && styles.problemCol)} style={hue(sheet.key.includes(c) ? 7 : sheet.problem?.includes(c) ? 8 : undefined)}>
                  {c}
                  {sheet.key.includes(c) && <span className={styles.badge}>key</span>}
                  {sheet.problem?.includes(c) && <span className={styles.badge}>repeats</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((r, i) => (
              <tr key={i}>
                {r.map((v, j) => (
                  <td key={j} className={cx(sheet.problem?.includes(sheet.columns[j]) && styles.problemCell)} style={hue(sheet.problem?.includes(sheet.columns[j]) ? 8 : undefined)}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** The sample orders taken from a spreadsheet to third normal form, one step at a time. */
export function SchemaDesignNormalForms() {
  return (
    <Walkthrough title="From a spreadsheet to 3NF" steps={STEPS.map((s) => ({ title: s.title, body: <p>{s.body}</p> }))}>
      {(i) => (
        <div className={styles.sheets}>
          {STEPS[i].sheets.map((s) => (
            <SheetView key={s.name} sheet={s} />
          ))}
        </div>
      )}
    </Walkthrough>
  )
}
