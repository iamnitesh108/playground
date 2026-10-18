// Recorded by tools/s3-capture/capture-durability.mjs against a real RustFS server. Do not edit by hand.
export const DURABILITY = {
  "version": "1.0.3",
  "objectBytes": 3145728,
  "mdSetup": [
    {
      "cmd": "podman run -d --name s3-node-md -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true -e \"RUSTFS_VOLUMES=/data/rustfs{0...3}\" -v s3-node-md-d0:/data/rustfs0 -v s3-node-md-d1:/data/rustfs1 -v s3-node-md-d2:/data/rustfs2 -v s3-node-md-d3:/data/rustfs3 docker.io/rustfs/rustfs:latest",
      "out": "dbb9702c1c04…"
    },
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc admin info cluster lab",
      "out": "Cluster Information  (online)\n\n  Deployment ID: …\n  Region:        us-east-1\n  Servers:       1\n  Disks:         4 (4 online)\n  Buckets:       0\n  Objects:       0\n\n  Backend:       Erasure\n  EC Parity:     2\n\nNodes:\n  ● :::9000\n     Network: 1/1 OK\n     Drives:  4/4 OK\n     Pool:    1\n\nDisks:\n  ● /data/rustfs2 [ok] /data/rustfs2\n  ● /data/rustfs3 [ok] /data/rustfs3\n  ● /data/rustfs0 [ok] /data/rustfs0\n  ● /data/rustfs1 [ok] /data/rustfs1"
    },
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key three.bin --body three.bin",
      "out": "{\n    \"ETag\": \"\\\"d53802314921961d88be5b7e972dc582\\\"\",\n    \"ChecksumCRC64NVME\": \"WFSpOURqk9k=\"\n}"
    },
    {
      "cmd": "md5sum three.bin",
      "out": "d53802314921961d88be5b7e972dc582  three.bin"
    },
    {
      "cmd": "podman exec s3-node-md sh -c \"du -b /data/rustfs*/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/rustfs0/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1\n1572960\t/data/rustfs1/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1\n1572960\t/data/rustfs2/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1\n1572960\t/data/rustfs3/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1"
    }
  ],
  "failing": [
    {
      "cmd": "podman exec s3-node-md chmod 000 /data/rustfs1",
      "out": ""
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key written-with-1-down.bin --body three.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "podman exec s3-node-md chmod 000 /data/rustfs2",
      "out": ""
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key written-with-2-down.bin --body three.bin --query ETag",
      "out": "aws: [ERROR]: An error occurred (ServiceUnavailable) when calling the PutObject operation (reached max retries: 2): The service is unavailable. Please retry.",
      "code": 254
    },
    {
      "cmd": "podman exec s3-node-md chmod 000 /data/rustfs3",
      "out": ""
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "aws: [ERROR]: An error occurred (SlowDownRead) when calling the GetObject operation (reached max retries: 2): Resource requested is unreadable, please reduce your request rate",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key written-with-3-down.bin --body three.bin --query ETag",
      "out": "aws: [ERROR]: An error occurred (ServiceUnavailable) when calling the PutObject operation (reached max retries: 2): The service is unavailable. Please retry.",
      "code": 254
    }
  ],
  "driveSteps": [
    {
      "down": 1,
      "read": true,
      "write": true
    },
    {
      "down": 2,
      "read": true,
      "write": false
    },
    {
      "down": 3,
      "read": false,
      "write": false
    }
  ],
  "back": [
    {
      "cmd": "podman exec s3-node-md chmod 755 /data/rustfs1 /data/rustfs2 /data/rustfs3",
      "out": ""
    },
    {
      "cmd": "podman exec s3-node-md ls /data/rustfs1/catalog /data/rustfs2/catalog",
      "out": "/data/rustfs1/catalog:\nthree.bin\nwritten-with-1-down.bin\n\n/data/rustfs2/catalog:\nthree.bin\nwritten-with-1-down.bin"
    },
    {
      "cmd": "rc admin heal start lab --bucket catalog",
      "out": "✓ Heal operation started successfully.\n  Client Token:  1a76c2f1-b93b-4b8f-a145-87c054187237\n  Started:       2026-10-18T13:38:47.127837762Z"
    },
    {
      "cmd": "podman exec s3-node-md ls /data/rustfs1/catalog /data/rustfs2/catalog",
      "out": "/data/rustfs1/catalog:\nthree.bin\nwritten-with-1-down.bin\n\n/data/rustfs2/catalog:\nthree.bin\nwritten-with-1-down.bin"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    }
  ],
  "replaced": [
    {
      "cmd": "podman exec s3-node-md sh -c \"rm -rf /data/rustfs3/catalog && ls /data/rustfs3\"",
      "out": ""
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "rc admin heal start lab --bucket catalog",
      "out": "✓ Heal operation started successfully.\n  Client Token:  2d14640c-5ea3-4a55-af86-c01a66d85da9\n  Started:       2026-10-18T13:38:53.514390406Z"
    },
    {
      "cmd": "podman exec s3-node-md sh -c \"du -b /data/rustfs3/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/rustfs3/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1"
    }
  ],
  "bitrot": [
    {
      "cmd": "podman exec s3-node-md sh -c 'md5sum $(find /data/rustfs0/catalog/three.bin -name part.1)'",
      "out": "5f2dbc67f017b58d93019972229dd66f  /data/rustfs0/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1"
    },
    {
      "cmd": "podman exec s3-node-md sh -c 'printf BITROT | dd of=$(find /data/rustfs0/catalog/three.bin -name part.1) bs=1 seek=4096 conv=notrunc 2>/dev/null; md5sum $(find /data/rustfs0/catalog/three.bin -name part.1)'",
      "out": "e0d32c320be99a983faa8dc49e5c482d  /data/rustfs0/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "md5sum copy.bin",
      "out": "d53802314921961d88be5b7e972dc582  copy.bin"
    },
    {
      "note": "5 seconds later"
    },
    {
      "cmd": "podman exec s3-node-md sh -c 'md5sum $(find /data/rustfs0/catalog/three.bin -name part.1)'",
      "out": "5f2dbc67f017b58d93019972229dd66f  /data/rustfs0/catalog/three.bin/62c79ca5-1462-4342-8ff9-690f0db411ea/part.1"
    }
  ],
  "nodesSetup": [
    {
      "cmd": "podman network create s3-net",
      "out": "s3-net"
    },
    {
      "cmd": "podman run -d --name s3-node-1 --hostname s3-node-1 --network s3-net -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e \"RUSTFS_VOLUMES=http://s3-node-{1...4}:9000/data\" -v s3-node-1-data:/data docker.io/rustfs/rustfs:latest",
      "out": "a18a55af6ee8…"
    },
    {
      "cmd": "podman run -d --name s3-node-2 --hostname s3-node-2 --network s3-net -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e \"RUSTFS_VOLUMES=http://s3-node-{1...4}:9000/data\" -v s3-node-2-data:/data docker.io/rustfs/rustfs:latest",
      "out": "42c28ad52ca8…"
    },
    {
      "cmd": "podman run -d --name s3-node-3 --hostname s3-node-3 --network s3-net -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e \"RUSTFS_VOLUMES=http://s3-node-{1...4}:9000/data\" -v s3-node-3-data:/data docker.io/rustfs/rustfs:latest",
      "out": "5063c65074fe…"
    },
    {
      "cmd": "podman run -d --name s3-node-4 --hostname s3-node-4 --network s3-net -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e \"RUSTFS_VOLUMES=http://s3-node-{1...4}:9000/data\" -v s3-node-4-data:/data docker.io/rustfs/rustfs:latest",
      "out": "37d1910a5758…"
    },
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc admin info cluster lab",
      "out": "Cluster Information  (online)\n\n  Deployment ID: …\n  Region:        us-east-1\n  Servers:       4\n  Disks:         4 (4 online)\n  Buckets:       0\n  Objects:       0\n\n  Backend:       Erasure\n  EC Parity:     2\n\nNodes:\n  ● s3-node-2:9000\n     Network: 4/4 OK\n     Drives:  1/1 OK\n     Pool:    1\n  ● s3-node-3:9000\n     Network: 4/4 OK\n     Drives:  1/1 OK\n     Pool:    1\n  ● s3-node-4:9000\n     Network: 4/4 OK\n     Drives:  1/1 OK\n     Pool:    1\n  ● s3-node-1:9000\n     Network: 4/4 OK\n     Drives:  1/1 OK\n     Pool:    1\n\nDisks:\n  ● /data [ok] http://s3-node-2:9000/data\n  ● /data [ok] http://s3-node-3:9000/data\n  ● /data [ok] http://s3-node-4:9000/data\n  ● /data [ok] http://s3-node-1:9000/data"
    },
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key three.bin --body three.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "podman exec s3-node-1 sh -c \"du -b /data/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/catalog/three.bin/f0832b05-1717-41a1-b638-d7902a0982ae/part.1"
    },
    {
      "cmd": "podman exec s3-node-2 sh -c \"du -b /data/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/catalog/three.bin/f0832b05-1717-41a1-b638-d7902a0982ae/part.1"
    },
    {
      "cmd": "podman exec s3-node-3 sh -c \"du -b /data/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/catalog/three.bin/f0832b05-1717-41a1-b638-d7902a0982ae/part.1"
    },
    {
      "cmd": "podman exec s3-node-4 sh -c \"du -b /data/catalog/three.bin/*/part.1\"",
      "out": "1572960\t/data/catalog/three.bin/f0832b05-1717-41a1-b638-d7902a0982ae/part.1"
    }
  ],
  "nodesDown": [
    {
      "cmd": "podman stop s3-node-3",
      "out": "s3-node-3"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key while-one-down.bin --body three.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "podman stop s3-node-4",
      "out": "s3-node-4"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key three.bin copy.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key while-two-down.bin --body three.bin --query ETag",
      "out": "aws: [ERROR]: An error occurred (ServiceUnavailable) when calling the PutObject operation (reached max retries: 2): The service is unavailable. Please retry.",
      "code": 254
    }
  ],
  "nodesBack": [
    {
      "cmd": "podman start s3-node-3 s3-node-4",
      "out": "s3-node-3\ns3-node-4"
    },
    {
      "cmd": "podman exec s3-node-3 ls /data/catalog",
      "out": "three.bin"
    },
    {
      "note": "healed 22.3 s after the restart"
    },
    {
      "cmd": "podman exec s3-node-3 ls /data/catalog",
      "out": "three.bin\nwhile-one-down.bin"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key after-restart.bin --body three.bin --query ETag",
      "out": "\"\\\"d53802314921961d88be5b7e972dc582\\\"\""
    }
  ],
  "events": [
    {
      "at": 0.2,
      "label": "s3-node-3 stopped",
      "ok": false
    },
    {
      "at": 0.8,
      "label": "read",
      "ok": true
    },
    {
      "at": 1.3,
      "label": "write",
      "ok": true
    },
    {
      "at": 1.5,
      "label": "s3-node-4 stopped",
      "ok": false
    },
    {
      "at": 2,
      "label": "read",
      "ok": true
    },
    {
      "at": 4.4,
      "label": "write",
      "ok": false
    },
    {
      "at": 4.5,
      "label": "both started",
      "ok": true
    },
    {
      "at": 26.8,
      "label": "while-one-down.bin back on s3-node-3",
      "ok": true
    }
  ],
  "healedAt": 26.8
} as const
