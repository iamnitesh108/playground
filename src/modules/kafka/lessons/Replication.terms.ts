import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Follower', definition: 'A replica that copies a partition from its leader.', lesson: 'replication' },
  { term: 'High watermark', definition: 'The first offset not yet copied to every in-sync replica; consumers only read records below it.', lesson: 'replication' },
  { term: 'ISR', definition: 'In-sync replicas: the leader and every follower fully caught up with it.', lesson: 'replication' },
  { term: 'Leader', definition: 'The replica that handles all reads and writes for a partition.', lesson: 'replication' },
  { term: 'min.insync.replicas', definition: 'Minimum number of in-sync replicas required to accept an acks=all write.', lesson: 'replication' },
  { term: 'Replica', definition: 'A copy of a partition on one broker.', lesson: 'replication' },
  { term: 'Replication factor', definition: 'Number of replicas of each partition in a topic.', lesson: 'replication' },
  { term: 'Unclean leader election', definition: 'Electing an out-of-sync replica as leader; restores availability but loses data.', lesson: 'replication' },
]
