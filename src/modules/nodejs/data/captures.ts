// Recorded with Node.js v24.21.0 on Linux by tools/node-capture — do not edit by hand.

export const CAPTURE = {
 "node": "v24.21.0",
 "runtime": {
  "versions": {
   "node": "24.21.0",
   "v8": "13.6.233.17-node.53",
   "uv": "1.52.1",
   "openssl": "3.5.8",
   "modules": "137"
  },
  "pid": "number",
  "before": [
   {
    "name": "MainThread",
    "count": 1
   },
   {
    "name": "DelayedTaskSche",
    "count": 1
   },
   {
    "name": "V8Worker",
    "count": 4
   },
   {
    "name": "SignalInspector",
    "count": 1
   }
  ],
  "after": [
   {
    "name": "MainThread",
    "count": 1
   },
   {
    "name": "DelayedTaskSche",
    "count": 1
   },
   {
    "name": "V8Worker",
    "count": 4
   },
   {
    "name": "SignalInspector",
    "count": 1
   },
   {
    "name": "libuv-worker",
    "count": 4
   }
  ],
  "threadpool": "4 (default)"
 },
 "order": {
  "esm": {
   "basics": [
    "sync 1",
    "sync 2",
    "promise.then",
    "queueMicrotask",
    "nextTick",
    "setTimeout 0",
    "setImmediate"
   ],
   "nested": [
    "promise 1",
    "promise inside promise",
    "nextTick 1",
    "nextTick inside promise",
    "nextTick inside nextTick",
    "promise inside nextTick"
   ],
   "io": [
    "readFile callback",
    "nextTick",
    "setImmediate",
    "setTimeout 0"
   ],
   "async": [
    "main: before",
    "work: start",
    "main: after",
    "work: after await",
    "work: resolved"
   ],
   "timers": [
    "immediate 1",
    "immediate 2",
    "timeout A",
    "nextTick from A",
    "promise from A",
    "timeout B"
   ]
  },
  "cjs": {
   "basics": [
    "sync 1",
    "sync 2",
    "nextTick",
    "promise.then",
    "queueMicrotask",
    "setTimeout 0",
    "setImmediate"
   ],
   "nested": [
    "nextTick 1",
    "nextTick inside nextTick",
    "promise 1",
    "promise inside nextTick",
    "promise inside promise",
    "nextTick inside promise"
   ],
   "io": [
    "readFile callback",
    "nextTick",
    "setImmediate",
    "setTimeout 0"
   ],
   "async": [
    "main: before",
    "work: start",
    "main: after",
    "work: after await",
    "work: resolved"
   ],
   "timers": [
    "immediate 1",
    "immediate 2",
    "timeout A",
    "nextTick from A",
    "promise from A",
    "timeout B"
   ]
  }
 },
 "race": {
  "runs": 200,
  "firsts": {
   "timeout": 8,
   "immediate": 192
  }
 },
 "starve": {
  "nextTick": {
   "iterations": 200000,
   "timerFiredAfterIterations": 200000,
   "timerFiredAtMs": 17
  },
  "setImmediate": {
   "iterations": 200000,
   "timerFiredAfterIterations": 140,
   "timerFiredAtMs": 1
  }
 },
 "blocking": {
  "ticks": [
   101,
   201,
   302,
   "blocked 351-1351",
   1351,
   1452,
   1551,
   1652,
   1753,
   1853
  ],
  "delayMs": {
   "mean": 22,
   "max": 1004,
   "p50": 10
  }
 },
 "worker": {
  "ticks": [
   101,
   201,
   301,
   401,
   502,
   601,
   701,
   802,
   902,
   1002,
   1103,
   1203,
   1303,
   "worker 351-1381",
   1404,
   1505,
   1604,
   1704,
   1804
  ]
 },
 "threadpool": [
  {
   "pool": 1,
   "mainThreadFreeAfterMs": 0,
   "tasks": [
    {
     "task": 1,
     "doneMs": 96
    },
    {
     "task": 2,
     "doneMs": 190
    },
    {
     "task": 3,
     "doneMs": 284
    },
    {
     "task": 4,
     "doneMs": 377
    }
   ]
  },
  {
   "pool": 2,
   "mainThreadFreeAfterMs": 0,
   "tasks": [
    {
     "task": 1,
     "doneMs": 97
    },
    {
     "task": 2,
     "doneMs": 99
    },
    {
     "task": 3,
     "doneMs": 191
    },
    {
     "task": 4,
     "doneMs": 198
    }
   ]
  },
  {
   "pool": 4,
   "mainThreadFreeAfterMs": 0,
   "tasks": [
    {
     "task": 1,
     "doneMs": 103
    },
    {
     "task": 2,
     "doneMs": 105
    },
    {
     "task": 3,
     "doneMs": 101
    },
    {
     "task": 4,
     "doneMs": 101
    }
   ]
  }
 ],
 "async": {
  "sequentialMs": 601,
  "parallelMs": 201,
  "allError": "payment service down",
  "allSettled": [
   {
    "status": "fulfilled",
    "value": "a"
   },
   {
    "status": "rejected",
    "reason": "payment service down"
   },
   {
    "status": "fulfilled",
    "value": "c"
   }
  ],
  "forEachDoneRightAfter": [],
  "forEachDoneLater": [
   1,
   2,
   3
  ],
  "forOfDone": [
   1,
   2,
   3
  ]
 },
 "errors": {
  "unhandled": {
   "stdout": "",
   "stderr": "file:///app/unhandled.mjs:3\nPromise.reject(new Error('card declined'))\n               ^\n\nError: card declined",
   "exit": 1
  },
  "tryCatch": {
   "stdout": "try block finished without error",
   "stderr": "file:///app/trycatch.mjs:3\n  setTimeout(() => { throw new Error('thrown inside setTimeout') }, 0)\n                     ^\n\nError: thrown inside setTimeout",
   "exit": 1
  },
  "awaitCatch": {
   "stdout": "caught: card declined",
   "stderr": "",
   "exit": 0
  }
 },
 "streams": {
  "defaults": {
   "writable": 65536,
   "readable": 65536,
   "objectMode": 16,
   "fileRead": 65536
  },
  "fileChunks": {
   "fileBytes": 1048576,
   "chunks": 16,
   "sizes": [
    65536
   ]
  },
  "ignoring": {
   "chunksWritten": 2000,
   "firstFalseAt": 15,
   "falseCount": 1985,
   "maxBufferedBytes": 2048000
  },
  "respecting": {
   "chunksWritten": 2000,
   "waitsForDrain": 125,
   "maxBufferedBytes": 16384
  },
  "pipeline": {
   "error": "disk full",
   "sourceDestroyed": true,
   "middleDestroyed": true
  }
 },
 "http": {
  "defaults": {
   "keepAliveTimeout": 5000,
   "headersTimeout": 60000,
   "requestTimeout": 300000,
   "maxHeaderSize": 16384
  },
  "events": [
   "connection: socket 1 opened",
   "request GET /health on socket 1",
   "request GET /orders/42 on socket 1",
   "request GET /report on socket 1",
   "request POST /orders on socket 1",
   "  data event: 30 bytes",
   "  data event: 53 bytes",
   "  end event"
  ],
  "exchanges": [
   {
    "request": "GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n",
    "response": "HTTP/1.1 200 OK\r\nDate: Sat, 10 Oct 2026 06:59:41 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nContent-Length: 2\r\n\r\nok"
   },
   {
    "request": "GET /orders/42 HTTP/1.1\r\nHost: localhost\r\n\r\n",
    "response": "HTTP/1.1 200 OK\r\ncontent-type: application/json\r\nDate: Sat, 10 Oct 2026 06:59:42 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nTransfer-Encoding: chunked\r\n\r\n19\r\n{\"id\":42,\"status\":\"PAID\"}\r\n0\r\n\r\n"
   },
   {
    "request": "GET /report HTTP/1.1\r\nHost: localhost\r\n\r\n",
    "response": "HTTP/1.1 200 OK\r\ncontent-type: text/plain\r\nDate: Sat, 10 Oct 2026 06:59:42 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nTransfer-Encoding: chunked\r\n\r\n7\r\npart 1\n\r\n7\r\npart 2\n\r\n0\r\n\r\n"
   },
   {
    "request": "POST /orders HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: 83\r\n\r\n{\"customerId\":7,\"amount\":\"25.00\",\"note\":\"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\"}",
    "response": "HTTP/1.1 201 Created\r\ncontent-type: application/json\r\nDate: Sat, 10 Oct 2026 06:59:42 GMT\r\nConnection: keep-alive\r\nKeep-Alive: timeout=5\r\nTransfer-Encoding: chunked\r\n\r\nf\r\n{\"received\":83}\r\n0\r\n\r\n"
   }
  ]
 },
 "shutdown": {
  "abrupt": {
   "log": "    8 ms  listening\n  238 ms  request /checkout started",
   "exit": {
    "code": null,
    "signal": "SIGTERM"
   },
   "client": "error: socket hang up (ECONNRESET)"
  },
  "graceful": {
   "log": "    8 ms  listening\n  236 ms  request /checkout started\n  433 ms  SIGTERM received: stop accepting, finish in-flight requests\n 1240 ms  request /checkout finished\n 1241 ms  all connections closed, exiting",
   "exit": {
    "code": 0,
    "signal": null
   },
   "client": "200 done"
  }
 },
 "modules": {
  "sources": {
   "counter.cjs": "let count = 0\nmodule.exports = { next: () => ++count }\nconsole.log('counter.cjs evaluated')",
   "cache.cjs": "const a = require('./counter.cjs')\nconst b = require('./counter.cjs')\nconsole.log('same object:', a === b)\nconsole.log(a.next(), b.next(), a.next())",
   "math.cjs": "exports.add = (x, y) => x + y\nexports.version = '1.0'",
   "import-cjs.mjs": "import { add } from './math.cjs'\nimport math from './math.cjs'\nconsole.log(add(2, 3), math.version)",
   "money.mjs": "export const format = (cents) => (cents / 100).toFixed(2)\nexport default 'money'",
   "require-esm.cjs": "const money = require('./money.mjs')\nconsole.log(Object.keys(money), money.format(2500), money.default)",
   "slow.mjs": "await new Promise((r) => setTimeout(r, 10))\nexport const ready = true",
   "require-tla.cjs": "require('./slow.mjs')",
   "paths.mjs": "console.log(import.meta.dirname === undefined ? 'no dirname' : 'import.meta.dirname ok', typeof import.meta.filename)\nconsole.log(__dirname)",
   "pkg/index.js": "console.log(typeof require === 'undefined' ? '.js is an ES module here' : '.js is CommonJS here')",
   "detect/index.js": "import { platform } from 'node:os'\nconsole.log('ESM syntax detected, platform:', typeof platform())",
   "plain/index.js": "console.log(typeof require === 'undefined' ? '.js is an ES module here' : '.js is CommonJS here')"
  },
  "runs": [
   {
    "file": "cache.cjs",
    "stdout": "counter.cjs evaluated\nsame object: true\n1 2 3",
    "stderr": "",
    "exit": 0
   },
   {
    "file": "import-cjs.mjs",
    "stdout": "5 1.0",
    "stderr": "",
    "exit": 0
   },
   {
    "file": "require-esm.cjs",
    "stdout": "[ '__esModule', 'default', 'format' ] 25.00 money",
    "stderr": "",
    "exit": 0
   },
   {
    "file": "require-tla.cjs",
    "stdout": "",
    "stderr": "node:internal/modules/esm/module_job:313\n    throw new ERR_REQUIRE_ASYNC_MODULE(filename, parent, locations);\n    ^\n\nError [ERR_REQUIRE_ASYNC_MODULE]: require() cannot be used on an ESM graph with top-level await. Use import() instead. To see where the top-level await comes from, use --experimental-print-required-tla.\nRequired module: /app/slow.mjs\nRequire stack:\n- /app/require-tla.cjs",
    "exit": 1
   },
   {
    "file": "paths.mjs",
    "stdout": "import.meta.dirname ok string",
    "stderr": "file:///app/paths.mjs:2\nconsole.log(__dirname)\n            ^\n\nReferenceError: __dirname is not defined in ES module scope",
    "exit": 1
   },
   {
    "file": "pkg/index.js",
    "stdout": ".js is an ES module here",
    "stderr": "",
    "exit": 0
   },
   {
    "file": "plain/index.js",
    "stdout": ".js is CommonJS here",
    "stderr": "",
    "exit": 0
   },
   {
    "file": "detect/index.js",
    "stdout": "ESM syntax detected, platform: string",
    "stderr": "",
    "exit": 0
   }
  ]
 }
} as const
