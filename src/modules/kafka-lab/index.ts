import type { LearningModule } from '@/core/module'

export const kafkaSetupModule: LearningModule = {
  id: 'kafka-lab',
  title: 'Kafka from scratch: setup to code',
  description:
    'Build a working Kafka, Kafka Connect and Debezium stack on your machine, understand every line of every config file, then produce and consume from Java for pub-sub and CDC.',
  tags: ['setup', 'docker compose', 'kafka connect', 'debezium', 'java'],
  groups: [
    {
      title: 'Set up',
      lessons: [
        { slug: 'overview', title: 'What you will build', summary: 'The stack, the versions, and the order you will set it up in.', load: () => import('./lessons/Overview') },
        { slug: 'compose', title: 'Project layout and Compose', summary: 'One folder, one docker-compose.yml, explained block by block.', load: () => import('./lessons/Compose') },
        { slug: 'broker', title: 'The Kafka broker', summary: 'server.properties line by line, formatting KRaft storage, and your first topic.', load: () => import('./lessons/Broker') },
        { slug: 'postgres', title: 'Postgres ready for CDC', summary: 'WAL level, a replication user, replica identity and a publication.', load: () => import('./lessons/Postgres') },
        { slug: 'connect', title: 'The Kafka Connect worker', summary: 'Installing the Debezium plugin and connect-distributed.properties line by line.', load: () => import('./lessons/Connect') },
        { slug: 'connector', title: 'The Debezium connector', summary: 'Every connector setting, registering it over REST, and the first change events.', load: () => import('./lessons/Connector') },
      ],
    },
    {
      title: 'Use it from code',
      lessons: [
        { slug: 'clients', title: 'Client configuration', summary: 'Every producer and consumer setting you will actually touch.', load: () => import('./lessons/Clients') },
        { slug: 'pubsub', title: 'Pub-sub from Java', summary: 'A producer and a consumer group, run against your stack.', load: () => import('./lessons/PubSub') },
        { slug: 'cdc', title: 'CDC from Java', summary: 'Consume database changes: the envelope, tombstones, unwrap, and idempotency.', load: () => import('./lessons/Cdc') },
      ],
    },
    {
      title: 'Operate',
      lessons: [
        { slug: 'troubleshooting', title: 'When it does not work', summary: 'The errors you will meet, what they mean, and the fix.', load: () => import('./lessons/Troubleshooting') },
        { slug: 'production', title: 'From laptop to production', summary: 'What changes when the stack has to be reliable and secure.', load: () => import('./lessons/Production') },
      ],
    },
  ],
}
