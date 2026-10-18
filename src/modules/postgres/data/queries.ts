// Recorded from PostgreSQL 18.6 (Debian 18.6-1.pgdg13+2) by tools/postgres-capture/capture-queries.mjs — do not edit by hand.

export const QUERIES = {
 "version": "18.6 (Debian 18.6-1.pgdg13+2)",
 "settings": {
  "cpu_index_tuple_cost": "0.005",
  "cpu_operator_cost": "0.0025",
  "cpu_tuple_cost": "0.01",
  "default_statistics_target": "100",
  "effective_cache_size": "524288",
  "max_parallel_workers_per_gather": "2",
  "min_parallel_table_scan_size": "1024",
  "parallel_setup_cost": "1000",
  "parallel_tuple_cost": "0.1",
  "random_page_cost": "4",
  "seq_page_cost": "1",
  "work_mem": "4096"
 },
 "tables": [
  {
   "name": "customers",
   "pages": 109,
   "tuples": 10000,
   "bytes": 892928
  },
  {
   "name": "orders",
   "pages": 5436,
   "tuples": 500000,
   "bytes": 44531712
  },
  {
   "name": "payments",
   "pages": 3090,
   "tuples": 485000,
   "bytes": 25313280
  }
 ],
 "statsSql": "SELECT n_distinct, most_common_vals, most_common_freqs, correlation\nFROM pg_stats WHERE tablename = 'orders' AND attname = 'status';",
 "statsShow": "-[ RECORD 1 ]-----+-----------------------------------------------------------\nn_distinct        | 5\nmost_common_vals  | {DELIVERED,SHIPPED,PAID,NEW,CANCELLED}\nmost_common_freqs | {0.69986665,0.14786667,0.12253334,0.019666666,0.010066667}\ncorrelation       | 0.5326517",
 "stats": [
  {
   "attname": "amount",
   "n_distinct": 49714,
   "null_frac": 0,
   "avg_width": 6,
   "correlation": 0.0060365046,
   "mcv": null,
   "mcf": null,
   "hist": "{0.00,4.99,10.33,15.82,20.59,25.72,30.94,36.06,40.89,45.55,50.47,55.08,60.25,65.21,69.89,75.28,80.08,85.12,89.90,94.61,99.57,104.84,109.47,114.43,119.57,124.79,129.85,134.89,139.48,144.18,149.11,154.02,159.28,164.60,170.20,174.84,179.54,184.80,189.65,194.40,199.27,204.09,208.90,213.88,219.00,223.54,228.75,233.76,238.62,243.47,248.38,253.69,258.53,263.59,268.72,273.81,278.95,284.07,289.02,294.64,299.40,304.64,309.35,314.06,319.10,323.42,328.41,333.79,338.73,343.42,348.08,352.92,357.82,362.96,368.58,373.74,378.50,384.21,389.72,394.81,400.03,405.58,410.44,415.40,420.42,425.58,430.58,435.56,440.58,445.76,450.66,455.08,460.46,465.65,470.17,475.28,480.77,485.29,490.32,495.19,499.99}"
  },
  {
   "attname": "created_at",
   "n_distinct": -1,
   "null_frac": 0,
   "avg_width": 8,
   "correlation": 1,
   "mcv": null,
   "mcf": null,
   "hist": "{\"2026-01-01 00:06:00+00\",\"2026-01-04 14:54:00+00\",\"2026-01-07 18:40:00+00\",\"2026-01-11 05:30:00+00\",\"2026-01-14 22:42:00+00\",\"2026-01-18 10:19:00+00\",\"2026-01-21 15:54:00+00\",\"2026-01-25 05:00:00+00\",\"2026-01-28 22:02:00+00\",\"2026-02-01 13:57:00+00\",\"2026-02-05 03:53:00+00\",\"2026-02-08 16:07:00+00\",\"2026-02-12 02:05:00+00\",\"2026-02-15 06:03:00+00\",\"2026-02-18 16:30:00+00\",\"2026-02-21 21:49:00+00\",\"2026-02-25 06:52:00+00\",\"2026-02-28 18:47:00+00\",\"2026-03-04 10:49:00+00\",\"2026-03-07 14:39:00+00\",\"2026-03-10 22:02:00+00\",\"2026-03-14 03:12:00+00\",\"2026-03-17 09:06:00+00\",\"2026-03-21 02:16:00+00\",\"2026-03-24 13:37:00+00\",\"2026-03-28 08:38:00+00\",\"2026-03-31 22:03:00+00\",\"2026-04-04 13:24:00+00\",\"2026-04-08 00:32:00+00\",\"2026-04-11 12:26:00+00\",\"2026-04-15 04:21:00+00\",\"2026-04-18 16:28:00+00\",\"2026-04-22 09:27:00+00\",\"2026-04-25 19:34:00+00\",\"2026-04-29 08:59:00+00\",\"2026-05-02 21:26:00+00\",\"2026-05-06 07:26:00+00\",\"2026-05-09 07:22:00+00\",\"2026-05-13 03:08:00+00\",\"2026-05-16 15:07:00+00\",\"2026-05-19 14:41:00+00\",\"2026-05-23 02:06:00+00\",\"2026-05-26 05:39:00+00\",\"2026-05-29 20:13:00+00\",\"2026-06-02 09:43:00+00\",\"2026-06-06 02:21:00+00\",\"2026-06-09 16:10:00+00\",\"2026-06-12 22:19:00+00\",\"2026-06-16 05:23:00+00\",\"2026-06-19 23:10:00+00\",\"2026-06-23 08:48:00+00\",\"2026-06-27 01:00:00+00\",\"2026-06-30 15:19:00+00\",\"2026-07-04 06:11:00+00\",\"2026-07-07 08:00:00+00\",\"2026-07-10 20:38:00+00\",\"2026-07-14 19:12:00+00\",\"2026-07-17 21:14:00+00\",\"2026-07-21 08:22:00+00\",\"2026-07-24 18:37:00+00\",\"2026-07-28 01:50:00+00\",\"2026-07-31 10:14:00+00\",\"2026-08-04 08:09:00+00\",\"2026-08-07 15:40:00+00\",\"2026-08-11 02:11:00+00\",\"2026-08-14 10:16:00+00\",\"2026-08-18 01:12:00+00\",\"2026-08-21 15:22:00+00\",\"2026-08-24 23:34:00+00\",\"2026-08-28 13:12:00+00\",\"2026-09-01 04:29:00+00\",\"2026-09-04 21:35:00+00\",\"2026-09-08 18:52:00+00\",\"2026-09-12 05:18:00+00\",\"2026-09-15 17:33:00+00\",\"2026-09-18 21:54:00+00\",\"2026-09-21 20:55:00+00\",\"2026-09-25 12:15:00+00\",\"2026-09-28 19:12:00+00\",\"2026-10-02 05:12:00+00\",\"2026-10-05 13:12:00+00\",\"2026-10-08 23:08:00+00\",\"2026-10-12 22:02:00+00\",\"2026-10-16 07:53:00+00\",\"2026-10-19 14:02:00+00\",\"2026-10-23 08:57:00+00\",\"2026-10-26 20:39:00+00\",\"2026-10-30 05:56:00+00\",\"2026-11-02 17:36:00+00\",\"2026-11-06 05:23:00+00\",\"2026-11-09 17:07:00+00\",\"2026-11-13 05:48:00+00\",\"2026-11-16 12:28:00+00\",\"2026-11-19 18:24:00+00\",\"2026-11-23 06:19:00+00\",\"2026-11-26 13:55:00+00\",\"2026-11-29 20:30:00+00\",\"2026-12-03 16:33:00+00\",\"2026-12-07 04:56:00+00\",\"2026-12-10 17:13:00+00\",\"2026-12-14 05:02:00+00\"}"
  },
  {
   "attname": "customer_id",
   "n_distinct": 10015,
   "null_frac": 0,
   "avg_width": 4,
   "correlation": -0.006840635,
   "mcv": "{589,2359,3406,3771,3854,5762,9151,9510,9810}",
   "mcf": [
    0.00036666667,
    0.00033333333,
    0.00033333333,
    0.00033333333,
    0.00033333333,
    0.00033333333,
    0.00033333333,
    0.00033333333,
    0.00033333333
   ],
   "hist": "{1,100,202,306,405,509,602,703,806,907,1007,1116,1216,1307,1414,1518,1615,1713,1813,1904,2008,2094,2198,2299,2393,2496,2592,2690,2787,2884,2984,3089,3191,3295,3393,3500,3609,3707,3808,3908,4002,4101,4197,4299,4391,4496,4592,4693,4799,4905,5006,5109,5202,5300,5401,5506,5601,5709,5805,5911,6012,6114,6212,6311,6414,6517,6628,6733,6832,6927,7015,7109,7208,7306,7407,7506,7596,7688,7792,7890,7983,8087,8192,8299,8391,8485,8591,8684,8792,8897,9008,9109,9205,9297,9402,9509,9609,9716,9815,9904,10000}"
  },
  {
   "attname": "id",
   "n_distinct": -1,
   "null_frac": 0,
   "avg_width": 8,
   "correlation": 1,
   "mcv": null,
   "mcf": null,
   "hist": "{6,5214,9760,14730,20082,25099,29754,34860,40202,45477,50633,55687,60605,65163,70110,74749,79612,84647,89929,94479,99242,103872,108546,113896,118897,124358,129483,134724,139712,144746,150021,155068,160407,165334,170459,175526,180446,184762,190268,195307,199601,204606,209139,214333,219463,224781,229930,234619,239363,244750,249648,254940,260119,265331,269760,274838,280512,284954,289942,294877,299630,304454,310089,314860,319811,324616,329832,335002,339814,344952,350189,355535,361132,366078,371133,375714,379975,385215,389952,394872,399672,404588,410282,415193,419882,425337,430359,435236,440256,445283,450307,455388,460108,464784,469819,474595,479310,484833,489896,494953,499982}"
  },
  {
   "attname": "note",
   "n_distinct": 2,
   "null_frac": 0,
   "avg_width": 16,
   "correlation": 0.55417347,
   "mcv": "{\"gift wrap: false\",\"gift wrap: true\"}",
   "mcf": [
    0.6659,
    0.3341
   ],
   "hist": null
  },
  {
   "attname": "status",
   "n_distinct": 5,
   "null_frac": 0,
   "avg_width": 8,
   "correlation": 0.5326517,
   "mcv": "{DELIVERED,SHIPPED,PAID,NEW,CANCELLED}",
   "mcf": [
    0.69986665,
    0.14786667,
    0.12253334,
    0.019666666,
    0.010066667
   ],
   "hist": null
  }
 ],
 "histSql": "SELECT histogram_bounds FROM pg_stats WHERE tablename = 'orders' AND attname = 'amount';",
 "counts": {
  "new": 10000,
  "c42": 50,
  "cheap": 50000
 },
 "estimates": {
  "mcv": {
   "sql": "SELECT * FROM orders WHERE status = 'NEW'",
   "plan": [
    "Seq Scan on orders  (cost=0.00..11686.00 rows=9833 width=50) (actual rows=10000.00 loops=1)",
    "  Filter: (status = 'NEW'::text)",
    "  Rows Removed by Filter: 490000",
    "  Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=24"
   ]
  },
  "distinct": {
   "sql": "SELECT * FROM orders WHERE customer_id = 42",
   "plan": [
    "Seq Scan on orders  (cost=0.00..11686.00 rows=50 width=50) (actual rows=50.00 loops=1)",
    "  Filter: (customer_id = 42)",
    "  Rows Removed by Filter: 499950",
    "  Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=15"
   ]
  },
  "histogram": {
   "sql": "SELECT * FROM orders WHERE amount < 50",
   "plan": [
    "Seq Scan on orders  (cost=0.00..11686.00 rows=49512 width=50) (actual rows=50000.00 loops=1)",
    "  Filter: (amount < '50'::numeric)",
    "  Rows Removed by Filter: 450000",
    "  Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=15"
   ]
  }
 },
 "correlated": {
  "before": {
   "sql": "SELECT * FROM customers WHERE country = 'FR' AND city = 'Paris'",
   "plan": [
    "Seq Scan on customers  (cost=0.00..259.00 rows=400 width=55) (actual rows=2000.00 loops=1)",
    "  Filter: ((country = 'FR'::text) AND (city = 'Paris'::text))",
    "  Rows Removed by Filter: 8000",
    "  Buffers: shared hit=109",
    "Planning:",
    "  Buffers: shared hit=24"
   ]
  },
  "fix": "CREATE STATISTICS customers_country_city (dependencies) ON country, city FROM customers;\nANALYZE customers;",
  "after": {
   "sql": "SELECT * FROM customers WHERE country = 'FR' AND city = 'Paris'",
   "plan": [
    "Seq Scan on customers  (cost=0.00..259.00 rows=2000 width=55) (actual rows=2000.00 loops=1)",
    "  Filter: ((country = 'FR'::text) AND (city = 'Paris'::text))",
    "  Rows Removed by Filter: 8000",
    "  Buffers: shared hit=109",
    "Planning:",
    "  Buffers: shared hit=24"
   ]
  },
  "dependencies": "    statistics_name     |               dependencies               \n------------------------+------------------------------------------\n customers_country_city | {\"4 => 5\": 1.000000, \"5 => 4\": 1.000000}\n(1 row)"
 },
 "stale": {
  "before": {
   "sql": "SELECT * FROM deliveries WHERE delivered_at >= '2026-01-24'",
   "plan": [
    "Seq Scan on deliveries  (cost=0.00..2831.98 rows=948 width=24) (actual rows=50641.00 loops=1)",
    "  Filter: (delivered_at >= '2026-01-24 00:00:00+00'::timestamp with time zone)",
    "  Rows Removed by Filter: 99359",
    "  Buffers: shared hit=956",
    "Planning:",
    "  Buffers: shared hit=19"
   ]
  },
  "after": {
   "sql": "SELECT * FROM deliveries WHERE delivered_at >= '2026-01-24'",
   "plan": [
    "Seq Scan on deliveries  (cost=0.00..2831.00 rows=51203 width=24) (actual rows=50641.00 loops=1)",
    "  Filter: (delivered_at >= '2026-01-24 00:00:00+00'::timestamp with time zone)",
    "  Rows Removed by Filter: 99359",
    "  Buffers: shared hit=956",
    "Planning:",
    "  Buffers: shared hit=23"
   ]
  }
 },
 "cost": {
  "all": [
   "Seq Scan on orders  (cost=0.00..10436.00 rows=500000 width=50)"
  ],
  "filtered": [
   "Seq Scan on orders  (cost=0.00..11686.00 rows=9833 width=50)",
   "  Filter: (status = 'NEW'::text)"
  ],
  "stats": " relpages | reltuples \n----------+-----------\n     5436 |    500000\n(1 row)"
 },
 "scans": {
  "seq": {
   "sql": "SELECT * FROM orders WHERE status = 'DELIVERED'",
   "plan": [
    "Seq Scan on orders  (cost=0.00..11686.00 rows=352433 width=51) (actual time=0.007..28.566 rows=350000.00 loops=1)",
    "  Filter: (status = 'DELIVERED'::text)",
    "  Rows Removed by Filter: 150000",
    "  Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=24",
    "Planning Time: 0.050 ms",
    "Execution Time: 36.774 ms"
   ]
  },
  "index": {
   "sql": "SELECT * FROM orders WHERE id = 31337",
   "plan": [
    "Index Scan using orders_pkey on orders  (cost=0.42..8.44 rows=1 width=51) (actual time=0.010..0.011 rows=1.00 loops=1)",
    "  Index Cond: (id = 31337)",
    "  Index Searches: 1",
    "  Buffers: shared hit=4",
    "Planning:",
    "  Buffers: shared hit=15",
    "Planning Time: 0.029 ms",
    "Execution Time: 0.020 ms"
   ]
  },
  "indexOnly": {
   "sql": "SELECT id FROM orders WHERE id BETWEEN 1000 AND 1999",
   "plan": [
    "Index Only Scan using orders_pkey on orders  (cost=0.42..32.60 rows=1009 width=8) (actual time=0.008..0.065 rows=1000.00 loops=1)",
    "  Index Cond: ((id >= 1000) AND (id <= 1999))",
    "  Heap Fetches: 0",
    "  Index Searches: 1",
    "  Buffers: shared hit=7",
    "Planning:",
    "  Buffers: shared hit=20",
    "Planning Time: 0.050 ms",
    "Execution Time: 0.096 ms"
   ]
  },
  "bitmap": {
   "sql": "SELECT * FROM orders WHERE customer_id = 42",
   "plan": [
    "Bitmap Heap Scan on orders  (cost=4.81..191.05 rows=50 width=51) (actual time=0.072..0.274 rows=50.00 loops=1)",
    "  Recheck Cond: (customer_id = 42)",
    "  Heap Blocks: exact=50",
    "  Buffers: shared hit=50 read=3",
    "  ->  Bitmap Index Scan on orders_customer_idx  (cost=0.00..4.80 rows=50 width=0) (actual time=0.060..0.060 rows=50.00 loops=1)",
    "        Index Cond: (customer_id = 42)",
    "        Index Searches: 1",
    "        Buffers: shared read=3",
    "Planning:",
    "  Buffers: shared hit=15",
    "Planning Time: 0.033 ms",
    "Execution Time: 0.290 ms"
   ]
  }
 },
 "joins": {
  "nested": {
   "sql": "SELECT o.id, c.name, o.amount FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id BETWEEN 1000 AND 1009",
   "plan": [
    "Nested Loop  (cost=0.71..87.65 rows=10 width=27) (actual time=0.025..0.075 rows=10.00 loops=1)",
    "  Buffers: shared hit=34",
    "  ->  Index Scan using orders_pkey on orders o  (cost=0.42..8.62 rows=10 width=18) (actual time=0.009..0.011 rows=10.00 loops=1)",
    "        Index Cond: ((id >= 1000) AND (id <= 1009))",
    "        Index Searches: 1",
    "        Buffers: shared hit=4",
    "  ->  Index Scan using customers_pkey on customers c  (cost=0.29..7.90 rows=1 width=17) (actual time=0.006..0.006 rows=1.00 loops=10)",
    "        Index Cond: (id = o.customer_id)",
    "        Index Searches: 10",
    "        Buffers: shared hit=30",
    "Planning:",
    "  Buffers: shared hit=146 read=3",
    "Planning Time: 0.383 ms",
    "Execution Time: 0.091 ms"
   ]
  },
  "hash": {
   "sql": "SELECT c.country, count(*), sum(o.amount) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.country",
   "plan": [
    "HashAggregate  (cost=15833.06..15833.12 rows=5 width=43) (actual time=151.633..151.636 rows=5.00 loops=1)",
    "  Group Key: c.country",
    "  Batches: 1  Memory Usage: 32kB",
    "  Buffers: shared hit=5545",
    "  ->  Hash Join  (cost=334.00..12083.06 rows=500000 width=9) (actual time=1.416..92.054 rows=500000.00 loops=1)",
    "        Hash Cond: (o.customer_id = c.id)",
    "        Buffers: shared hit=5545",
    "        ->  Seq Scan on orders o  (cost=0.00..10436.00 rows=500000 width=10) (actual time=0.006..19.837 rows=500000.00 loops=1)",
    "              Buffers: shared hit=5436",
    "        ->  Hash  (cost=209.00..209.00 rows=10000 width=7) (actual time=1.354..1.355 rows=10000.00 loops=1)",
    "              Buckets: 16384  Batches: 1  Memory Usage: 519kB",
    "              Buffers: shared hit=109",
    "              ->  Seq Scan on customers c  (cost=0.00..209.00 rows=10000 width=7) (actual time=0.006..0.555 rows=10000.00 loops=1)",
    "                    Buffers: shared hit=109",
    "Planning:",
    "  Buffers: shared hit=154 read=2",
    "Planning Time: 0.298 ms",
    "Execution Time: 151.724 ms"
   ]
  },
  "merge": {
   "sql": "SELECT o.id, p.method FROM orders o JOIN payments p ON p.order_id = o.id ORDER BY o.id LIMIT 1000",
   "plan": [
    "Limit  (cost=1.30..75.54 rows=1000 width=13) (actual time=0.023..0.327 rows=1000.00 loops=1)",
    "  Buffers: shared hit=18",
    "  ->  Merge Join  (cost=1.30..36008.09 rows=485000 width=13) (actual time=0.023..0.276 rows=1000.00 loops=1)",
    "        Merge Cond: (o.id = p.order_id)",
    "        Buffers: shared hit=18",
    "        ->  Index Only Scan using orders_pkey on orders o  (cost=0.42..12996.42 rows=500000 width=8) (actual time=0.009..0.059 rows=1030.00 loops=1)",
    "              Heap Fetches: 0",
    "              Index Searches: 1",
    "              Buffers: shared hit=6",
    "        ->  Index Scan using payments_pkey on payments p  (cost=0.42..15700.42 rows=485000 width=13) (actual time=0.012..0.080 rows=1000.00 loops=1)",
    "              Index Searches: 1",
    "              Buffers: shared hit=12",
    "Planning:",
    "  Buffers: shared hit=56",
    "Planning Time: 0.153 ms",
    "Execution Time: 0.366 ms"
   ]
  }
 },
 "forced": {
  "sql": "SELECT o.id, p.method FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id <= 100000",
  "runs": [
   {
    "algorithm": "hash join",
    "node": "Hash Join",
    "cost": 13268.71,
    "ms": 86.111
   },
   {
    "algorithm": "merge join",
    "node": "Merge Join",
    "cost": 20938.55,
    "ms": 29.262
   },
   {
    "algorithm": "nested loop",
    "node": "Nested Loop",
    "cost": 64029.46,
    "ms": 81.071
   }
  ],
  "chosen": "Hash Join"
 },
 "report": {
  "sql": "SELECT c.id, c.name, sum(o.amount) AS spent\nFROM customers c JOIN orders o ON o.customer_id = c.id\nWHERE c.country = 'FR' AND o.created_at >= '2026-06-01' AND o.created_at < '2026-07-01'\nGROUP BY c.id, c.name ORDER BY spent DESC LIMIT 5",
  "plan": [
   "Limit  (cost=13413.70..13413.71 rows=5 width=49) (actual time=28.275..28.278 rows=5.00 loops=1)",
   "  Buffers: shared hit=5548",
   "  ->  Sort  (cost=13413.70..13418.70 rows=2000 width=49) (actual time=28.274..28.276 rows=5.00 loops=1)",
   "        Sort Key: (sum(o.amount)) DESC",
   "        Sort Method: top-N heapsort  Memory: 25kB",
   "        Buffers: shared hit=5548",
   "        ->  HashAggregate  (cost=13355.48..13380.48 rows=2000 width=49) (actual time=27.693..28.087 rows=2000.00 loops=1)",
   "              Group Key: c.id",
   "              Batches: 1  Memory Usage: 977kB",
   "              Buffers: shared hit=5545",
   "              ->  Hash Join  (cost=259.00..13311.22 rows=8852 width=23) (actual time=10.041..26.161 rows=8640.00 loops=1)",
   "                    Hash Cond: (o.customer_id = c.id)",
   "                    Buffers: shared hit=5545",
   "                    ->  Seq Scan on orders o  (cost=0.00..12936.00 rows=44258 width=10) (actual time=9.284..22.927 rows=43200.00 loops=1)",
   "                          Filter: ((created_at >= '2026-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2026-07-01 00:00:00+00'::timestamp with time zone))",
   "                          Rows Removed by Filter: 456800",
   "                          Buffers: shared hit=5436",
   "                    ->  Hash  (cost=234.00..234.00 rows=2000 width=17) (actual time=0.740..0.741 rows=2000.00 loops=1)",
   "                          Buckets: 2048  Batches: 1  Memory Usage: 114kB",
   "                          Buffers: shared hit=109",
   "                          ->  Seq Scan on customers c  (cost=0.00..234.00 rows=2000 width=17) (actual time=0.009..0.554 rows=2000.00 loops=1)",
   "                                Filter: (country = 'FR'::text)",
   "                                Rows Removed by Filter: 8000",
   "                                Buffers: shared hit=109",
   "Planning:",
   "  Buffers: shared hit=106",
   "Planning Time: 0.411 ms",
   "Execution Time: 28.447 ms"
  ]
 },
 "parallel": {
  "plan": {
   "sql": "SELECT status, count(*), avg(amount) FROM orders GROUP BY status",
   "plan": [
    "Finalize GroupAggregate  (cost=10081.98..10083.56 rows=5 width=49) (actual time=32.502..36.117 rows=5.00 loops=1)",
    "  Group Key: status",
    "  Buffers: shared hit=5454",
    "  ->  Gather Merge  (cost=10081.98..10083.37 rows=12 width=49) (actual time=32.494..36.105 rows=15.00 loops=1)",
    "        Workers Planned: 2",
    "        Workers Launched: 2",
    "        Buffers: shared hit=5454",
    "        ->  Sort  (cost=9081.95..9081.96 rows=5 width=49) (actual time=29.928..29.928 rows=5.00 loops=3)",
    "              Sort Key: status",
    "              Sort Method: quicksort  Memory: 25kB",
    "              Buffers: shared hit=5454",
    "              Worker 0:  Sort Method: quicksort  Memory: 25kB",
    "              Worker 1:  Sort Method: quicksort  Memory: 25kB",
    "              ->  Partial HashAggregate  (cost=9081.83..9081.89 rows=5 width=49) (actual time=29.891..29.893 rows=5.00 loops=3)",
    "                    Group Key: status",
    "                    Batches: 1  Memory Usage: 32kB",
    "                    Buffers: shared hit=5436",
    "                    Worker 0:  Batches: 1  Memory Usage: 32kB",
    "                    Worker 1:  Batches: 1  Memory Usage: 32kB",
    "                    ->  Parallel Seq Scan on orders  (cost=0.00..7519.33 rows=208333 width=15) (actual time=0.009..7.749 rows=166666.67 loops=3)",
    "                          Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=141",
    "Planning Time: 0.554 ms",
    "Execution Time: 36.263 ms"
   ]
  },
  "timings": [
   {
    "workers": 0,
    "ms": 81.61
   },
   {
    "workers": 1,
    "ms": 47.992
   },
   {
    "workers": 2,
    "ms": 39.212
   },
   {
    "workers": 4,
    "ms": 37.419
   }
  ],
  "cpus": 12
 },
 "spill": {
  "small": {
   "sql": "SELECT id, amount FROM orders ORDER BY amount",
   "plan": [
    "Sort  (cost=74858.92..76108.92 rows=500000 width=14) (actual time=172.822..222.120 rows=500000.00 loops=1)",
    "  Sort Key: amount",
    "  Sort Method: external merge  Disk: 12248kB",
    "  Buffers: shared hit=5439, temp read=3062 written=3090",
    "  ->  Seq Scan on orders  (cost=0.00..10436.00 rows=500000 width=14) (actual time=0.008..31.779 rows=500000.00 loops=1)",
    "        Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=108",
    "Planning Time: 0.217 ms",
    "Execution Time: 235.865 ms"
   ]
  },
  "big": {
   "sql": "SELECT id, amount FROM orders ORDER BY amount",
   "plan": [
    "Sort  (cost=57764.92..59014.92 rows=500000 width=14) (actual time=143.615..159.224 rows=500000.00 loops=1)",
    "  Sort Key: amount",
    "  Sort Method: quicksort  Memory: 27914kB",
    "  Buffers: shared hit=5439",
    "  ->  Seq Scan on orders  (cost=0.00..10436.00 rows=500000 width=14) (actual time=0.008..31.253 rows=500000.00 loops=1)",
    "        Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=108",
    "Planning Time: 0.207 ms",
    "Execution Time: 173.555 ms"
   ]
  },
  "topN": {
   "sql": "SELECT id, amount FROM orders ORDER BY amount LIMIT 10",
   "plan": [
    "Limit  (cost=21240.82..21240.85 rows=10 width=14) (actual time=62.771..62.773 rows=10.00 loops=1)",
    "  Buffers: shared hit=5439",
    "  ->  Sort  (cost=21240.82..22490.82 rows=500000 width=14) (actual time=62.770..62.771 rows=10.00 loops=1)",
    "        Sort Key: amount",
    "        Sort Method: top-N heapsort  Memory: 25kB",
    "        Buffers: shared hit=5439",
    "        ->  Seq Scan on orders  (cost=0.00..10436.00 rows=500000 width=14) (actual time=0.013..29.482 rows=500000.00 loops=1)",
    "              Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=108",
    "Planning Time: 0.250 ms",
    "Execution Time: 62.791 ms"
   ]
  },
  "hashSmall": {
   "sql": "SELECT o.id, p.method FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.id <= 100000",
   "plan": [
    "Hash Join  (cost=4442.57..18780.71 rows=95938 width=13) (actual time=13.977..123.551 rows=97000.00 loops=1)",
    "  Hash Cond: (p.order_id = o.id)",
    "  Buffers: shared hit=3367, temp read=2333 written=2333",
    "  ->  Seq Scan on payments p  (cost=0.00..7940.00 rows=485000 width=13) (actual time=0.005..26.649 rows=485000.00 loops=1)",
    "        Buffers: shared hit=3090",
    "  ->  Hash  (cost=2819.26..2819.26 rows=98905 width=8) (actual time=13.833..13.834 rows=100000.00 loops=1)",
    "        Buckets: 16384  Batches: 16  Memory Usage: 375kB",
    "        Buffers: shared hit=277, temp written=313",
    "        ->  Index Only Scan using orders_pkey on orders o  (cost=0.42..2819.26 rows=98905 width=8) (actual time=0.016..5.808 rows=100000.00 loops=1)",
    "              Index Cond: (id <= 100000)",
    "              Heap Fetches: 0",
    "              Index Searches: 1",
    "              Buffers: shared hit=277",
    "Planning:",
    "  Buffers: shared hit=229",
    "Planning Time: 0.482 ms",
    "Execution Time: 126.030 ms"
   ]
  }
 },
 "multi": {
  "both": {
   "sql": "SELECT id FROM orders WHERE customer_id = 42 AND created_at >= '2026-06-01'",
   "plan": [
    "Bitmap Heap Scan on orders (actual rows=28.00 loops=1)",
    "  Recheck Cond: ((customer_id = 42) AND (created_at >= '2026-06-01 00:00:00+00'::timestamp with time zone))",
    "  Heap Blocks: exact=28",
    "  Buffers: shared hit=28 read=4",
    "  ->  Bitmap Index Scan on orders_customer_created_idx (actual rows=28.00 loops=1)",
    "        Index Cond: ((customer_id = 42) AND (created_at >= '2026-06-01 00:00:00+00'::timestamp with time zone))",
    "        Index Searches: 1",
    "        Buffers: shared read=4",
    "Planning:",
    "  Buffers: shared hit=15"
   ]
  },
  "leading": {
   "sql": "SELECT id FROM orders WHERE customer_id = 42",
   "plan": [
    "Bitmap Heap Scan on orders (actual rows=50.00 loops=1)",
    "  Recheck Cond: (customer_id = 42)",
    "  Heap Blocks: exact=50",
    "  Buffers: shared hit=54",
    "  ->  Bitmap Index Scan on orders_customer_created_idx (actual rows=50.00 loops=1)",
    "        Index Cond: (customer_id = 42)",
    "        Index Searches: 1",
    "        Buffers: shared hit=4",
    "Planning:",
    "  Buffers: shared hit=3"
   ]
  },
  "second": {
   "sql": "SELECT id FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-03-01 01:00'",
   "plan": [
    "Seq Scan on orders (actual rows=60.00 loops=1)",
    "  Filter: ((created_at >= '2026-03-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2026-03-01 01:00:00+00'::timestamp with time zone))",
    "  Rows Removed by Filter: 499940",
    "  Buffers: shared hit=5436",
    "Planning:",
    "  Buffers: shared hit=15"
   ]
  },
  "sorted": {
   "sql": "SELECT id, created_at FROM orders WHERE customer_id = 42 ORDER BY created_at DESC LIMIT 5",
   "plan": [
    "Limit (actual rows=5.00 loops=1)",
    "  Buffers: shared hit=8",
    "  ->  Index Scan Backward using orders_customer_created_idx on orders (actual rows=5.00 loops=1)",
    "        Index Cond: (customer_id = 42)",
    "        Index Searches: 1",
    "        Buffers: shared hit=8",
    "Planning:",
    "  Buffers: shared hit=37"
   ]
  },
  "skip": {
   "sql": "SELECT id FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-03-01 01:00'",
   "plan": [
    "Index Scan using orders_status_created_idx on orders (actual rows=60.00 loops=1)",
    "  Index Cond: ((created_at >= '2026-03-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2026-03-01 01:00:00+00'::timestamp with time zone))",
    "  Index Searches: 11",
    "  Buffers: shared hit=30 read=17",
    "Planning:",
    "  Buffers: shared hit=21"
   ]
  }
 },
 "covering": {
  "plain": {
   "sql": "SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=3377 read=21",
    "  ->  Bitmap Heap Scan on orders (actual rows=5000.00 loops=1)",
    "        Recheck Cond: ((customer_id >= 100) AND (customer_id <= 199))",
    "        Heap Blocks: exact=3375",
    "        Buffers: shared hit=3377 read=21",
    "        ->  Bitmap Index Scan on orders_customer_created_idx (actual rows=5000.00 loops=1)",
    "              Index Cond: ((customer_id >= 100) AND (customer_id <= 199))",
    "              Index Searches: 1",
    "              Buffers: shared hit=2 read=21",
    "Planning:",
    "  Buffers: shared hit=29 read=1"
   ]
  },
  "ddl": "CREATE INDEX orders_customer_incl_idx ON orders (customer_id) INCLUDE (amount);",
  "vacuumed": {
   "sql": "SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=3 read=21",
    "  ->  Index Only Scan using orders_customer_incl_idx on orders (actual rows=5000.00 loops=1)",
    "        Index Cond: ((customer_id >= 100) AND (customer_id <= 199))",
    "        Heap Fetches: 0",
    "        Index Searches: 1",
    "        Buffers: shared hit=3 read=21",
    "Planning:",
    "  Buffers: shared hit=27 read=3"
   ]
  },
  "vmBefore": {
   "all_visible": 5436
  },
  "vmAfterUpdate": {
   "all_visible": 0
  },
  "afterUpdate": {
   "sql": "SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=5522 read=12 dirtied=2",
    "  ->  Index Only Scan using orders_customer_incl_idx on orders (actual rows=5000.00 loops=1)",
    "        Index Cond: ((customer_id >= 100) AND (customer_id <= 199))",
    "        Heap Fetches: 5500",
    "        Index Searches: 1",
    "        Buffers: shared hit=5522 read=12 dirtied=2",
    "Planning:",
    "  Buffers: shared hit=81"
   ]
  },
  "vmAfterVacuum": {
   "all_visible": 5998
  },
  "again": {
   "sql": "SELECT sum(amount) FROM orders WHERE customer_id BETWEEN 100 AND 199",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=34",
    "  ->  Index Only Scan using orders_customer_incl_idx on orders (actual rows=5000.00 loops=1)",
    "        Index Cond: ((customer_id >= 100) AND (customer_id <= 199))",
    "        Heap Fetches: 0",
    "        Index Searches: 1",
    "        Buffers: shared hit=34",
    "Planning:",
    "  Buffers: shared hit=30"
   ]
  },
  "vmShow": " all_visible | all_frozen \n-------------+------------\n        5998 |          0\n(1 row)"
 },
 "sortAvoid": {
  "without": {
   "sql": "SELECT * FROM orders ORDER BY created_at DESC LIMIT 10",
   "plan": [
    "Limit (actual rows=10.00 loops=1)",
    "  Buffers: shared hit=6001",
    "  ->  Sort (actual rows=10.00 loops=1)",
    "        Sort Key: created_at DESC",
    "        Sort Method: top-N heapsort  Memory: 27kB",
    "        Buffers: shared hit=6001",
    "        ->  Seq Scan on orders (actual rows=500000.00 loops=1)",
    "              Buffers: shared hit=5998",
    "Planning:",
    "  Buffers: shared hit=46"
   ]
  },
  "with": {
   "sql": "SELECT * FROM orders ORDER BY created_at DESC LIMIT 10",
   "plan": [
    "Limit (actual rows=10.00 loops=1)",
    "  Buffers: shared hit=2 read=3",
    "  ->  Index Scan Backward using orders_created_idx on orders (actual rows=10.00 loops=1)",
    "        Index Searches: 1",
    "        Buffers: shared hit=2 read=3",
    "Planning:",
    "  Buffers: shared hit=46"
   ]
  }
 },
 "writes": [
  {
   "indexes": 0,
   "columns": [],
   "rowsPerSec": 1149425,
   "ms": 174,
   "wal": 22372832,
   "idx": 0,
   "heap": 17833984
  },
  {
   "indexes": 1,
   "columns": [
    "id"
   ],
   "rowsPerSec": 576369,
   "ms": 347,
   "wal": 35625256,
   "idx": 4513792,
   "heap": 17833984
  },
  {
   "indexes": 3,
   "columns": [
    "id",
    "customer_id",
    "created_at"
   ],
   "rowsPerSec": 250000,
   "ms": 800,
   "wal": 63364056,
   "idx": 11296768,
   "heap": 17833984
  },
  {
   "indexes": 6,
   "columns": [
    "id",
    "customer_id",
    "created_at",
    "status",
    "amount",
    "customer_id, created_at"
   ],
   "rowsPerSec": 87912,
   "ms": 2275,
   "wal": 111701944,
   "idx": 28909568,
   "heap": 17833984
  }
 ],
 "bloat": [
  {
   "stage": "fresh index",
   "bytes": 3596288,
   "density": 91.61,
   "leaf_pages": 435
  },
  {
   "stage": "after deleting 75 % + VACUUM",
   "bytes": 3596288,
   "density": 23.09,
   "leaf_pages": 435
  },
  {
   "stage": "after REINDEX CONCURRENTLY",
   "bytes": 909312,
   "density": 91.4,
   "leaf_pages": 109
  }
 ],
 "bloatShow": "  size  | avg_leaf_density | leaf_pages | deleted_pages \n--------+------------------+------------+---------------\n 888 kB |             91.4 |        109 |             0\n(1 row)",
 "blocked": "ERROR:  canceling statement due to lock timeout\nLINE 1: INSERT INTO orders_w SELECT * FROM orders WHERE id = 1;\n                    ^",
 "blockedLocks": "   mode    | granted |        query        \n-----------+---------+---------------------\n ShareLock | t       | SELECT pg_sleep(3);\n(1 row)",
 "concurrently": {
  "plainMs": 65,
  "concurrentMs": 85
 },
 "invalid": {
  "error": "ERROR:  could not create unique index \"orders_w_customer_uq\"\nDETAIL:  Key (customer_id)=(2017) is duplicated.",
  "describe": "         index         | indisvalid \n-----------------------+------------\n orders_w_customer_idx | t\n orders_w_amount_idx   | t\n orders_w_customer_uq  | f\n(3 rows)"
 },
 "unusedSql": "SELECT relname AS table, indexrelname AS index, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size\nFROM pg_stat_user_indexes WHERE relname = 'orders' ORDER BY idx_scan, pg_relation_size(indexrelid) DESC;",
 "unused": " table  |            index            | idx_scan | size  \n--------+-----------------------------+----------+-------\n orders | orders_customer_incl_idx    |        0 | 23 MB\n orders | orders_created_idx          |        1 | 11 MB\n orders | orders_customer_created_idx |       20 | 15 MB\n orders | orders_pkey                 |       20 | 11 MB\n(4 rows)",
 "partial": {
  "ddl": "CREATE INDEX orders_new_created_idx ON orders (created_at) WHERE status = 'NEW';",
  "plan": {
   "sql": "SELECT id, created_at FROM orders WHERE status = 'NEW' ORDER BY created_at LIMIT 20",
   "plan": [
    "Limit (actual rows=20.00 loops=1)",
    "  Buffers: shared hit=10 read=2",
    "  ->  Index Scan using orders_new_created_idx on orders (actual rows=20.00 loops=1)",
    "        Index Searches: 1",
    "        Buffers: shared hit=10 read=2",
    "Planning:",
    "  Buffers: shared hit=46"
   ]
  },
  "other": {
   "sql": "SELECT id, created_at FROM orders WHERE status = 'PAID' ORDER BY created_at LIMIT 20",
   "plan": [
    "Limit (actual rows=20.00 loops=1)",
    "  Buffers: shared hit=42 read=2",
    "  ->  Index Scan using orders_created_idx on orders (actual rows=20.00 loops=1)",
    "        Filter: (status = 'PAID'::text)",
    "        Rows Removed by Filter: 172",
    "        Index Searches: 1",
    "        Buffers: shared hit=42 read=2",
    "Planning:",
    "  Buffers: shared hit=51"
   ]
  },
  "sizes": {
   "partial": 245760,
   "full": 11255808
  }
 },
 "expression": {
  "before": {
   "sql": "SELECT id FROM customers WHERE lower(email) = 'user42@example.com'",
   "plan": [
    "Seq Scan on customers (actual rows=1.00 loops=1)",
    "  Filter: (lower(email) = 'user42@example.com'::text)",
    "  Rows Removed by Filter: 9999",
    "  Buffers: shared read=109",
    "Planning:",
    "  Buffers: shared hit=9"
   ]
  },
  "ddl": "CREATE INDEX customers_email_lower_idx ON customers (lower(email));",
  "after": {
   "sql": "SELECT id FROM customers WHERE lower(email) = 'user42@example.com'",
   "plan": [
    "Index Scan using customers_email_lower_idx on customers (actual rows=1.00 loops=1)",
    "  Index Cond: (lower(email) = 'user42@example.com'::text)",
    "  Index Searches: 1",
    "  Buffers: shared hit=1 read=2",
    "Planning:",
    "  Buffers: shared hit=15"
   ]
  }
 },
 "products": {
  "rows": 200000,
  "heap": 71270400,
  "sample": " id |     name     |                                attrs                                |  tags  \n----+--------------+---------------------------------------------------------------------+--------\n 42 | Summit shirt | {\"size\": \"XL\", \"brand\": \"brand42\", \"color\": \"red\", \"weight_g\": 142} | {sale}\n(1 row)"
 },
 "gin": {
  "before": {
   "json": {
    "sql": "SELECT id, name FROM products WHERE attrs @> '{\"brand\": \"brand8\", \"color\": \"red\", \"size\": \"M\"}'",
    "plan": [
     "Seq Scan on products (actual rows=333.00 loops=1)",
     "  Filter: (attrs @> '{\"size\": \"M\", \"brand\": \"brand8\", \"color\": \"red\"}'::jsonb)",
     "  Rows Removed by Filter: 199667",
     "  Buffers: shared hit=8700",
     "Planning:",
     "  Buffers: shared hit=24"
    ]
   },
   "trgm": {
    "sql": "SELECT id, name FROM products WHERE description ILIKE '%model 4242%'",
    "plan": [
     "Seq Scan on products (actual rows=11.00 loops=1)",
     "  Filter: (description ~~* '%model 4242%'::text)",
     "  Rows Removed by Filter: 199989",
     "  Buffers: shared hit=8700",
     "Planning:",
     "  Buffers: shared hit=24"
    ]
   }
  },
  "ddl": {
   "json": "CREATE INDEX products_attrs_idx ON products USING gin (attrs);",
   "jsonPath": "CREATE INDEX products_attrs_path_idx ON products USING gin (attrs jsonb_path_ops);",
   "tags": "CREATE INDEX products_tags_idx ON products USING gin (tags);",
   "fts": "CREATE INDEX products_search_idx ON products USING gin (search);",
   "trgm": "CREATE INDEX products_description_trgm_idx ON products USING gin (description gin_trgm_ops);"
  },
  "buildMs": {
   "json": 312,
   "jsonPath": 173,
   "tags": 106,
   "fts": 598,
   "trgm": 1008
  },
  "json": {
   "sql": "SELECT id, name FROM products WHERE attrs @> '{\"brand\": \"brand8\", \"color\": \"red\", \"size\": \"M\"}'",
   "plan": [
    "Bitmap Heap Scan on products (actual rows=333.00 loops=1)",
    "  Recheck Cond: (attrs @> '{\"size\": \"M\", \"brand\": \"brand8\", \"color\": \"red\"}'::jsonb)",
    "  Heap Blocks: exact=333",
    "  Buffers: shared hit=534",
    "  ->  Bitmap Index Scan on products_attrs_idx (actual rows=333.00 loops=1)",
    "        Index Cond: (attrs @> '{\"size\": \"M\", \"brand\": \"brand8\", \"color\": \"red\"}'::jsonb)",
    "        Index Searches: 1",
    "        Buffers: shared hit=201",
    "Planning:",
    "  Buffers: shared hit=131 read=1"
   ]
  },
  "jsonBroad": {
   "sql": "SELECT id FROM products WHERE attrs @> '{\"color\": \"red\", \"size\": \"M\"}'",
   "plan": [
    "Bitmap Heap Scan on products (actual rows=8334.00 loops=1)",
    "  Recheck Cond: (attrs @> '{\"size\": \"M\", \"color\": \"red\"}'::jsonb)",
    "  Heap Blocks: exact=8333",
    "  Buffers: shared hit=8466",
    "  ->  Bitmap Index Scan on products_attrs_idx (actual rows=8334.00 loops=1)",
    "        Index Cond: (attrs @> '{\"size\": \"M\", \"color\": \"red\"}'::jsonb)",
    "        Index Searches: 1",
    "        Buffers: shared hit=133",
    "Planning:",
    "  Buffers: shared hit=124"
   ]
  },
  "tags": {
   "sql": "SELECT count(*) FROM products WHERE tags @> ARRAY['new', 'sale']",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=8720",
    "  ->  Bitmap Heap Scan on products (actual rows=10000.00 loops=1)",
    "        Recheck Cond: (tags @> '{new,sale}'::text[])",
    "        Heap Blocks: exact=8700",
    "        Buffers: shared hit=8720",
    "        ->  Bitmap Index Scan on products_tags_idx (actual rows=10000.00 loops=1)",
    "              Index Cond: (tags @> '{new,sale}'::text[])",
    "              Index Searches: 1",
    "              Buffers: shared hit=20",
    "Planning:",
    "  Buffers: shared hit=174 read=2"
   ]
  },
  "fts": {
   "sql": "SELECT id, name FROM products WHERE search @@ to_tsquery('english', 'waterproof & wool & skiing') LIMIT 5",
   "plan": [
    "Limit (actual rows=5.00 loops=1)",
    "  Buffers: shared hit=43",
    "  ->  Bitmap Heap Scan on products (actual rows=5.00 loops=1)",
    "        Recheck Cond: (search @@ '''waterproof'' & ''wool'' & ''ski'''::tsquery)",
    "        Heap Blocks: exact=5",
    "        Buffers: shared hit=43",
    "        ->  Bitmap Index Scan on products_search_idx (actual rows=529.00 loops=1)",
    "              Index Cond: (search @@ '''waterproof'' & ''wool'' & ''ski'''::tsquery)",
    "              Index Searches: 1",
    "              Buffers: shared hit=37",
    "Planning:",
    "  Buffers: shared hit=137 read=14"
   ]
  },
  "trgm": {
   "sql": "SELECT id, name FROM products WHERE description ILIKE '%model 4242%'",
   "plan": [
    "Bitmap Heap Scan on products (actual rows=11.00 loops=1)",
    "  Recheck Cond: (description ~~* '%model 4242%'::text)",
    "  Heap Blocks: exact=3",
    "  Buffers: shared hit=240",
    "  ->  Bitmap Index Scan on products_description_trgm_idx (actual rows=11.00 loops=1)",
    "        Index Cond: (description ~~* '%model 4242%'::text)",
    "        Index Searches: 1",
    "        Buffers: shared hit=237",
    "Planning:",
    "  Buffers: shared hit=132"
   ]
  },
  "tsvector": "     name     |                                        search                                         \n--------------+---------------------------------------------------------------------------------------\n Summit shirt | '42':10 'design':6 'model':9 'nylon':5 'shirt':2 'summit':1 'travel':8 'waterproof':4\n(1 row)",
  "trigrams": "          show_trgm          \n-----------------------------\n {\"  w\",\" wo\",\"ol \",ool,woo}\n(1 row)",
  "jsonPath": {
   "sql": "SELECT id, name FROM products WHERE attrs @> '{\"brand\": \"brand8\", \"color\": \"red\", \"size\": \"M\"}'",
   "plan": [
    "Bitmap Heap Scan on products (actual rows=333.00 loops=1)",
    "  Recheck Cond: (attrs @> '{\"size\": \"M\", \"brand\": \"brand8\", \"color\": \"red\"}'::jsonb)",
    "  Heap Blocks: exact=333",
    "  Buffers: shared hit=369",
    "  ->  Bitmap Index Scan on products_attrs_path_idx (actual rows=333.00 loops=1)",
    "        Index Cond: (attrs @> '{\"size\": \"M\", \"brand\": \"brand8\", \"color\": \"red\"}'::jsonb)",
    "        Index Searches: 1",
    "        Buffers: shared hit=36",
    "Planning:",
    "  Buffers: shared hit=150"
   ]
  }
 },
 "sizes": {
  "products": [
   {
    "name": "products_description_trgm_idx",
    "method": "gin",
    "bytes": 15630336
   },
   {
    "name": "products_search_idx",
    "method": "gin",
    "bytes": 13443072
   },
   {
    "name": "products_sku_btree_idx",
    "method": "btree",
    "bytes": 8151040
   },
   {
    "name": "products_sku_hash_idx",
    "method": "hash",
    "bytes": 6635520
   },
   {
    "name": "products_pkey",
    "method": "btree",
    "bytes": 4513792
   },
   {
    "name": "products_attrs_idx",
    "method": "gin",
    "bytes": 3039232
   },
   {
    "name": "products_attrs_path_idx",
    "method": "gin",
    "bytes": 2187264
   },
   {
    "name": "products_tags_idx",
    "method": "gin",
    "bytes": 303104
   }
  ]
 },
 "hash": {
  "ddl": "CREATE INDEX products_sku_hash_idx ON products USING hash (sku);",
  "plan": {
   "sql": "SELECT id FROM products WHERE sku = 'SKU-b33e76f2-4242'",
   "plan": [
    "Index Scan using products_sku_hash_idx on products (actual rows=1.00 loops=1)",
    "  Index Cond: (sku = 'SKU-b33e76f2-4242'::text)",
    "  Index Searches: 1",
    "  Buffers: shared hit=2",
    "Planning:",
    "  Buffers: shared hit=3"
   ]
  }
 },
 "gist": {
  "ddl": "CREATE TABLE bookings (\n  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,\n  room_id int NOT NULL,\n  during tstzrange NOT NULL,\n  EXCLUDE USING gist (room_id WITH =, during WITH &&)\n);",
  "rows": 24400,
  "ok": " room_id |                       during                        \n---------+-----------------------------------------------------\n       7 | [\"2026-03-10 14:00:00+00\",\"2026-03-11 11:00:00+00\")\n(1 row)",
  "conflict": "ERROR:  conflicting key value violates exclusion constraint \"bookings_room_id_during_excl\"\nDETAIL:  Key (room_id, during)=(7, [\"2026-03-10 18:00:00+00\",\"2026-03-12 11:00:00+00\")) conflicts with existing key (room_id, during)=(7, [\"2026-03-10 14:00:00+00\",\"2026-03-11 11:00:00+00\")).",
  "overlap": {
   "sql": "SELECT id, during FROM bookings WHERE room_id = 7 AND during && tstzrange('2026-03-10', '2026-03-12')",
   "plan": [
    "Index Scan using bookings_room_id_during_excl on bookings (actual rows=2.00 loops=1)",
    "  Index Cond: ((room_id = 7) AND (during && '[\"2026-03-10 00:00:00+00\",\"2026-03-12 00:00:00+00\")'::tstzrange))",
    "  Index Searches: 1",
    "  Buffers: shared hit=52",
    "Planning:",
    "  Buffers: shared hit=60"
   ]
  },
  "knn": {
   "sql": "SELECT id, location, location <-> point '(50, 50)' AS distance FROM stores ORDER BY location <-> point '(50, 50)' LIMIT 3",
   "plan": [
    "Limit (actual rows=3.00 loops=1)",
    "  Buffers: shared hit=4 read=3",
    "  ->  Index Scan using stores_location_idx on stores (actual rows=3.00 loops=1)",
    "        Order By: (location <-> '(50,50)'::point)",
    "        Index Searches: 1",
    "        Buffers: shared hit=4 read=3",
    "Planning:",
    "  Buffers: shared hit=60 read=2"
   ]
  },
  "knnRows": "  id   |   location    | distance \n-------+---------------+----------\n 69529 | (50.04,50.06) |    0.072\n 23400 | (49.81,49.95) |    0.196\n 89150 | (50.14,49.79) |    0.252\n(3 rows)",
  "sizes": [
   {
    "name": "stores",
    "bytes": 6029312
   },
   {
    "name": "stores_location_idx",
    "bytes": 6594560
   },
   {
    "name": "bookings",
    "bytes": 1671168
   },
   {
    "name": "bookings_room_id_during_excl",
    "bytes": 1761280
   }
  ]
 },
 "brin": {
  "rows": 2000000,
  "seq": {
   "sql": "SELECT count(*) FROM events WHERE created_at >= '2026-02-01 10:00' AND created_at < '2026-02-01 11:00'",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=16098 read=4521 written=40",
    "  ->  Seq Scan on events (actual rows=1200.00 loops=1)",
    "        Filter: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "        Rows Removed by Filter: 1998800",
    "        Buffers: shared hit=16098 read=4521 written=40",
    "Planning:",
    "  Buffers: shared hit=15 read=1"
   ]
  },
  "btreeBuildMs": 1671,
  "btree": {
   "sql": "SELECT count(*) FROM events WHERE created_at >= '2026-02-01 10:00' AND created_at < '2026-02-01 11:00'",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=14 read=6",
    "  ->  Index Scan using events_created_btree on events (actual rows=1200.00 loops=1)",
    "        Index Cond: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "        Index Searches: 1",
    "        Buffers: shared hit=14 read=6",
    "Planning:",
    "  Buffers: shared hit=67 read=1"
   ]
  },
  "ddl": "CREATE INDEX events_created_brin ON events USING brin (created_at);",
  "brinBuildMs": 341,
  "brin": {
   "sql": "SELECT count(*) FROM events WHERE created_at >= '2026-02-01 10:00' AND created_at < '2026-02-01 11:00'",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=136",
    "  ->  Bitmap Heap Scan on events (actual rows=1200.00 loops=1)",
    "        Recheck Cond: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "        Rows Removed by Index Recheck: 11216",
    "        Heap Blocks: lossy=128",
    "        Buffers: shared hit=136",
    "        ->  Bitmap Index Scan on events_created_brin (actual rows=1280.00 loops=1)",
    "              Index Cond: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "              Index Searches: 1",
    "              Buffers: shared hit=8",
    "Planning:",
    "  Buffers: shared hit=39 read=1"
   ]
  },
  "sizes": {
   "heap": 168910848,
   "brin": 24576,
   "btree": 44949504
  },
  "summary": " blknum |                       value                        \n--------+----------------------------------------------------\n      0 | {2026-01-01 00:00:03+00 .. 2026-01-01 10:20:48+00}\n    128 | {2026-01-01 10:20:51+00 .. 2026-01-01 20:41:36+00}\n    256 | {2026-01-01 20:41:39+00 .. 2026-01-02 07:02:24+00}\n(3 rows)",
  "correlation": 1,
  "shuffled": {
   "sql": "SELECT count(*) FROM events_shuffled WHERE created_at >= '2026-02-01 10:00' AND created_at < '2026-02-01 11:00'",
   "plan": [
    "Aggregate (actual rows=1.00 loops=1)",
    "  Buffers: shared hit=9 read=20672 written=4792",
    "  ->  Bitmap Heap Scan on events_shuffled (actual rows=1200.00 loops=1)",
    "        Recheck Cond: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "        Rows Removed by Index Recheck: 1998800",
    "        Heap Blocks: lossy=20672",
    "        Buffers: shared hit=9 read=20672 written=4792",
    "        ->  Bitmap Index Scan on events_shuffled_brin (actual rows=206720.00 loops=1)",
    "              Index Cond: ((created_at >= '2026-02-01 10:00:00+00'::timestamp with time zone) AND (created_at < '2026-02-01 11:00:00+00'::timestamp with time zone))",
    "              Index Searches: 1",
    "              Buffers: shared hit=9",
    "Planning:",
    "  Buffers: shared hit=67 read=1"
   ]
  },
  "shuffledCorrelation": 0.002266735
 }
} as const
