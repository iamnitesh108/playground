import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { Button, Demo } from '@/shared/ui'
import { KafkaStage } from './KafkaStage'
import { useKafkaStage } from './useKafkaStage'

const KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank']

/** Free play: produce, add or stop consumers in two groups, and watch partitions move. */
export function StagePlayground({ partitions = 3 }: { partitions?: number }) {
  const stage = useKafkaStage({ topic: 'orders', partitions, groups: [{ id: 'billing', consumers: 1 }] })
  const [n, setN] = useState(1)
  const [running, setRunning] = useState(true)
  useInterval(() => stage.apply({ type: 'consume' }), running ? 900 : null)
  const groups = stage.cluster.groups
  const produce = (count: number) => {
    for (let i = 0; i < count; i++) window.setTimeout(() => stage.apply({ type: 'produce', key: KEYS[(n + i) % KEYS.length], value: `order-${1000 + n + i}` }), i * 300)
    setN(n + count)
  }
  return (
    <Demo
      title="Partitions, consumers and groups — live"
      hint="Produce records, add consumers to billing (try more consumers than partitions), stop one, then add a second group. Consumers read one record per tick."
      controls={
        <>
          <Button size="sm" onClick={() => produce(1)}>Produce 1</Button>
          <Button size="sm" onClick={() => produce(6)}>Produce 6</Button>
          {groups.map((g) => (
            <span key={g.id} style={{ display: 'inline-flex', gap: 6 }}>
              <Button size="sm" onClick={() => stage.apply({ type: 'addConsumer', group: g.id })}>+ consumer in {g.id}</Button>
              <Button size="sm" disabled={g.members.length === 0} onClick={() => stage.apply({ type: 'removeConsumer', group: g.id })}>stop one</Button>
            </span>
          ))}
          <Button size="sm" disabled={groups.length > 1} onClick={() => { stage.apply({ type: 'addGroup', group: 'analytics' }); stage.apply({ type: 'addConsumer', group: 'analytics' }) }}>+ group analytics</Button>
          <Button size="sm" onClick={() => setRunning((r) => !r)}>{running ? 'Pause consumers' : 'Run consumers'}</Button>
          <Button size="sm" variant="ghost" onClick={() => { stage.reset(); setN(1) }}>Reset</Button>
        </>
      }
    >
      <KafkaStage cluster={stage.cluster} flights={stage.flights} now={stage.now} />
    </Demo>
  )
}
