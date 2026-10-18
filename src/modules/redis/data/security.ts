// Recorded from Redis 8.8.3 by tools/redis-capture/capture-security.mjs — do not edit by hand.

export const SECURITY = {
 "version": "8.8.3",
 "protectedConfig": {
  "protected-mode": "yes",
  "bind": "* -::*"
 },
 "lanAvailable": true,
 "protectedMode": [
  {
   "shell": true,
   "cmd": "redis-cli -h 192.168.1.20 PING          # from another machine on the network",
   "out": "DENIED Redis is running in protected mode because protected mode is enabled and no password is set for the default user. In this mode connections are only accepted from the loopback interface. If you want to connect from external computers to Redis you may adopt one of the following solutions: 1) Just disable protected mode sending the command 'CONFIG SET protected-mode no' from the loopback interface by connecting to Redis from the same host the server is running, however MAKE SURE Redis is not publicly accessible from internet if you do so. Use CONFIG REWRITE to make this change permanent. 2) Alternatively you can just disable the protected mode by editing the Redis configuration file, and setting the protected mode option to 'no', and then restarting the server. 3) If you started the server manually just for testing, restart it with the '--protected-mode no' option. 4) Set up an authentication password for the default user. NOTE: You only need to do one of the above things in order for the server to start accepting connections from the outside."
  },
  {
   "shell": true,
   "cmd": "redis-cli -h 127.0.0.1 PING             # on the server itself",
   "out": "PONG"
  }
 ],
 "protectedWithPassword": [
  {
   "shell": true,
   "cmd": "redis-cli -h 192.168.1.20 PING",
   "out": "NOAUTH Authentication required."
  },
  {
   "shell": true,
   "cmd": "redis-cli -h 192.168.1.20 --user default --pass correct-horse-battery PING",
   "out": "PONG"
  }
 ],
 "bindOnly": {
  "shell": true,
  "cmd": "redis-server --bind 0.0.0.0   then from another machine: redis-cli -h 192.168.1.20 PING",
  "out": "DENIED Redis is running in protected mode because protected mode is enabled and no password is set for the default user. In this mode connections are only accepted from the loopback interface. If you want to connect from external computers to Redis you may adopt one of the following solutions: 1) Just disable protected mode sending the command 'CONFIG SET protected-mode no' from the loopback interface by connecting to Redis from the same host the server is running, however MAKE SURE Redis is not publicly accessible from internet if you do so. Use CONFIG REWRITE to make this change permanent. 2) Alternatively you can just disable the protected mode by editing the Redis configuration file, and setting the protected mode option to 'no', and then restarting the server. 3) If you started the server manually just for testing, restart it with the '--protected-mode no' option. 4) Set up an authentication password for the default user. NOTE: You only need to do one of the above things in order for the server to start accepting connections from the outside."
 },
 "unprotected": {
  "shell": true,
  "cmd": "redis-server --protected-mode no   then from another machine: redis-cli -h 192.168.1.20 PING",
  "out": "PONG"
 },
 "offByDefault": [
  {
   "cmd": "CONFIG GET enable-protected-configs",
   "out": "1) \"enable-protected-configs\"\n2) \"no\""
  },
  {
   "cmd": "CONFIG GET enable-module-command",
   "out": "1) \"enable-module-command\"\n2) \"no\""
  },
  {
   "cmd": "CONFIG GET enable-debug-command",
   "out": "1) \"enable-debug-command\"\n2) \"no\""
  },
  {
   "cmd": "CONFIG SET dir /tmp",
   "out": "(error) ERR CONFIG SET failed (possibly related to argument 'dir') - can't set protected config"
  },
  {
   "cmd": "CONFIG SET dbfilename authorized_keys",
   "out": "(error) ERR CONFIG SET failed (possibly related to argument 'dbfilename') - can't set protected config"
  },
  {
   "cmd": "MODULE LOAD /tmp/evil.so",
   "out": "(error) ERR MODULE command not allowed. If the enable-module-command option is set to \"local\", you can run it from a local connection, otherwise you need to set this option in the configuration file, and then restart the server."
  },
  {
   "cmd": "DEBUG SLEEP 1",
   "out": "(error) ERR DEBUG command not allowed. If the enable-debug-command option is set to \"local\", you can run it from a local connection, otherwise you need to set this option in the configuration file, and then restart the server."
  },
  {
   "cmd": "CONFIG SET maxmemory 100mb",
   "out": "OK"
  }
 ],
 "acl": [
  {
   "who": "admin",
   "cmd": "ACL CAT",
   "out": " 1) \"keyspace\"\n 2) \"read\"\n 3) \"write\"\n 4) \"set\"\n 5) \"sortedset\"\n 6) \"list\"\n 7) \"hash\"\n 8) \"string\"\n 9) \"array\"\n10) \"bitmap\"\n11) \"hyperloglog\"\n12) \"geo\"\n13) \"stream\"\n14) \"pubsub\"\n15) \"admin\"\n16) \"fast\"\n17) \"slow\"\n18) \"blocking\"\n19) \"dangerous\"\n20) \"connection\"\n21) \"transaction\"\n22) \"scripting\""
  },
  {
   "who": "admin",
   "cmd": "ACL SETUSER orders-api on >s3cret-orders resetkeys ~orders:* %R~catalog:* resetchannels &orders.* -@all +@read +@write +@string +@hash +@list +@connection +@pubsub -@dangerous",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL GETUSER orders-api",
   "out": " 1) \"flags\"\n 2) 1) \"on\"\n    2) \"sanitize-payload\"\n 3) \"passwords\"\n 4) 1) \"20ad95ab8c8dfedd57150cbf49391a2c0f4d8f3ad56456dd35490f5da7bc5c88\"\n 5) \"commands\"\n 6) \"-@all +@read +@write +@string +@hash +@list +@connection +@pubsub -@dangerous\"\n 7) \"keys\"\n 8) \"~orders:* %R~catalog:*\"\n 9) \"channels\"\n10) \"&orders.*\"\n11) \"selectors\"\n12) (empty array)"
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN orders-api SET orders:42 paid",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN orders-api SET catalog:7 cheap",
   "out": "\"User orders-api has no permissions to access the 'catalog:7' key\""
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN orders-api GET catalog:7",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN orders-api FLUSHDB",
   "out": "\"User orders-api has no permissions to run the 'flushdb' command\""
  },
  {
   "who": "app",
   "cmd": "AUTH orders-api wrong",
   "out": "(error) WRONGPASS invalid username-password pair or user is disabled."
  },
  {
   "who": "app",
   "cmd": "AUTH orders-api s3cret-orders",
   "out": "OK"
  },
  {
   "who": "app",
   "cmd": "HSET orders:42 status paid total 59.90",
   "out": "(integer) 2"
  },
  {
   "who": "app",
   "cmd": "GET catalog:7",
   "out": "(nil)"
  },
  {
   "who": "app",
   "cmd": "SET catalog:7 cheap",
   "out": "(error) NOPERM No permissions to access a key"
  },
  {
   "who": "app",
   "cmd": "GET users:1",
   "out": "(error) NOPERM No permissions to access a key"
  },
  {
   "who": "app",
   "cmd": "PUBLISH orders.created 42",
   "out": "(integer) 0"
  },
  {
   "who": "app",
   "cmd": "PUBLISH users.created 1",
   "out": "(error) NOPERM No permissions to access a channel"
  },
  {
   "who": "app",
   "cmd": "KEYS *",
   "out": "(error) NOPERM User orders-api has no permissions to run the 'keys' command"
  },
  {
   "who": "admin",
   "cmd": "ACL LOG 3",
   "out": "1)  1) \"count\"\n    2) (integer) 1\n    3) \"reason\"\n    4) \"command\"\n    5) \"context\"\n    6) \"toplevel\"\n    7) \"object\"\n    8) \"keys\"\n    9) \"username\"\n   10) \"orders-api\"\n   11) \"age-seconds\"\n   12) \"0.02\"\n   13) \"client-info\"\n   14) \"id=7 addr=10.0.4.12:51734 laddr=10.0.4.5:6379 … cmd=keys user=orders-api …\"\n   15) \"entry-id\"\n   16) (integer) 4\n   17) \"timestamp-created\"\n   18) (integer) 1792300000000\n   19) \"timestamp-last-updated\"\n   20) (integer) 1792300000000\n2)  1) \"count\"\n    2) (integer) 1\n    3) \"reason\"\n    4) \"channel\"\n    5) \"context\"\n    6) \"toplevel\"\n    7) \"object\"\n    8) \"users.created\"\n    9) \"username\"\n   10) \"orders-api\"\n   11) \"age-seconds\"\n   12) \"0.02\"\n   13) \"client-info\"\n   14) \"id=7 addr=10.0.4.12:51734 laddr=10.0.4.5:6379 … cmd=publish user=orders-api …\"\n   15) \"entry-id\"\n   16) (integer) 3\n   17) \"timestamp-created\"\n   18) (integer) 1792300000000\n   19) \"timestamp-last-updated\"\n   20) (integer) 1792300000000\n3)  1) \"count\"\n    2) (integer) 1\n    3) \"reason\"\n    4) \"key\"\n    5) \"context\"\n    6) \"toplevel\"\n    7) \"object\"\n    8) \"users:1\"\n    9) \"username\"\n   10) \"orders-api\"\n   11) \"age-seconds\"\n   12) \"0.02\"\n   13) \"client-info\"\n   14) \"id=7 addr=10.0.4.12:51734 laddr=10.0.4.5:6379 … cmd=get user=orders-api …\"\n   15) \"entry-id\"\n   16) (integer) 2\n   17) \"timestamp-created\"\n   18) (integer) 1792300000000\n   19) \"timestamp-last-updated\"\n   20) (integer) 1792300000000"
  },
  {
   "who": "admin",
   "cmd": "ACL SETUSER reporting on >r3port-only ~* +@read (~audit:* +@write)",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN reporting SET audit:2026-10-18 ok",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL DRYRUN reporting SET orders:42 refunded",
   "out": "\"User reporting has no permissions to access the 'orders:42' key\""
  },
  {
   "who": "admin",
   "cmd": "ACL SETUSER default off",
   "out": "OK"
  },
  {
   "who": "admin",
   "cmd": "ACL LIST",
   "out": "1) \"user default off nopass sanitize-payload ~* &* +@all\"\n2) \"user orders-api on sanitize-payload #20ad95ab8c8dfedd57150cbf49391a2c0f4d8f3ad56456dd35490f5da7bc5c88 ~orders:* %R~catalog:* resetchannels &orders.* -@all +@read +@write +@string +@hash +@list +@connection +@pubsub -@dangerous\"\n3) \"user reporting on sanitize-payload #6cb64b2f368a3e299cc3f39243da72024d9a5ecba227cf42688f6d29afd6354c ~* resetchannels -@all +@read (~audit:* resetchannels -@all +@write)\""
  }
 ],
 "aclCategories": 22,
 "aclfile": {
  "steps": [
   {
    "cmd": "ACL SETUSER metrics on >m3trics +info +ping",
    "out": "OK"
   },
   {
    "cmd": "ACL SAVE",
    "out": "OK"
   }
  ],
  "file": [
   "user default on nopass sanitize-payload ~* &* +@all",
   "user metrics on sanitize-payload #bc14aa7daf9f… resetchannels -@all +info +ping"
  ]
 },
 "aclConf": {
  "steps": [
   {
    "cmd": "ACL SETUSER metrics on >m3trics +info +ping",
    "out": "OK"
   },
   {
    "cmd": "ACL SAVE",
    "out": "(error) ERR This Redis instance is not configured to use an ACL file. You may want to specify users via the ACL SETUSER command and then issue a CONFIG REWRITE (assuming you have a Redis configuration file set) in order to store users in the Redis configuration."
   },
   {
    "cmd": "CONFIG REWRITE",
    "out": "OK"
   }
  ],
  "file": [
   "user default on nopass sanitize-payload ~* &* +@all",
   "user metrics on sanitize-payload #bc14aa7daf9f… resetchannels -@all +info +ping"
  ]
 },
 "rename": [
  {
   "cmd": "FLUSHALL",
   "out": "(error) ERR unknown command 'FLUSHALL'"
  },
  {
   "cmd": "CONFIG GET maxmemory",
   "out": "(error) ERR unknown command 'CONFIG', with args beginning with: 'GET' 'maxmemory'"
  },
  {
   "cmd": "CONFIG_b9f2c1 GET maxmemory",
   "out": "1) \"maxmemory\"\n2) \"0\""
  }
 ],
 "tlsCerts": [
  "openssl genrsa -out ca.key 4096",
  "openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 -subj \"/CN=Example Redis CA\" -out ca.crt",
  "openssl genrsa -out redis.key 2048",
  "openssl req -new -key redis.key -subj \"/CN=redis.internal\" -out redis.csr",
  "printf \"subjectAltName=DNS:redis.internal,IP:127.0.0.1\\n\" > san.ext",
  "openssl x509 -req -in redis.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -extfile san.ext -out redis.crt",
  "openssl genrsa -out client.key 2048",
  "openssl req -new -key client.key -subj \"/CN=orders-api\" -out client.csr",
  "openssl x509 -req -in client.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 365 -sha256 -out client.crt"
 ],
 "tlsServerCommand": "redis-server --port 0 --tls-port 6379 --tls-cert-file redis.crt --tls-key-file redis.key --tls-ca-cert-file ca.crt --tls-auth-clients yes",
 "tls": [
  {
   "shell": true,
   "cmd": "redis-cli -p 6379 PING                                       # plain TCP to a TLS port",
   "out": "Error: Connection reset by peer"
  },
  {
   "shell": true,
   "cmd": "redis-cli --tls --cacert ca.crt -p 6379 PING                 # TLS, but no client certificate",
   "out": "Error: Server closed the connection"
  },
  {
   "shell": true,
   "cmd": "redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -p 6379 PING",
   "out": "PONG"
  },
  {
   "shell": true,
   "cmd": "redis-cli --tls --cacert ca.crt --cert client.crt --key client.key -p 6379 INFO server | grep -E \"redis_version|tcp_port\"",
   "out": "redis_version:8.8.3\r\ntcp_port:6379\r"
  }
 ],
 "tlsLog": [
  "Ready to accept connections tls",
  "Error accepting a client connection: error:0A00010B:SSL routines::wrong version number (addr=10.0.4.12:51734 laddr=10.0.4.5:6379)",
  "Error accepting a client connection: error:0A0000C7:SSL routines::peer did not return a certificate (addr=10.0.4.12:51734 laddr=10.0.4.5:6379)"
 ]
} as const
