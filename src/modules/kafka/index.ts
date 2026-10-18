import type { LearningModule } from '@/core/module'

export const kafkaModule: LearningModule = {
  id: 'kafka',
  title: 'Apache Kafka',
  description:
    'Just want to use Kafka? Start with “Using Kafka day to day”. Otherwise: event streaming from zero — topics, partitions, offsets, how consumers and consumer groups really work — with animations and three hands-on practicals recorded on Kafka 4.3 with the CLI and a Micronaut app — then replication, Kafka Connect, Debezium change data capture and the outbox pattern.',
  tags: ['messaging', 'event streaming', 'consumer groups', 'micronaut', 'kafka connect', 'debezium', 'cdc'],
  groups: [
    {
      title: 'Foundations',
      lessons: [
        {
          slug: 'why-kafka',
          title: 'Why Kafka exists',
          summary: 'The problem Kafka solves, and the one idea everything else builds on: the log.',
          load: () => import('./lessons/WhyKafka'),
        },
        {
          slug: 'events',
          title: 'Events and records',
          summary: 'What a message actually is: key, value, headers, timestamp — and how it is serialized.',
          load: () => import('./lessons/Events'),
        },
        {
          slug: 'brokers',
          title: 'Brokers and the cluster',
          summary: 'The servers that store data, the controller that coordinates them, and how clients find them.',
          load: () => import('./lessons/Brokers'),
        },
        {
          slug: 'topics-partitions',
          title: 'Topics and partitions',
          summary: 'How a topic is split into ordered, append-only logs, and why that unlocks scale.',
          load: () => import('./lessons/TopicsPartitions'),
        },
      ],
    },
    {
      title: 'Producing and consuming',
      lessons: [
        {
          slug: 'producers',
          title: 'Producers',
          summary: 'How a record finds its partition, how batching works, and what acks and idempotence buy you.',
          load: () => import('./lessons/Producers'),
        },
        {
          slug: 'keys',
          title: 'Record keys and partitioning',
          summary: 'What a key decides — partition, order, compaction, joins — when to leave it null and let Kafka spread records, when to set it, how to choose one, and what goes wrong (hot keys, adding partitions).',
          load: () => import('./lessons/Keys'),
        },
        {
          slug: 'offsets',
          title: 'Offsets',
          summary: 'The bookmark in the log: log-end offset, consumer position, committed offset and lag.',
          load: () => import('./lessons/Offsets'),
        },
        {
          slug: 'consumers',
          title: 'How a consumer works',
          summary: 'The poll loop from the inside: fetching, position and committed offset, heartbeats, and what a crash costs.',
          load: () => import('./lessons/Consumers'),
        },
        {
          slug: 'consumer-groups',
          title: 'Consumers and groups',
          summary: 'How consumers share partitions, what a rebalance is, and why groups read independently.',
          load: () => import('./lessons/ConsumerGroups'),
        },
        {
          slug: 'delivery',
          title: 'Commits and delivery guarantees',
          summary: 'At-most-once, at-least-once and exactly-once — decided by when you commit.',
          load: () => import('./lessons/Delivery'),
        },
      ],
    },
    {
      title: 'Hands-on practicals',
      lessons: [
        {
          slug: 'practical-1',
          title: 'Practical 1: a producer and a consumer',
          summary: 'Run Kafka, create a topic, send and read messages — with the CLI and with a Micronaut app, recorded.',
          load: () => import('./lessons/Practical1'),
        },
        {
          slug: 'practical-2',
          title: 'Practical 2: partitions and consumers',
          summary: 'Three partitions, one group, one to four consumers: watch partitions being shared and moved.',
          load: () => import('./lessons/Practical2'),
        },
        {
          slug: 'practical-3',
          title: 'Practical 3: several consumer groups',
          summary: 'Two groups on one topic each get every message; lag, catching up, and replaying with an offset reset.',
          load: () => import('./lessons/Practical3'),
        },
      ],
    },
    {
      title: 'Durability',
      lessons: [
        {
          slug: 'replication',
          title: 'Replication and failover',
          summary: 'Leaders, followers, the in-sync replica set, and what happens when a broker dies.',
          load: () => import('./lessons/Replication'),
        },
        {
          slug: 'retention',
          title: 'Retention and compaction',
          summary: 'How long Kafka keeps data: segments, time-based deletion, and log compaction.',
          load: () => import('./lessons/Retention'),
        },
      ],
    },
    {
      title: 'Ecosystem',
      lessons: [
        {
          slug: 'kafka-connect',
          title: 'Kafka Connect',
          summary: 'Moving data in and out of Kafka without writing producers: connectors, tasks, converters, SMTs.',
          load: () => import('./lessons/KafkaConnect'),
        },
        {
          slug: 'debezium',
          title: 'Debezium and CDC',
          summary: 'Turning every database change into an event by reading the write-ahead log.',
          load: () => import('./lessons/Debezium'),
        },
        {
          slug: 'outbox',
          title: 'The outbox pattern',
          summary: 'A production design: reliable events from a database transaction, end to end.',
          load: () => import('./lessons/Outbox'),
        },
      ],
    },
    {
      title: 'Using Kafka in applications',
      lessons: [
        { slug: 'using-kafka', title: 'Using Kafka day to day', summary: 'The everyday operations — create a topic, send, read, inspect and reset groups — from the CLI and from Java code, without the internals.', load: () => import('./lessons/UsingKafka') },
        { slug: 'schema-registry', title: 'Schemas and Schema Registry', summary: 'Avro and Protobuf, schema ids in every record, compatibility rules, and evolving a schema without breaking consumers.', load: () => import('./lessons/SchemaRegistry') },
        { slug: 'kafka-streams', title: 'Kafka Streams', summary: 'Processing streams inside your app: KStream and KTable, state stores, windows, and how it scales with partitions.', load: () => import('./lessons/KafkaStreams') },
      ],
    },
    {
      title: 'Operating Kafka',
      lessons: [
        { slug: 'security', title: 'Security', summary: 'Encryption with TLS, authentication with SASL, authorization with ACLs — configured and tested.', load: () => import('./lessons/Security') },
        { slug: 'monitoring', title: 'Monitoring', summary: 'The metrics that matter, consumer lag, under-replicated partitions and the alerts to set.', load: () => import('./lessons/Monitoring') },
      ],
    },
    {
      title: 'More hands-on',
      lessons: [
        { slug: 'practical-4', title: 'Practical 4: transactions and exactly-once', summary: 'A transactional producer, read_committed consumers and aborted records — recorded on Kafka 4.3.', load: () => import('./lessons/Practical4') },
        { slug: 'practical-5', title: 'Practical 5: share groups (queues)', summary: 'Several consumers on one partition, per-record acknowledgement and redelivery — recorded on Kafka 4.3.', load: () => import('./lessons/Practical5') },
      ],
    },
    {
      title: 'Reference',
      lessons: [
        {
          slug: 'sandbox',
          title: 'Sandbox',
          summary: 'Everything at once. Change partitions, keys, groups and consumers and watch the effects.',
          load: () => import('./lessons/Sandbox'),
        },
        {
          slug: 'cli',
          title: 'CLI cheat sheet',
          summary: 'The commands you will actually type against a real cluster and Connect worker.',
          load: () => import('./lessons/Cli'),
        },
        {
          slug: 'glossary',
          title: 'Glossary',
          summary: 'Every term from this module in one searchable place.',
          load: () => import('./lessons/Glossary'),
        },
      ],
    },
  ],
}
