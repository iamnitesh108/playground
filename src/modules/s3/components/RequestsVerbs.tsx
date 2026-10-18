import { useState } from 'react'
import { Segmented } from '@/shared/ui'
import { HttpExchange } from './HttpExchange'

interface Recorded {
  readonly cmd?: string
  readonly out?: string
}

/** Pick an everyday operation and see the HTTP request and response it was, as recorded. */
export function RequestsVerbs({ steps, names }: { steps: readonly Recorded[]; names: readonly string[] }) {
  const [i, setI] = useState(0)
  return (
    <>
      <Segmented label="operation" value={i} options={names.map((n, k) => ({ value: k, label: n }))} onChange={setI} />
      <HttpExchange wire={steps[i].out ?? ''} title={`Recorded: ${names[i]} — ${steps[i].cmd?.replace(/ --aws-sigv4 \S+ --user \S+/, ' …')}`} />
    </>
  )
}
