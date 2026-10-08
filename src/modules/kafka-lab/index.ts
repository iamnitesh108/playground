import type { LearningModule } from '@/core/module'

export const kafkaSetupModule: LearningModule = {
  id: 'kafka-lab',
  title: 'Kafka from scratch: setup to code',
  description:
    'Set up Kafka, Kafka Connect and Debezium the way operations teams do — on Ubuntu with systemd and with Docker — with every configuration file explained line by line, then produce and consume from Java for pub-sub and CDC.',
  tags: ['setup', 'ubuntu', 'systemd', 'docker', 'kafka connect', 'debezium', 'java'],
  groups: [
    {
      title: 'Plan',
      lessons: [
        { slug: 'overview', title: 'Plan the deployment', summary: 'Components, topologies, the two ways to run them, sizing and versions.', load: () => import('./lessons/Overview') },
      ],
    },
    {
      title: 'Kafka',
      lessons: [
        { slug: 'broker-config', title: 'Broker configuration', summary: 'server.properties for a single node, a controller and a broker — every line.', load: () => import('./lessons/BrokerConfig') },
        { slug: 'ubuntu', title: 'Install on Ubuntu', summary: 'Java, a service user, verified download, directory layout, OS tuning, formatting and systemd.', load: () => import('./lessons/InstallUbuntu') },
        { slug: 'docker', title: 'Run with Docker', summary: 'The official image, a complete single-host stack, and a 3 + 3 production layout.', load: () => import('./lessons/InstallDocker') },
      ],
    },
    {
      title: 'Change data capture',
      lessons: [
        { slug: 'postgres', title: 'Prepare PostgreSQL', summary: 'Logical WAL, access rules, a replication user, replica identity and a publication.', load: () => import('./lessons/Postgres') },
        { slug: 'connect', title: 'Kafka Connect worker', summary: 'connect-distributed.properties, the Debezium plugin, secrets, systemd and containers.', load: () => import('./lessons/ConnectWorker') },
        { slug: 'connector', title: 'The Debezium connector', summary: 'Every connector setting, registering it over REST, and the first change events.', load: () => import('./lessons/Connector') },
      ],
    },
    {
      title: 'Use it from code',
      lessons: [
        { slug: 'clients', title: 'Client configuration', summary: 'Every producer and consumer setting you will actually touch.', load: () => import('./lessons/Clients') },
        { slug: 'pubsub', title: 'Pub-sub from Java', summary: 'A producer and a consumer group, run against the stack.', load: () => import('./lessons/PubSub') },
        { slug: 'cdc', title: 'CDC from Java', summary: 'Consume database changes: the envelope, tombstones, unwrap, and idempotency.', load: () => import('./lessons/Cdc') },
      ],
    },
    {
      title: 'Operate',
      lessons: [
        { slug: 'operations', title: 'Operate and secure', summary: 'Routine tasks, monitoring, backups, security and a production checklist.', load: () => import('./lessons/Operations') },
        { slug: 'troubleshooting', title: 'When it does not work', summary: 'The real error messages, what they mean, and the fix.', load: () => import('./lessons/Troubleshooting') },
      ],
    },
  ],
}
