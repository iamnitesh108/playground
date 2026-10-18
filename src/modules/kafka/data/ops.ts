// Recorded with Kafka 4.3.1 (docker.io/apache/kafka:4.3.1) by tools/kafka-capture/capture-ops.mjs — do not edit by hand.

export const OPS = {
 "image": "docker.io/apache/kafka:4.3.1",
 "security": {
  "tls": [
   {
    "label": "a private CA: key + self-signed certificate",
    "cmd": "openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 365 -subj \"/CN=demo-ca\"",
    "out": ""
   },
   {
    "label": "the broker key and a signing request for its host name",
    "cmd": "openssl req -newkey rsa:2048 -nodes -keyout broker.key -out broker.csr -subj \"/CN=localhost\"",
    "out": ""
   },
   {
    "label": "the CA signs it; the SAN must match the advertised host",
    "cmd": "openssl x509 -req -in broker.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out broker.pem -days 365 -extfile san.ext",
    "out": ""
   },
   {
    "label": "Kafka reads a PEM key only in PKCS#8: convert, then key + certificate in one file",
    "cmd": "openssl pkcs8 -topk8 -nocrypt -in broker.key -out broker.pk8 && cat broker.pk8 broker.pem > broker-chain.pem",
    "out": ""
   }
  ],
  "steps": [
   {
    "label": "a cluster id",
    "cmd": "kafka-storage.sh random-uuid",
    "out": "nPyM2st4…"
   },
   {
    "label": "format the storage and create the first SCRAM user (admin) before the broker ever starts",
    "cmd": "kafka-storage.sh format -t nPyM2st4… -c /cfg/server.properties --add-scram 'SCRAM-SHA-512=[name=admin,password=admin-secret]'",
    "out": "Formatting metadata directory /tmp/kraft-logs with metadata.version 4.3-IV0."
   },
   {
    "label": "a client with no credentials (PLAINTEXT) against the SASL listener",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --command-config /cfg/plain.properties --list",
    "out": "Error while executing topic command : Timed out waiting for a node assignment. Call: listTopics"
   },
   {
    "label": "a wrong password",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --command-config /cfg/wrong.properties --list",
    "out": "Error while executing topic command : Authentication failed during authentication due to invalid credentials with SASL mechanism SCRAM-SHA-512"
   },
   {
    "label": "the admin (a super user) creates a topic",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --create --topic orders --partitions 3 --replication-factor 1",
    "out": "Created topic orders."
   },
   {
    "label": "the admin creates a second SCRAM user, app, at runtime",
    "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --alter --add-config 'SCRAM-SHA-512=[iterations=8192,password=app-secret]' --entity-type users --entity-name app",
    "out": "Completed updating config for user app."
   },
   {
    "label": "users are listed with their mechanism and iterations — never the password",
    "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --describe --entity-type users",
    "out": "SCRAM credential configs for user-principal 'app' are SCRAM-SHA-512=iterations=8192\nSCRAM credential configs for user-principal 'admin' are SCRAM-SHA-512=iterations=4096"
   },
   {
    "label": "app is authenticated but has no ACL: producing is denied",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --command-config /cfg/app.properties --topic orders",
    "out": "WARN [Producer clientId=console-producer] The metadata response from the cluster reported a recoverable issue with correlation id 1 : {orders=TOPIC_AUTHORIZATION_FAILED} (org.apache.kafka.clients.NetworkClient)\norg.apache.kafka.common.errors.TopicAuthorizationException: Not authorized to access topics: [orders]"
   },
   {
    "label": "allow app to WRITE to the topic orders",
    "cmd": "kafka-acls.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --add --allow-principal User:app --operation WRITE --topic orders",
    "out": "Adding ACLs for resource `ResourcePattern(resourceType=TOPIC, name=orders, patternType=LITERAL)`: \n \t(principal=User:app, host=*, operation=WRITE, permissionType=ALLOW)"
   },
   {
    "label": "the same producer now works (no output means every record was acknowledged)",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --command-config /cfg/app.properties --topic orders",
    "out": "",
    "typed": [
     "order-1",
     "order-2"
    ]
   },
   {
    "label": "consuming with a group: denied on the group first",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --command-config /cfg/app.properties --topic orders --group billing --from-beginning --timeout-ms 8000",
    "out": "org.apache.kafka.common.errors.GroupAuthorizationException: Not authorized to access group: billing"
   },
   {
    "label": "allow app to READ the group billing",
    "cmd": "kafka-acls.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --add --allow-principal User:app --operation READ --group billing",
    "out": "Adding ACLs for resource `ResourcePattern(resourceType=GROUP, name=billing, patternType=LITERAL)`: \n \t(principal=User:app, host=*, operation=READ, permissionType=ALLOW)"
   },
   {
    "label": "now denied on the topic",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --command-config /cfg/app.properties --topic orders --group billing --from-beginning --timeout-ms 8000",
    "out": "org.apache.kafka.common.errors.TopicAuthorizationException: Not authorized to access topics: [orders]"
   },
   {
    "label": "allow app to READ the topic",
    "cmd": "kafka-acls.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --add --allow-principal User:app --operation READ --topic orders",
    "out": "Adding ACLs for resource `ResourcePattern(resourceType=TOPIC, name=orders, patternType=LITERAL)`: \n \t(principal=User:app, host=*, operation=READ, permissionType=ALLOW)"
   },
   {
    "label": "with both READ ACLs the consumer gets its records",
    "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --command-config /cfg/app.properties --topic orders --group billing --from-beginning --timeout-ms 8000",
    "out": "order-1\norder-2\nProcessed a total of 2 messages"
   },
   {
    "label": "every ACL on the cluster",
    "cmd": "kafka-acls.sh --bootstrap-server localhost:9092 --command-config /cfg/admin.properties --list",
    "out": "Current ACLs for resource `ResourcePattern(resourceType=TOPIC, name=orders, patternType=LITERAL)`:\n\t(principal=User:app, host=*, operation=READ, permissionType=ALLOW)\n\t(principal=User:app, host=*, operation=WRITE, permissionType=ALLOW)\n\nCurrent ACLs for resource `ResourcePattern(resourceType=GROUP, name=billing, patternType=LITERAL)`:\n\t(principal=User:app, host=*, operation=READ, permissionType=ALLOW)"
   },
   {
    "label": "TLS: a client that does not trust the private CA",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9094 --command-config /cfg/tls-no-truststore.properties --list",
    "out": "org.apache.kafka.common.errors.SslAuthenticationException: SSL handshake failed\nCaused by: javax.net.ssl.SSLHandshakeException: (certificate_unknown) PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target\nERROR org.apache.kafka.common.errors.SslAuthenticationException: SSL handshake failed\nCaused by: javax.net.ssl.SSLHandshakeException: (certificate_unknown) PKIX path building failed: sun.security.provider.certpath.SunCertPathBuilderException: unable to find valid certification path to requested target"
   },
   {
    "label": "TLS: a client with the CA as its truststore",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9094 --command-config /cfg/tls.properties --list",
    "out": "__consumer_offsets\norders"
   }
  ],
  "files": {
   "server.properties": "process.roles=broker,controller\nnode.id=1\ncontroller.quorum.voters=1@localhost:9093\nlisteners=SASL_PLAINTEXT://localhost:9092,CONTROLLER://localhost:9093,SASL_SSL://localhost:9094\nadvertised.listeners=SASL_PLAINTEXT://localhost:9092,SASL_SSL://localhost:9094\nlistener.security.protocol.map=CONTROLLER:PLAINTEXT,SASL_PLAINTEXT:SASL_PLAINTEXT,SASL_SSL:SASL_SSL\ncontroller.listener.names=CONTROLLER\ninter.broker.listener.name=SASL_PLAINTEXT\n\n# authentication: SCRAM users are stored in the cluster metadata\nsasl.enabled.mechanisms=SCRAM-SHA-512\nsasl.mechanism.inter.broker.protocol=SCRAM-SHA-512\nlistener.name.sasl_plaintext.scram-sha-512.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"admin\" password=\"admin-secret\";\nlistener.name.sasl_ssl.scram-sha-512.sasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"admin\" password=\"admin-secret\";\n\n# TLS for the SASL_SSL listener\nssl.keystore.type=PEM\nssl.keystore.location=/cfg/broker-chain.pem\n\n# authorisation: ACLs, deny by default\nauthorizer.class.name=org.apache.kafka.metadata.authorizer.StandardAuthorizer\nsuper.users=User:admin;User:ANONYMOUS\nallow.everyone.if.no.acl.found=false\n\noffsets.topic.replication.factor=1\ntransaction.state.log.replication.factor=1\ntransaction.state.log.min.isr=1\ngroup.initial.rebalance.delay.ms=0\nlog.dirs=/tmp/kraft-logs\n",
   "admin.properties": "security.protocol=SASL_PLAINTEXT\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"admin\" password=\"admin-secret\";\n",
   "app.properties": "security.protocol=SASL_PLAINTEXT\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"app\" password=\"app-secret\";\n",
   "wrong.properties": "security.protocol=SASL_PLAINTEXT\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"app\" password=\"not-the-password\";\n",
   "plain.properties": "security.protocol=PLAINTEXT\ndefault.api.timeout.ms=8000\nrequest.timeout.ms=4000\n",
   "tls.properties": "security.protocol=SASL_SSL\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"admin\" password=\"admin-secret\";\nssl.truststore.type=PEM\nssl.truststore.location=/cfg/ca.pem\n",
   "tls-no-truststore.properties": "security.protocol=SASL_SSL\nsasl.mechanism=SCRAM-SHA-512\nsasl.jaas.config=org.apache.kafka.common.security.scram.ScramLoginModule required username=\"admin\" password=\"admin-secret\";\ndefault.api.timeout.ms=8000\nrequest.timeout.ms=4000\n"
  },
  "handshake": {
   "cmd": "openssl s_client -connect localhost:9094 -CAfile ca.pem",
   "out": "subject=CN=localhost\nissuer=CN=demo-ca\nNew, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384\nProtocol: TLSv1.3\nVerify return code: 0 (ok)"
  },
  "brokerLog": [
   "INFO [SocketServer listenerType=BROKER, nodeId=1] Failed authentication with /127.0.0.1 (channelId=127.0.0.1:9092-127.0.0.1:44084-0-5) (Authentication failed during authentication due to invalid credentials with SASL mechanism SCRAM-SHA-512) (org.apache.kafka.common.network.Selector)",
   "INFO [SocketServer listenerType=BROKER, nodeId=1] Failed authentication with /127.0.0.1 (channelId=127.0.0.1:9094-127.0.0.1:33758-3-0) (SSL handshake failed) (org.apache.kafka.common.network.Selector)"
  ]
 },
 "version": "4.3.1",
 "monitoring": {
  "jmxEnv": "KAFKA_JMX_PORT=9999\nKAFKA_JMX_HOSTNAME=localhost",
  "create": {
   "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic orders --partitions 3 --replication-factor 1",
   "out": "Created topic orders."
  },
  "health": {
   "cmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions --object-name kafka.server:type=ReplicaManager,name=UnderMinIsrPartitionCount --object-name kafka.controller:type=KafkaController,name=OfflinePartitionsCount --object-name kafka.controller:type=KafkaController,name=ActiveControllerCount --report-format properties --one-time true",
   "out": "time=1792303373788\nkafka.controller:type=KafkaController,name=ActiveControllerCount:Value=1\nkafka.controller:type=KafkaController,name=OfflinePartitionsCount:Value=0\nkafka.server:type=ReplicaManager,name=UnderMinIsrPartitionCount:Value=0\nkafka.server:type=ReplicaManager,name=UnderReplicatedPartitions:Value=0\nTrying to connect to JMX url: service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi"
  },
  "samplerCmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.server:type=BrokerTopicMetrics,name=MessagesInPerSec --object-name kafka.server:type=BrokerTopicMetrics,name=BytesInPerSec --object-name kafka.server:type=KafkaRequestHandlerPool,name=RequestHandlerAvgIdlePercent --object-name kafka.network:type=SocketServer,name=NetworkProcessorAvgIdlePercent --reporting-interval 1000 --report-format csv",
  "perf": {
   "cmd": "kafka-producer-perf-test.sh --topic orders --num-records 4000000 --record-size 100 --throughput -1 --producer-props bootstrap.servers=localhost:9092 acks=all linger.ms=5 --print-metrics",
   "out": "4000000 records sent, 1092001.092001 records/sec (104.14 MB/sec), 126.45 ms avg latency, 417.00 ms max latency, 90 ms 50th, 377 ms 95th, 410 ms 99th, 415 ms 99.9th."
  },
  "load": [
   {
    "t": 1,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 14
   },
   {
    "t": 2,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 99,
    "networkIdlePct": 16
   },
   {
    "t": 3,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 18
   },
   {
    "t": 4,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 99,
    "networkIdlePct": 21
   },
   {
    "t": 5,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 23
   },
   {
    "t": 6,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 25
   },
   {
    "t": 7,
    "msgsPerSec": 116982,
    "mbPerSec": 12.8,
    "handlerIdlePct": 100,
    "networkIdlePct": 26
   },
   {
    "t": 8,
    "msgsPerSec": 934222,
    "mbPerSec": 102.6,
    "handlerIdlePct": 100,
    "networkIdlePct": 28
   },
   {
    "t": 9,
    "msgsPerSec": 1399305,
    "mbPerSec": 153.9,
    "handlerIdlePct": 96,
    "networkIdlePct": 30
   },
   {
    "t": 10,
    "msgsPerSec": 1545846,
    "mbPerSec": 170.3,
    "handlerIdlePct": 88,
    "networkIdlePct": 31
   },
   {
    "t": 11,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 33
   },
   {
    "t": 12,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 94,
    "networkIdlePct": 34
   },
   {
    "t": 13,
    "msgsPerSec": 0,
    "mbPerSec": 0,
    "handlerIdlePct": 100,
    "networkIdlePct": 36
   }
  ],
  "perfSummary": "4000000 records sent, 1092001.092001 records/sec (104.14 MB/sec), 126.45 ms avg latency, 417.00 ms max latency, 90 ms 50th, 377 ms 95th, 410 ms 99th, 415 ms 99.9th.",
  "producerMetrics": [
   {
    "group": "producer-metrics",
    "name": "batch-size-avg",
    "value": 15088.165
   },
   {
    "group": "producer-metrics",
    "name": "buffer-available-bytes",
    "value": 33554432
   },
   {
    "group": "producer-metrics",
    "name": "bufferpool-wait-ratio",
    "value": 0.004
   },
   {
    "group": "producer-metrics",
    "name": "record-error-rate",
    "value": 0
   },
   {
    "group": "producer-metrics",
    "name": "record-retry-rate",
    "value": 0
   },
   {
    "group": "producer-metrics",
    "name": "record-send-rate",
    "value": 119835.825
   },
   {
    "group": "producer-metrics",
    "name": "records-per-request-avg",
    "value": 325.336
   },
   {
    "group": "producer-metrics",
    "name": "request-latency-avg",
    "value": 1.305
   },
   {
    "group": "producer-metrics",
    "name": "request-latency-max",
    "value": 40
   }
  ],
  "produceTimes": {
   "cmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce --object-name kafka.network:type=RequestMetrics,name=RequestQueueTimeMs,request=Produce --object-name kafka.network:type=RequestMetrics,name=LocalTimeMs,request=Produce --object-name kafka.network:type=RequestMetrics,name=RemoteTimeMs,request=Produce --object-name kafka.network:type=RequestMetrics,name=ResponseSendTimeMs,request=Produce --attributes Count,Mean,99thPercentile --report-format properties --one-time true",
   "out": "time=1792303388474\nkafka.network:type=RequestMetrics,name=LocalTimeMs,request=Produce:99thPercentile=1.0\nkafka.network:type=RequestMetrics,name=LocalTimeMs,request=Produce:Count=12295\nkafka.network:type=RequestMetrics,name=LocalTimeMs,request=Produce:Mean=0.0428629524196828\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=Produce:99thPercentile=0.0\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=Produce:Count=12295\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=Produce:Mean=0.0\nkafka.network:type=RequestMetrics,name=RequestQueueTimeMs,request=Produce:99thPercentile=0.0\nkafka.network:type=RequestMetrics,name=RequestQueueTimeMs,request=Produce:Count=12295\nkafka.network:type=RequestMetrics,name=RequestQueueTimeMs,request=Produce:Mean=0.0023586823912159416\nkafka.network:type=RequestMetrics,name=ResponseSendTimeMs,request=Produce:99thPercentile=0.0\nkafka.network:type=RequestMetrics,name=ResponseSendTimeMs,request=Produce:Count=12295\nkafka.network:type=RequestMetrics,name=ResponseSendTimeMs,request=Produce:Mean=8.133387555917039E-5\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce:99thPercentile=1.0\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce:Count=12295\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=Produce:Mean=0.07206181374542497\nTrying to connect to JMX url: service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi"
  },
  "flush": {
   "cmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.log:type=LogFlushStats,name=LogFlushRateAndTimeMs --attributes Count,Mean --report-format properties --one-time true",
   "out": "time=1792303389255\nkafka.log:type=LogFlushStats,name=LogFlushRateAndTimeMs:Count=43\nkafka.log:type=LogFlushStats,name=LogFlushRateAndTimeMs:Mean=8.498804697674418\nTrying to connect to JMX url: service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi"
  },
  "consumerPerf": {
   "cmd": "kafka-consumer-perf-test.sh --bootstrap-server localhost:9092 --topic orders --num-records 4000000 --group perf-readers --print-metrics",
   "out": "start.time, end.time, data.consumed.in.MB, MB.sec, data.consumed.in.nMsg, nMsg.sec, rebalance.time.ms, fetch.time.ms, fetch.MB.sec, fetch.nMsg.sec\n2026-10-18 06:03:10:311, 2026-10-18 06:03:11:832, 381.4697, 250.8019, 4000000, 2629848.7837, 583, 938, 406.6841, 4264392.3241"
  },
  "consumerMetrics": [
   {
    "group": "consumer-coordinator-metrics",
    "name": "commit-latency-avg",
    "value": null
   },
   {
    "group": "consumer-coordinator-metrics",
    "name": "commit-rate",
    "value": 0
   },
   {
    "group": "consumer-coordinator-metrics",
    "name": "rebalance-latency-avg",
    "value": 316
   },
   {
    "group": "consumer-coordinator-metrics",
    "name": "rebalance-total",
    "value": 1
   },
   {
    "group": "consumer-fetch-manager-metrics",
    "name": "fetch-latency-avg",
    "value": 2.699
   },
   {
    "group": "consumer-fetch-manager-metrics",
    "name": "fetch-rate",
    "value": 4.628
   },
   {
    "group": "consumer-fetch-manager-metrics",
    "name": "fetch-size-avg",
    "value": 3064490.818
   },
   {
    "group": "consumer-fetch-manager-metrics",
    "name": "records-consumed-rate",
    "value": 129638.632
   },
   {
    "group": "consumer-fetch-manager-metrics",
    "name": "records-lag-max",
    "value": 1346225
   },
   {
    "group": "consumer-metrics",
    "name": "last-poll-seconds-ago",
    "value": 0
   }
  ],
  "fetchTimes": {
   "cmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer --object-name kafka.network:type=RequestMetrics,name=RemoteTimeMs,request=FetchConsumer --attributes Count,Mean,99thPercentile --report-format properties --one-time true",
   "out": "time=1792303393079\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=FetchConsumer:99thPercentile=271.079999999996\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=FetchConsumer:Count=145\nkafka.network:type=RequestMetrics,name=RemoteTimeMs,request=FetchConsumer:Mean=3.462068965517241\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer:99thPercentile=278.21999999999605\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer:Count=145\nkafka.network:type=RequestMetrics,name=TotalTimeMs,request=FetchConsumer:Mean=5.813793103448276\nTrying to connect to JMX url: service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi"
  },
  "healthAfter": {
   "cmd": "kafka-jmx.sh --jmx-url service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi --object-name kafka.server:type=ReplicaManager,name=UnderReplicatedPartitions --object-name kafka.server:type=ReplicaManager,name=UnderMinIsrPartitionCount --object-name kafka.controller:type=KafkaController,name=OfflinePartitionsCount --object-name kafka.controller:type=KafkaController,name=ActiveControllerCount --report-format properties --one-time true",
   "out": "time=1792303393806\nkafka.controller:type=KafkaController,name=ActiveControllerCount:Value=1\nkafka.controller:type=KafkaController,name=OfflinePartitionsCount:Value=0\nkafka.server:type=ReplicaManager,name=UnderMinIsrPartitionCount:Value=0\nkafka.server:type=ReplicaManager,name=UnderReplicatedPartitions:Value=0\nTrying to connect to JMX url: service:jmx:rmi:///jndi/rmi://localhost:9999/jmxrmi"
  },
  "lagCommands": {
   "producer": "kafka-producer-perf-test.sh --topic payments --num-records 90000 --record-size 100 --throughput 2000 --producer-props bootstrap.servers=localhost:9092",
   "consumer": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --group reports --command-property client.id=reports-1 --command-property auto.commit.interval.ms=1000 > /dev/null",
   "describe": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group reports"
  },
  "lag": {
   "rate": 2000,
   "series": [
    {
     "t": 1.4,
     "lag": 514,
     "logEnd": 514
    },
    {
     "t": 2.7,
     "lag": 1038,
     "logEnd": 3205
    },
    {
     "t": 4.1,
     "lag": 1808,
     "logEnd": 5971
    },
    {
     "t": 5.5,
     "lag": 494,
     "logEnd": 8667
    },
    {
     "t": 6.8,
     "lag": 1161,
     "logEnd": 11325
    },
    {
     "t": 8.2,
     "lag": 1864,
     "logEnd": 14031
    },
    {
     "t": 9.5,
     "lag": 530,
     "logEnd": 16701
    },
    {
     "t": 10.9,
     "lag": 1253,
     "logEnd": 19431
    },
    {
     "t": 12.3,
     "lag": 2028,
     "logEnd": 22203
    },
    {
     "t": 13.9,
     "lag": 2610,
     "logEnd": 25621
    },
    {
     "t": 15.3,
     "lag": 5236,
     "logEnd": 28247
    },
    {
     "t": 16.6,
     "lag": 7898,
     "logEnd": 30909
    },
    {
     "t": 17.9,
     "lag": 10528,
     "logEnd": 33539
    },
    {
     "t": 19.2,
     "lag": 13166,
     "logEnd": 36177
    },
    {
     "t": 20.5,
     "lag": 15750,
     "logEnd": 38761
    },
    {
     "t": 21.8,
     "lag": 18334,
     "logEnd": 41345
    },
    {
     "t": 23.1,
     "lag": 20914,
     "logEnd": 43925
    },
    {
     "t": 24.4,
     "lag": 23468,
     "logEnd": 46479
    },
    {
     "t": 25.7,
     "lag": 26050,
     "logEnd": 49061
    },
    {
     "t": 27,
     "lag": 28688,
     "logEnd": 51699
    },
    {
     "t": 28.3,
     "lag": 31296,
     "logEnd": 54307
    },
    {
     "t": 29.7,
     "lag": 34132,
     "logEnd": 57143
    },
    {
     "t": 31,
     "lag": 838,
     "logEnd": 59819
    },
    {
     "t": 32.4,
     "lag": 1490,
     "logEnd": 62471
    },
    {
     "t": 33.7,
     "lag": 162,
     "logEnd": 65145
    },
    {
     "t": 35.1,
     "lag": 836,
     "logEnd": 67823
    },
    {
     "t": 36.4,
     "lag": 1540,
     "logEnd": 70521
    },
    {
     "t": 37.7,
     "lag": 136,
     "logEnd": 73121
    },
    {
     "t": 39,
     "lag": 772,
     "logEnd": 75755
    },
    {
     "t": 40.3,
     "lag": 1435,
     "logEnd": 78424
    },
    {
     "t": 41.6,
     "lag": 2018,
     "logEnd": 80999
    },
    {
     "t": 43,
     "lag": 661,
     "logEnd": 83648
    },
    {
     "t": 44.3,
     "lag": 1306,
     "logEnd": 86299
    },
    {
     "t": 45.6,
     "lag": 1947,
     "logEnd": 88936
    },
    {
     "t": 47,
     "lag": 0,
     "logEnd": 90000
    }
   ],
   "events": [
    {
     "t": 0,
     "label": "producer starts: 2000 records/s"
    },
    {
     "t": 12.6,
     "label": "consumer stops"
    },
    {
     "t": 28.3,
     "label": "consumer restarts"
    },
    {
     "t": 47,
     "label": "producer ends"
    }
   ],
   "atMax": {
    "t": 29.7,
    "cmd": "kafka-consumer-groups.sh --bootstrap-server localhost:9092 --describe --group reports",
    "out": "GROUP           TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID                                    HOST            CLIENT-ID\nreports         payments        0          7314            19248           11934           reports-1-8aacce98… /127.0.0.1      reports-1\nreports         payments        1          7922            19221           11299           reports-1-8aacce98… /127.0.0.1      reports-1\nreports         payments        2          7775            18674           10899           reports-1-8aacce98… /127.0.0.1      reports-1"
   }
  }
 }
} as const
