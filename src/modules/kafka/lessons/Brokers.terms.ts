import type { GlossaryEntry } from '../glossary'

/** The glossary terms this lesson explains; the Glossary page collects every lesson's terms. */
export const terms: GlossaryEntry[] = [
  { term: 'bootstrap.servers', definition: 'Initial broker addresses a client contacts to discover the rest of the cluster.', lesson: 'brokers' },
  { term: 'Broker', definition: 'A Kafka server process that stores partition data and serves clients.', lesson: 'brokers' },
  { term: 'Cluster', definition: 'Brokers and controllers working together as one Kafka system.', lesson: 'brokers' },
  { term: 'Controller', definition: 'Node managing cluster metadata and electing partition leaders.', lesson: 'brokers' },
  { term: 'KRaft', definition: 'Kafka’s built-in Raft-based metadata quorum, replacing ZooKeeper.', lesson: 'brokers' },
  { term: 'Listener', definition: 'A network endpoint a broker accepts connections on; advertised listeners are what clients are told to use.', lesson: 'brokers' },
  { term: 'ZooKeeper', definition: 'External coordination service older Kafka versions needed; removed in Kafka 4.0.', lesson: 'brokers' },
]
