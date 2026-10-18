// Recorded by tools/kafka-capture/capture-segments.mjs against docker.io/apache/kafka:4.3.1 — do not edit by hand.
// Ports are shown as the standard 9092.
export const SEGMENTS = {
  "image": "docker.io/apache/kafka:4.3.1",
  "version": "4.3.1",
  "dir": {
    "create": {
      "label": "one partition, segments of 1 MiB (the smallest allowed) instead of 1 GiB",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic payments --partitions 1 --replication-factor 1 --config segment.bytes=1048576",
      "out": "Created topic payments."
    },
    "tooSmall": {
      "label": "smaller is refused",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic tiny --partitions 1 --replication-factor 1 --config segment.bytes=4096",
      "out": "Error while executing topic command : Invalid value 4096 for configuration segment.bytes: Value must be at least 1048576"
    },
    "empty": {
      "label": "right after creating it",
      "cmd": "ls -l /tmp/kafka-logs/payments-0",
      "out": "total 8\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser        0 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "write": {
      "label": "3000 records of 1000 bytes",
      "cmd": "kafka-producer-perf-test.sh --bootstrap-server localhost:9092 --topic payments --num-records 3000 --record-size 1000 --throughput -1 --command-property linger.ms=5",
      "out": "3000 records sent, 5859.375000 records/sec (5.59 MB/sec), 211.56 ms avg latency, 319.00 ms max latency, 219 ms 50th, 270 ms 95th, 273 ms 99th, 274 ms 99.9th."
    },
    "full": {
      "label": "after writing ~3 MB",
      "cmd": "ls -l /tmp/kafka-logs/payments-0",
      "out": "total 3016\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser      192 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000001024.index\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000001024.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000001024.snapshot\n-rw-r--r-- 1 appuser appuser      156 Oct 18 15:28 00000000000000001024.timeindex\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000002048.index\n-rw-r--r-- 1 appuser appuser   964228 Oct 18 15:28 00000000000000002048.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000002048.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000002048.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "offsets": [
      {
        "label": "earliest offset still stored (log start offset)",
        "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments --time -2",
        "out": "payments:0:0"
      },
      {
        "label": "next offset to be written (log end offset)",
        "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments --time -1",
        "out": "payments:0:3000"
      }
    ]
  },
  "files": {
    "log": {
      "label": "the batches in the first segment (fields shortened)",
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/payments-0/00000000000000000000.log",
      "out": "Dumping /tmp/kafka-logs/payments-0/00000000000000000000.log\nLog starting offset: 0\nbaseOffset: 0 lastOffset: 15 count: 16 position: 0 CreateTime: 1792337291659 size: 16205\nbaseOffset: 16 lastOffset: 31 count: 16 position: 16205 CreateTime: 1792337291660 size: 16205\nbaseOffset: 32 lastOffset: 47 count: 16 position: 32410 CreateTime: 1792337291661 size: 16205\n… 61 more batches, the last one ends at offset 1023"
    },
    "index": {
      "label": "its offset index: one entry per ~4 KB of log",
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/payments-0/00000000000000000000.index",
      "out": "Dumping /tmp/kafka-logs/payments-0/00000000000000000000.index\noffset: 31 position: 16205\noffset: 47 position: 32410\noffset: 63 position: 48615\noffset: 79 position: 64820\n… 59 more entries"
    },
    "timeindex": {
      "label": "its time index: timestamp → offset",
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/payments-0/00000000000000000000.timeindex",
      "out": "Dumping /tmp/kafka-logs/payments-0/00000000000000000000.timeindex\ntimestamp: 1792337291660 offset: 31\ntimestamp: 1792337291661 offset: 47\ntimestamp: 1792337291662 offset: 63\n…"
    },
    "counts": {
      "batches": 64,
      "entries": 63,
      "indexBytes": 504
    }
  },
  "lookup": {
    "target": 1500,
    "segment": 1024,
    "segments": [
      0,
      1024,
      2048
    ],
    "entry": {
      "offset": 1487,
      "position": 453740
    },
    "scanned": [
      {
        "base": 1472,
        "last": 1487,
        "position": 453740,
        "size": 16205
      },
      {
        "base": 1488,
        "last": 1503,
        "position": 469945,
        "size": 16205
      }
    ],
    "index": {
      "label": "entries of segment 1024 near offset 1500",
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/payments-0/00000000000000001024.index",
      "out": "Dumping /tmp/kafka-logs/payments-0/00000000000000001024.index\n…\noffset: 1471 position: 437535\noffset: 1487 position: 453740\noffset: 1503 position: 469945\noffset: 1519 position: 486150\noffset: 1535 position: 502355\n…"
    },
    "log": {
      "label": "the batches from that position on",
      "cmd": "kafka-dump-log.sh --files /tmp/kafka-logs/payments-0/00000000000000001024.log",
      "out": "Dumping /tmp/kafka-logs/payments-0/00000000000000001024.log\nbaseOffset: 1472 lastOffset: 1487 count: 16 position: 453740 CreateTime: 1792337291683 size: 16205\nbaseOffset: 1488 lastOffset: 1503 count: 16 position: 469945 CreateTime: 1792337291683 size: 16205\n…"
    },
    "read": {
      "label": "a consumer asking for offset 1500",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --partition 0 --offset 1500 --max-messages 2 --formatter-property print.offset=true --formatter-property print.value=false",
      "out": "Offset:1500\nOffset:1501"
    }
  },
  "timeRoll": {
    "create": {
      "label": "segments roll after 10 seconds instead of 7 days",
      "cmd": "kafka-topics.sh --bootstrap-server localhost:9092 --create --topic clicks --partitions 1 --replication-factor 1 --config segment.ms=10000",
      "out": "Created topic clicks."
    },
    "first": {
      "label": "three records",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic clicks",
      "out": "> click-1\n> click-2\n> click-3"
    },
    "ls1": {
      "label": "one segment",
      "cmd": "ls -l /tmp/kafka-logs/clicks-0",
      "out": "total 12\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser      103 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "ls2": {
      "label": "13 seconds later, nothing written in between",
      "cmd": "ls -l /tmp/kafka-logs/clicks-0",
      "out": "total 12\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser      103 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "second": {
      "label": "two more records",
      "cmd": "kafka-console-producer.sh --bootstrap-server localhost:9092 --topic clicks",
      "out": "> click-4\n> click-5"
    },
    "ls3": {
      "label": "the old segment was closed by the write, a new one holds offset 3 onwards",
      "cmd": "ls -l /tmp/kafka-logs/clicks-0",
      "out": "total 24\n-rw-r--r-- 1 appuser appuser        0 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser      103 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser       12 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000000003.index\n-rw-r--r-- 1 appuser appuser       89 Oct 18 15:28 00000000000000000003.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000000003.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000000003.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    }
  },
  "retention": {
    "more": {
      "label": "600 new records: they fill the last segment and roll a new one",
      "cmd": "kafka-producer-perf-test.sh --bootstrap-server localhost:9092 --topic payments --num-records 600 --record-size 1000 --throughput -1 --command-property linger.ms=5",
      "out": "600 records sent, 2459.016393 records/sec (2.35 MB/sec), 25.42 ms avg latency, 209.00 ms max latency, 26 ms 50th, 30 ms 95th, 30 ms 99th, 209 ms 99.9th."
    },
    "before": {
      "label": "the first two segments hold only old records, the third old and new ones",
      "cmd": "ls -l /tmp/kafka-logs/payments-0",
      "out": "total 3624\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000000000.index\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000000000.log\n-rw-r--r-- 1 appuser appuser      192 Oct 18 15:28 00000000000000000000.timeindex\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000001024.index\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000001024.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000001024.snapshot\n-rw-r--r-- 1 appuser appuser      156 Oct 18 15:28 00000000000000001024.timeindex\n-rw-r--r-- 1 appuser appuser      512 Oct 18 15:28 00000000000000002048.index\n-rw-r--r-- 1 appuser appuser  1045253 Oct 18 15:28 00000000000000002048.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000002048.snapshot\n-rw-r--r-- 1 appuser appuser      132 Oct 18 15:28 00000000000000002048.timeindex\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000003080.index\n-rw-r--r-- 1 appuser appuser   526693 Oct 18 15:28 00000000000000003080.log\n-rw-r--r-- 1 appuser appuser      102 Oct 18 15:28 00000000000000003080.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000003080.timeindex\n-rw-r--r-- 1 appuser appuser        8 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "alter": {
      "label": "keep records for 10 seconds (the first 3000 are older than that, the new ones are not)",
      "cmd": "kafka-configs.sh --bootstrap-server localhost:9092 --alter --entity-type topics --entity-name payments --add-config retention.ms=10000",
      "out": "Completed updating config for topic payments."
    },
    "after": {
      "label": "4 seconds later",
      "cmd": "ls -l /tmp/kafka-logs/payments-0",
      "out": "total 3624\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000000000.index.deleted\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000000000.log.deleted\n-rw-r--r-- 1 appuser appuser      192 Oct 18 15:28 00000000000000000000.timeindex.deleted\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000001024.index.deleted\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000001024.log.deleted\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000001024.snapshot.deleted\n-rw-r--r-- 1 appuser appuser      156 Oct 18 15:28 00000000000000001024.timeindex.deleted\n-rw-r--r-- 1 appuser appuser      512 Oct 18 15:28 00000000000000002048.index\n-rw-r--r-- 1 appuser appuser  1045253 Oct 18 15:28 00000000000000002048.log\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000002048.snapshot\n-rw-r--r-- 1 appuser appuser      132 Oct 18 15:28 00000000000000002048.timeindex\n-rw-r--r-- 1 appuser appuser 10485760 Oct 18 15:28 00000000000000003080.index\n-rw-r--r-- 1 appuser appuser   526693 Oct 18 15:28 00000000000000003080.log\n-rw-r--r-- 1 appuser appuser      102 Oct 18 15:28 00000000000000003080.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000003080.timeindex\n-rw-r--r-- 1 appuser appuser       11 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "start": {
      "label": "the log start offset moved",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments --time -2",
      "out": "payments:0:2048"
    },
    "end": {
      "label": "the log end offset did not",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments --time -1",
      "out": "payments:0:3600"
    },
    "read": {
      "label": "reading from the beginning now starts at the new log start offset",
      "cmd": "kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic payments --partition 0 --from-beginning --max-messages 1 --timeout-ms 10000 --formatter-property print.offset=true --formatter-property print.value=false",
      "out": "Offset:2048"
    },
    "allExpired": {
      "label": "12 seconds later every record is older than 10 seconds",
      "cmd": "ls -l /tmp/kafka-logs/payments-0",
      "out": "total 3628\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000000000.index.deleted\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000000000.log.deleted\n-rw-r--r-- 1 appuser appuser      192 Oct 18 15:28 00000000000000000000.timeindex.deleted\n-rw-r--r-- 1 appuser appuser      504 Oct 18 15:28 00000000000000001024.index.deleted\n-rw-r--r-- 1 appuser appuser  1037120 Oct 18 15:28 00000000000000001024.log.deleted\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000001024.snapshot.deleted\n-rw-r--r-- 1 appuser appuser      156 Oct 18 15:28 00000000000000001024.timeindex.deleted\n-rw-r--r-- 1 appuser appuser      512 Oct 18 15:28 00000000000000002048.index.deleted\n-rw-r--r-- 1 appuser appuser  1045253 Oct 18 15:28 00000000000000002048.log.deleted\n-rw-r--r-- 1 appuser appuser       56 Oct 18 15:28 00000000000000002048.snapshot.deleted\n-rw-r--r-- 1 appuser appuser      132 Oct 18 15:28 00000000000000002048.timeindex.deleted\n-rw-r--r-- 1 appuser appuser      256 Oct 18 15:28 00000000000000003080.index.deleted\n-rw-r--r-- 1 appuser appuser   526693 Oct 18 15:28 00000000000000003080.log.deleted\n-rw-r--r-- 1 appuser appuser      102 Oct 18 15:28 00000000000000003080.snapshot.deleted\n-rw-r--r-- 1 appuser appuser      108 Oct 18 15:28 00000000000000003080.timeindex.deleted\n-rw-r--r-- 1 appuser appuser        0 Oct 18 15:28 00000000000000003600.log\n-rw-r--r-- 1 appuser appuser      102 Oct 18 15:28 00000000000000003600.snapshot\n-rw-r--r-- 1 appuser appuser 10485756 Oct 18 15:28 00000000000000003600.timeindex\n-rw-r--r-- 1 appuser appuser       11 Oct 18 15:28 leader-epoch-checkpoint\n-rw-r--r-- 1 appuser appuser       43 Oct 18 15:28 partition.metadata"
    },
    "allStart": {
      "label": "nothing left to read: the log start offset is now the log end offset",
      "cmd": "kafka-get-offsets.sh --bootstrap-server localhost:9092 --topic payments --time -2",
      "out": "payments:0:3600"
    }
  }
} as const
