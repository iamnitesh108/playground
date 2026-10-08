// Real output captured while testing this module's stack (Kafka 4.3.1, Debezium 3.7.0, Postgres 18).
// Long lines are trimmed with "…".

export const CONNECT_ROOT = `{"version":"4.3.1","commit":"26b251a451ce941d","kafka_cluster_id":"4L6g3nShT-eMCtK--X86sw"}`

export const CONNECTOR_PLUGINS = `source io.debezium.connector.postgresql.PostgresConnector 3.7.0.Final
source org.apache.kafka.connect.mirror.MirrorCheckpointConnector 4.3.1
source org.apache.kafka.connect.mirror.MirrorHeartbeatConnector 4.3.1
source org.apache.kafka.connect.mirror.MirrorSourceConnector 4.3.1`

export const CONNECT_TOPICS = `Topic: connect-status    PartitionCount: 5   ReplicationFactor: 1  Configs: cleanup.policy=compact,…
Topic: connect-configs   PartitionCount: 1   ReplicationFactor: 1  Configs: cleanup.policy=compact,…
Topic: connect-offsets   PartitionCount: 25  ReplicationFactor: 1  Configs: cleanup.policy=compact,…`

export const CONNECTOR_STATUS = `{"name":"orders-cdc","connector":"RUNNING","tasks":[{"id":0,"state":"RUNNING","worker_id":"connect:8083"}]}`

export const CDC_RECORDS = `Offset:0 | {"id":1} | {"before":null,"after":{"id":1,"customer":"alice","amount":"120.50","status":"NEW","created_at":"2026-10-08T08:52:19.659212Z"},"source":{"version":"3.7.0.Final","connector":"postgresql","name":"shop","snapshot":"false","db":"shop","schema":"public","table":"orders","txId":771,"lsn":29408640,…},"transaction":null,"op":"c","ts_ms":1791449539800,…}
Offset:1 | {"id":2} | {"before":null,"after":{"id":2,"customer":"bob","amount":"75.00","status":"NEW",…},…,"op":"c",…}
Offset:2 | {"id":1} | {"before":{"id":1,…,"status":"NEW",…},"after":{"id":1,…,"status":"PAID",…},…,"op":"u",…}
Offset:3 | {"id":2} | {"before":{"id":2,"customer":"bob","amount":"75.00","status":"NEW",…},"after":null,…,"op":"d",…}
Offset:4 | {"id":2} | null`

export const UNWRAPPED_RECORDS = `{"id":1} | {"id":1,"customer":"alice","amount":"120.50","status":"PAID","created_at":"2026-10-08T08:52:19.659212Z","__op":"r","__source_ts_ms":1791449693257}
{"id":3} | {"id":3,"customer":"carol","amount":"42.00","status":"NEW","created_at":"2026-10-08T08:54:59.245989Z","__op":"c","__source_ts_ms":1791449699246}
{"id":3} | null`

export const PRODUCER_OUTPUT = `sent key=order-2 -> payments-0 @ offset 0
sent key=order-3 -> payments-0 @ offset 1
sent key=order-2 -> payments-0 @ offset 2
sent key=order-3 -> payments-0 @ offset 3
sent key=order-1 -> payments-1 @ offset 0
sent key=order-1 -> payments-1 @ offset 1`

export const CONSUMER_OUTPUT = `partition 0 offset 0 key=order-2 value={"orderId":"order-2","amount":10,"status":"PAID"}
partition 0 offset 1 key=order-3 value={"orderId":"order-3","amount":20,"status":"PAID"}
partition 0 offset 2 key=order-2 value={"orderId":"order-2","amount":40,"status":"PAID"}
partition 0 offset 3 key=order-3 value={"orderId":"order-3","amount":50,"status":"PAID"}
partition 1 offset 0 key=order-1 value={"orderId":"order-1","amount":30,"status":"PAID"}
partition 1 offset 1 key=order-1 value={"orderId":"order-1","amount":60,"status":"PAID"}`

export const GROUP_DESCRIBE = `Consumer group 'billing' has no active members.
GROUP    TOPIC     PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG  CONSUMER-ID  HOST  CLIENT-ID
billing  payments  0          4               4               0    -            -     -
billing  payments  1          2               2               0    -            -     -
billing  payments  2          0               0               0    -            -     -`

export const CDC_CONSUMER_OUTPUT = `op=c id=1 -> 1 orders in memory
op=c id=2 -> 2 orders in memory
op=u id=1 -> 2 orders in memory
op=d id=2 -> 1 orders in memory
tombstone for key {"id":2}`

export const SLOTS_AFTER_DELETE = ` slot_name      | plugin   | active | behind
 shop_slot      | pgoutput | t      | 320 bytes
 shop_flat_slot | pgoutput | f      | 320 bytes     ← its connector was deleted; the slot stayed`

export const KAFKA_STARTED = `Formatting dynamic metadata voter directory /var/lib/kafka/data with metadata.version 4.3-IV0.
…
INFO [KafkaRaftServer nodeId=1] Kafka Server started (kafka.server.KafkaRaftServer)`

// ── Ubuntu 24.04 + systemd (Kafka 4.3.1, OpenJDK 21, PostgreSQL 16) ──

export const VERIFY_DOWNLOAD = `sha512 OK
gpg: Good signature from "Bill Bejeck (CODE SIGNING KEY) <bbejeck@apache.org>" [unknown]`

export const FORMAT_STANDALONE = `Formatting dynamic metadata voter directory /var/lib/kafka/data with metadata.version 4.3-IV0.`

export const FORMATTED_DIR = `drwxrwxr-x kafka kafka __cluster_metadata-0
-rw-rw-r-- kafka kafka bootstrap.checkpoint
-rw-rw-r-- kafka kafka meta.properties`

export const SYSTEMCTL_STATUS = `● kafka.service - Apache Kafka (KRaft broker and controller)
     Loaded: loaded (/etc/systemd/system/kafka.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-10-08 12:09:30 UTC; 9s ago
       Docs: https://kafka.apache.org/documentation/
   Main PID: 3434 (java)`

export const OPEN_FILES = `Max open files            100000               100000               files`

export const LOG_FILES = `controller.log  kafka-authorizer.log  kafka-request.log  kafkaServer-gc.log
log-cleaner.log  server.log  state-change.log`

export const GRACEFUL_STOP = `Result=success
ExecMainStatus=143`

export const NO_LOG_DIR = `mkdir: cannot create directory '/opt/kafka/bin/../logs': Permission denied
[0.000s][error][logging] Error opening log file '/opt/kafka/bin/../logs/kafkaServer-gc.log': No such file or directory
Invalid -Xlog option '-Xlog:gc*:file=/opt/kafka/bin/../logs/kafkaServer-gc.log:time,tags:filecount=10,filesize=100M', see error log for details.`

export const FORMATTED_AS_ROOT = `drwxr-xr-x root root __cluster_metadata-0
… AccessDeniedException: /var/lib/kafka/data/__cluster_metadata-0/leader-epoch-checkpoint`

export const SECRET_PLACEHOLDER = `$ curl -s localhost:8083/connectors/orders-cdc/config | jq -r '."database.password"'
\${file:/etc/kafka/connect-secrets.properties:password}`

// ── Docker ──

export const COMPOSE_HEALTHY = `kafka-stack-kafka-1      Up 28 seconds (healthy)
kafka-stack-postgres-1   Up 28 seconds (healthy)
kafka-stack-connect-1    Up 15 seconds (healthy)`

// ── 3 controllers + 3 brokers ──

export const QUORUM_STATUS = `LeaderId:               1
CurrentVoters:          [{"id": 1, "endpoints": ["CONTROLLER://controller-1:9093"]}, {"id": 2, …}, {"id": 3, …}]
CurrentObservers:       [{"id": 5, …}, {"id": 6, …}, {"id": 4, …}]`

export const RF3_TOPIC = `Topic: payments  PartitionCount: 6  ReplicationFactor: 3  Configs: min.insync.replicas=2
  Partition: 0  Leader: 6  Replicas: 6,4,5  Isr: 6,4,5
  Partition: 1  Leader: 4  Replicas: 4,5,6  Isr: 4,5,6
  Partition: 2  Leader: 5  Replicas: 5,6,4  Isr: 5,6,4
  …`

export const RF1_BY_MISTAKE = `Topic: payments  PartitionCount: 3  ReplicationFactor: 1  Configs: min.insync.replicas=1
  Partition: 0  Leader: none  Replicas: 6  Isr:        ← broker 6 stopped: partition offline`

export const FAILURE_TEST = `one broker stopped  → acks=all write succeeds
two brokers stopped → ERROR … NotEnoughReplicasException   (nothing written)`
