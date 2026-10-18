// Recorded by tools/kafka-capture/capture-compaction.mjs against docker.io/apache/kafka:4.3.1 — do not edit by hand.
// Ports are shown as the standard 9092; times are ms since the run started.
export const COMPACTION = {
  "image": "docker.io/apache/kafka:4.3.1",
  "version": "4.3.1",
  "deleteRetentionMs": 5000,
  "segmentMs": 2000,
  "create": {
    "label": "one partition; a new segment every 2 s (on the next write)",
    "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic profiles --partitions 1 --replication-factor 1 --config segment.ms=2000",
    "out": "Created topic profiles."
  },
  "rounds": [
    {
      "label": "round 1",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL",
      "out": "> user-1:Ann\n> user-2:Ben\n> user-3:Cat"
    },
    {
      "label": "round 2: NULL is a tombstone (a null value)",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL",
      "out": "> user-1:Anna\n> user-2:NULL\n> user-4:Dan"
    },
    {
      "label": "round 3",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL",
      "out": "> user-1:Annie\n> user-5:Eve"
    }
  ],
  "before": {
    "ls": {
      "label": "three segments; the last is active",
      "cmd": "ls -l /tmp/kafka-logs/profiles-0",
      "out": "total 36\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser      109 Oct 18 16:24 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000003.index\n-rw-r--r-- 1 appuser appuser      107 Oct 18 16:24 00000000000000000003.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 16:24 00000000000000000003.snapshot\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000003.timeindex\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 16:24 00000000000000000006.index\n-rw-r--r-- 1 appuser appuser       95 Oct 18 16:24 00000000000000000006.log\n-rw-r--r-- 1 appuser appuser      102 Oct 18 16:24 00000000000000000006.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 16:24 00000000000000000006.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 16:24 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 16:24 partition.metadata"
    },
    "read": {
      "label": "a consumer reads every record",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic profiles --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true",
      "out": "Offset:0\tuser-1\tAnn\nOffset:1\tuser-2\tBen\nOffset:2\tuser-3\tCat\nOffset:3\tuser-1\tAnna\nOffset:4\tuser-2\tnull\nOffset:5\tuser-4\tDan\nOffset:6\tuser-1\tAnnie\nOffset:7\tuser-5\tEve"
    },
    "dumps": [
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000000.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000000.log\nbatch baseOffset: 0 lastOffset: 2 count: 3 deleteHorizonMs: OptionalLong.empty\n  | offset: 0 key: user-1 payload: Ann\n  | offset: 1 key: user-2 payload: Ben\n  | offset: 2 key: user-3 payload: Cat"
      },
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000003.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000003.log\nbatch baseOffset: 3 lastOffset: 5 count: 3 deleteHorizonMs: OptionalLong.empty\n  | offset: 3 key: user-1 payload: Anna\n  | offset: 4 key: user-2\n  | offset: 5 key: user-4 payload: Dan"
      },
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000006.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000006.log\nbatch baseOffset: 6 lastOffset: 7 count: 2 deleteHorizonMs: OptionalLong.empty\n  | offset: 6 key: user-1 payload: Annie\n  | offset: 7 key: user-5 payload: Eve"
      }
    ]
  },
  "alter": {
    "label": "turn on compaction; clean as soon as anything is dirty; keep tombstones 5 s after their first cleaning",
    "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type topics --entity-name profiles --add-config cleanup.policy=compact,min.cleanable.dirty.ratio=0.01,delete.retention.ms=5000",
    "out": "Completed updating config for topic profiles."
  },
  "first": {
    "checkpoint": {
      "label": "the cleaner checkpoint: cleaned up to offset 6 (the active segment)",
      "cmd": "cat /tmp/kafka-logs/cleaner-offset-checkpoint",
      "out": "0\n1\nprofiles 0 6"
    },
    "ls": {
      "label": "after the first cleaning",
      "cmd": "ls -l /tmp/kafka-logs/profiles-0",
      "out": "total 44\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000000.index.deleted\n-rw-r--r-- 1 appuser appuser      190 Oct 18 16:24 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser      109 Oct 18 16:24 00000000000000000000.log.deleted\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000000.timeindex.deleted\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000003.index.deleted\n-rw-r--r-- 1 appuser appuser      107 Oct 18 16:24 00000000000000000003.log.deleted\n-rw-r--r-- 1 appuser appuser       56 Oct 18 16:24 00000000000000000003.snapshot.deleted\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000003.timeindex.deleted\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 16:24 00000000000000000006.index\n-rw-r--r-- 1 appuser appuser       95 Oct 18 16:24 00000000000000000006.log\n-rw-r--r-- 1 appuser appuser      102 Oct 18 16:24 00000000000000000006.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 16:24 00000000000000000006.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 16:24 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 16:24 partition.metadata"
    },
    "read": {
      "label": "what a consumer reads now",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic profiles --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true",
      "out": "Offset:2\tuser-3\tCat\nOffset:3\tuser-1\tAnna\nOffset:4\tuser-2\tnull\nOffset:5\tuser-4\tDan\nOffset:6\tuser-1\tAnnie\nOffset:7\tuser-5\tEve"
    },
    "dumps": [
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000000.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000000.log\nbatch baseOffset: 0 lastOffset: 2 count: 1 deleteHorizonMs: OptionalLong.empty\n  | offset: 2 key: user-3 payload: Cat\nbatch baseOffset: 3 lastOffset: 5 count: 3 deleteHorizonMs: OptionalLong[1792340681503]\n  | offset: 3 key: user-1 payload: Anna\n  | offset: 4 key: user-2\n  | offset: 5 key: user-4 payload: Dan"
      },
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000006.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000006.log\nbatch baseOffset: 6 lastOffset: 7 count: 2 deleteHorizonMs: OptionalLong.empty\n  | offset: 6 key: user-1 payload: Annie\n  | offset: 7 key: user-5 payload: Eve"
      }
    ]
  },
  "later": {
    "label": "one more update; it rolls the active segment, which makes offsets 6–7 dirty",
    "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic profiles --reader-property parse.key=true --reader-property key.separator=: --reader-property null.marker=NULL",
    "out": "> user-3:Cathy"
  },
  "second": {
    "checkpoint": {
      "label": "cleaned up to offset 8",
      "cmd": "cat /tmp/kafka-logs/cleaner-offset-checkpoint",
      "out": "0\n1\nprofiles 0 8"
    },
    "ls": {
      "label": "after the second cleaning",
      "cmd": "ls -l /tmp/kafka-logs/profiles-0",
      "out": "total 56\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000000.index.deleted\n-rw-r--r-- 1 appuser appuser      251 Oct 18 16:24 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser      190 Oct 18 16:24 00000000000000000000.log.deleted\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000000.timeindex.deleted\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000003.index.deleted\n-rw-r--r-- 1 appuser appuser      107 Oct 18 16:24 00000000000000000003.log.deleted\n-rw-r--r-- 1 appuser appuser       56 Oct 18 16:24 00000000000000000003.snapshot.deleted\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000003.timeindex.deleted\n-rw-r--r-- 1 appuser appuser        0 Oct 18 16:24 00000000000000000006.index.deleted\n-rw-r--r-- 1 appuser appuser       95 Oct 18 16:24 00000000000000000006.log.deleted\n-rw-r--r-- 1 appuser appuser      102 Oct 18 16:24 00000000000000000006.snapshot.deleted\n-rw-r--r-- 1 appuser appuser       12 Oct 18 16:24 00000000000000000006.timeindex.deleted\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 16:24 00000000000000000008.index\n-rw-r--r-- 1 appuser appuser       79 Oct 18 16:24 00000000000000000008.log\n-rw-r--r-- 1 appuser appuser      148 Oct 18 16:24 00000000000000000008.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 16:24 00000000000000000008.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 16:24 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 16:24 partition.metadata"
    },
    "read": {
      "label": "what a consumer reads now",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic profiles --from-beginning --timeout-ms 4000 --formatter-property print.offset=true --formatter-property print.key=true --formatter-property print.value=true",
      "out": "Offset:2\tuser-3\tCat\nOffset:5\tuser-4\tDan\nOffset:6\tuser-1\tAnnie\nOffset:7\tuser-5\tEve\nOffset:8\tuser-3\tCathy"
    },
    "dumps": [
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000000.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000000.log\nbatch baseOffset: 0 lastOffset: 2 count: 1 deleteHorizonMs: OptionalLong.empty\n  | offset: 2 key: user-3 payload: Cat\nbatch baseOffset: 3 lastOffset: 5 count: 1 deleteHorizonMs: OptionalLong[1792340681503]\n  | offset: 5 key: user-4 payload: Dan\nbatch baseOffset: 6 lastOffset: 7 count: 2 deleteHorizonMs: OptionalLong.empty\n  | offset: 6 key: user-1 payload: Annie\n  | offset: 7 key: user-5 payload: Eve"
      },
      {
        "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/profiles-0/00000000000000000008.log --print-data-log",
        "out": "Dumping /tmp/kafka-logs/profiles-0/00000000000000000008.log\nbatch baseOffset: 8 lastOffset: 8 count: 1 deleteHorizonMs: OptionalLong.empty\n  | offset: 8 key: user-3 payload: Cathy"
      }
    ]
  },
  "cleanerLog": "INFO Starting the log cleaner\nINFO [kafka-log-cleaner-thread-0]: Starting (org.apache.kafka.storage.internals.log.LogCleaner$CleanerThread)\nINFO Cleaner 0: Beginning cleaning of log profiles-0\nINFO Cleaner 0: Building offset map for profiles-0...\nINFO Cleaner 0: Building offset map for log profiles-0 for 2 segments in offset range [0, 6).\nINFO Cleaner 0: Offset map for log profiles-0 complete.\nINFO Cleaner 0: Cleaning log profiles-0 (cleaning prior to Sun Oct 18 16:24:18 GMT 2026, discarding tombstones prior to upper bound deletion horizon Thu Jan 01 00:00:00 GMT 1970)...\nINFO Cleaner 0: Cleaning LogSegment(baseOffset=0, size=109, lastModifiedTime=1792340654764, largestRecordTimestamp=1792340654651) in log profiles-0 into 0 with an upper bound deletion horizon 0 computed from the segment last modified time of 1792340654764,retaining deletes.\nINFO Cleaner 0: Cleaning LogSegment(baseOffset=3, size=107, lastModifiedTime=1792340658509, largestRecordTimestamp=1792340658482) in log profiles-0 into 0 with an upper bound deletion horizon 0 computed from the segment last modified time of 1792340658509,retaining deletes.\nINFO Cleaner 0: Swapping in cleaned segment LogSegment(baseOffset=0, size=190, lastModifiedTime=1792340658509, largestRecordTimestamp=1792340658482) for segment(s) [LogSegment(baseOffset=0, size=109, lastModifiedTime=1792340654764, largestRecordTimestamp=1792340654651), LogSegment(baseOffset=3, size=107, lastModifiedTime=1792340658509, largestRecordTimestamp=1792340658482)] in log Log(dir=/tmp/kafka-logs/profiles-0, topicId=WIFEqf…, topic=profiles, partition=0, highWatermark=8, lastStableOffset=8, logStartOffset=0, logEndOffset=8)\nINFO [kafka-log-cleaner-thread-0]: \n\tLog cleaner thread 0 cleaned log profiles-0 (dirty section = [0, 6])\n\t0.0 MB of log processed in 0.0 seconds (0.0 MB/sec).\n\tIndexed 0.0 MB in 0.0 seconds (0.0 Mb/sec, 48.6% of total time)\n\tBuffer utilization: 0.0%\n\tCleaned 0.0 MB in 0.0 seconds (0.0 Mb/sec, 51.4% of total time)\n\tStart size: 0.0 MB (6 messages)\n\tEnd size: 0.0 MB (4 messages)\n\t12.0% size reduction (33.3% fewer messages)\n (org.apache.kafka.storage.internals.log.LogCleaner$CleanerThread)\nINFO Cleaner 0: Beginning cleaning of log profiles-0\nINFO Cleaner 0: Building offset map for profiles-0...\nINFO Cleaner 0: Building offset map for log profiles-0 for 1 segments in offset range [6, 8).\nINFO Cleaner 0: Offset map for log profiles-0 complete.\nINFO Cleaner 0: Cleaning log profiles-0 (cleaning prior to Sun Oct 18 16:24:22 GMT 2026, discarding tombstones prior to upper bound deletion horizon Sun Oct 18 16:24:13 GMT 2026)...\nINFO Cleaner 0: Cleaning LogSegment(baseOffset=0, size=190, lastModifiedTime=1792340658509, largestRecordTimestamp=1792340658482) in log profiles-0 into 0 with an upper bound deletion horizon 1792340653509 computed from the segment last modified time of 1792340658509,retaining deletes.\nINFO Cleaner 0: Cleaning LogSegment(baseOffset=6, size=95, lastModifiedTime=1792340662228, largestRecordTimestamp=1792340662209) in log profiles-0 into 0 with an upper bound deletion horizon 1792340653509 computed from the segment last modified time of 1792340662228,retaining deletes.\nINFO Cleaner 0: Swapping in cleaned segment LogSegment(baseOffset=0, size=251, lastModifiedTime=1792340662228, largestRecordTimestamp=1792340662209) for segment(s) [LogSegment(baseOffset=0, size=190, lastModifiedTime=1792340658509, largestRecordTimestamp=1792340658482), LogSegment(baseOffset=6, size=95, lastModifiedTime=1792340662228, largestRecordTimestamp=1792340662209)] in log Log(dir=/tmp/kafka-logs/profiles-0, topicId=WIFEqf…, topic=profiles, partition=0, highWatermark=9, lastStableOffset=9, logStartOffset=0, logEndOffset=9)\nINFO [kafka-log-cleaner-thread-0]: \n\tLog cleaner thread 0 cleaned log profiles-0 (dirty section = [6, 8])\n\t0.0 MB of log processed in 0.0 seconds (0.0 MB/sec).\n\tIndexed 0.0 MB in 0.0 seconds (0.0 Mb/sec, 31.8% of total time)\n\tBuffer utilization: 0.0%\n\tCleaned 0.0 MB in 0.0 seconds (0.0 Mb/sec, 68.2% of total time)\n\tStart size: 0.0 MB (6 messages)\n\tEnd size: 0.0 MB (4 messages)\n\t11.9% size reduction (33.3% fewer messages)\n (org.apache.kafka.storage.internals.log.LogCleaner$CleanerThread)",
  "times": {
    "round1": 5205,
    "round2": 9027,
    "round3": 12768,
    "clean1": 28009,
    "round4": 46887,
    "clean2": 48187
  }
} as const
