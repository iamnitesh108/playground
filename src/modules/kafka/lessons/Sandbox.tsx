import { useState } from 'react'
import { useInterval } from '@/shared/hooks/useInterval'
import { useObservable } from '@/shared/hooks/useObservable'
import { Button, Demo, Segmented, TextField } from '@/shared/ui'
import { ActivityFeed, ClusterView } from '../components'
import { DefaultPartitioner, KafkaCluster, RoundRobinPartitioner, type OffsetReset } from '../simulation'
import styles from './lesson.module.css'

const RANDOM_KEYS = ['alice', 'bob', 'carol', 'dave', 'erin', 'frank', 'grace', 'heidi']

function createSandbox() {
  const cluster = new KafkaCluster({ topic: 'events', partitions: 3 })
  cluster.addGroup('group-a')
  cluster.addConsumer('group-a')
  return cluster
}

export default function Sandbox() {
  const cluster = useObservable(createSandbox)
  const [key, setKey] = useState('alice')
  const [seq, setSeq] = useState(1)
  const [producing, setProducing] = useState(false)
  const [consuming, setConsuming] = useState(false)
  const [reset, setReset] = useState<OffsetReset>('earliest')
  const [partitioner, setPartitioner] = useState<'default' | 'rr'>('default')
  const [groupSeq, setGroupSeq] = useState(1)

  const produce = (k: string | null) => {
    cluster.produce(k, `v${seq}`)
    setSeq((s) => s + 1)
  }

  useInterval(() => produce(RANDOM_KEYS[Math.floor(Math.random() * RANDOM_KEYS.length)]), producing ? 700 : null)
  useInterval(() => cluster.tick(), consuming ? 600 : null)

  const restart = (partitions: number) => {
    setProducing(false)
    setConsuming(false)
    cluster.reset(partitions)
    cluster.addGroup('group-a', reset)
    cluster.addConsumer('group-a')
    setGroupSeq(1)
  }

  const addGroup = () => {
    const id = `group-${String.fromCharCode(97 + groupSeq)}`
    cluster.addGroup(id, reset)
    cluster.addConsumer(id)
    setGroupSeq(groupSeq + 1)
  }

  return (
    <>
      <p>
        Everything from the earlier lessons in one place. There are no instructions — form a guess, then test it. Some
        ideas: What happens to ordering per key when you switch to round robin? How does lag behave with one consumer
        against a fast producer? What does a group created with <code>latest</code> miss?
      </p>

      <Demo
        title="Kafka sandbox"
        controls={
          <>
            <Segmented
              label="partitions"
              value={cluster.topic.partitionCount}
              onChange={restart}
              options={[1, 2, 3, 4, 6].map((n) => ({ value: n, label: String(n) }))}
            />
            <Segmented
              label="partitioner"
              value={partitioner}
              onChange={(value) => {
                setPartitioner(value)
                cluster.setPartitioner(value === 'default' ? new DefaultPartitioner() : new RoundRobinPartitioner())
              }}
              options={[
                { value: 'default', label: 'key hash' },
                { value: 'rr', label: 'round robin' },
              ]}
            />
            <Segmented
              label="new groups start at"
              value={reset}
              onChange={setReset}
              options={[
                { value: 'earliest', label: 'earliest' },
                { value: 'latest', label: 'latest' },
              ]}
            />
          </>
        }
      >
        <div className={styles.grid2} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="key" value={key} onChange={(e) => setKey(e.target.value)} />
            <Button size="sm" variant="primary" onClick={() => produce(key || null)}>
              Produce
            </Button>
            <Button size="sm" onClick={() => setProducing(!producing)}>
              {producing ? 'Stop stream' : 'Stream random keys'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button size="sm" variant={consuming ? 'default' : 'primary'} onClick={() => setConsuming(!consuming)}>
              {consuming ? 'Pause consumers' : 'Run consumers'}
            </Button>
            <Button size="sm" disabled={cluster.groups.length >= 4} onClick={addGroup}>
              + Group
            </Button>
          </div>
        </div>
        <ClusterView cluster={cluster} />
        <ActivityFeed items={cluster.activity} />
      </Demo>
    </>
  )
}
