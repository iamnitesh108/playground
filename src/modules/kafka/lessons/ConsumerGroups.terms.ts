import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'Assignor', definition: 'Strategy that decides which partitions each member of a consumer group gets (range, round robin, sticky, cooperative-sticky).', lesson: 'consumer-groups' },
  { term: 'Consumer', definition: 'An application that reads records from Kafka topics.', lesson: 'consumer-groups' },
  { term: 'Consumer group', definition: 'Consumers sharing a group.id that divide a topic’s partitions between them.', lesson: 'consumer-groups' },
  { term: 'Generation', definition: 'Counter incremented on each rebalance; fences off stale group members.', lesson: 'consumer-groups' },
  { term: 'Group coordinator', definition: 'Broker that manages a consumer group’s membership and offset commits.', lesson: 'consumer-groups' },
  { term: 'Heartbeat (consumer)', definition: 'Periodic signal from a group member to the coordinator proving it is alive.', lesson: 'consumer-groups' },
  { term: 'max.poll.interval.ms', definition: 'Longest allowed gap between poll() calls before a consumer is removed from its group.', lesson: 'consumer-groups' },
  { term: 'Rebalance', definition: 'Reassignment of partitions among group members when membership changes.', lesson: 'consumer-groups' },
  { term: 'session.timeout.ms', definition: 'Time without heartbeats after which a consumer is considered dead.', lesson: 'consumer-groups' },
  { term: 'Static membership', definition: 'Stable group.instance.id so a consumer that restarts within session.timeout.ms keeps its partitions without a rebalance.', lesson: 'consumer-groups' },
]
