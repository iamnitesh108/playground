// Recorded by tools/redis-capture/capture-kubernetes.mjs (podman, docker.io/redis:8.10.2) — do not edit by hand.
// No Kubernetes cluster was used: the manifests' files were mounted into containers as a pod would see them.

export const K8S = {
 "image": "docker.io/redis:8.10.2",
 "kubeconform": {
  "version": "v0.6.7",
  "out": "Summary: 9 resources found in 5 files - Valid: 8, Invalid: 0, Errors: 0, Skipped: 1",
  "code": 0
 },
 "probesBeforeSync": {
  "redis-1": {
   "ready": {
    "exit": 1,
    "out": "replica not linked to its primary"
   }
  }
 },
 "primaryReplication": [
  "role:master",
  "connected_slaves:1",
  "slave0:ip=redis-1.redis-headless.default.svc.cluster.local,port=6379,state=online,offset=0,lag=0,io-thread=0"
 ],
 "replicaReplication": [
  "role:slave",
  "master_host:redis-0.redis-headless.default.svc.cluster.local",
  "master_port:6379",
  "master_link_status:up"
 ],
 "config": [
  "maxmemory 671088640"
 ],
 "probes": {
  "redis-0": {
   "live": {
    "exit": 0,
    "out": ""
   },
   "ready": {
    "exit": 0,
    "out": ""
   }
  },
  "redis-1": {
   "live": {
    "exit": 0,
    "out": ""
   },
   "ready": {
    "exit": 0,
    "out": ""
   }
  }
 },
 "appUser": [
  {
   "cmd": "SET orders:42 paid",
   "out": "OK"
  },
  {
   "cmd": "GET orders:42",
   "out": "paid"
  },
  {
   "cmd": "SET sessions:9 x",
   "out": "NOPERM No permissions to access a key"
  },
  {
   "cmd": "CONFIG GET maxmemory",
   "out": "NOPERM User app has no permissions to run the 'config|get' command"
  },
  {
   "cmd": "FLUSHALL",
   "out": "NOPERM User app has no permissions to run the 'flushall' command"
  }
 ],
 "defaultUser": "NOAUTH Authentication required.",
 "replicaRead": "paid",
 "backup": {
  "code": 0,
  "out": "-rw------- 1 redis redis 7989074 Oct 18 02:15 dump-20261018-0215.rdb"
 },
 "shutdownLog": [
  "* Creating AOF base file appendonly.aof.1.base.rdb on server start",
  "* Creating AOF incr file appendonly.aof.1.incr.aof on server start",
  "1:signal-handler (1792299606) Received SIGTERM scheduling shutdown...",
  "* Calling fsync() on the AOF file.",
  "* Saving the final RDB snapshot before exiting.",
  "# Redis is now ready to exit, bye bye..."
 ],
 "loading": {
  "naive": "LOADING Redis is loading the dataset in memory\n\nexit code 0",
  "live": {
   "exit": 0,
   "out": ""
  },
  "ready": {
   "exit": 1,
   "out": "LOADING Redis is loading the dataset in memory"
  },
  "readyAfterSeconds": 24,
  "keys": 300000
 },
 "clusterSlots": "1) 1) (integer) 0\n   2) (integer) 16383\n   3) 1) \"redis-0.redis-headless.default.svc.cluster.local\"\n      2) (integer) 6379\n      3) \"09f20c3c…\"\n      4) 1) \"ip\"\n         2) \"\"",
 "sentinel": {
  "addr": "1) \"localhost\"\n2) \"6379\"",
  "conf": [
   "port 26379",
   "sentinel resolve-hostnames yes",
   "sentinel announce-hostnames yes",
   "sentinel monitor orders localhost 6379 1"
  ]
 }
} as const
