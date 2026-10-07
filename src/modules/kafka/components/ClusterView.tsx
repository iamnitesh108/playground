import { Button } from '@/shared/ui'
import type { ConsumerGroup, KafkaCluster } from '../simulation'
import { PartitionLog, type OffsetMarker } from './PartitionLog'
import { toneStyle } from './tones'
import styles from './ClusterView.module.css'

interface ClusterViewProps {
  cluster: KafkaCluster
  /** Lets readers drive consumers by hand; off for read-only views. */
  interactive?: boolean
}

const shortId = (memberId: string) => memberId.split('-').pop()!

/** Renders a topic's partitions plus every group reading it. */
export function ClusterView({ cluster, interactive = true }: ClusterViewProps) {
  const { topic, groups } = cluster

  return (
    <div className={styles.view}>
      <div className={styles.topic}>
        <div className={styles.topicHeader}>
          <span className={styles.topicName}>topic: {topic.name}</span>
          <span className={styles.meta}>{topic.partitionCount} partitions</span>
        </div>
        {topic.partitionIds.map((p) => (
          <PartitionLog
            key={p}
            label={`P${p}`}
            cells={topic.records(p)}
            markers={markersFor(groups, p)}
            owners={groups.flatMap((group, gi) => {
              const owner = group.ownerOf(p)
              return owner ? [{ label: `${groups.length > 1 ? `${group.id}:` : ''}${shortId(owner)}`, tone: gi }] : []
            })}
          />
        ))}
      </div>

      <div className={styles.groups}>
        {groups.map((group, gi) => (
          <GroupCard key={group.id} cluster={cluster} group={group} tone={gi} interactive={interactive} />
        ))}
      </div>
    </div>
  )
}

function markersFor(groups: readonly ConsumerGroup[], partition: number): OffsetMarker[] {
  return groups.flatMap((group, gi) => {
    const committed = group.committedOffset(partition)
    return committed === undefined ? [] : [{ offset: committed, label: group.id, tone: gi }]
  })
}

interface GroupCardProps {
  cluster: KafkaCluster
  group: ConsumerGroup
  tone: number
  interactive: boolean
}

function GroupCard({ cluster, group, tone, interactive }: GroupCardProps) {
  return (
    <div className={styles.group} style={toneStyle(tone)}>
      <div className={styles.groupHeader}>
        <div>
          <div className={styles.groupName}>group: {group.id}</div>
          <div className={styles.meta}>
            generation {group.generation} · lag {group.totalLag()} · {group.assignorName} assignor
          </div>
        </div>
        {interactive && (
          <Button size="sm" onClick={() => cluster.addConsumer(group.id)}>
            + Consumer
          </Button>
        )}
      </div>

      {group.members.length === 0 && <div className={styles.empty}>No consumers. Records wait in the log.</div>}

      <div className={styles.members}>
        {group.members.map((member) => {
          const partitions = group.partitionsOf(member.id)
          const idle = partitions.length === 0
          return (
            <div key={member.id} className={styles.member} data-idle={idle}>
              <div className={styles.memberName}>{shortId(member.id)}</div>
              <div className={styles.memberMeta}>
                {idle ? 'idle (no partition)' : `P${partitions.join(', P')}`} · read {member.processed}
              </div>
              {interactive && (
                <div className={styles.memberActions}>
                  <Button size="sm" disabled={idle} onClick={() => cluster.consume(group.id, member.id)}>
                    Poll
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => cluster.removeConsumer(group.id, member.id)}>
                    Leave
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
