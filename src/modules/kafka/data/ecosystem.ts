// Recorded by tools/kafka-capture/capture-ecosystem.mjs against a real Kafka, Schema Registry and the
// apps in tools/kafka-capture/schema-app and streams-app. Do not edit by hand: re-run the script.
import ordersAvro from '../../../../tools/kafka-capture/schema-app/src/main/java/demo/schema/OrdersAvro.java?raw'
import orderV1 from '../../../../tools/kafka-capture/schema-app/src/main/resources/order-v1.avsc?raw'
import orderV2 from '../../../../tools/kafka-capture/schema-app/src/main/resources/order-v2.avsc?raw'
import schemaGradle from '../../../../tools/kafka-capture/schema-app/build.gradle?raw'
import orderStats from '../../../../tools/kafka-capture/streams-app/src/main/java/demo/streams/OrderStats.java?raw'
import streamsGradle from '../../../../tools/kafka-capture/streams-app/build.gradle?raw'

export const ECOSYSTEM_APPS = {
  schema: { 'build.gradle': schemaGradle, 'order-v1.avsc': orderV1, 'order-v2.avsc': orderV2, 'OrdersAvro.java': ordersAvro },
  streams: { 'build.gradle': streamsGradle, 'OrderStats.java': orderStats },
} as const

export const ECOSYSTEM = {
  "image": "docker.io/apache/kafka:4.3.1",
  "registryImage": "docker.io/confluentinc/cp-schema-registry:8.0.0",
  "version": "4.3.1",
  "schema": {
    "config": {
      "cmd": "curl -s localhost:8081/config",
      "out": "{\"compatibilityLevel\":\"BACKWARD\"}"
    },
    "createTopic": {
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders-avro --partitions 1 --replication-factor 1",
      "out": "Created topic orders-avro."
    },
    "produceV1": {
      "cmd": "./build/install/schema-app/bin/schema-app produce v1",
      "out": [
        "sent {\"id\": \"order-1\", \"customer\": \"alice\", \"amount\": 10.0} with schema v1 -> partition=0 offset=0",
        "sent {\"id\": \"order-2\", \"customer\": \"bob\", \"amount\": 20.0} with schema v1 -> partition=0 offset=1",
        "sent {\"id\": \"order-3\", \"customer\": \"carol\", \"amount\": 30.0} with schema v1 -> partition=0 offset=2"
      ]
    },
    "subjects": {
      "cmd": "curl -s localhost:8081/subjects",
      "out": "[\"orders-avro-value\"]"
    },
    "versionsAfterV1": {
      "cmd": "curl -s localhost:8081/subjects/orders-avro-value/versions",
      "out": "[1]"
    },
    "schemaById1": {
      "cmd": "curl -s localhost:8081/schemas/ids/1",
      "out": "{\"subject\":\"orders-avro-value\",\"version\":1,\"guid\":\"8de22f74…\",\"schemaType\":\"AVRO\",\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"}]}\",\"ts\":1792302850421,\"deleted\":false}"
    },
    "produceV2": {
      "cmd": "./build/install/schema-app/bin/schema-app produce v2",
      "out": [
        "sent {\"id\": \"order-4\", \"customer\": \"alice\", \"amount\": 40.0, \"currency\": \"USD\"} with schema v2 -> partition=0 offset=3",
        "sent {\"id\": \"order-5\", \"customer\": \"bob\", \"amount\": 50.0, \"currency\": \"USD\"} with schema v2 -> partition=0 offset=4",
        "sent {\"id\": \"order-6\", \"customer\": \"carol\", \"amount\": 60.0, \"currency\": \"USD\"} with schema v2 -> partition=0 offset=5"
      ]
    },
    "versionsAfterV2": {
      "cmd": "curl -s localhost:8081/subjects/orders-avro-value/versions",
      "out": "[1,2]"
    },
    "latest": {
      "cmd": "curl -s localhost:8081/subjects/orders-avro-value/versions/latest",
      "out": "{\"subject\":\"orders-avro-value\",\"version\":2,\"id\":2,\"guid\":\"ea38309b…\",\"schemaType\":\"AVRO\",\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"}]}\",\"ts\":1792302851331,\"deleted\":false}"
    },
    "raw": {
      "cmd": "./build/install/schema-app/bin/schema-app raw",
      "out": [
        "offset=0 bytes=27 magic=0 schemaId=1 payload=22 bytes | 00 00 00 00 01 0e 6f 72 64 65 72 2d 31 0a 61 6c 69 63 65 00 00 00 00 00 00 24 40",
        "offset=1 bytes=25 magic=0 schemaId=1 payload=20 bytes | 00 00 00 00 01 0e 6f 72 64 65 72 2d 32 06 62 6f 62 00 00 00 00 00 00 34 40",
        "offset=2 bytes=27 magic=0 schemaId=1 payload=22 bytes | 00 00 00 00 01 0e 6f 72 64 65 72 2d 33 0a 63 61 72 6f 6c 00 00 00 00 00 00 3e 40",
        "offset=3 bytes=31 magic=0 schemaId=2 payload=26 bytes | 00 00 00 00 02 0e 6f 72 64 65 72 2d 34 0a 61 6c 69 63 65 00 00 00 00 00 00 44 40 06 55 53 44",
        "offset=4 bytes=29 magic=0 schemaId=2 payload=24 bytes | 00 00 00 00 02 0e 6f 72 64 65 72 2d 35 06 62 6f 62 00 00 00 00 00 00 49 40 06 55 53 44",
        "offset=5 bytes=31 magic=0 schemaId=2 payload=26 bytes | 00 00 00 00 02 0e 6f 72 64 65 72 2d 36 0a 63 61 72 6f 6c 00 00 00 00 00 00 4e 40 06 55 53 44"
      ]
    },
    "consume": {
      "cmd": "./build/install/schema-app/bin/schema-app consume",
      "out": [
        "offset=0 key=alice value={\"id\": \"order-1\", \"customer\": \"alice\", \"amount\": 10.0}",
        "offset=1 key=bob value={\"id\": \"order-2\", \"customer\": \"bob\", \"amount\": 20.0}",
        "offset=2 key=carol value={\"id\": \"order-3\", \"customer\": \"carol\", \"amount\": 30.0}",
        "offset=3 key=alice value={\"id\": \"order-4\", \"customer\": \"alice\", \"amount\": 40.0, \"currency\": \"USD\"}",
        "offset=4 key=bob value={\"id\": \"order-5\", \"customer\": \"bob\", \"amount\": 50.0, \"currency\": \"USD\"}",
        "offset=5 key=carol value={\"id\": \"order-6\", \"customer\": \"carol\", \"amount\": 60.0, \"currency\": \"USD\"}"
      ]
    },
    "badSchema": "{\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"},{\\\"name\\\":\\\"channel\\\",\\\"type\\\":\\\"string\\\"}]}\"}",
    "checkBad": {
      "cmd": "curl -s -X POST -H 'Content-Type: application/vnd.schemaregistry.v1+json' --data '{\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"},{\\\"name\\\":\\\"channel\\\",\\\"type\\\":\\\"string\\\"}]}\"}' localhost:8081/compatibility/subjects/orders-avro-value/versions/latest",
      "out": "{\"is_compatible\":false}"
    },
    "registerBad": {
      "cmd": "curl -s -X POST -H 'Content-Type: application/vnd.schemaregistry.v1+json' --data '{\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"},{\\\"name\\\":\\\"channel\\\",\\\"type\\\":\\\"string\\\"}]}\"}' localhost:8081/subjects/orders-avro-value/versions",
      "out": "{\"error_code\":409,\"message\":\"Schema being registered is incompatible with an earlier schema for subject \\\"orders-avro-value\\\", details: [{errorType:'READER_FIELD_MISSING_DEFAULT_VALUE', description:'The field 'channel' at path '/fields/4' in the new schema has no default value and is missing in the old schema', additionalInfo:'channel'}, {oldSchemaVersion: 2}, {oldSchema: '{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"}]}'}, {validateFields: 'false', compatibility: 'BACKWARD'}]\"}"
    },
    "checkGood": {
      "cmd": "curl -s -X POST -H 'Content-Type: application/vnd.schemaregistry.v1+json' --data '{\"schema\":\"{\\\"type\\\":\\\"record\\\",\\\"name\\\":\\\"Order\\\",\\\"namespace\\\":\\\"demo.schema\\\",\\\"fields\\\":[{\\\"name\\\":\\\"id\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"customer\\\",\\\"type\\\":\\\"string\\\"},{\\\"name\\\":\\\"amount\\\",\\\"type\\\":\\\"double\\\"},{\\\"name\\\":\\\"currency\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"EUR\\\"},{\\\"name\\\":\\\"channel\\\",\\\"type\\\":\\\"string\\\",\\\"default\\\":\\\"web\\\"}]}\"}' localhost:8081/compatibility/subjects/orders-avro-value/versions/latest",
      "out": "{\"is_compatible\":true}"
    },
    "versionsAtEnd": {
      "cmd": "curl -s localhost:8081/subjects/orders-avro-value/versions",
      "out": "[1,2]"
    }
  },
  "streams": {
    "createTopics": [
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 2 --replication-factor 1 --config retention.ms=-1",
        "out": "Created topic orders."
      },
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic big-orders --partitions 2 --replication-factor 1 --config retention.ms=-1",
        "out": "Created topic big-orders."
      },
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders-per-customer-out --partitions 2 --replication-factor 1 --config retention.ms=-1",
        "out": "Created topic orders-per-customer-out."
      },
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders-per-customer-10s-out --partitions 2 --replication-factor 1 --config retention.ms=-1",
        "out": "Created topic orders-per-customer-10s-out."
      },
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders-per-size-out --partitions 2 --replication-factor 1 --config retention.ms=-1",
        "out": "Created topic orders-per-size-out."
      }
    ],
    "describe": "Topologies:\n   Sub-topology: 0\n    Source: KSTREAM-SOURCE-0000000000 (topics: [orders])\n      --> KSTREAM-AGGREGATE-0000000003, KSTREAM-AGGREGATE-0000000007, KSTREAM-FILTER-0000000001, KSTREAM-KEY-SELECT-0000000011\n    Processor: KSTREAM-AGGREGATE-0000000003 (stores: [orders-per-customer])\n      --> KTABLE-TOSTREAM-0000000004\n      <-- KSTREAM-SOURCE-0000000000\n    Processor: KSTREAM-AGGREGATE-0000000007 (stores: [orders-per-customer-10s])\n      --> KTABLE-TOSTREAM-0000000008\n      <-- KSTREAM-SOURCE-0000000000\n    Processor: KSTREAM-KEY-SELECT-0000000011 (stores: [])\n      --> orders-per-size-repartition-filter\n      <-- KSTREAM-SOURCE-0000000000\n    Processor: KTABLE-TOSTREAM-0000000004 (stores: [])\n      --> KSTREAM-MAPVALUES-0000000005\n      <-- KSTREAM-AGGREGATE-0000000003\n    Processor: KTABLE-TOSTREAM-0000000008 (stores: [])\n      --> KSTREAM-MAP-0000000009\n      <-- KSTREAM-AGGREGATE-0000000007\n    Processor: KSTREAM-FILTER-0000000001 (stores: [])\n      --> KSTREAM-SINK-0000000002\n      <-- KSTREAM-SOURCE-0000000000\n    Processor: KSTREAM-MAP-0000000009 (stores: [])\n      --> KSTREAM-SINK-0000000010\n      <-- KTABLE-TOSTREAM-0000000008\n    Processor: KSTREAM-MAPVALUES-0000000005 (stores: [])\n      --> KSTREAM-SINK-0000000006\n      <-- KTABLE-TOSTREAM-0000000004\n    Processor: orders-per-size-repartition-filter (stores: [])\n      --> orders-per-size-repartition-sink\n      <-- KSTREAM-KEY-SELECT-0000000011\n    Sink: KSTREAM-SINK-0000000002 (topic: big-orders)\n      <-- KSTREAM-FILTER-0000000001\n    Sink: KSTREAM-SINK-0000000006 (topic: orders-per-customer-out)\n      <-- KSTREAM-MAPVALUES-0000000005\n    Sink: KSTREAM-SINK-0000000010 (topic: orders-per-customer-10s-out)\n      <-- KSTREAM-MAP-0000000009\n    Sink: orders-per-size-repartition-sink (topic: orders-per-size-repartition)\n      <-- orders-per-size-repartition-filter\n  Sub-topology: 1\n    Source: orders-per-size-repartition-source (topics: [orders-per-size-repartition])\n      --> KSTREAM-AGGREGATE-0000000012\n    Processor: KSTREAM-AGGREGATE-0000000012 (stores: [orders-per-size])\n      --> KTABLE-TOSTREAM-0000000016\n      <-- orders-per-size-repartition-source\n    Processor: KTABLE-TOSTREAM-0000000016 (stores: [])\n      --> KSTREAM-MAPVALUES-0000000017\n      <-- KSTREAM-AGGREGATE-0000000012\n    Processor: KSTREAM-MAPVALUES-0000000017 (stores: [])\n      --> KSTREAM-SINK-0000000018\n      <-- KTABLE-TOSTREAM-0000000016\n    Sink: KSTREAM-SINK-0000000018 (topic: orders-per-size-out)\n      <-- KSTREAM-MAPVALUES-0000000017",
    "produce": {
      "cmd": "./build/install/streams-app/bin/streams-app produce",
      "out": [
        "sent key=alice value=20 at 10:00:00",
        "sent key=bob value=80 at 10:00:02",
        "sent key=alice value=55 at 10:00:04",
        "sent key=carol value=10 at 10:00:11",
        "sent key=alice value=30 at 10:00:13",
        "sent key=bob value=70 at 10:00:25",
        "sent key=alice value=40 at 10:00:08"
      ]
    },
    "outputs": {
      "big-orders": {
        "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic big-orders --from-beginning --timeout-ms 6000 --isolation-level read_committed --formatter-property print.key=true --formatter-property print.partition=true",
        "out": "Partition:0\tbob\t80\nPartition:0\tbob\t70\nPartition:1\talice\t55"
      },
      "orders-per-customer-out": {
        "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders-per-customer-out --from-beginning --timeout-ms 6000 --isolation-level read_committed --formatter-property print.key=true --formatter-property print.partition=true",
        "out": "Partition:1\talice\t1\nPartition:1\talice\t2\nPartition:1\talice\t3\nPartition:1\talice\t4\nPartition:0\tbob\t1\nPartition:0\tcarol\t1\nPartition:0\tbob\t2"
      },
      "orders-per-customer-10s-out": {
        "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders-per-customer-10s-out --from-beginning --timeout-ms 6000 --isolation-level read_committed --formatter-property print.key=true --formatter-property print.partition=true",
        "out": "Partition:1\talice@2026-01-15T10:00:00Z\t1\nPartition:1\tbob@2026-01-15T10:00:00Z\t1\nPartition:1\tcarol@2026-01-15T10:00:10Z\t1\nPartition:1\tbob@2026-01-15T10:00:20Z\t1\nPartition:1\talice@2026-01-15T10:00:00Z\t2\nPartition:0\talice@2026-01-15T10:00:10Z\t1"
      },
      "orders-per-size-out": {
        "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders-per-size-out --from-beginning --timeout-ms 6000 --isolation-level read_committed --formatter-property print.key=true --formatter-property print.partition=true",
        "out": "Partition:0\tsmall\t1\nPartition:0\tbig\t1\nPartition:0\tsmall\t2\nPartition:0\tbig\t2\nPartition:0\tbig\t3\nPartition:0\tsmall\t3\nPartition:0\tsmall\t4"
      }
    },
    "query": {
      "typed": [
        "query alice",
        "query bob"
      ],
      "out": [
        "store orders-per-customer: alice = 4",
        "store orders-per-customer: bob = 2"
      ]
    },
    "topics": {
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --list",
      "out": "__consumer_offsets\n__transaction_state\n_schemas\nbig-orders\norder-stats-orders-per-customer-10s-changelog\norder-stats-orders-per-customer-changelog\norder-stats-orders-per-size-changelog\norder-stats-orders-per-size-repartition\norders\norders-avro\norders-per-customer-10s-out\norders-per-customer-out\norders-per-size-out"
    },
    "changelogConfig": {
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --describe --entity-type topics --entity-name order-stats-orders-per-customer-changelog",
      "out": "Dynamic configs for topic order-stats-orders-per-customer-changelog are:\n  cleanup.policy=compact sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:cleanup.policy=compact, DEFAULT_CONFIG:log.cleanup.policy=delete}\n  message.timestamp.type=CreateTime sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:message.timestamp.type=CreateTime, DEFAULT_CONFIG:log.message.timestamp.type=CreateTime}"
    },
    "repartitionConfig": {
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --describe --entity-type topics --entity-name order-stats-orders-per-size-repartition",
      "out": "Dynamic configs for topic order-stats-orders-per-size-repartition are:\n  cleanup.policy=delete sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:cleanup.policy=delete, DEFAULT_CONFIG:log.cleanup.policy=delete}\n  message.timestamp.type=CreateTime sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:message.timestamp.type=CreateTime, DEFAULT_CONFIG:log.message.timestamp.type=CreateTime}\n  retention.ms=-1 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=-1}\n  segment.bytes=52428800 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:segment.bytes=52428800, DEFAULT_CONFIG:log.segment.bytes=1073741824}"
    },
    "scale": {
      "first": [
        "state CREATED -> REBALANCING",
        "state REBALANCING -> RUNNING",
        "active tasks [0_0, 0_1, 1_0, 1_1]",
        "state RUNNING -> REBALANCING",
        "state REBALANCING -> RUNNING",
        "active tasks [0_1, 1_1]",
        "state RUNNING -> REBALANCING",
        "state REBALANCING -> RUNNING",
        "active tasks [0_1, 1_1]"
      ],
      "second": [
        "state CREATED -> REBALANCING",
        "state REBALANCING -> RUNNING",
        "active tasks []",
        "state RUNNING -> REBALANCING",
        "state REBALANCING -> RUNNING",
        "active tasks [0_0, 1_0]"
      ]
    },
    "group": {
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group order-stats --members",
      "out": "\nGROUP           CONSUMER-ID                                                                                                   HOST            CLIENT-ID                                                                #PARTITIONS     \norder-stats     order-stats-ff4be0aa…-StreamThread-1-consumer-aa2981d0… /127.0.0.1      order-stats-ff4be0aa…-StreamThread-1-consumer 2               \norder-stats     order-stats-d523d171…-StreamThread-1-consumer-cb7989c4… /127.0.0.1      order-stats-d523d171…-StreamThread-1-consumer 2"
    },
    "lateWarning": [
      "WARN KStreamWindowAggregate - Skipping record for expired window. topic=[orders] partition=[1] offset=[3] timestamp=[1768471208000] window=[1768471200000,1768471210000) expiration=[1768471213000] streamTime=[1768471213000]"
    ]
  }
} as const
