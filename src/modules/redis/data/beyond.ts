// Recorded from Redis 8.10.2 (docker.io/redis:8) by tools/redis-capture/capture-beyond.mjs — do not edit by hand.

export const BEYOND = {
 "version": "8.10.2",
 "modules": [
  {
   "name": "bf",
   "ver": "81001"
  },
  {
   "name": "timeseries",
   "ver": "81001"
  },
  {
   "name": "search",
   "ver": "81001"
  },
  {
   "name": "vectorset",
   "ver": "1"
  },
  {
   "name": "ReJSON",
   "ver": "81000"
  }
 ],
 "json": [
  {
   "cmd": "JSON.SET user:1 $ '{\"name\":\"Ada\",\"city\":\"London\",\"age\":36,\"tags\":[\"admin\"],\"address\":{\"zip\":\"N1 9GU\"},\"orders\":[{\"id\":101,\"total\":20.5},{\"id\":102,\"total\":74}]}'",
   "out": "OK"
  },
  {
   "cmd": "JSON.GET user:1 $.name $.address.zip",
   "out": "\"{\\\"$.name\\\":[\\\"Ada\\\"],\\\"$.address.zip\\\":[\\\"N1 9GU\\\"]}\""
  },
  {
   "cmd": "JSON.NUMINCRBY user:1 $.age 1",
   "out": "\"[37]\""
  },
  {
   "cmd": "JSON.ARRAPPEND user:1 $.tags '\"beta\"'",
   "out": "1) (integer) 2"
  },
  {
   "cmd": "JSON.GET user:1 $.orders[*].total",
   "out": "\"[20.5,74]\""
  },
  {
   "cmd": "JSON.GET user:1 $..zip",
   "out": "\"[\\\"N1 9GU\\\"]\""
  },
  {
   "cmd": "JSON.TYPE user:1 $.orders",
   "out": "1) \"array\""
  },
  {
   "cmd": "JSON.SET user:1 $.address.city '\"London\"'",
   "out": "OK"
  },
  {
   "cmd": "JSON.DEL user:1 $.address",
   "out": "(integer) 1"
  },
  {
   "cmd": "JSON.GET user:1",
   "out": "\"{\\\"name\\\":\\\"Ada\\\",\\\"city\\\":\\\"London\\\",\\\"age\\\":37,\\\"tags\\\":[\\\"admin\\\",\\\"beta\\\"],\\\"orders\\\":[{\\\"id\\\":101,\\\"total\\\":20.5},{\\\"id\\\":102,\\\"total\\\":74}]}\""
  }
 ],
 "jsonMemory": {
  "string": 155,
  "json": 408,
  "hash": 67,
  "bytes": 113
 },
 "search": [
  {
   "cmd": "FT.CREATE idx:customer ON JSON PREFIX 1 customer: SCHEMA $.name AS name TEXT $.city AS city TAG $.plan AS plan TAG $.age AS age NUMERIC SORTABLE $.spent AS spent NUMERIC SORTABLE",
   "out": "OK"
  },
  {
   "cmd": "FT.SEARCH idx:customer '@city:{London} @plan:{pro} @age:[30 40]' SORTBY spent DESC LIMIT 0 3 RETURN 3 name age spent",
   "out": "1) (integer) 14\n2) \"customer:813\"\n3) 1) \"spent\"\n   2) \"464.93\"\n   3) \"name\"\n   4) \"Linus 813\"\n   5) \"age\"\n   6) \"30\"\n4) \"customer:731\"\n5) 1) \"spent\"\n   2) \"449.9\"\n   3) \"name\"\n   4) \"Alan 731\"\n   5) \"age\"\n   6) \"30\"\n6) \"customer:66\"\n7) 1) \"spent\"\n   2) \"351.38\"\n   3) \"name\"\n   4) \"Ken 66\"\n   5) \"age\"\n   6) \"40\""
  },
  {
   "cmd": "FT.SEARCH idx:customer '@name:grace' LIMIT 0 0",
   "out": "1) (integer) 100"
  },
  {
   "cmd": "FT.AGGREGATE idx:customer '*' GROUPBY 1 @city REDUCE COUNT 0 AS customers REDUCE AVG 1 @spent AS avg_spent SORTBY 2 @customers DESC",
   "out": "1) (integer) 5\n2) 1) \"city\"\n   2) \"Paris\"\n   3) \"customers\"\n   4) \"207\"\n   5) \"avg_spent\"\n   6) \"248.63\"\n3) 1) \"city\"\n   2) \"London\"\n   3) \"customers\"\n   4) \"205\"\n   5) \"avg_spent\"\n   6) \"259.37\"\n4) 1) \"city\"\n   2) \"Madrid\"\n   3) \"customers\"\n   4) \"202\"\n   5) \"avg_spent\"\n   6) \"256.77\"\n5) 1) \"city\"\n   2) \"Berlin\"\n   3) \"customers\"\n   4) \"202\"\n   5) \"avg_spent\"\n   6) \"268.31\"\n6) 1) \"city\"\n   2) \"Rome\"\n   3) \"customers\"\n   4) \"184\"\n   5) \"avg_spent\"\n   6) \"257.17\""
  },
  {
   "cmd": "FT.EXPLAIN idx:customer '@city:{London} @age:[30 40]'",
   "out": "\"INTERSECT {\\n  TAG:@city {\\n    london\\n  }\\n  NUMERIC {30.000000 <= @age <= 40.000000}\\n}\\n\""
  }
 ],
 "searchInfo": {
  "docs": 1000,
  "invertedMB": 0.1234,
  "totalIndexMB": 0.3637
 },
 "searchVsScan": {
  "docs": 1000,
  "scanned": 1000,
  "hits": 14,
  "searchHits": 14,
  "scanMs": 10,
  "searchMs": 0.6
 },
 "timeseries": [
  {
   "cmd": "TS.CREATE temp:kitchen RETENTION 86400000 DUPLICATE_POLICY LAST LABELS room kitchen type temperature",
   "out": "OK"
  },
  {
   "cmd": "TS.CREATE temp:kitchen:hourly LABELS room kitchen type temperature resolution 1h",
   "out": "OK"
  },
  {
   "cmd": "TS.CREATERULE temp:kitchen temp:kitchen:hourly AGGREGATION avg 3600000",
   "out": "OK"
  },
  {
   "note": "(6 hours of one-minute readings added with TS.ADD in a pipeline)"
  },
  {
   "cmd": "TS.ADD temp:kitchen 1792321600000 21.4",
   "out": "(integer) 1792321600000"
  },
  {
   "cmd": "TS.GET temp:kitchen",
   "out": "1) (integer) 1792321600000\n2) 21.4"
  },
  {
   "cmd": "TS.RANGE temp:kitchen 1792300000000 1792300240000",
   "out": "1) 1) (integer) 1792300000000\n   2) 20.3\n2) 1) (integer) 1792300060000\n   2) 20.19\n3) 1) (integer) 1792300120000\n   2) 20.26\n4) 1) (integer) 1792300180000\n   2) 20.4\n5) 1) (integer) 1792300240000\n   2) 20.44"
  },
  {
   "cmd": "TS.RANGE temp:kitchen - + AGGREGATION max 3600000",
   "out": "1) 1) (integer) 1792299600000\n   2) 21.86\n2) 1) (integer) 1792303200000\n   2) 22.39\n3) 1) (integer) 1792306800000\n   2) 22.28\n4) 1) (integer) 1792310400000\n   2) 20.81\n5) 1) (integer) 1792314000000\n   2) 18.99\n6) 1) (integer) 1792317600000\n   2) 19.52\n7) 1) (integer) 1792321200000\n   2) 21.4"
  },
  {
   "cmd": "TS.RANGE temp:kitchen:hourly - +",
   "out": "1) 1) (integer) 1792299600000\n   2) 21.028333333333332\n2) 1) (integer) 1792303200000\n   2) 22.08933333333333\n3) 1) (integer) 1792306800000\n   2) 21.511499999999995\n4) 1) (integer) 1792310400000\n   2) 19.7325\n5) 1) (integer) 1792314000000\n   2) 18.390333333333327\n6) 1) (integer) 1792317600000\n   2) 18.69583333333333"
  },
  {
   "cmd": "TS.MRANGE - + SELECTED_LABELS resolution COUNT 2 AGGREGATION max 3600000 FILTER room=kitchen type=temperature",
   "out": "1) 1) \"temp:kitchen\"\n   2) 1) 1) \"resolution\"\n         2) (nil)\n   3) 1) 1) (integer) 1792299600000\n         2) 21.86\n      2) 1) (integer) 1792303200000\n         2) 22.39\n2) 1) \"temp:kitchen:hourly\"\n   2) 1) 1) \"resolution\"\n         2) \"1h\"\n   3) 1) 1) (integer) 1792299600000\n         2) 21.028333333333332\n      2) 1) (integer) 1792303200000\n         2) 22.08933333333333"
  }
 ],
 "tsStart": 1792300000000,
 "tsMemory": {
  "samples": 10000,
  "timeseries": 72008,
  "zset": 994659,
  "chunks": 17
 },
 "prob": [
  {
   "cmd": "BF.RESERVE seen:emails 0.01 100000",
   "out": "OK"
  },
  {
   "cmd": "BF.ADD seen:emails ada@example.com",
   "out": "(integer) 1"
  },
  {
   "cmd": "BF.EXISTS seen:emails ada@example.com",
   "out": "(integer) 1"
  },
  {
   "cmd": "BF.EXISTS seen:emails alan@example.com",
   "out": "(integer) 0"
  },
  {
   "cmd": "CF.RESERVE seen:coupons 100000",
   "out": "OK"
  },
  {
   "cmd": "CF.ADD seen:coupons WELCOME10",
   "out": "(integer) 1"
  },
  {
   "cmd": "CF.DEL seen:coupons WELCOME10",
   "out": "(integer) 1"
  },
  {
   "cmd": "CF.EXISTS seen:coupons WELCOME10",
   "out": "(integer) 0"
  },
  {
   "cmd": "CMS.INITBYPROB page:views 0.001 0.01",
   "out": "OK"
  },
  {
   "cmd": "CMS.INCRBY page:views /home 120 /pricing 7",
   "out": "1) (integer) 120\n2) (integer) 7"
  },
  {
   "cmd": "CMS.QUERY page:views /home /pricing /about",
   "out": "1) (integer) 120\n2) (integer) 7\n3) (integer) 0"
  },
  {
   "cmd": "TOPK.RESERVE top:products 3",
   "out": "OK"
  },
  {
   "cmd": "TOPK.ADD top:products p1 p2 p1 p3 p1 p2 p4",
   "out": "1) (nil)\n2) (nil)\n3) (nil)\n4) (nil)\n5) (nil)\n6) (nil)\n7) \"p3\""
  },
  {
   "cmd": "TOPK.LIST top:products WITHCOUNT",
   "out": "1) \"p1\"\n2) (integer) 3\n3) \"p2\"\n4) (integer) 2\n5) \"p4\"\n6) (integer) 1"
  },
  {
   "cmd": "TDIGEST.CREATE latency:ms",
   "out": "OK"
  },
  {
   "cmd": "TDIGEST.ADD latency:ms 12 15 11 230 14 13 16 12 980 15",
   "out": "OK"
  },
  {
   "cmd": "TDIGEST.QUANTILE latency:ms 0.5 0.9 0.99",
   "out": "1) \"15\"\n2) \"980\"\n3) \"980\""
  }
 ],
 "bloom": {
  "n": 100000,
  "target": 0.01,
  "bfFalse": 495,
  "cfFalse": 1196,
  "bf": 137976,
  "cf": 262248,
  "set": 5561837
 },
 "cms": {
  "events": 200000,
  "distinct": 5000,
  "overcounted": 2751,
  "maxOver": 107,
  "epsilonBound": 200,
  "cms": 56064,
  "hash": 219629,
  "topPage": "/p/0",
  "topExact": 11744,
  "topEst": 11744
 },
 "tdigest": {
  "n": 100000,
  "quantiles": [
   {
    "q": 0.5,
    "exact": 18.3,
    "estimate": 18.3
   },
   {
    "q": 0.9,
    "exact": 26.6,
    "estimate": 26.5
   },
   {
    "q": 0.99,
    "exact": 453.5,
    "estimate": 451.9
   },
   {
    "q": 0.999,
    "exact": 898.2,
    "estimate": 899.1
   }
  ],
  "tdigest": 9872,
  "list": 556239
 },
 "vectors": [
  {
   "cmd": "VADD products VALUES 3 0.9 0.1 0.0 p:running-shoe SETATTR '{\"category\":\"shoes\",\"price\":89}'",
   "out": "(integer) 1"
  },
  {
   "cmd": "VADD products VALUES 3 0.8 0.2 0.1 p:trail-shoe SETATTR '{\"category\":\"shoes\",\"price\":120}'",
   "out": "(integer) 1"
  },
  {
   "cmd": "VADD products VALUES 3 0.7 0.0 0.4 p:sports-sock SETATTR '{\"category\":\"socks\",\"price\":9}'",
   "out": "(integer) 1"
  },
  {
   "cmd": "VADD products VALUES 3 0.0 0.9 0.3 p:rain-jacket SETATTR '{\"category\":\"jackets\",\"price\":150}'",
   "out": "(integer) 1"
  },
  {
   "cmd": "VCARD products",
   "out": "(integer) 4"
  },
  {
   "cmd": "VDIM products",
   "out": "(integer) 3"
  },
  {
   "cmd": "VSIM products ELE p:running-shoe WITHSCORES COUNT 3",
   "out": "1) \"p:running-shoe\"\n2) \"0.9999\"\n3) \"p:trail-shoe\"\n4) \"0.9919\"\n5) \"p:sports-sock\"\n6) \"0.9315\""
  },
  {
   "cmd": "VSIM products VALUES 3 0.85 0.1 0.1 WITHSCORES COUNT 3 FILTER '.category == \"shoes\" and .price < 100'",
   "out": "1) \"p:running-shoe\"\n2) \"0.9965\""
  },
  {
   "cmd": "VGETATTR products p:trail-shoe",
   "out": "\"{\\\"category\\\":\\\"shoes\\\",\\\"price\\\":120}\""
  },
  {
   "cmd": "VREM products p:rain-jacket",
   "out": "(integer) 1"
  }
 ],
 "vectorMemory": {
  "n": 2000,
  "dims": 384,
  "raw": 3072000,
  "NOQUANT": 4455149,
  "Q8": 2151149,
  "BIN": 1479149
 },
 "vinfo": [
  "quant-type",
  "int8",
  "hnsw-m",
  "16",
  "vector-dim",
  "384",
  "projection-input-dim",
  "0",
  "size",
  "2000",
  "max-level",
  "5",
  "attributes-count",
  "0",
  "vset-uid",
  "2",
  "hnsw-max-node-uid",
  "2000"
 ]
} as const
