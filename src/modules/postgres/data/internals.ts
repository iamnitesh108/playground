// Recorded from 18.6 (Debian 18.6-1.pgdg13+2) by tools/postgres-capture/capture-internals.mjs — do not edit by hand.
// Transaction ids, LSNs, oids and timings differ on every run; the behaviour does not.

export const INTERNALS_VERSION = 'PostgreSQL 18.6'

export const INTERNALS = {
 "architecture": {
  "ps": "    PID    PPID CMD\n      1       0 postgres\n     65       1 postgres: io worker 0\n     66       1 postgres: io worker 1\n     67       1 postgres: io worker 2\n     68       1 postgres: checkpointer \n     69       1 postgres: background writer \n     71       1 postgres: walwriter \n     72       1 postgres: autovacuum launcher \n     73       1 postgres: logical replication launcher \n   1658       1 postgres: postgres lab [local] SELECT\n   1659       1 postgres: walsender postgres [local] streaming 0/22D06EE8\n   1664       1 postgres: autovacuum worker lab",
  "activity": [
   {
    "pid": 72,
    "backend_type": "autovacuum launcher",
    "usename": "",
    "state": "",
    "wait": "Activity:AutovacuumMain"
   },
   {
    "pid": 1664,
    "backend_type": "autovacuum worker",
    "usename": "",
    "state": "active",
    "wait": "Timeout:VacuumDelay"
   },
   {
    "pid": 69,
    "backend_type": "background writer",
    "usename": "",
    "state": "",
    "wait": "Activity:BgwriterMain"
   },
   {
    "pid": 68,
    "backend_type": "checkpointer",
    "usename": "",
    "state": "",
    "wait": "Activity:CheckpointerMain"
   },
   {
    "pid": 1658,
    "backend_type": "client backend",
    "usename": "postgres",
    "state": "active",
    "wait": "Timeout:PgSleep"
   },
   {
    "pid": 1666,
    "backend_type": "client backend",
    "usename": "postgres",
    "state": "active",
    "wait": ""
   },
   {
    "pid": 65,
    "backend_type": "io worker",
    "usename": "",
    "state": "",
    "wait": "Activity:IoWorkerMain"
   },
   {
    "pid": 66,
    "backend_type": "io worker",
    "usename": "",
    "state": "",
    "wait": "Activity:IoWorkerMain"
   },
   {
    "pid": 67,
    "backend_type": "io worker",
    "usename": "",
    "state": "",
    "wait": "Activity:IoWorkerMain"
   },
   {
    "pid": 73,
    "backend_type": "logical replication launcher",
    "usename": "postgres",
    "state": "",
    "wait": "Activity:LogicalLauncherMain"
   },
   {
    "pid": 1659,
    "backend_type": "walsender",
    "usename": "postgres",
    "state": "active",
    "wait": "Activity:WalSenderMain"
   },
   {
    "pid": 71,
    "backend_type": "walwriter",
    "usename": "",
    "state": "",
    "wait": "Activity:WalWriterMain"
   }
  ],
  "activityText": "lab=# SELECT pid, backend_type, state, wait_event FROM pg_stat_activity ORDER BY backend_type;\n pid  |         backend_type         | state  |     wait_event      \n------+------------------------------+--------+---------------------\n   72 | autovacuum launcher          |        | AutovacuumMain\n 1664 | autovacuum worker            | active | VacuumDelay\n   69 | background writer            |        | BgwriterMain\n   68 | checkpointer                 |        | CheckpointerMain\n 1658 | client backend               | active | PgSleep\n 1668 | client backend               | active | \n   65 | io worker                    |        | IoWorkerMain\n   66 | io worker                    |        | IoWorkerMain\n   67 | io worker                    |        | IoWorkerMain\n   73 | logical replication launcher |        | LogicalLauncherMain\n 1659 | walsender                    | active | WalSenderMain\n   71 | walwriter                    |        | WalWriterMain\n(12 rows)",
  "settings": [
   {
    "name": "block_size",
    "setting": "8192",
    "unit": null,
    "short_desc": "Shows the size of a disk block."
   },
   {
    "name": "data_checksums",
    "setting": "on",
    "unit": null,
    "short_desc": "Shows whether data checksums are turned on for this cluster."
   },
   {
    "name": "effective_cache_size",
    "setting": "524288",
    "unit": "8kB",
    "short_desc": "Sets the planner's assumption about the total size of the data caches."
   },
   {
    "name": "io_method",
    "setting": "worker",
    "unit": null,
    "short_desc": "Selects the method for executing asynchronous I/O."
   },
   {
    "name": "io_workers",
    "setting": "3",
    "unit": null,
    "short_desc": "Number of IO worker processes, for io_method=worker."
   },
   {
    "name": "maintenance_work_mem",
    "setting": "65536",
    "unit": "kB",
    "short_desc": "Sets the maximum memory to be used for maintenance operations."
   },
   {
    "name": "max_connections",
    "setting": "100",
    "unit": null,
    "short_desc": "Sets the maximum number of concurrent connections."
   },
   {
    "name": "segment_size",
    "setting": "131072",
    "unit": "8kB",
    "short_desc": "Shows the number of pages per disk file."
   },
   {
    "name": "shared_buffers",
    "setting": "16384",
    "unit": "8kB",
    "short_desc": "Sets the number of shared memory buffers used by the server."
   },
   {
    "name": "synchronous_commit",
    "setting": "on",
    "unit": null,
    "short_desc": "Sets the current transaction's synchronization level."
   },
   {
    "name": "wal_buffers",
    "setting": "512",
    "unit": "8kB",
    "short_desc": "Sets the number of disk-page buffers in shared memory for WAL."
   },
   {
    "name": "wal_level",
    "setting": "replica",
    "unit": null,
    "short_desc": "Sets the level of information written to the WAL."
   },
   {
    "name": "wal_segment_size",
    "setting": "16777216",
    "unit": "B",
    "short_desc": "Shows the size of write ahead log segments."
   },
   {
    "name": "work_mem",
    "setting": "4096",
    "unit": "kB",
    "short_desc": "Sets the maximum memory to be used for query workspaces."
   }
  ],
  "files": {
   "dbOid": "16384",
   "path": "base/16384/17347",
   "relfilenode": "17347",
   "databases": "lab=# SELECT oid, datname FROM pg_database ORDER BY oid;\n  oid  |  datname  \n-------+-----------\n     1 | template1\n     4 | template0\n     5 | postgres\n 16384 | lab\n(4 rows)",
   "filepath": "lab=# SELECT pg_relation_filepath('orders'), pg_relation_filepath('orders_pkey');\n pg_relation_filepath | pg_relation_filepath \n----------------------+----------------------\n base/16384/17347     | base/16384/17355\n(1 row)",
   "pgdata": "base/\nglobal/\npg_commit_ts/\npg_dynshmem/\npg_hba.conf\npg_ident.conf\npg_logical/\npg_multixact/\npg_notify/\npg_replslot/\npg_serial/\npg_snapshots/\npg_stat/\npg_stat_tmp/\npg_subtrans/\npg_tblspc/\npg_twophase/\nPG_VERSION\npg_wal/\npg_xact/\npostgresql.auto.conf\npostgresql.conf\npostmaster.opts\npostmaster.pid",
   "relFiles": "5218304 base/16384/17347\n24576 base/16384/17347_fsm\n8192 base/16384/17347_vm\n2260992 base/16384/17355",
   "walFiles": "16777216 000000010000000000000022\n16777216 000000010000000000000023\n16777216 000000010000000000000024\n16777216 000000010000000000000025\n16777216 000000010000000000000026",
   "xactFiles": "8192 0000",
   "sizes": {
    "main": 5218304,
    "fsm": 24576,
    "vm": 8192,
    "pkey": 2260992
   }
  },
  "rewrite": "lab=# EXPLAIN (COSTS OFF) SELECT * FROM paid_orders WHERE id = 42;\n               QUERY PLAN               \n----------------------------------------\n Index Scan using orders_pkey on orders\n   Index Cond: (id = 42)\n   Filter: (status = 'paid'::text)\n(3 rows)",
  "pointCold": "lab=# EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM orders WHERE id = 42;\n                            QUERY PLAN                             \n-------------------------------------------------------------------\n Index Scan using orders_pkey on orders (actual rows=1.00 loops=1)\n   Index Cond: (id = 42)\n   Index Searches: 1\n   Buffers: shared read=3\n Planning:\n   Buffers: shared hit=84 read=1\n(6 rows)",
  "pointWarm": "lab=# EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT * FROM orders WHERE id = 42;\n                            QUERY PLAN                             \n-------------------------------------------------------------------\n Index Scan using orders_pkey on orders (actual rows=1.00 loops=1)\n   Index Cond: (id = 42)\n   Index Searches: 1\n   Buffers: shared hit=3\n Planning:\n   Buffers: shared hit=85\n(6 rows)",
  "scanCold": "lab=# EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT count(*) FROM orders;\n                        QUERY PLAN                        \n----------------------------------------------------------\n Aggregate (actual rows=1.00 loops=1)\n   Buffers: shared hit=1 read=636\n   ->  Seq Scan on orders (actual rows=100000.00 loops=1)\n         Buffers: shared hit=1 read=636\n Planning:\n   Buffers: shared hit=76\n(6 rows)",
  "scanWarm": "lab=# EXPLAIN (ANALYZE, BUFFERS, COSTS OFF, TIMING OFF, SUMMARY OFF) SELECT count(*) FROM orders;\n                        QUERY PLAN                        \n----------------------------------------------------------\n Aggregate (actual rows=1.00 loops=1)\n   Buffers: shared hit=637\n   ->  Seq Scan on orders (actual rows=100000.00 loops=1)\n         Buffers: shared hit=637\n Planning:\n   Buffers: shared hit=76\n(6 rows)",
  "usageAfter2": [
   {
    "usagecount": 2,
    "buffers": 636
   },
   {
    "usagecount": 4,
    "buffers": 1
   }
  ],
  "usageAfter6": [
   {
    "usagecount": 5,
    "buffers": 637
   }
  ],
  "ordersPages": 637,
  "summary": {
   "buffers_used": 1749,
   "buffers_unused": 14635,
   "buffers_dirty": 4,
   "buffers_pinned": 0,
   "usagecount_avg": 4.186392224128073
  },
  "sharedBuffers": 16384,
  "commits": {
   "n": 1000,
   "each": {
    "ms": 1463.207,
    "fsyncs": 1000
   },
   "eachAsync": {
    "ms": 5.679,
    "fsyncs": 0
   },
   "oneTx": {
    "ms": 3.8,
    "fsyncs": 1
   }
  }
 },
 "storage": {
  "header": {
   "lower": 44,
   "upper": 7912,
   "special": 8192,
   "pagesize": 8192,
   "version": 4,
   "checksum": 0
  },
  "headerText": "lab=# SELECT lower, upper, special, pagesize FROM page_header(get_raw_page('payments', 0));\n lower | upper | special | pagesize \n-------+-------+---------+----------\n    44 |  7912 |    8192 |     8192\n(1 row)",
  "items": [
   {
    "lp": 1,
    "lp_off": 8144,
    "lp_len": 42,
    "t_hoff": 24,
    "t_bits": "11110000"
   },
   {
    "lp": 2,
    "lp_off": 8088,
    "lp_len": 54,
    "t_hoff": 24,
    "t_bits": ""
   },
   {
    "lp": 3,
    "lp_off": 8040,
    "lp_len": 46,
    "t_hoff": 24,
    "t_bits": "11110000"
   },
   {
    "lp": 4,
    "lp_off": 7992,
    "lp_len": 42,
    "t_hoff": 24,
    "t_bits": "11110000"
   },
   {
    "lp": 5,
    "lp_off": 7912,
    "lp_len": 79,
    "t_hoff": 24,
    "t_bits": ""
   }
  ],
  "itemsText": "lab=# SELECT lp, lp_off, lp_len, t_hoff, t_bits FROM heap_page_items(get_raw_page('payments', 0));\n lp | lp_off | lp_len | t_hoff |  t_bits  \n----+--------+--------+--------+----------\n  1 |   8144 |     42 |     24 | 11110000\n  2 |   8088 |     54 |     24 | \n  3 |   8040 |     46 |     24 | 11110000\n  4 |   7992 |     42 |     24 | 11110000\n  5 |   7912 |     79 |     24 | \n(5 rows)",
  "indexHeader": {
   "lower": 44,
   "upper": 8096,
   "special": 8176
  },
  "indexHeaderText": "lab=# SELECT lower, upper, special FROM page_header(get_raw_page('payments_pkey', 1));\n lower | upper | special \n-------+-------+---------\n    44 |  8096 |    8176\n(1 row)",
  "checksumInMemory": 0,
  "checksumText": "lab=# SELECT checksum FROM page_header(get_raw_page('payments', 0));  -- after CHECKPOINT, read back from disk\n checksum \n----------\n   -20540\n(1 row)",
  "tuple": {
   "lp": 1,
   "xmin": "29166",
   "xmax": "0",
   "cid": 0,
   "ctid": "(0,1)",
   "t_infomask2": 5,
   "t_infomask": 2051,
   "t_hoff": 24,
   "t_bits": "11110000",
   "lp_len": 42,
   "hex": "ee710000000000000000000000000000010005000308180f01000000650000000b008119000b70616964"
  },
  "bitmap": [
   {
    "tbl": "cols8",
    "columns": 8,
    "has_null": false,
    "t_hoff": 24,
    "lp_len": 56,
    "t_bits": ""
   },
   {
    "tbl": "cols8",
    "columns": 8,
    "has_null": true,
    "t_hoff": 24,
    "lp_len": 52,
    "t_bits": "11111110"
   },
   {
    "tbl": "cols9",
    "columns": 9,
    "has_null": false,
    "t_hoff": 24,
    "lp_len": 60,
    "t_bits": ""
   },
   {
    "tbl": "cols9",
    "columns": 9,
    "has_null": true,
    "t_hoff": 32,
    "lp_len": 64,
    "t_bits": "1111111100000000"
   }
  ],
  "columnOrder": {
   "padded": {
    "lp_len": 64,
    "per_page": 120,
    "bytes": 6832128
   },
   "packed": {
    "lp_len": 48,
    "per_page": 157,
    "bytes": 5218304
   }
  },
  "columnOrderText": "lab=# SELECT pg_column_size(ROW(true, 1::bigint, false, 1::bigint, 1::smallint, 1::int)) AS padded,\n       pg_column_size(ROW(1::bigint, 1::bigint, 1::int, 1::smallint, true, false)) AS packed;\n padded | packed \n--------+--------\n     64 |     48\n(1 row)",
  "layoutChecks": [
   {
    "types": [
     "boolean",
     "bigint"
    ],
    "values": [
     "true",
     "9000000000"
    ],
    "lp_len": 40
   },
   {
    "types": [
     "bigint",
     "boolean"
    ],
    "values": [
     "9000000000",
     "true"
    ],
    "lp_len": 33
   },
   {
    "types": [
     "smallint",
     "integer",
     "boolean",
     "bigint"
    ],
    "values": [
     "7",
     "42",
     "true",
     "9000000000"
    ],
    "lp_len": 48
   },
   {
    "types": [
     "integer",
     "text",
     "bigint"
    ],
    "values": [
     "42",
     "'paid'",
     "9000000000"
    ],
    "lp_len": 48
   },
   {
    "types": [
     "boolean",
     "timestamptz",
     "boolean",
     "uuid"
    ],
    "values": [
     "true",
     "'2026-01-01 10:00+00'",
     "true",
     "'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'"
    ],
    "lp_len": 57
   },
   {
    "types": [
     "text",
     "integer",
     "numeric",
     "date"
    ],
    "values": [
     "'paid'",
     "42",
     "19.99",
     "'2026-01-01'"
    ],
    "lp_len": 48
   },
   {
    "types": [
     "uuid",
     "integer",
     "boolean",
     "text",
     "bigint",
     "smallint"
    ],
    "values": [
     "'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'",
     "42",
     "true",
     "'paid'",
     "9000000000",
     "7"
    ],
    "lp_len": 66
   },
   {
    "types": [
     "double precision",
     "boolean",
     "smallint",
     "integer",
     "boolean"
    ],
    "values": [
     "1.5",
     "true",
     "7",
     "42",
     "true"
    ],
    "lp_len": 41
   }
  ],
  "fillfactor": {
   "ff100": {
    "per_page": 157,
    "free": 4,
    "pages": 64
   },
   "ff70": {
    "per_page": 109,
    "free": 2500,
    "pages": 92
   },
   "rows": 10000
  },
  "toast": [
   {
    "id": 1,
    "kind": "repetitive",
    "length": 1000,
    "stored": 1004,
    "compression": "",
    "external": false,
    "row_bytes": 1044
   },
   {
    "id": 2,
    "kind": "repetitive",
    "length": 2100,
    "stored": 35,
    "compression": "pglz",
    "external": false,
    "row_bytes": 75
   },
   {
    "id": 3,
    "kind": "repetitive",
    "length": 100000,
    "stored": 1158,
    "compression": "pglz",
    "external": false,
    "row_bytes": 1198
   },
   {
    "id": 4,
    "kind": "random",
    "length": 1280,
    "stored": 1284,
    "compression": "",
    "external": false,
    "row_bytes": 1320
   },
   {
    "id": 5,
    "kind": "random",
    "length": 2240,
    "stored": 2240,
    "compression": "",
    "external": true,
    "row_bytes": 53
   },
   {
    "id": 6,
    "kind": "random",
    "length": 12800,
    "stored": 12800,
    "compression": "",
    "external": true,
    "row_bytes": 53
   }
  ],
  "toastText": "lab=# SELECT id, octet_length(body) AS length, pg_column_size(body) AS stored,\n       pg_column_compression(body) AS compression, pg_column_toast_chunk_id(body) AS chunk_id\nFROM docs ORDER BY id;\n id | length | stored | compression | chunk_id \n----+--------+--------+-------------+----------\n  1 |   1000 |   1004 |             |         \n  2 |   2100 |     35 | pglz        |         \n  3 | 100000 |   1158 | pglz        |         \n  4 |   1280 |   1284 |             |         \n  5 |   2240 |   2240 |             |    17447\n  6 |  12800 |  12800 |             |    17448\n(6 rows)",
  "toastTable": "pg_toast.pg_toast_17439",
  "toastChunksText": "lab=# SELECT chunk_id, chunk_seq, length(chunk_data) FROM pg_toast.pg_toast_17439 ORDER BY 1, 2;\n chunk_id | chunk_seq | length \n----------+-----------+--------\n    17447 |         0 |   1996\n    17447 |         1 |    244\n    17448 |         0 |   1996\n    17448 |         1 |   1996\n    17448 |         2 |   1996\n    17448 |         3 |   1996\n    17448 |         4 |   1996\n    17448 |         5 |   1996\n    17448 |         6 |    824\n(9 rows)",
  "compression": {
   "rows": 5000,
   "pglz": {
    "insertMs": 309.814,
    "raw": 17732642,
    "stored": 3353429,
    "method": "pglz",
    "total": 3760128,
    "readMs": 28.935
   },
   "lz4": {
    "insertMs": 215.513,
    "raw": 17732642,
    "stored": 4230081,
    "method": "lz4",
    "total": 4587520,
    "readMs": 26.285
   }
  },
  "copyKeeps": "lab=# SELECT pg_column_compression(body) FROM doc_copy;  -- column is lz4, value came from a pglz table\n pg_column_compression \n-----------------------\n pglz\n(1 row)",
  "mapsBefore": [
   {
    "page": 0,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 1,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 2,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 0
   },
   {
    "page": 3,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 0
   },
   {
    "page": 4,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 5,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 78
   },
   {
    "page": 6,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 7,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 8,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 141
   },
   {
    "page": 9,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 10,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 11,
    "free": 0,
    "all_visible": false,
    "all_frozen": false,
    "live": 73
   }
  ],
  "vacuumMaps": "pages: 0 removed, 12 remain, 12 scanned (100.00% of total), 0 eagerly scanned\ntuples: 0 removed, 1391 remain, 0 are dead but not yet removable\nvisibility map: 12 pages set all-visible, 2 pages set all-frozen (0 were all-visible)",
  "mapsAfter": [
   {
    "page": 0,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 1,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 2,
    "free": 8160,
    "all_visible": true,
    "all_frozen": true,
    "live": 0
   },
   {
    "page": 3,
    "free": 8160,
    "all_visible": true,
    "all_frozen": true,
    "live": 0
   },
   {
    "page": 4,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 5,
    "free": 3776,
    "all_visible": true,
    "all_frozen": false,
    "live": 78
   },
   {
    "page": 6,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 7,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 8,
    "free": 768,
    "all_visible": true,
    "all_frozen": false,
    "live": 141
   },
   {
    "page": 9,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 10,
    "free": 0,
    "all_visible": true,
    "all_frozen": false,
    "live": 157
   },
   {
    "page": 11,
    "free": 4352,
    "all_visible": true,
    "all_frozen": false,
    "live": 73
   }
  ],
  "mapsFrozen": [
   {
    "page": 0,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 1,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 2,
    "free": 8160,
    "all_visible": true,
    "all_frozen": true,
    "live": 0
   },
   {
    "page": 3,
    "free": 8160,
    "all_visible": true,
    "all_frozen": true,
    "live": 0
   },
   {
    "page": 4,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 5,
    "free": 3776,
    "all_visible": true,
    "all_frozen": true,
    "live": 78
   },
   {
    "page": 6,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 7,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 8,
    "free": 768,
    "all_visible": true,
    "all_frozen": true,
    "live": 141
   },
   {
    "page": 9,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 10,
    "free": 0,
    "all_visible": true,
    "all_frozen": true,
    "live": 157
   },
   {
    "page": 11,
    "free": 4352,
    "all_visible": true,
    "all_frozen": true,
    "live": 73
   }
  ],
  "fsmText": "lab=# SELECT * FROM pg_freespace('fsm_demo');\n blkno | avail \n-------+-------\n     0 |     0\n     1 |     0\n     2 |  8160\n     3 |  8160\n     4 |     0\n     5 |  3776\n     6 |     0\n     7 |     0\n     8 |   768\n     9 |     0\n    10 |     0\n    11 |  4352\n(12 rows)",
  "vmText": "lab=# SELECT * FROM pg_visibility_map('fsm_demo');\n blkno | all_visible | all_frozen \n-------+-------------+------------\n     0 | t           | t\n     1 | t           | t\n     2 | t           | t\n     3 | t           | t\n     4 | t           | t\n     5 | t           | t\n     6 | t           | t\n     7 | t           | t\n     8 | t           | t\n     9 | t           | t\n    10 | t           | t\n    11 | t           | t\n(12 rows)"
 },
 "mvcc": {
  "snapshot": {
   "snap": "29217:29219:29217",
   "xmin": "29217",
   "xmax": "29219",
   "xip": [
    "29217"
   ]
  },
  "snapshotText": "lab=# SELECT pg_current_snapshot();\n pg_current_snapshot \n---------------------\n 29217:29219:29217\n(1 row)",
  "snapshotRows": "lab=# SELECT xmin, xmax, * FROM accounts ORDER BY id;\n xmin  | xmax | id | owner | balance \n-------+------+----+-------+---------\n 29216 |    0 |  1 | ann   |     100\n 29218 |    0 |  3 | cat   |     300\n(2 rows)",
  "snapshotPage": [
   {
    "lp": 1,
    "xmin": "29216",
    "xmax": "0",
    "status": "committed"
   },
   {
    "lp": 2,
    "xmin": "29217",
    "xmax": "0",
    "status": "in progress"
   },
   {
    "lp": 3,
    "xmin": "29218",
    "xmax": "0",
    "status": "committed"
   },
   {
    "lp": 4,
    "xmin": "29219",
    "xmax": "0",
    "status": "in progress"
   }
  ],
  "hintBefore": {
   "xmin": "29221",
   "xmax": "0",
   "t_infomask": 2048
  },
  "hintAfter": {
   "xmin": "29221",
   "xmax": "0",
   "t_infomask": 2304
  },
  "lock": {
   "xmax": "29222",
   "t_infomask": 448,
   "me": "29222"
  },
  "chain": [
   {
    "lp": 1,
    "xmin": "29216",
    "xmax": "29223",
    "ctid": "(0,5)",
    "hot_updated": true,
    "heap_only": false,
    "id": 1,
    "balance": 100
   },
   {
    "lp": 2,
    "xmin": "29217",
    "xmax": "0",
    "ctid": "(0,2)",
    "hot_updated": false,
    "heap_only": false,
    "id": 2,
    "balance": 200
   },
   {
    "lp": 3,
    "xmin": "29218",
    "xmax": "0",
    "ctid": "(0,3)",
    "hot_updated": false,
    "heap_only": false,
    "id": 3,
    "balance": 300
   },
   {
    "lp": 4,
    "xmin": "29219",
    "xmax": "0",
    "ctid": "(0,4)",
    "hot_updated": false,
    "heap_only": false,
    "id": 4,
    "balance": 400
   },
   {
    "lp": 5,
    "xmin": "29223",
    "xmax": "29224",
    "ctid": "(0,6)",
    "hot_updated": true,
    "heap_only": true,
    "id": 1,
    "balance": 150
   },
   {
    "lp": 6,
    "xmin": "29224",
    "xmax": "29225",
    "ctid": "(0,7)",
    "hot_updated": true,
    "heap_only": true,
    "id": 1,
    "balance": 175
   },
   {
    "lp": 7,
    "xmin": "29225",
    "xmax": "0",
    "ctid": "(0,7)",
    "hot_updated": false,
    "heap_only": true,
    "id": 1,
    "balance": 160
   }
  ],
  "chainText": "lab=# SELECT lp, t_xmin, t_xmax, t_ctid FROM heap_page_items(get_raw_page('accounts', 0));\n lp | t_xmin | t_xmax | t_ctid \n----+--------+--------+--------\n  1 |  29216 |  29223 | (0,5)\n  2 |  29217 |      0 | (0,2)\n  3 |  29218 |      0 | (0,3)\n  4 |  29219 |      0 | (0,4)\n  5 |  29223 |  29224 | (0,6)\n  6 |  29224 |  29225 | (0,7)\n  7 |  29225 |      0 | (0,7)\n(7 rows)",
  "xid": {
   "xid8": "29226",
   "txid": "29226"
  }
 },
 "vacuum": {
  "hot": [
   {
    "fillfactor": 100,
    "upd": 20000,
    "hot": 17447,
    "newpage": 2553,
    "before": {
     "heap": 2269184,
     "indexes": 3907584
    },
    "after": {
     "heap": 2555904,
     "indexes": 3981312
    }
   },
   {
    "fillfactor": 90,
    "upd": 20000,
    "hot": 19468,
    "newpage": 532,
    "before": {
     "heap": 2506752,
     "indexes": 3907584
    },
    "after": {
     "heap": 2580480,
     "indexes": 3907584
    }
   }
  ],
  "hotText": "lab=# SELECT relname, n_tup_upd, n_tup_hot_upd, n_tup_newpage_upd FROM pg_stat_user_tables WHERE relname LIKE 'hot_ff%' ORDER BY relname;\n  relname  | n_tup_upd | n_tup_hot_upd | n_tup_newpage_upd \n-----------+-----------+---------------+-------------------\n hot_ff100 |     20000 |         17447 |              2553\n hot_ff90  |     20000 |         19468 |               532\n(2 rows)",
  "pruneBefore": {
   "items": [
    {
     "lp": 1,
     "lp_flags": 1,
     "lp_off": 7752,
     "lp_len": 436,
     "xmin": "29257",
     "xmax": "29258",
     "ctid": "(0,4)"
    },
    {
     "lp": 2,
     "lp_flags": 1,
     "lp_off": 7312,
     "lp_len": 436,
     "xmin": "29257",
     "xmax": "0",
     "ctid": "(0,2)"
    },
    {
     "lp": 3,
     "lp_flags": 1,
     "lp_off": 6872,
     "lp_len": 436,
     "xmin": "29257",
     "xmax": "0",
     "ctid": "(0,3)"
    },
    {
     "lp": 4,
     "lp_flags": 1,
     "lp_off": 6432,
     "lp_len": 436,
     "xmin": "29258",
     "xmax": "29259",
     "ctid": "(0,5)"
    },
    {
     "lp": 5,
     "lp_flags": 1,
     "lp_off": 5992,
     "lp_len": 436,
     "xmin": "29259",
     "xmax": "29260",
     "ctid": "(0,6)"
    },
    {
     "lp": 6,
     "lp_flags": 1,
     "lp_off": 5552,
     "lp_len": 436,
     "xmin": "29260",
     "xmax": "0",
     "ctid": "(0,6)"
    },
    {
     "lp": 7,
     "lp_flags": 1,
     "lp_off": 5112,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,7)"
    },
    {
     "lp": 8,
     "lp_flags": 1,
     "lp_off": 4672,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,8)"
    },
    {
     "lp": 9,
     "lp_flags": 1,
     "lp_off": 4232,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,9)"
    },
    {
     "lp": 10,
     "lp_flags": 1,
     "lp_off": 3792,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,10)"
    },
    {
     "lp": 11,
     "lp_flags": 1,
     "lp_off": 3352,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,11)"
    },
    {
     "lp": 12,
     "lp_flags": 1,
     "lp_off": 2912,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,12)"
    },
    {
     "lp": 13,
     "lp_flags": 1,
     "lp_off": 2472,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,13)"
    },
    {
     "lp": 14,
     "lp_flags": 1,
     "lp_off": 2032,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,14)"
    },
    {
     "lp": 15,
     "lp_flags": 1,
     "lp_off": 1592,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,15)"
    },
    {
     "lp": 16,
     "lp_flags": 1,
     "lp_off": 1152,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,16)"
    },
    {
     "lp": 17,
     "lp_flags": 1,
     "lp_off": 712,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,17)"
    }
   ],
   "free": 620
  },
  "pruneAfter": {
   "items": [
    {
     "lp": 1,
     "lp_flags": 2,
     "lp_off": 6,
     "lp_len": 0,
     "xmin": null,
     "xmax": null,
     "ctid": null
    },
    {
     "lp": 2,
     "lp_flags": 1,
     "lp_off": 7752,
     "lp_len": 436,
     "xmin": "29257",
     "xmax": "0",
     "ctid": "(0,2)"
    },
    {
     "lp": 3,
     "lp_flags": 1,
     "lp_off": 7312,
     "lp_len": 436,
     "xmin": "29257",
     "xmax": "0",
     "ctid": "(0,3)"
    },
    {
     "lp": 4,
     "lp_flags": 0,
     "lp_off": 0,
     "lp_len": 0,
     "xmin": null,
     "xmax": null,
     "ctid": null
    },
    {
     "lp": 5,
     "lp_flags": 0,
     "lp_off": 0,
     "lp_len": 0,
     "xmin": null,
     "xmax": null,
     "ctid": null
    },
    {
     "lp": 6,
     "lp_flags": 1,
     "lp_off": 6872,
     "lp_len": 436,
     "xmin": "29260",
     "xmax": "0",
     "ctid": "(0,6)"
    },
    {
     "lp": 7,
     "lp_flags": 1,
     "lp_off": 6432,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,7)"
    },
    {
     "lp": 8,
     "lp_flags": 1,
     "lp_off": 5992,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,8)"
    },
    {
     "lp": 9,
     "lp_flags": 1,
     "lp_off": 5552,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,9)"
    },
    {
     "lp": 10,
     "lp_flags": 1,
     "lp_off": 5112,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,10)"
    },
    {
     "lp": 11,
     "lp_flags": 1,
     "lp_off": 4672,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,11)"
    },
    {
     "lp": 12,
     "lp_flags": 1,
     "lp_off": 4232,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,12)"
    },
    {
     "lp": 13,
     "lp_flags": 1,
     "lp_off": 3792,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,13)"
    },
    {
     "lp": 14,
     "lp_flags": 1,
     "lp_off": 3352,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,14)"
    },
    {
     "lp": 15,
     "lp_flags": 1,
     "lp_off": 2912,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,15)"
    },
    {
     "lp": 16,
     "lp_flags": 1,
     "lp_off": 2472,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,16)"
    },
    {
     "lp": 17,
     "lp_flags": 1,
     "lp_off": 2032,
     "lp_len": 436,
     "xmin": "29261",
     "xmax": "0",
     "ctid": "(0,17)"
    }
   ],
   "free": 1940
  },
  "bloat": [
   {
    "label": "fresh: 100,000 rows",
    "pages": 1539,
    "bytes": 12607488,
    "index_bytes": 2260992,
    "tuple_percent": 89.63,
    "dead_tuple_percent": 0,
    "free_percent": 1.35,
    "tuple_count": 100000,
    "dead_tuple_count": 0,
    "relfilenode": 17512
   },
   {
    "label": "after UPDATE of every row",
    "pages": 3077,
    "bytes": 25206784,
    "index_bytes": 4513792,
    "tuple_percent": 44.83,
    "dead_tuple_percent": 44.83,
    "free_percent": 1.32,
    "tuple_count": 100000,
    "dead_tuple_count": 100000,
    "relfilenode": 17512
   },
   {
    "label": "after VACUUM",
    "pages": 3077,
    "bytes": 25206784,
    "index_bytes": 4513792,
    "tuple_percent": 44.83,
    "dead_tuple_percent": 0,
    "free_percent": 50.49,
    "tuple_count": 100000,
    "dead_tuple_count": 0,
    "relfilenode": 17512
   },
   {
    "label": "after VACUUM FULL",
    "pages": 1539,
    "bytes": 12607488,
    "index_bytes": 2260992,
    "tuple_percent": 89.63,
    "dead_tuple_percent": 0,
    "free_percent": 1.35,
    "tuple_count": 100000,
    "dead_tuple_count": 0,
    "relfilenode": 17520
   }
  ],
  "vacuumVerbose": "INFO:  vacuuming \"lab.public.items\"\nINFO:  finished vacuuming \"lab.public.items\": index scans: 1\npages: 0 removed, 3077 remain, 3077 scanned (100.00% of total), 0 eagerly scanned\ntuples: 100000 removed, 100000 remain, 0 are dead but not yet removable\nremovable cutoff: 29267, which was 0 XIDs old when operation ended\nnew relfrozenxid: 29265, which is 2 XIDs ahead of previous value\nfrozen: 0 pages from table (0.00% of total) had 0 tuples frozen\nvisibility map: 3077 pages set all-visible, 1538 pages set all-frozen (0 were all-visible)\nindex scan needed: 1539 pages from table (50.02% of total) had 100000 dead item identifiers removed\nindex \"items_pkey\": pages: 551 in total, 0 newly deleted, 0 currently deleted, 0 reusable\navg read rate: 0.000 MB/s, avg write rate: 0.000 MB/s\nbuffer usage: 8305 hits, 0 reads, 0 dirtied\nWAL usage: 6704 records, 0 full page images, 1244698 bytes, 0 buffers full\nsystem usage: CPU: user: 0.03 s, system: 0.00 s, elapsed: 0.03 s",
  "vacuumFullMs": 81.09,
  "truncate": {
   "line": "pages: 769 removed, 770 remain, 1539 scanned (100.00% of total), 0 eagerly scanned",
   "after": {
    "label": "after DELETE of the second half + VACUUM",
    "pages": 770,
    "bytes": 6307840,
    "index_bytes": 2260992,
    "tuple_percent": 89.57,
    "dead_tuple_percent": 0,
    "free_percent": 1.42,
    "tuple_count": 50000,
    "dead_tuple_count": 0,
    "relfilenode": 17520
   }
  },
  "held": {
   "activity": "lab=# SELECT pid, state, backend_xmin, now() - xact_start AS open_for FROM pg_stat_activity WHERE backend_xmin IS NOT NULL AND pid <> pg_backend_pid();\n pid  | state  | backend_xmin |    open_for     \n------+--------+--------------+-----------------\n 2221 | active |        29273 | 00:00:01.166434\n(1 row)",
   "blocked": "tuples: 0 removed, 10000 remain, 5000 are dead but not yet removable\nremovable cutoff: 29273, which was 1 XIDs old when operation ended",
   "released": "tuples: 5000 removed, 5000 remain, 0 are dead but not yet removable\nremovable cutoff: 29274, which was 0 XIDs old when operation ended"
  },
  "freezeBefore": {
   "items": [
    {
     "lp": 1,
     "xmin": "29275",
     "t_infomask": 2048,
     "frozen": false
    },
    {
     "lp": 2,
     "xmin": "29275",
     "t_infomask": 2048,
     "frozen": false
    },
    {
     "lp": 3,
     "xmin": "29275",
     "t_infomask": 2048,
     "frozen": false
    }
   ],
   "age": 10003,
   "relfrozenxid": "29274",
   "vm": {
    "all_visible": false,
    "all_frozen": false
   }
  },
  "freezeAfter": {
   "items": [
    {
     "lp": 1,
     "xmin": "29275",
     "t_infomask": 2816,
     "frozen": true
    },
    {
     "lp": 2,
     "xmin": "29275",
     "t_infomask": 2816,
     "frozen": true
    },
    {
     "lp": 3,
     "xmin": "29275",
     "t_infomask": 2816,
     "frozen": true
    }
   ],
   "age": 0,
   "relfrozenxid": "39277",
   "vm": {
    "all_visible": true,
    "all_frozen": true
   }
  },
  "datfrozen": [
   {
    "datname": "lab",
    "age": 38532
   },
   {
    "datname": "postgres",
    "age": 38532
   },
   {
    "datname": "template0",
    "age": 38532
   },
   {
    "datname": "template1",
    "age": 38532
   }
  ],
  "datfrozenText": "lab=# SELECT datname, age(datfrozenxid), current_setting('autovacuum_freeze_max_age') AS freeze_max_age FROM pg_database;\n  datname  |  age  | freeze_max_age \n-----------+-------+----------------\n postgres  | 38532 | 200000000\n lab       | 38532 | 200000000\n template1 | 38532 | 200000000\n template0 | 38532 | 200000000\n(4 rows)",
  "nextXid": "39277",
  "wraparoundCheck": "lab=# SELECT c.oid::regclass AS table, age(c.relfrozenxid) AS xid_age,\n       round(100.0 * age(c.relfrozenxid) / current_setting('autovacuum_freeze_max_age')::int, 4) AS pct_of_limit\nFROM pg_class c WHERE c.relkind IN ('r', 'm', 't') ORDER BY age(c.relfrozenxid) DESC LIMIT 3;\n         table          | xid_age | pct_of_limit \n------------------------+---------+--------------\n pg_toast.pg_toast_1255 |   38533 |       0.0193\n pg_toast.pg_toast_1247 |   38533 |       0.0193\n pg_toast.pg_toast_2604 |   38533 |       0.0193\n(3 rows)",
  "settings": [
   {
    "name": "autovacuum_analyze_scale_factor",
    "setting": "0.1"
   },
   {
    "name": "autovacuum_analyze_threshold",
    "setting": "50"
   },
   {
    "name": "autovacuum_freeze_max_age",
    "setting": "200000000"
   },
   {
    "name": "autovacuum_max_workers",
    "setting": "3"
   },
   {
    "name": "autovacuum_naptime",
    "setting": "1"
   },
   {
    "name": "autovacuum_vacuum_insert_scale_factor",
    "setting": "0.2"
   },
   {
    "name": "autovacuum_vacuum_insert_threshold",
    "setting": "1000"
   },
   {
    "name": "autovacuum_vacuum_max_threshold",
    "setting": "100000000"
   },
   {
    "name": "autovacuum_vacuum_scale_factor",
    "setting": "0.2"
   },
   {
    "name": "autovacuum_vacuum_threshold",
    "setting": "50"
   },
   {
    "name": "vacuum_freeze_min_age",
    "setting": "50000000"
   },
   {
    "name": "vacuum_freeze_table_age",
    "setting": "150000000"
   }
  ],
  "autovacuum": {
   "start": {
    "live": 1000,
    "dead": 0,
    "vacuums": 0,
    "analyzes": 1,
    "reltuples": 1000
   },
   "deleted": {
    "live": 700,
    "dead": 300,
    "vacuums": 0,
    "analyzes": 1,
    "reltuples": 1000
   },
   "vacuumed": {
    "live": 700,
    "dead": 0,
    "vacuums": 1,
    "analyzes": 2,
    "reltuples": 700
   },
   "below": {
    "live": 550,
    "dead": 150,
    "vacuums": 1,
    "analyzes": 2,
    "reltuples": 700
   },
   "stillBelow": {
    "live": 550,
    "dead": 150,
    "vacuums": 1,
    "analyzes": 3,
    "reltuples": 550
   }
  },
  "autovacuumLog": "LOG:  automatic vacuum of table \"lab.public.av_demo\": index scans: 1\n  pages: 0 removed, 5 remain, 5 scanned (100.00% of total), 0 eagerly scanned\n  tuples: 300 removed, 700 remain, 0 are dead but not yet removable\n  removable cutoff: 39282, which was 0 XIDs old when operation ended\n  new relfrozenxid: 39279, which is 1 XIDs ahead of previous value\n  frozen: 0 pages from table (0.00% of total) had 0 tuples frozen\n  visibility map: 5 pages set all-visible, 1 pages set all-frozen (0 were all-visible)\n  index scan needed: 2 pages from table (40.00% of total) had 300 dead item identifiers removed\n  index \"av_demo_pkey\": pages: 5 in total, 0 newly deleted, 0 currently deleted, 0 reusable\n  avg read rate: 0.000 MB/s, avg write rate: 67.349 MB/s\n  buffer usage: 74 hits, 0 reads, 4 dirtied\n  WAL usage: 15 records, 4 full page images, 35789 bytes, 0 buffers full"
 }
} as const
