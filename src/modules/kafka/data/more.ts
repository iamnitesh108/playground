// Recorded by tools/kafka-capture/capture-more.mjs against docker.io/apache/kafka:4.3.1 — do not edit by hand.
// Ports are shown as the standard 9092; Kafka's random ids are shortened.
export const MORE = {
  "image": "docker.io/apache/kafka:4.3.1",
  "version": "4.3.1",
  "usingCli": {
    "connect": [
      {
        "label": "which cluster is behind this address?",
        "cmd": "kafka-cluster.sh cluster-id --bootstrap-server localhost:9092",
        "out": "Cluster ID: 5L6g3n…"
      },
      {
        "label": "every tool takes the same --bootstrap-server; an empty cluster has no topics yet",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --list",
        "out": ""
      }
    ],
    "topics": [
      {
        "label": "create",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 3 --replication-factor 1",
        "out": "Created topic payments."
      },
      {
        "label": "list",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --list",
        "out": "payments"
      },
      {
        "label": "describe",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic payments",
        "out": "Topic: payments\tTopicId: WP7GBy…\tPartitionCount: 3\tReplicationFactor: 1\tConfigs: min.insync.replicas=1\n\tTopic: payments\tPartition: 0\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr: \n\tTopic: payments\tPartition: 1\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr: \n\tTopic: payments\tPartition: 2\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:"
      },
      {
        "label": "add partitions (only ever more, never fewer)",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic payments --partitions 4",
        "out": ""
      },
      {
        "label": "try to go back to 3",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic payments --partitions 3",
        "out": "Error while executing topic command : The topic payments currently has 4 partition(s); 3 would not be an increase."
      },
      {
        "label": "a scratch topic to delete",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic scratch --partitions 1 --replication-factor 1",
        "out": "Created topic scratch."
      },
      {
        "label": "delete it",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --delete --topic scratch",
        "out": ""
      },
      {
        "label": "gone",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --list",
        "out": "payments"
      }
    ],
    "produce": {
      "label": "produce keyed records with a header (header TAB key:value per line)",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic payments --reader-property parse.key=true --reader-property key.separator=: --reader-property parse.headers=true",
      "out": "> source:checkout\talice:{\"amount\":25}\n> source:checkout\tbob:{\"amount\":40}\n> source:refunds\talice:{\"amount\":-25}\n> source:checkout\tcarol:{\"amount\":90}",
      "typed": [
        "source:checkout\talice:{\"amount\":25}",
        "source:checkout\tbob:{\"amount\":40}",
        "source:refunds\talice:{\"amount\":-25}",
        "source:checkout\tcarol:{\"amount\":90}"
      ]
    },
    "readAll": {
      "label": "read everything, with partition, offset, key and headers",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.headers=true",
      "out": "Partition:2\tOffset:0\tsource:checkout\tbob\t{\"amount\":40}\nPartition:2\tOffset:1\tsource:checkout\tcarol\t{\"amount\":90}\nPartition:1\tOffset:0\tsource:checkout\talice\t{\"amount\":25}\nPartition:1\tOffset:1\tsource:refunds\talice\t{\"amount\":-25}"
    },
    "offsets": {
      "label": "how many records per partition (the end offsets)",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments",
      "out": "payments:0:0\npayments:1:2\npayments:2:2\npayments:3:0"
    },
    "readGroup": {
      "label": "read as a group: offsets are committed, a second run continues where this one stopped",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group payments-cli --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
      "out": "Partition:2\tOffset:0\tbob\t{\"amount\":40}\nPartition:2\tOffset:1\tcarol\t{\"amount\":90}\nPartition:1\tOffset:0\talice\t{\"amount\":25}\nPartition:1\tOffset:1\talice\t{\"amount\":-25}"
    },
    "groupsList": {
      "label": "list groups",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list",
      "out": "payments-cli\nconsole-consumer-8502"
    },
    "groupDescribe": {
      "label": "describe a group: committed offset, end offset and lag per partition",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group payments-cli",
      "out": "\nGROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID     HOST            CLIENT-ID\npayments-cli    payments        0          0               0               0               -               -               -\npayments-cli    payments        1          2               2               0               -               -               -\npayments-cli    payments        2          2               2               0               -               -               -\npayments-cli    payments        3          0               0               0               -               -               -"
    },
    "produceMore": {
      "label": "two more payments arrive",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic payments --reader-property parse.key=true --reader-property key.separator=:",
      "out": "> bob:{\"amount\":12}\n> alice:{\"amount\":7}",
      "typed": [
        "bob:{\"amount\":12}",
        "alice:{\"amount\":7}"
      ]
    },
    "lag": {
      "label": "lag: records the group has not read yet",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group payments-cli",
      "out": "\nGROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID     HOST            CLIENT-ID\npayments-cli    payments        0          0               0               0               -               -               -\npayments-cli    payments        1          2               3               1               -               -               -\npayments-cli    payments        2          2               3               1               -               -               -\npayments-cli    payments        3          0               0               0               -               -               -"
    },
    "resetDry": {
      "label": "reset to the beginning: --dry-run only shows the plan",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --to-earliest --group payments-cli --topic payments --dry-run",
      "out": "\nGROUP           TOPIC           PARTITION  NEW-OFFSET\npayments-cli    payments        3          0\npayments-cli    payments        0          0\npayments-cli    payments        2          0\npayments-cli    payments        1          0"
    },
    "resetRun": {
      "label": "--execute applies it (the group must have no running members)",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --reset-offsets --to-earliest --group payments-cli --topic payments --execute",
      "out": "\nGROUP           TOPIC           PARTITION  NEW-OFFSET\npayments-cli    payments        3          0\npayments-cli    payments        0          0\npayments-cli    payments        2          0\npayments-cli    payments        1          0"
    },
    "afterReset": {
      "label": "now the whole topic is lag again",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group payments-cli",
      "out": "\nGROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID     HOST            CLIENT-ID\npayments-cli    payments        0          0               0               0               -               -               -\npayments-cli    payments        1          0               3               3               -               -               -\npayments-cli    payments        2          0               3               3               -               -               -\npayments-cli    payments        3          0               0               0               -               -               -"
    },
    "configSet": {
      "label": "keep records for one day instead of the default seven",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type topics --entity-name payments --add-config retention.ms=86400000",
      "out": "Completed updating config for topic payments."
    },
    "configGet": {
      "label": "the topic now overrides one setting",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --describe --entity-type topics --entity-name payments",
      "out": "Dynamic configs for topic payments are:\n  retention.ms=86400000 sensitive=false synonyms={DYNAMIC_TOPIC_CONFIG:retention.ms=86400000}"
    },
    "configDel": {
      "label": "remove the override: back to the broker default",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type topics --entity-name payments --delete-config retention.ms",
      "out": "Completed updating config for topic payments."
    },
    "byOffset": {
      "label": "one record by partition and offset (partition 2, offset 0)",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --partition 2 --offset 0 --max-messages 1 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
      "out": "Partition:2\tOffset:0\tbob\t{\"amount\":40}"
    },
    "found": {
      "partition": 2,
      "offset": 0
    }
  },
  "usingJava": {
    "setup": {
      "label": "a topic for the programs",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 3 --replication-factor 1",
      "out": "Created topic payments."
    },
    "topicAdmin": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.TopicAdmin",
      "out": "created invoices\ntopics: [invoices, payments]\n  partition 0 leader 1\n  partition 1 leader 1\n  partition 2 leader 1\ninvoices now has 6 partitions\nretention.ms = 86400000\ndeleted invoices"
    },
    "send": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.SendPayments",
      "out": "sent key=alice value={\"amount\":25} -> partition 0 offset 0\nsent key=bob value={\"amount\":40} -> partition 0 offset 1\nsent key=alice value={\"amount\":15} -> partition 0 offset 2\nsent key=carol value={\"amount\":90} -> partition 2 offset 0"
    },
    "read": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ReadPayments",
      "out": "partition 0 offset 0 key=alice value={\"amount\":25} source=checkout\npartition 0 offset 1 key=bob value={\"amount\":40} source=checkout\npartition 0 offset 2 key=alice value={\"amount\":15} source=checkout\npartition 2 offset 0 key=carol value={\"amount\":90} source=checkout"
    },
    "lagAfterRead": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.GroupLag payments-reader",
      "out": "payments-0 committed=3 end=3 lag=0\npayments-1 committed=0 end=0 lag=0\npayments-2 committed=1 end=1 lag=0"
    },
    "sendMore": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.SendPayments",
      "out": "sent key=alice value={\"amount\":25} -> partition 0 offset 3\nsent key=bob value={\"amount\":40} -> partition 0 offset 4\nsent key=alice value={\"amount\":15} -> partition 0 offset 5\nsent key=carol value={\"amount\":90} -> partition 2 offset 1"
    },
    "lagAfterMore": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.GroupLag payments-reader",
      "out": "payments-0 committed=3 end=6 lag=3\npayments-1 committed=0 end=0 lag=0\npayments-2 committed=1 end=2 lag=1"
    },
    "reset": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ResetOffsets payments-reader",
      "out": "payments-0 -> 0\npayments-2 -> 0\npayments-1 -> 0"
    },
    "lagAfterReset": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.GroupLag payments-reader",
      "out": "payments-0 committed=0 end=6 lag=6\npayments-1 committed=0 end=0 lag=0\npayments-2 committed=0 end=2 lag=2"
    },
    "atOffset": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ReadAtOffset 0 1",
      "out": "payments-0 offset 1: key=bob value={\"amount\":40}"
    }
  },
  "tx": {
    "setup": [
      {
        "label": "the input topic",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic transfers --partitions 1 --replication-factor 1",
        "out": "Created topic transfers."
      },
      {
        "label": "the output topic of the read-process-write step",
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic transfers-checked --partitions 1 --replication-factor 1",
        "out": "Created topic transfers-checked."
      }
    ],
    "features": {
      "label": "transactions need no switch: transaction.version is finalized on a 4.x cluster",
      "cmd": "kafka-features.sh --bootstrap-server localhost:9092 describe",
      "out": "Feature: metadata.version                          SupportedMinVersion: 3.3-IV3          SupportedMaxVersion: 4.3-IV0          FinalizedVersionLevel: 4.3-IV0\nFeature: transaction.version                       SupportedMinVersion: 0                SupportedMaxVersion: 2                FinalizedVersionLevel: 2"
    },
    "pay": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.PayTransactionally",
      "out": "committed: debit 30, credit bob 30\naborted:   debit 500, credit erin 500"
    },
    "endOffsets": {
      "label": "six offsets used for four records",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic transfers",
      "out": "transfers:0:6"
    },
    "uncommitted": {
      "label": "read_uncommitted (the default): aborted records are delivered too",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic transfers --from-beginning --timeout-ms 5000 --formatter-property print.offset=true",
      "out": "Offset:0\tdebit 30\nOffset:1\tcredit bob 30\nOffset:3\tdebit 500\nOffset:4\tcredit erin 500"
    },
    "committed": {
      "label": "read_committed: only the committed transaction",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic transfers --from-beginning --timeout-ms 5000 --isolation-level read_committed --formatter-property print.offset=true",
      "out": "Offset:0\tdebit 30\nOffset:1\tcredit bob 30"
    },
    "dump": {
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/transfers-0/00000000000000000000.log --print-data-log",
      "out": "baseOffset: 0 lastOffset: 1 count: 2 producerId: 0 producerEpoch: 0 isTransactional: true isControl: false\n| offset: 0 key: alice payload: debit 30\n| offset: 1 key: alice payload: credit bob 30\nbaseOffset: 2 lastOffset: 2 count: 1 producerId: 0 producerEpoch: 1 isTransactional: true isControl: true\n| offset: 2 endTxnMarker: COMMIT\nbaseOffset: 3 lastOffset: 4 count: 2 producerId: 0 producerEpoch: 1 isTransactional: true isControl: false\n| offset: 3 key: alice payload: debit 500\n| offset: 4 key: alice payload: credit erin 500\nbaseOffset: 5 lastOffset: 5 count: 1 producerId: 0 producerEpoch: 2 isTransactional: true isControl: true\n| offset: 5 endTxnMarker: ABORT"
    },
    "javaUncommitted": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ReadTransfers read_uncommitted",
      "out": "read_uncommitted offset 0: debit 30\nread_uncommitted offset 1: credit bob 30\nread_uncommitted offset 3: debit 500\nread_uncommitted offset 4: credit erin 500\nread_uncommitted position after reading: 6"
    },
    "javaCommitted": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ReadTransfers read_committed",
      "out": "read_committed offset 0: debit 30\nread_committed offset 1: credit bob 30\nread_committed position after reading: 6"
    },
    "txList": {
      "label": "the transactions the cluster knows about",
      "cmd": "kafka-transactions.sh --bootstrap-server localhost:9092 list",
      "out": "TransactionalId\tCoordinator\tProducerId\tTransactionState\t\ntransfers-1    \t1          \t0         \tCompleteAbort"
    },
    "txDescribe": {
      "label": "one transactional id in detail",
      "cmd": "kafka-transactions.sh --bootstrap-server localhost:9092 describe --transactional-id transfers-1",
      "out": "CoordinatorId\tTransactionalId\tProducerId\tProducerEpoch\tTransactionState\tTransactionTimeoutMs\tCurrentTransactionStartTimeMs\tTransactionDurationMs\tTopicPartitions\t\n1            \ttransfers-1    \t0         \t2            \tCompleteAbort   \t60000               \t1792303831585                \t21893"
    },
    "check": {
      "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.CheckTransfers",
      "out": "in offset 0: debit 30 -> out: debit 30 [checked]\nin offset 1: credit bob 30 -> out: credit bob 30 [checked]\ncommitted output and offsets {transfers-0=OffsetAndMetadata{offset=2, leaderEpoch=null, metadata=''}}"
    },
    "checkGroup": {
      "label": "the offsets were committed by the transaction, not by the consumer",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group transfer-checker",
      "out": "\nGROUP            TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID     HOST            CLIENT-ID\ntransfer-checker transfers       0          2               6               4               -               -               -"
    },
    "checkedOut": {
      "label": "the output topic, read_committed",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic transfers-checked --from-beginning --timeout-ms 5000 --isolation-level read_committed --formatter-property print.offset=true",
      "out": "Offset:0\tdebit 30 [checked]\nOffset:1\tcredit bob 30 [checked]"
    },
    "checkedOffsets": {
      "label": "two records, one marker",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic transfers-checked",
      "out": "transfers-checked:0:3"
    },
    "txList2": {
      "label": "both transactional ids",
      "cmd": "kafka-transactions.sh --bootstrap-server localhost:9092 list",
      "out": "TransactionalId   \tCoordinator\tProducerId\tTransactionState\t\ntransfers-1       \t1          \t0         \tCompleteAbort   \t\ntransfer-checker-1\t1          \t1         \tCompleteCommit"
    }
  },
  "share": {
    "features": {
      "cmd": "kafka-features.sh --bootstrap-server localhost:9092 describe",
      "out": "Feature: share.version                             SupportedMinVersion: 0                SupportedMaxVersion: 1                FinalizedVersionLevel: 1"
    },
    "setup": {
      "label": "ONE partition: in a consumer group only one member could read it",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic jobs --partitions 1 --replication-factor 1",
      "out": "Created topic jobs."
    },
    "defaults": {
      "label": "the share-group settings and their defaults",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --describe --entity-type groups --entity-name cli-workers --all",
      "out": "All configs for group cli-workers are:\n  share.assignment.interval.ms=1000\n  share.auto.offset.reset=latest\n  share.delivery.count.limit=5\n  share.heartbeat.interval.ms=5000\n  share.isolation.level=read_uncommitted\n  share.partition.max.record.locks=2000\n  share.record.lock.duration.ms=30000\n  share.renew.acknowledge.enable=true\n  share.session.timeout.ms=45000"
    },
    "reset": {
      "label": "a new share group starts at the END of the topic (latest); start this one at the beginning",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type groups --entity-name cli-workers --add-config share.auto.offset.reset=earliest",
      "out": "Completed updating config for group cli-workers."
    },
    "members": {
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --describe --group cli-workers --members",
      "out": "GROUP           CONSUMER-ID            HOST            CLIENT-ID       #PARTITIONS  ASSIGNMENT\ncli-workers     Wfup6w…                /127.0.0.1      worker-a        1            jobs:0\ncli-workers     aZFoKJ…                /127.0.0.1      worker-b        1            jobs:0\ncli-workers     nYcNoZ…                /127.0.0.1      worker-c        1            jobs:0"
    },
    "produced": {
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic jobs",
      "out": "> job-1\n> job-2\n> job-3\n> job-4\n> job-5\n> job-6\n> job-7\n> job-8\n> job-9",
      "typed": [
        "job-1",
        "job-2",
        "job-3",
        "job-4",
        "job-5",
        "job-6",
        "job-7",
        "job-8",
        "job-9"
      ]
    },
    "consumers": [
      {
        "name": "worker-a",
        "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic jobs --group cli-workers --command-property client.id=worker-a --formatter-property print.offset=true --formatter-property print.delivery=true",
        "out": [
          "Offset:1\tDelivery:1\tjob-2",
          "Offset:4\tDelivery:1\tjob-5",
          "Offset:7\tDelivery:1\tjob-8"
        ]
      },
      {
        "name": "worker-b",
        "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic jobs --group cli-workers --command-property client.id=worker-b --formatter-property print.offset=true --formatter-property print.delivery=true",
        "out": [
          "Offset:2\tDelivery:1\tjob-3",
          "Offset:5\tDelivery:1\tjob-6"
        ]
      },
      {
        "name": "worker-c",
        "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic jobs --group cli-workers --command-property client.id=worker-c --formatter-property print.offset=true --formatter-property print.delivery=true",
        "out": [
          "Offset:0\tDelivery:1\tjob-1",
          "Offset:3\tDelivery:1\tjob-4",
          "Offset:6\tDelivery:1\tjob-7",
          "Offset:8\tDelivery:1\tjob-9"
        ]
      }
    ],
    "offsets": {
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --describe --group cli-workers --offsets",
      "out": "\nGROUP           TOPIC           PARTITION  START-OFFSET  LAG\ncli-workers     jobs            0          8             0"
    },
    "list": {
      "label": "share groups are listed by their own tool",
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --list",
      "out": "cli-workers"
    },
    "allGroups": {
      "label": "kafka-groups.sh lists groups of every type",
      "cmd": "kafka-groups.sh --bootstrap-server localhost:9092 --list",
      "out": "GROUP                TYPE                 PROTOCOL            \ncli-workers          Share                share"
    },
    "resetDry": {
      "label": "replay: move the share group back to the beginning (members must be stopped)",
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --reset-offsets --to-earliest --group cli-workers --topic jobs --dry-run",
      "out": "\nGROUP           TOPIC           PARTITION  NEW-OFFSET\ncli-workers     jobs            0          0"
    },
    "limit": {
      "label": "allow three deliveries per record (default 5, allowed 2–10)",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type groups --entity-name releaser --add-config share.auto.offset.reset=earliest,share.delivery.count.limit=3",
      "out": "Completed updating config for group releaser."
    },
    "retriesIn": {
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic retries",
      "out": "> job-1\n> job-2",
      "typed": [
        "job-1",
        "job-2"
      ]
    },
    "release": {
      "label": "--release gives every record back: it is delivered again, until the limit",
      "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic retries --group releaser --release --timeout-ms 8000 --formatter-property print.offset=true --formatter-property print.delivery=true",
      "out": "Offset:0\tDelivery:1\tjob-1\nOffset:1\tDelivery:1\tjob-2\nOffset:0\tDelivery:2\tjob-1\nOffset:1\tDelivery:2\tjob-2\nOffset:0\tDelivery:3\tjob-1\nOffset:1\tDelivery:3\tjob-2"
    },
    "releaseOffsets": {
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --describe --group releaser --offsets",
      "out": "\nGROUP           TOPIC           PARTITION  START-OFFSET  LAG\nreleaser        retries         0          1             0"
    },
    "rejectIn": {
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic bad-jobs",
      "out": "> job-1\n> job-2",
      "typed": [
        "job-1",
        "job-2"
      ]
    },
    "reject": {
      "label": "--reject: each record is delivered once and never again",
      "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic bad-jobs --group rejecter --reject --timeout-ms 6000 --formatter-property print.offset=true --formatter-property print.delivery=true",
      "out": "Offset:0\tDelivery:1\tjob-1\nOffset:1\tDelivery:1\tjob-2"
    },
    "rejectAgain": {
      "label": "a second consumer in the same group: nothing left to deliver",
      "cmd": "kafka-console-share-consumer.sh --bootstrap-server localhost:9092 --topic bad-jobs --group rejecter --timeout-ms 6000 --formatter-property print.offset=true --formatter-property print.delivery=true",
      "out": ""
    },
    "javaConfig": {
      "label": "the group the Java workers use: 15 s locks (the minimum), three deliveries",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type groups --entity-name workers --add-config share.record.lock.duration.ms=15000,share.delivery.count.limit=3",
      "out": "Completed updating config for group workers."
    },
    "javaMembers": {
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --describe --group workers --members",
      "out": "GROUP           CONSUMER-ID            HOST            CLIENT-ID       #PARTITIONS  ASSIGNMENT\nworkers         BZD-9h…                /127.0.0.1      worker-1        1            jobs:0\nworkers         c8yNt4…                /127.0.0.1      worker-2        1            jobs:0"
    },
    "javaProduced": {
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic jobs",
      "typed": [
        "slow-10",
        "job-11",
        "retry-12",
        "poison-13",
        "job-14"
      ],
      "at": 0
    },
    "workers": [
      {
        "name": "worker-1",
        "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ShareWorker worker-1 30",
        "lines": [
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 10 delivery 1: job-11 -> accept"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 11 delivery 1: retry-12 -> release"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 11 delivery 2: retry-12 -> release"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 11 delivery 3: retry-12 -> release"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 12 delivery 1: poison-13 -> reject"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 1.2,
            "line": "worker-1 partition 0 offset 13 delivery 1: job-14 -> accept"
          },
          {
            "at": 1.2,
            "line": "worker-1   ack ok"
          },
          {
            "at": 15.9,
            "line": "worker-1 partition 0 offset 9 delivery 2: slow-10 -> accept"
          },
          {
            "at": 15.9,
            "line": "worker-1   ack ok"
          }
        ]
      },
      {
        "name": "worker-2",
        "cmd": "KAFKA_BOOTSTRAP=localhost:9092 java -cp \"build/install/using-app/lib/*\" demo.using.ShareWorker worker-2 30",
        "lines": [
          {
            "at": 1.2,
            "line": "worker-2 partition 0 offset 9 delivery 1: slow-10 -> accept"
          },
          {
            "at": 20.9,
            "line": "worker-2   ack ok"
          }
        ]
      }
    ],
    "javaOffsets": {
      "cmd": "kafka-share-groups.sh --bootstrap-server localhost:9092 --describe --group workers --offsets",
      "out": "\nGROUP           TOPIC           PARTITION  START-OFFSET  LAG\nworkers         jobs            0          9             0"
    }
  }
} as const
