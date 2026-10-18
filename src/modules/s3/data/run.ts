// Recorded by tools/s3-capture/capture-run.mjs against a real RustFS server. Do not edit by hand.
export const RUN = {
  "version": "1.0.3",
  "start": [
    {
      "cmd": "podman volume create s3-lab-data",
      "out": "s3-lab-data"
    },
    {
      "cmd": "podman run -d --name s3-lab -p 9000:9000 -p 9001:9001 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -v s3-lab-data:/data docker.io/rustfs/rustfs:latest",
      "out": "1049a294c2d7…"
    },
    {
      "cmd": "podman ps --filter name=s3-lab --format \"{{.Names}}  {{.Status}}  {{.Ports}}\"",
      "out": "s3-lab  Up Less than a second  0.0.0.0:9000-9001->9000-9001/tcp"
    },
    {
      "cmd": "podman logs s3-lab",
      "out": "Initializing data directories: /data\nInitializing log directory: /logs\nStarting: /usr/bin/rustfs  /data"
    }
  ],
  "health": [
    {
      "cmd": "curl -si http://localhost:9000/health",
      "out": "HTTP/1.1 200 OK\ncontent-type: application/json\nx-request-id: e103994f\ncontent-length: 119\ndate: Sun, 18 Oct 2026 12:48:18 GMT\n\n{\"service\":\"rustfs-endpoint\",\"status\":\"ok\",\"timestamp\":\"2026-10-18T12:48:18.716653414Z[Etc/Unknown]\",\"version\":\"1.0.3\"}"
    },
    {
      "cmd": "curl -s http://localhost:9000/health/ready",
      "out": "{\"degradedReasons\":[],\"details\":{\"iam\":{\"ready\":true,\"status\":\"connected\"},\"lock\":{\"ready\":true,\"status\":\"connected\"},\"poolMetadata\":{\"ready\":true,\"status\":\"writable\"},\"storage\":{\"readQuorum\":true,\"readinessScope\":\"read_quorum\",\"ready\":true,\"source\":\"local_runtime\",\"status\":\"connected\",\"unavailableDrives\":[],\"writeQuorum\":true}},\"ready\":true,\"service\":\"rustfs-endpoint\",\"status\":\"ok\",\"timestamp\":\"2026-10-18T12:48:18.817281765Z[Etc/Unknown]\",\"version\":\"1.0.3\"}"
    },
    {
      "cmd": "curl -s http://localhost:9001/rustfs/console/health",
      "out": "{\"service\":\"rustfs-console\",\"status\":\"ok\",\"timestamp\":\"2026-10-18T12:48:18.922622933Z[Etc/Unknown]\",\"uptime\":1792327698,\"version\":\"1.0.3\"}"
    }
  ],
  "anonymous": [
    {
      "cmd": "curl -si http://localhost:9000/",
      "out": "HTTP/1.1 403 Forbidden\ncontent-type: application/xml\nx-request-id: 11b38418\nx-amz-request-id: 11b38418\ncontent-length: 110\ndate: Sun, 18 Oct 2026 12:48:19 GMT\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    }
  ],
  "awsCli": [
    {
      "cmd": "aws --version",
      "out": "aws-cli/2.38.1 Python/3.14.6 Linux/7.2.10-zen1 docker/x86_64.amzn.2023"
    },
    {
      "cmd": "aws configure list",
      "out": "NAME       : VALUE                    : TYPE             : LOCATION\nprofile    : <not set>                : None             : None\naccess_key : ****************dmin     : shared-credentials-file :\nsecret_key : ****************t123     : shared-credentials-file :\nregion     : us-east-1                : config-file      : ~/.aws/config"
    },
    {
      "cmd": "aws s3 ls",
      "out": ""
    },
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3 cp readme.txt s3://catalog/readme.txt",
      "out": "upload: ./readme.txt to s3://catalog/readme.txt"
    },
    {
      "cmd": "aws s3 ls s3://catalog/",
      "out": "2026-10-18 12:48:21         28 readme.txt"
    }
  ],
  "virtual": [
    {
      "cmd": "aws --profile virtual s3 ls s3://catalog/",
      "out": "aws: [ERROR]: Could not connect to the endpoint URL: \"http://catalog.localhost:9000/?list-type=2&prefix=&delimiter=%2F&encoding-type=url\"",
      "code": 255
    }
  ],
  "rcCli": [
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc alias list",
      "out": "lab          http://localhost:9000"
    },
    {
      "cmd": "rc ping lab",
      "out": "lab http://localhost:9000/health: alive in 0 ms (rustfs-endpoint 1.0.3)"
    },
    {
      "cmd": "rc ready lab",
      "out": "lab http://localhost:9000/health/ready: ready in 0 ms (rustfs-endpoint 1.0.3)"
    },
    {
      "cmd": "rc ls lab/catalog/",
      "out": "[2026-10-18 12:48:21]       28 B readme.txt"
    },
    {
      "cmd": "rc admin info server lab",
      "out": "Server List (1 servers)\n\n● :::9000 [2026-10-17T15:57:35+08:00@1.0.3]\n    Uptime: 0m | Disks: 1"
    }
  ],
  "moreUploads": [
    {
      "cmd": "aws s3 cp photo.jpg s3://catalog/images/photo.jpg",
      "out": "upload: ./photo.jpg to s3://catalog/images/photo.jpg"
    },
    {
      "cmd": "aws s3 cp video.mp4 s3://catalog/videos/demo.mp4",
      "out": "upload: ./video.mp4 to s3://catalog/videos/demo.mp4"
    }
  ],
  "disk": [
    {
      "cmd": "podman exec s3-lab ls -a /data",
      "out": ".\n..\n.rustfs\n.rustfs.sys\ncatalog"
    },
    {
      "cmd": "podman exec s3-lab tree /data",
      "out": "/data\n└── catalog\n    ├── images\n    │   └── photo.jpg\n    │       ├── 77c89017-8b2d-4876-8d2c-261175b652a9\n    │       │   └── part.1\n    │       └── xl.meta\n    ├── readme.txt\n    │   └── xl.meta\n    └── videos\n        └── demo.mp4\n            ├── 8ac668f2-428e-4dca-8964-e791a2380aae\n            │   ├── part.1\n            │   ├── part.1.meta\n            │   ├── part.2\n            │   ├── part.2.meta\n            │   ├── part.3\n            │   └── part.3.meta\n            └── xl.meta\n\n8 directories, 10 files"
    },
    {
      "cmd": "podman exec s3-lab sh -c \"du -b /data/catalog/readme.txt/xl.meta /data/catalog/images/photo.jpg/xl.meta /data/catalog/images/photo.jpg/*/part.1 /data/catalog/videos/demo.mp4/*/part.*\"",
      "out": "654\t/data/catalog/readme.txt/xl.meta\n534\t/data/catalog/images/photo.jpg/xl.meta\n307232\t/data/catalog/images/photo.jpg/77c89017-8b2d-4876-8d2c-261175b652a9/part.1\n8388864\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.1\n150\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.1.meta\n8388864\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.2\n150\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.2.meta\n4194432\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.3\n150\t/data/catalog/videos/demo.mp4/8ac668f2-428e-4dca-8964-e791a2380aae/part.3.meta"
    },
    {
      "cmd": "podman exec s3-lab strings /data/catalog/readme.txt/xl.meta",
      "out": "XL2\nType\nV2Obj\nDDir\nEcAlgo\nEcBSize\nEcIndex\nEcDist\nCSumAlgo\nPartNums\nPartETags\n b4209f7376610ae2bec78b69e3b45d4d\nPartSizes\nPartASizes\nPartIdx\nSize\nMTime\nMetaSys\nx-rustfs-internal-inline-data\ntrue\nx-minio-internal-inline-data\ntrue\nx-minio-internal-actual-size\nx-rustfs-internal-crc\nx-rustfs-internal-actual-size\nx-minio-internal-crc\nMetaUsr\ncontent-type\ntext/plain\netag\n b4209f7376610ae2bec78b69e3b45d4d\nnull\nh1j6x.\n&Product photos and manuals."
    },
    {
      "cmd": "podman exec s3-lab sh -c \"tail -c 32 /data/catalog/readme.txt/xl.meta | xxd\"",
      "out": "00000000: 960d d626 5072 6f64 7563 7420 7068 6f74  ...&Product phot\n00000010: 6f73 2061 6e64 206d 616e 7561 6c73 2e0a  os and manuals.."
    }
  ],
  "persist": [
    {
      "cmd": "podman rm -f s3-lab",
      "out": "s3-lab"
    },
    {
      "cmd": "podman run -d --name s3-lab -p 9000:9000 -p 9001:9001 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -v s3-lab-data:/data docker.io/rustfs/rustfs:latest",
      "out": "431f4e4a71fb…"
    },
    {
      "cmd": "aws s3 ls s3://catalog/ --recursive",
      "out": "2026-10-18 12:48:26     307200 images/photo.jpg\n2026-10-18 12:48:21         28 readme.txt\n2026-10-18 12:48:27   20971520 videos/demo.mp4"
    }
  ],
  "compose": [
    {
      "cmd": "podman compose up -d",
      "out": "0fe9efeec3f2…\nf43aac2a898e…\ns3-lab-compose"
    },
    {
      "cmd": "podman compose ps --format \"{{.Names}}  {{.Status}}  {{.Ports}}\"",
      "out": "s3-lab-compose  Up 1 second (healthy)  0.0.0.0:9000-9001->9000-9001/tcp"
    },
    {
      "cmd": "podman compose down -v",
      "out": "s3-lab-compose\ns3-lab-compose\ncompose_data\n0fe9efeec3f2…\ncompose_default"
    }
  ],
  "composeHealth": "healthy",
  "drives": [
    {
      "cmd": "podman run -d --name s3-lab -p 9000:9000 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e \"RUSTFS_VOLUMES=/data/rustfs{0...3}\" docker.io/rustfs/rustfs:latest",
      "out": "a1aebb3a6e64…"
    },
    {
      "cmd": "podman logs s3-lab",
      "out": "Initializing data directories: /data/rustfs0 /data/rustfs1 /data/rustfs2 /data/rustfs3\nInitializing log directory: /logs\nStarting: /usr/bin/rustfs  /data/rustfs0 /data/rustfs1 /data/rustfs2 /data/rustfs3\n[FATAL] Server runtime failed: local erasure endpoints must use distinct physical disks; detected shared devices [0:95 => /data/rustfs0, /data/rustfs1, /data/rustfs2, /data/rustfs3]. validation diagnostics: [path='/data/rustfs0', canonical='/data/rustfs0', st_dev='0:95', device_ids=[0:95]; path='/data/rustfs1', canonical='/data/rustfs1', st_dev='0:95', device_ids=[0:95]; path='/data/rustfs2', canonical='/data/rustfs2', st_dev='0:95', device_ids=[0:95]; path='/data/rustfs3', canonical='/data/rustfs3', st_dev='0:95', device_ids=[0:95]]. Set RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true only for local testing or CI to bypass this safety check"
    },
    {
      "cmd": "podman run -d --name s3-lab -p 9000:9000 -e RUSTFS_ACCESS_KEY=labadmin -e RUSTFS_SECRET_KEY=labsecret123 -e RUSTFS_UNSAFE_BYPASS_DISK_CHECK=true -e \"RUSTFS_VOLUMES=/data/rustfs{0...3}\" docker.io/rustfs/rustfs:latest",
      "out": "d5e4e76b1ccf…"
    },
    {
      "cmd": "rc admin info cluster lab",
      "out": "Cluster Information  (online)\n\n  Deployment ID: …\n  Region:        us-east-1\n  RC Version:    0.1.36\n  RustFS Version: 2026-10-17T15:57:35+08:00@1.0.3\n  Servers:       1\n  Disks:         4 (4 online)\n  Storage:       1.20 TiB / 1.84 TiB (64%)\n  Buckets:       0\n  Objects:       0\n\n  Backend:       Erasure\n  EC Parity:     2\n\nNodes:\n  ● :::9000\n     Uptime:  0m\n     Version: 2026-10-17T15:57:35+08:00@1.0.3\n     Network: 1/1 OK\n     Drives:  4/4 OK\n     Pool:    1\n\nDisks:\n  ● /data/rustfs1 [ok] /data/rustfs1\n     Capacity: 306.03 GiB / 470.88 GiB (64%, available: 164.85 GiB)\n     Location: pool:0 set:0 disk:1\n  ● /data/rustfs0 [ok] /data/rustfs0\n     Capacity: 306.03 GiB / 470.88 GiB (64%, available: 164.85 GiB)\n     Location: pool:0 set:0 disk:0\n  ● /data/rustfs3 [ok] /data/rustfs3\n     Capacity: 306.03 GiB / 470.88 GiB (64%, available: 164.85 GiB)\n     Location: pool:0 set:0 disk:3\n  ● /data/rustfs2 [ok] /data/rustfs2\n     Capacity: 306.03 GiB / 470.88 GiB (64%, available: 164.85 GiB)\n     Location: pool:0 set:0 disk:2"
    }
  ]
} as const
