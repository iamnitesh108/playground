// Recorded by tools/kafka-capture/capture-keys.mjs against docker.io/apache/kafka:4.3.1 — do not edit by hand.
// Ports are shown as the standard 9092; Kafka's random ids are shortened.
export const KEYS = {
  "image": "docker.io/apache/kafka:4.3.1",
  "version": "4.3.1",
  "keyed": {
    "setup": {
      "label": "a topic with three partitions",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1",
      "out": "Created topic orders."
    },
    "send": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.SendKeyed",
      "out": "key=alice value=order-1 -> partition 0 offset 0   (murmur2 % 3 = 0)\nkey=bob   value=order-2 -> partition 0 offset 1   (murmur2 % 3 = 0)\nkey=alice value=order-3 -> partition 0 offset 2   (murmur2 % 3 = 0)\nkey=carol value=order-4 -> partition 2 offset 0   (murmur2 % 3 = 2)\nkey=dave  value=order-5 -> partition 1 offset 0   (murmur2 % 3 = 1)\nkey=alice value=order-6 -> partition 0 offset 3   (murmur2 % 3 = 0)\nkey=alice value=order-7 partition=2 given -> partition 2 offset 1"
    }
  },
  "stored": {
    "keyed": {
      "label": "a key and a value, split at the first \":\"",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic keyless --reader-property parse.key=true --reader-property key.separator=:",
      "out": "> customer-1:hello\n> :empty key"
    },
    "unkeyed": {
      "label": "without parse.key the whole line is the value and the key is null",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic keyless",
      "out": "> no key at all"
    },
    "dump": {
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/keyless-0/00000000000000000000.log --print-data-log",
      "out": "| offset: 0 keySize: 10 valueSize: 5 key: customer-1 payload: hello\n| offset: 1 keySize: 0 valueSize: 9 key:  payload: empty key\n| offset: 2 keySize: -1 valueSize: 13"
    }
  },
  "spread": {
    "setup": {
      "label": "six partitions",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic clicks --partitions 6 --replication-factor 1",
      "out": "Created topic clicks."
    },
    "defaults": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.Spread clicks 300 16384 5 null",
      "out": "records   1-296 -> partition 2\nrecords 297-300 -> partition 5\npartition 2: 296 records\npartition 5: 4 records"
    },
    "small": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.Spread clicks 120 1024 50 null",
      "out": "records   1- 16 -> partition 3\nrecords  17- 32 -> partition 0\nrecords  33- 48 -> partition 4\nrecords  49- 64 -> partition 2\nrecords  65- 80 -> partition 0\nrecords  81- 96 -> partition 5\nrecords  97-112 -> partition 4\nrecords 113-120 -> partition 3\npartition 0: 32 records\npartition 2: 16 records\npartition 3: 24 records\npartition 4: 32 records\npartition 5: 16 records"
    },
    "empty": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.Spread clicks 60 1024 50 empty",
      "out": "records   1- 60 -> partition 3\npartition 3: 60 records"
    },
    "ignore": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.Spread clicks 60 1024 50 ignore-keys",
      "out": "records   1- 48 -> partition 3\nrecords  49- 60 -> partition 4\npartition 3: 48 records\npartition 4: 12 records"
    },
    "roundRobin": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.Spread clicks 60 1024 50 round-robin",
      "out": "records   1-  1 -> partition 2\nrecords   2-  2 -> partition 1\nrecords   3-  3 -> partition 4\nrecords   4-  4 -> partition 3\nrecords   5-  5 -> partition 5\nrecords   6-  6 -> partition 0\nrecords   7-  7 -> partition 2\nrecords   8-  8 -> partition 1\nrecords   9-  9 -> partition 4\nrecords  10- 10 -> partition 3\nrecords  11- 11 -> partition 5\nrecords  12- 12 -> partition 0\nrecords  13- 13 -> partition 2\nrecords  14- 14 -> partition 1\nrecords  15- 15 -> partition 4\nrecords  16- 16 -> partition 3\nrecords  17- 17 -> partition 5\nrecords  18- 18 -> partition 0\nrecords  19- 19 -> partition 2\nrecords  20- 20 -> partition 1\nrecords  21- 21 -> partition 4\nrecords  22- 22 -> partition 3\nrecords  23- 23 -> partition 5\nrecords  24- 24 -> partition 0\nrecords  25- 25 -> partition 2\nrecords  26- 26 -> partition 1\nrecords  27- 27 -> partition 4\nrecords  28- 28 -> partition 3\nrecords  29- 29 -> partition 5\nrecords  30- 30 -> partition 0\nrecords  31- 31 -> partition 2\nrecords  32- 32 -> partition 1\nrecords  33- 33 -> partition 4\nrecords  34- 34 -> partition 3\nrecords  35- 35 -> partition 5\nrecords  36- 36 -> partition 0\nrecords  37- 37 -> partition 2\nrecords  38- 38 -> partition 1\nrecords  39- 39 -> partition 4\nrecords  40- 40 -> partition 3\nrecords  41- 41 -> partition 5\nrecords  42- 42 -> partition 0\nrecords  43- 43 -> partition 2\nrecords  44- 44 -> partition 1\nrecords  45- 45 -> partition 4\nrecords  46- 46 -> partition 3\nrecords  47- 47 -> partition 5\nrecords  48- 48 -> partition 0\nrecords  49- 49 -> partition 2\nrecords  50- 50 -> partition 1\nrecords  51- 51 -> partition 4\nrecords  52- 52 -> partition 3\nrecords  53- 53 -> partition 5\nrecords  54- 54 -> partition 0\nrecords  55- 55 -> partition 2\nrecords  56- 56 -> partition 1\nrecords  57- 57 -> partition 4\nrecords  58- 58 -> partition 3\nrecords  59- 59 -> partition 5\nrecords  60- 60 -> partition 0\npartition 0: 10 records\npartition 1: 10 records\npartition 2: 10 records\npartition 3: 10 records\npartition 4: 10 records\npartition 5: 10 records"
    }
  },
  "formats": {
    "setup": {
      "label": "six partitions",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic customers --partitions 6 --replication-factor 1",
      "out": "Created topic customers."
    },
    "send": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.KeyFormats",
      "out": "StringSerializer  \"42\"   bytes=3432                       -> partition 4\nIntegerSerializer 42     bytes=0000002a                   -> partition 0\nLongSerializer    42L    bytes=000000000000002a           -> partition 4\nJSON {\"id\":42}           bytes=7b226964223a34327d         -> partition 1\nJSON {\"id\": 42}          bytes=7b226964223a2034327d       -> partition 3"
    }
  },
  "tenants": {
    "setup": {
      "label": "six partitions",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic tenant-orders --partitions 6 --replication-factor 1",
      "out": "Created topic tenant-orders."
    },
    "send": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.SendTenants",
      "out": "key=tenant-a:1001 -> partition 3 offset 0\nkey=tenant-b:1002 -> partition 4 offset 0\nkey=tenant-a:1003 -> partition 3 offset 1\nkey=tenant-c:1004 -> partition 5 offset 0\nkey=tenant-b:1005 -> partition 4 offset 1\nkey=tenant-a:1006 -> partition 3 offset 2"
    }
  },
  "hot": {
    "setup": [
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments-by-status --partitions 6 --replication-factor 1",
        "out": "Created topic payments-by-status."
      },
      {
        "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments-by-order --partitions 6 --replication-factor 1",
        "out": "Created topic payments-by-order."
      }
    ],
    "sendStatus": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.SendStatuses payments-by-status 3000 status",
      "out": "sent 3000 records to payments-by-status keyed by status"
    },
    "sendOrder": {
      "cmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.SendStatuses payments-by-order 3000 order",
      "out": "sent 3000 records to payments-by-order keyed by order"
    },
    "offsetsStatus": {
      "label": "records per partition, keyed by status",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments-by-status",
      "out": "payments-by-status:0:0\npayments-by-status:1:2850\npayments-by-status:2:0\npayments-by-status:3:0\npayments-by-status:4:150\npayments-by-status:5:0"
    },
    "offsetsOrder": {
      "label": "records per partition, keyed by order id",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments-by-order",
      "out": "payments-by-order:0:523\npayments-by-order:1:513\npayments-by-order:2:483\npayments-by-order:3:484\npayments-by-order:4:490\npayments-by-order:5:507"
    },
    "workerCmd": "java -cp \"build/install/keys-app/lib/*\" demo.keys.SlowWorker worker-1 status-workers payments-by-status 5 14",
    "lagStatus": {
      "label": "10 s later: the group reading the status-keyed topic",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group status-workers",
      "out": "GROUP           TOPIC               PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG   CLIENT-ID\nstatus-workers  payments-by-status  0          0               0               0     worker-1\nstatus-workers  payments-by-status  1          1700            2850            1150  worker-1\nstatus-workers  payments-by-status  2          0               0               0     worker-2\nstatus-workers  payments-by-status  3          0               0               0     worker-2\nstatus-workers  payments-by-status  4          150             150             0     worker-3\nstatus-workers  payments-by-status  5          0               0               0     worker-3"
    },
    "lagOrder": {
      "label": "10 s later: the group reading the order-keyed topic",
      "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group order-workers",
      "out": "GROUP          TOPIC              PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CLIENT-ID\norder-workers  payments-by-order  0          523             523             0    oworker-1\norder-workers  payments-by-order  1          513             513             0    oworker-1\norder-workers  payments-by-order  2          483             483             0    oworker-2\norder-workers  payments-by-order  3          484             484             0    oworker-2\norder-workers  payments-by-order  4          490             490             0    oworker-3\norder-workers  payments-by-order  5          507             507             0    oworker-3"
    },
    "statusWorkers": [
      "worker-1 owned partitions [0, 1], handled {1=2320}",
      "worker-2 owned partitions [2, 3], handled {}",
      "worker-3 owned partitions [4, 5], handled {4=150}"
    ],
    "orderWorkers": [
      "oworker-1 owned partitions [0, 1], handled {1=456}",
      "oworker-2 owned partitions [2, 3], handled {0=523, 1=57, 2=483, 3=484}",
      "oworker-3 owned partitions [4, 5], handled {4=490, 5=507}"
    ]
  },
  "remap": {
    "setup": {
      "label": "three partitions",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic profiles --partitions 3 --replication-factor 1",
      "out": "Created topic profiles."
    },
    "first": {
      "label": "one record per customer, key before the \":\"",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=:",
      "out": "> customer-1:v1\n> customer-2:v1\n> customer-3:v1\n> customer-4:v1\n> customer-5:v1\n> customer-6:v1\n> customer-7:v1\n> customer-8:v1"
    },
    "readFirst": {
      "label": "print the partition and key of every record",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic profiles --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.key=true",
      "out": "Partition:1\tcustomer-3\tv1\nPartition:1\tcustomer-4\tv1\nPartition:1\tcustomer-6\tv1\nPartition:1\tcustomer-7\tv1\nPartition:0\tcustomer-1\tv1\nPartition:0\tcustomer-5\tv1\nPartition:2\tcustomer-2\tv1\nPartition:2\tcustomer-8\tv1"
    },
    "alter": {
      "label": "add a fourth partition",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --alter --topic profiles --partitions 4",
      "out": ""
    },
    "second": {
      "label": "the same customers again",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=:",
      "out": "> customer-1:v2\n> customer-2:v2\n> customer-3:v2\n> customer-4:v2\n> customer-5:v2\n> customer-6:v2\n> customer-7:v2\n> customer-8:v2"
    },
    "readAll": {
      "label": "everything, sorted by key: where did v1 and v2 of each customer go?",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic profiles --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.key=true",
      "out": "Partition:0\tcustomer-1\tv1\nPartition:1\tcustomer-1\tv2\nPartition:2\tcustomer-2\tv1\nPartition:2\tcustomer-2\tv2\nPartition:1\tcustomer-3\tv1\nPartition:2\tcustomer-3\tv2\nPartition:1\tcustomer-4\tv1\nPartition:1\tcustomer-4\tv2\nPartition:0\tcustomer-5\tv1\nPartition:2\tcustomer-5\tv2\nPartition:1\tcustomer-6\tv1\nPartition:3\tcustomer-6\tv2\nPartition:1\tcustomer-7\tv1\nPartition:3\tcustomer-7\tv2\nPartition:2\tcustomer-8\tv1\nPartition:0\tcustomer-8\tv2"
    }
  },
  "compacted": {
    "setup": {
      "label": "a compacted topic",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic user-profiles --partitions 1 --replication-factor 1 --config cleanup.policy=compact --config segment.ms=100 --config min.cleanable.dirty.ratio=0.01",
      "out": "Created topic user-profiles."
    },
    "noKey": {
      "label": "a record without a key",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic user-profiles",
      "out": "> no key here\nERROR Error when sending message to topic user-profiles with key: null, value: 11 bytes with error: (org.apache.kafka.clients.producer.internals.ErrorLoggingCallback)\norg.apache.kafka.common.InvalidRecordException: Compacted topic cannot accept message without key in topic partition user-profiles-0"
    },
    "brokerLog": [
      "org.apache.kafka.common.InvalidRecordException: One or more records have been rejected due to 1 record errors in total, and only showing the first three errors at most: [RecordError(batchIndex=0, message='Compacted topic cannot accept message without key in topic partition user-profiles-0')]"
    ],
    "produce": {
      "label": "keyed updates; NULL becomes a null value (a tombstone)",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic user-profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL",
      "out": "> user-1:Ann\n> user-2:Ben\n> user-1:Anna\n> user-3:Cat\n> user-2:NULL\n> user-1:Annie"
    },
    "roll": {
      "label": "one more record, so the earlier ones sit in a closed segment the cleaner may compact",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic user-profiles --reader-property parse.key=true --reader-property key.separator=:",
      "out": "> user-4:Dan"
    },
    "before": {
      "label": "right after writing",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic user-profiles --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true",
      "out": "Offset:0\tuser-1\tAnn\nOffset:1\tuser-2\tBen\nOffset:2\tuser-1\tAnna\nOffset:3\tuser-3\tCat\nOffset:4\tuser-2\tnull\nOffset:5\tuser-1\tAnnie\nOffset:6\tuser-4\tDan"
    },
    "after": {
      "label": "after the log cleaner ran",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic user-profiles --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true",
      "out": "Offset:3\tuser-3\tCat\nOffset:4\tuser-2\tnull\nOffset:5\tuser-1\tAnnie\nOffset:6\tuser-4\tDan"
    }
  }
} as const
