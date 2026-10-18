// Recorded with Kafka 4.3.1 (docker.io/apache/kafka:4.3.1) and the Micronaut orders-app by tools/kafka-capture — do not edit by hand.

export const PRACTICALS = {
 "image": "docker.io/apache/kafka:4.3.1",
 "version": "4.3.1",
 "p1": {
  "cli": [
   {
    "label": "create a topic with one partition",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic greetings --partitions 1 --replication-factor 1",
    "out": "Created topic greetings."
   },
   {
    "label": "describe it",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic greetings",
    "out": "Topic: greetings\tTopicId: SQyYGLbQRAm-0TWJAsT3lg\tPartitionCount: 1\tReplicationFactor: 1\tConfigs: min.insync.replicas=1\n\tTopic: greetings\tPartition: 0\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:"
   },
   {
    "label": "produce three messages (typed, then Ctrl-D)",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic greetings",
    "out": "> hello\n> from\n> kafka",
    "typed": [
     "hello",
     "from",
     "kafka"
    ]
   },
   {
    "label": "read everything from the beginning",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic greetings --from-beginning --timeout-ms 5000 --formatter-property print.offset=true --formatter-property print.partition=true",
    "out": "Partition:0\tOffset:0\thello\nPartition:0\tOffset:1\tfrom\nPartition:0\tOffset:2\tkafka"
   },
   {
    "label": "read again: the same three — reading does not remove anything",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic greetings --from-beginning --timeout-ms 5000",
    "out": "hello\nfrom\nkafka"
   },
   {
    "label": "the consumer without --from-beginning only saw new messages; every console consumer joined a generated group",
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list",
    "out": "console-consumer-25642\nconsole-consumer-36453\nconsole-consumer-59532"
   }
  ],
  "app": {
   "producer": [
    "INFO  SendOrders - sent key=alice value=order-1001 -> partition=0 offset=0",
    "INFO  SendOrders - sent key=bob value=order-1002 -> partition=0 offset=1",
    "INFO  SendOrders - sent key=carol value=order-1003 -> partition=0 offset=2"
   ],
   "consumer": [
    "INFO  ConsumerRebalanceListenerInvoker - [group billing] Adding newly assigned partitions: orders-p1-0",
    "INFO  OrderListener - [app-1] received partition=0 offset=0 key=alice value=order-1001",
    "INFO  OrderListener - [app-1] received partition=0 offset=1 key=bob value=order-1002",
    "INFO  OrderListener - [app-1] received partition=0 offset=2 key=carol value=order-1003"
   ],
   "describe": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing",
    "out": "\nGROUP    TOPIC      PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID                          HOST        CLIENT-ID\nbilling  orders-p1  0          3               3               0    orders-app-order-listener-f13f2056…  /127.0.0.1  orders-app-order-listener"
   }
  },
  "liveConsumer": {
   "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic greetings --command-property client.id=live --formatter-property print.offset=true",
   "out": [
    "Offset:3\ta new message"
   ]
  },
  "liveProducer": {
   "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic greetings",
   "typed": [
    "a new message"
   ]
  }
 },
 "p2": {
  "cli": [
   {
    "label": "a topic with three partitions",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1",
    "out": "Created topic orders."
   },
   {
    "label": "describe: one leader per partition",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --describe --topic orders",
    "out": "Topic: orders\tTopicId: FYM4SShSRRejVQDCmNxwyA\tPartitionCount: 3\tReplicationFactor: 1\tConfigs: min.insync.replicas=1\n\tTopic: orders\tPartition: 0\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr: \n\tTopic: orders\tPartition: 1\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr: \n\tTopic: orders\tPartition: 2\tLeader: 1\tReplicas: 1\tIsr: 1\tElr: \tLastKnownElr:"
   },
   {
    "label": "produce six keyed messages (key:value)",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=:",
    "out": "> alice:order-1001\n> bob:order-1002\n> carol:order-1003\n> dave:order-1004\n> erin:order-1005\n> frank:order-1006",
    "typed": [
     "alice:order-1001",
     "bob:order-1002",
     "carol:order-1003",
     "dave:order-1004",
     "erin:order-1005",
     "frank:order-1006"
    ]
   },
   {
    "label": "where did they land? one read of everything, with partition and key",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --from-beginning --timeout-ms 5000 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "out": "Partition:0\tOffset:0\talice\torder-1001\nPartition:0\tOffset:1\tbob\torder-1002\nPartition:1\tOffset:0\tdave\torder-1004\nPartition:1\tOffset:1\tfrank\torder-1006\nPartition:2\tOffset:0\tcarol\torder-1003\nPartition:2\tOffset:1\terin\torder-1005"
   }
  ],
  "stages": [
   {
    "label": "one consumer in group billing",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --command-property client.id=c1 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "describe": {
     "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members --verbose",
     "out": "\nGROUP    CONSUMER-ID   HOST        CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling  c1-558cc6da…  /127.0.0.1  c1         3            -              orders:0,1,2        -             -"
    },
    "output": {
     "c1": [
      "Partition:0\tOffset:0\talice\torder-1001",
      "Partition:0\tOffset:1\tbob\torder-1002",
      "Partition:1\tOffset:0\tdave\torder-1004",
      "Partition:1\tOffset:1\tfrank\torder-1006",
      "Partition:2\tOffset:0\tcarol\torder-1003",
      "Partition:2\tOffset:1\terin\torder-1005"
     ]
    }
   },
   {
    "label": "a second consumer joins the same group",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --command-property client.id=c2 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "describe": {
     "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members --verbose",
     "out": "\nGROUP    CONSUMER-ID   HOST        CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling  c2-ac087a2c…  /127.0.0.1  c2         1            -              orders:2            -             -\nbilling  c1-558cc6da…  /127.0.0.1  c1         2            -              orders:0,1          -             -"
    }
   },
   {
    "label": "a third consumer joins",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --command-property client.id=c3 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "describe": {
     "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members --verbose",
     "out": "\nGROUP    CONSUMER-ID   HOST        CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling  c2-ac087a2c…  /127.0.0.1  c2         1            -              orders:1            -             -\nbilling  c1-558cc6da…  /127.0.0.1  c1         1            -              orders:0            -             -\nbilling  c3-d2e1468a…  /127.0.0.1  c3         1            -              orders:2            -             -"
    }
   },
   {
    "label": "a fourth consumer: more consumers than partitions",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders --group billing --from-beginning --command-property client.id=c4 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "describe": {
     "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members --verbose",
     "out": "\nGROUP    CONSUMER-ID   HOST        CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling  c2-ac087a2c…  /127.0.0.1  c2         1            -              orders:1            -             -\nbilling  c1-558cc6da…  /127.0.0.1  c1         1            -              orders:0            -             -\nbilling  c3-d2e1468a…  /127.0.0.1  c3         1            -              orders:2            -             -\nbilling  c4-29a331b6…  /127.0.0.1  c4         0            -              -                   -             -"
    }
   }
  ],
  "app": {
   "assignments": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing-app --members --verbose",
    "out": "\nGROUP        CONSUMER-ID                          HOST        CLIENT-ID                  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling-app  orders-app-order-listener-05ad7675…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:0         -             -\nbilling-app  orders-app-order-listener-7e343b2f…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:2         -             -\nbilling-app  orders-app-order-listener-1241b986…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:1         -             -"
   },
   "producer": [
    "INFO  SendOrders - sent key=alice value=order-1001 -> partition=0 offset=0",
    "INFO  SendOrders - sent key=bob value=order-1002 -> partition=0 offset=1",
    "INFO  SendOrders - sent key=carol value=order-1003 -> partition=2 offset=0",
    "INFO  SendOrders - sent key=dave value=order-1004 -> partition=1 offset=0",
    "INFO  SendOrders - sent key=erin value=order-1005 -> partition=2 offset=1",
    "INFO  SendOrders - sent key=frank value=order-1006 -> partition=1 offset=1"
   ],
   "logs": {
    "app-1": {
     "startup": [
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-0, orders-p2-1, orders-p2-2",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Revoke previously assigned partitions orders-p2-0, orders-p2-1, orders-p2-2",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-2",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Revoke previously assigned partitions orders-p2-2",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-1"
     ],
     "received": [
      "INFO  OrderListener - [app-1] received partition=1 offset=0 key=dave value=order-1004",
      "INFO  OrderListener - [app-1] received partition=1 offset=1 key=frank value=order-1006"
     ]
    },
    "app-2": {
     "startup": [
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-0, orders-p2-1",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Revoke previously assigned partitions orders-p2-0, orders-p2-1",
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-0"
     ],
     "received": [
      "INFO  OrderListener - [app-2] received partition=0 offset=0 key=alice value=order-1001",
      "INFO  OrderListener - [app-2] received partition=0 offset=1 key=bob value=order-1002"
     ]
    },
    "app-3": {
     "startup": [
      "INFO  ConsumerRebalanceListenerInvoker - [group billing-app] Adding newly assigned partitions: orders-p2-2"
     ],
     "received": [
      "INFO  OrderListener - [app-3] received partition=2 offset=0 key=carol value=order-1003",
      "INFO  OrderListener - [app-3] received partition=2 offset=1 key=erin value=order-1005"
     ]
    }
   },
   "fourth": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing-app --members --verbose",
    "out": "\nGROUP        CONSUMER-ID                          HOST        CLIENT-ID                  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling-app  orders-app-order-listener-dae273cf…  /127.0.0.1  orders-app-order-listener  0            -              -                   -             -\nbilling-app  orders-app-order-listener-05ad7675…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:0         -             -\nbilling-app  orders-app-order-listener-7e343b2f…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:2         -             -\nbilling-app  orders-app-order-listener-1241b986…  /127.0.0.1  orders-app-order-listener  1            -              orders-p2:1         -             -"
   }
  },
  "burst": {
   "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic orders --reader-property parse.key=true --reader-property key.separator=:",
   "typed": [
    "alice:order-1007",
    "bob:order-1008",
    "carol:order-1009",
    "dave:order-1010",
    "erin:order-1011",
    "frank:order-1012"
   ],
   "outputs": {
    "c1": [
     "Partition:0\tOffset:2\talice\torder-1007",
     "Partition:0\tOffset:3\tbob\torder-1008"
    ],
    "c2": [
     "Partition:1\tOffset:2\tdave\torder-1010",
     "Partition:1\tOffset:3\tfrank\torder-1012"
    ],
    "c3": [
     "Partition:2\tOffset:2\tcarol\torder-1009",
     "Partition:2\tOffset:3\terin\torder-1011"
    ]
   }
  },
  "afterStop": {
   "label": "c2 stops (Ctrl-C): the partitions are dealt out again among c1, c3 and c4",
   "describe": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --members --verbose",
    "out": "\nGROUP    CONSUMER-ID   HOST        CLIENT-ID  #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nbilling  c1-558cc6da…  /127.0.0.1  c1         1            -              orders:0            -             -\nbilling  c3-d2e1468a…  /127.0.0.1  c3         1            -              orders:1            -             -\nbilling  c4-29a331b6…  /127.0.0.1  c4         1            -              orders:2            -             -"
   }
  },
  "offsets": {
   "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing",
   "out": "\nGROUP    TOPIC   PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID   HOST        CLIENT-ID\nbilling  orders  0          4               4               0    c1-558cc6da…  /127.0.0.1  c1\nbilling  orders  1          4               4               0    c3-d2e1468a…  /127.0.0.1  c3\nbilling  orders  2          4               4               0    c4-29a331b6…  /127.0.0.1  c4"
  }
 },
 "p3": {
  "cli": [
   {
    "label": "a topic for payments, three partitions",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 3 --replication-factor 1",
    "out": "Created topic payments."
   },
   {
    "label": "produce six payments",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic payments --reader-property parse.key=true --reader-property key.separator=:",
    "out": "> alice:pay-1\n> bob:pay-2\n> carol:pay-3\n> dave:pay-4\n> erin:pay-5\n> frank:pay-6",
    "typed": [
     "alice:pay-1",
     "bob:pay-2",
     "carol:pay-3",
     "dave:pay-4",
     "erin:pay-5",
     "frank:pay-6"
    ]
   }
  ],
  "app": {
   "producer": [
    "INFO  SendOrders - sent key=alice value=order-1 -> partition=0 offset=0",
    "INFO  SendOrders - sent key=bob value=order-2 -> partition=0 offset=1",
    "INFO  SendOrders - sent key=carol value=order-3 -> partition=2 offset=0",
    "INFO  SendOrders - sent key=dave value=order-4 -> partition=1 offset=0",
    "INFO  SendOrders - sent key=erin value=order-5 -> partition=2 offset=1",
    "INFO  SendOrders - sent key=frank value=order-6 -> partition=1 offset=1"
   ],
   "logs": {
    "billing-app-1": [
     "INFO  OrderListener - [billing-app-1] received partition=0 offset=0 key=alice value=order-1",
     "INFO  OrderListener - [billing-app-1] received partition=0 offset=1 key=bob value=order-2",
     "INFO  OrderListener - [billing-app-1] received partition=2 offset=0 key=carol value=order-3",
     "INFO  OrderListener - [billing-app-1] received partition=1 offset=0 key=dave value=order-4",
     "INFO  OrderListener - [billing-app-1] received partition=2 offset=1 key=erin value=order-5",
     "INFO  OrderListener - [billing-app-1] received partition=1 offset=1 key=frank value=order-6"
    ],
    "analytics-app-1": [
     "INFO  OrderListener - [analytics-app-1] received partition=0 offset=0 key=alice value=order-1",
     "INFO  OrderListener - [analytics-app-1] received partition=0 offset=1 key=bob value=order-2",
     "INFO  OrderListener - [analytics-app-1] received partition=1 offset=0 key=dave value=order-4",
     "INFO  OrderListener - [analytics-app-1] received partition=1 offset=1 key=frank value=order-6"
    ],
    "analytics-app-2": [
     "INFO  OrderListener - [analytics-app-2] received partition=2 offset=0 key=carol value=order-3",
     "INFO  OrderListener - [analytics-app-2] received partition=2 offset=1 key=erin value=order-5"
    ]
   },
   "describe": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing-app --group analytics-app",
    "out": "\nGROUP          TOPIC        PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID                          HOST        CLIENT-ID\nanalytics-app  payments-p3  0          2               2               0    orders-app-order-listener-61d6d1a5…  /127.0.0.1  orders-app-order-listener\nanalytics-app  payments-p3  1          2               2               0    orders-app-order-listener-61d6d1a5…  /127.0.0.1  orders-app-order-listener\nanalytics-app  payments-p3  2          2               2               0    orders-app-order-listener-f0e199f8…  /127.0.0.1  orders-app-order-listener\n\nGROUP        TOPIC        PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID                          HOST        CLIENT-ID\nbilling-app  payments-p3  0          2               2               0    orders-app-order-listener-2d6ab783…  /127.0.0.1  orders-app-order-listener\nbilling-app  payments-p3  1          2               2               0    orders-app-order-listener-2d6ab783…  /127.0.0.1  orders-app-order-listener\nbilling-app  payments-p3  2          2               2               0    orders-app-order-listener-2d6ab783…  /127.0.0.1  orders-app-order-listener"
   }
  },
  "assignedBefore": {
   "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group analytics --members --verbose",
   "out": "\nGROUP      CONSUMER-ID            HOST        CLIENT-ID    #PARTITIONS  CURRENT-EPOCH  CURRENT-ASSIGNMENT  TARGET-EPOCH  TARGET-ASSIGNMENT\nanalytics  analytics-1-8fe12d0a…  /127.0.0.1  analytics-1  2            -              payments:0,1        -             -\nanalytics  analytics-2-064a390f…  /127.0.0.1  analytics-2  1            -              payments:2          -             -"
  },
  "groups": {
   "billing": {
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group billing --from-beginning --command-property client.id=billing-1 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "out": [
     "Partition:0\tOffset:0\talice\tpay-1",
     "Partition:0\tOffset:1\tbob\tpay-2",
     "Partition:2\tOffset:0\tcarol\tpay-3",
     "Partition:2\tOffset:1\terin\tpay-5",
     "Partition:1\tOffset:0\tdave\tpay-4",
     "Partition:1\tOffset:1\tfrank\tpay-6"
    ]
   },
   "analytics-1": {
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group analytics --from-beginning --command-property client.id=analytics-1 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "out": [
     "Partition:0\tOffset:0\talice\tpay-1",
     "Partition:0\tOffset:1\tbob\tpay-2",
     "Partition:1\tOffset:0\tdave\tpay-4",
     "Partition:1\tOffset:1\tfrank\tpay-6"
    ]
   },
   "analytics-2": {
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group analytics --from-beginning --command-property client.id=analytics-2 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
    "out": [
     "Partition:2\tOffset:0\tcarol\tpay-3",
     "Partition:2\tOffset:1\terin\tpay-5"
    ]
   }
  },
  "list": {
   "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list",
   "out": "analytics\nbilling"
  },
  "describeBoth": {
   "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group billing --group analytics",
   "out": "\nGROUP      TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID            HOST        CLIENT-ID\nanalytics  payments  0          2               2               0    analytics-1-8fe12d0a…  /127.0.0.1  analytics-1\nanalytics  payments  1          2               2               0    analytics-1-8fe12d0a…  /127.0.0.1  analytics-1\nanalytics  payments  2          2               2               0    analytics-2-064a390f…  /127.0.0.1  analytics-2\n\nGROUP    TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID          HOST        CLIENT-ID\nbilling  payments  0          2               2               0    billing-1-ed518329…  /127.0.0.1  billing-1\nbilling  payments  1          2               2               0    billing-1-ed518329…  /127.0.0.1  billing-1\nbilling  payments  2          2               2               0    billing-1-ed518329…  /127.0.0.1  billing-1"
  },
  "whileAway": {
   "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic payments --reader-property parse.key=true --reader-property key.separator=:",
   "typed": [
    "alice:pay-7",
    "bob:pay-8",
    "carol:pay-9"
   ],
   "billingSaw": [
    "Partition:0\tOffset:2\talice\tpay-7",
    "Partition:0\tOffset:3\tbob\tpay-8",
    "Partition:2\tOffset:2\tcarol\tpay-9"
   ],
   "describe": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group analytics",
    "out": "\nGROUP      TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID  HOST  CLIENT-ID\nanalytics  payments  0          2               4               2    -            -     -\nanalytics  payments  1          2               2               0    -            -     -\nanalytics  payments  2          2               3               1    -            -     -"
   }
  },
  "caughtUp": {
   "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group analytics --command-property client.id=analytics-3 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
   "out": [
    "Partition:0\tOffset:2\talice\tpay-7",
    "Partition:0\tOffset:3\tbob\tpay-8",
    "Partition:2\tOffset:2\tcarol\tpay-9"
   ],
   "describe": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group analytics",
    "out": "\nGROUP      TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID            HOST        CLIENT-ID\nanalytics  payments  0          4               4               0    analytics-3-c30f694e…  /127.0.0.1  analytics-3\nanalytics  payments  1          2               2               0    analytics-3-c30f694e…  /127.0.0.1  analytics-3\nanalytics  payments  2          3               3               0    analytics-3-c30f694e…  /127.0.0.1  analytics-3"
   }
  },
  "reset": {
   "dryRun": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group analytics --topic payments --reset-offsets --to-earliest --dry-run",
    "out": "\nGROUP      TOPIC     PARTITION  NEW-OFFSET\nanalytics  payments  0          0\nanalytics  payments  2          0\nanalytics  payments  1          0"
   },
   "execute": {
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --group analytics --topic payments --reset-offsets --to-earliest --execute",
    "out": "\nGROUP      TOPIC     PARTITION  NEW-OFFSET\nanalytics  payments  0          0\nanalytics  payments  2          0\nanalytics  payments  1          0"
   }
  },
  "replay": {
   "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group analytics --command-property client.id=analytics-4 --formatter-property print.partition=true --formatter-property print.offset=true --formatter-property print.key=true",
   "out": [
    "Partition:0\tOffset:0\talice\tpay-1",
    "Partition:0\tOffset:1\tbob\tpay-2",
    "Partition:0\tOffset:2\talice\tpay-7",
    "Partition:0\tOffset:3\tbob\tpay-8",
    "Partition:2\tOffset:0\tcarol\tpay-3",
    "Partition:2\tOffset:1\terin\tpay-5",
    "Partition:2\tOffset:2\tcarol\tpay-9",
    "Partition:1\tOffset:0\tdave\tpay-4",
    "Partition:1\tOffset:1\tfrank\tpay-6"
   ]
  }
 }
} as const
