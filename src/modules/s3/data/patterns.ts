// Recorded by tools/s3-capture/capture-patterns.mjs against a real RustFS server. Do not edit by hand.
export const PATTERNS = {
  "version": "1.0.3",
  "rclone": "rclone v1.75.2",
  "notifyEnv": {
    "RUSTFS_NOTIFY_ENABLE": "true",
    "RUSTFS_NOTIFY_WEBHOOK_ENABLE_PRIMARY": "on",
    "RUSTFS_NOTIFY_WEBHOOK_ENDPOINT_PRIMARY": "http://s3-hook:3020/webhook",
    "RUSTFS_NOTIFY_WEBHOOK_QUEUE_DIR_PRIMARY": "/tmp/rustfs-events",
    "RUSTFS_OUTBOUND_ALLOW_ORIGINS": "http://s3-hook:3020"
  },
  "eventsSetup": [
    {
      "cmd": "aws s3api put-bucket-notification-configuration --bucket catalog --notification-configuration file://notification.json",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-notification-configuration --bucket catalog",
      "out": "{\n    \"QueueConfigurations\": [\n        {\n            \"Id\": \"uploads-to-webhook\",\n            \"QueueArn\": \"arn:rustfs:sqs::primary:webhook\",\n            \"Events\": [\n                \"s3:ObjectCreated:*\",\n                \"s3:ObjectRemoved:*\"\n            ],\n            \"Filter\": {\n                \"Key\": {\n                    \"FilterRules\": [\n                        {\n                            \"Name\": \"prefix\",\n                            \"Value\": \"uploads/\"\n                        }\n                    ]\n                }\n            }\n        }\n    ]\n}"
    }
  ],
  "presignPut": [
    {
      "cmd": "node presign.ts PUT catalog uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg 300 image/jpeg",
      "out": "http://localhost:9000/catalog/uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T134839Z&X-Amz-Expires=300&X-Amz-Signature=c85dc26d1732a0568f5193402a85044a7840c43006b52af3ceee8a2dc0ae2598&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject"
    }
  ],
  "putUpload": [
    {
      "cmd": "curl -s -i -X PUT -H \"Content-Type: image/jpeg\" --data-binary @photo.jpg \"http://localhost:9000/catalog/uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T134839Z&X-Amz-Expires=300&X-Amz-Signature=c85dc26d1732a0568f5193402a85044a7840c43006b52af3ceee8a2dc0ae2598&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject\"",
      "out": "HTTP/1.1 200 OK\netag: \"9eff775fee9d90a07ccf40d411bb16ac\"\ncontent-length: 0"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg --query \"{size: ContentLength, type: ContentType}\"",
      "out": "{\n    \"size\": 2048,\n    \"type\": \"image/jpeg\"\n}"
    }
  ],
  "presignPost": [
    {
      "cmd": "node upload-form.ts catalog uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg 100000",
      "out": "{\n  \"url\": \"http://localhost:9000/catalog\",\n  \"fields\": {\n    \"Content-Type\": \"image/jpeg\",\n    \"bucket\": \"catalog\",\n    \"X-Amz-Algorithm\": \"AWS4-HMAC-SHA256\",\n    \"X-Amz-Credential\": \"labadmin/20261018/us-east-1/s3/aws4_request\",\n    \"X-Amz-Date\": \"20261018T134840Z\",\n    \"key\": \"uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg\",\n    \"Policy\": \"eyJleHBpcmF0aW9uIjoiMjAyNi0xMC0xOFQxMzo1Mzo0MFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMDAwMDBdLFsic3RhcnRzLXdpdGgiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvIl0seyJDb250ZW50LVR5cGUiOiJpbWFnZS9qcGVnIn0seyJidWNrZXQiOiJjYXRhbG9nIn0seyJYLUFtei1BbGdvcml0aG0iOiJBV1M0LUhNQUMtU0hBMjU2In0seyJYLUFtei1DcmVkZW50aWFsIjoibGFiYWRtaW4vMjAyNjEwMTgvdXMtZWFzdC0xL3MzL2F3czRfcmVxdWVzdCJ9LHsiWC1BbXotRGF0ZSI6IjIwMjYxMDE4VDEzNDg0MFoifSx7ImtleSI6InVwbG9hZHMvMjAyNi8xMC8xOC9jMWQyZTNmNC1hNWI2LTRjN2QtOGU5Zi0wYTFiMmMzZDRlNWYuanBnIn1dfQ==\",\n    \"X-Amz-Signature\": \"258d34266e58e100e38d602365a737b7e44d81c0eb8fba9a56c148f8f2eab56f\"\n  }\n}"
    }
  ],
  "postUpload": [
    {
      "cmd": "curl -s -i -F \"Content-Type=image/jpeg\" -F \"bucket=catalog\" -F \"X-Amz-Algorithm=AWS4-HMAC-SHA256\" -F \"X-Amz-Credential=labadmin/20261018/us-east-1/s3/aws4_request\" -F \"X-Amz-Date=20261018T134840Z\" -F \"key=uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg\" -F \"Policy=eyJleHBpcmF0aW9uIjoiMjAyNi0xMC0xOFQxMzo1Mzo0MFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMDAwMDBdLFsic3RhcnRzLXdpdGgiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvIl0seyJDb250ZW50LVR5cGUiOiJpbWFnZS9qcGVnIn0seyJidWNrZXQiOiJjYXRhbG9nIn0seyJYLUFtei1BbGdvcml0aG0iOiJBV1M0LUhNQUMtU0hBMjU2In0seyJYLUFtei1DcmVkZW50aWFsIjoibGFiYWRtaW4vMjAyNjEwMTgvdXMtZWFzdC0xL3MzL2F3czRfcmVxdWVzdCJ9LHsiWC1BbXotRGF0ZSI6IjIwMjYxMDE4VDEzNDg0MFoifSx7ImtleSI6InVwbG9hZHMvMjAyNi8xMC8xOC9jMWQyZTNmNC1hNWI2LTRjN2QtOGU5Zi0wYTFiMmMzZDRlNWYuanBnIn1dfQ==\" -F \"X-Amz-Signature=258d34266e58e100e38d602365a737b7e44d81c0eb8fba9a56c148f8f2eab56f\" -F file=@photo.jpg http://localhost:9000/catalog",
      "out": "HTTP/1.1 204 No Content"
    },
    {
      "cmd": "curl -s -i -F \"Content-Type=image/jpeg\" -F \"bucket=catalog\" -F \"X-Amz-Algorithm=AWS4-HMAC-SHA256\" -F \"X-Amz-Credential=labadmin/20261018/us-east-1/s3/aws4_request\" -F \"X-Amz-Date=20261018T134840Z\" -F \"key=uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg\" -F \"Policy=eyJleHBpcmF0aW9uIjoiMjAyNi0xMC0xOFQxMzo1Mzo0MFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMDAwMDBdLFsic3RhcnRzLXdpdGgiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvIl0seyJDb250ZW50LVR5cGUiOiJpbWFnZS9qcGVnIn0seyJidWNrZXQiOiJjYXRhbG9nIn0seyJYLUFtei1BbGdvcml0aG0iOiJBV1M0LUhNQUMtU0hBMjU2In0seyJYLUFtei1DcmVkZW50aWFsIjoibGFiYWRtaW4vMjAyNjEwMTgvdXMtZWFzdC0xL3MzL2F3czRfcmVxdWVzdCJ9LHsiWC1BbXotRGF0ZSI6IjIwMjYxMDE4VDEzNDg0MFoifSx7ImtleSI6InVwbG9hZHMvMjAyNi8xMC8xOC9jMWQyZTNmNC1hNWI2LTRjN2QtOGU5Zi0wYTFiMmMzZDRlNWYuanBnIn1dfQ==\" -F \"X-Amz-Signature=258d34266e58e100e38d602365a737b7e44d81c0eb8fba9a56c148f8f2eab56f\" -F file=@big.jpg http://localhost:9000/catalog",
      "out": "HTTP/1.1 400 Bad Request\ncontent-type: application/xml\ncontent-length: 160\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>EntityTooLarge</Code><Message>Your proposed upload exceeds the maximum allowed object size.</Message></Error>"
    },
    {
      "cmd": "curl -s -i -F \"Content-Type=text/html\" -F \"bucket=catalog\" -F \"X-Amz-Algorithm=AWS4-HMAC-SHA256\" -F \"X-Amz-Credential=labadmin/20261018/us-east-1/s3/aws4_request\" -F \"X-Amz-Date=20261018T134840Z\" -F \"key=uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg\" -F \"Policy=eyJleHBpcmF0aW9uIjoiMjAyNi0xMC0xOFQxMzo1Mzo0MFoiLCJjb25kaXRpb25zIjpbWyJjb250ZW50LWxlbmd0aC1yYW5nZSIsMSwxMDAwMDBdLFsic3RhcnRzLXdpdGgiLCIkQ29udGVudC1UeXBlIiwiaW1hZ2UvIl0seyJDb250ZW50LVR5cGUiOiJpbWFnZS9qcGVnIn0seyJidWNrZXQiOiJjYXRhbG9nIn0seyJYLUFtei1BbGdvcml0aG0iOiJBV1M0LUhNQUMtU0hBMjU2In0seyJYLUFtei1DcmVkZW50aWFsIjoibGFiYWRtaW4vMjAyNjEwMTgvdXMtZWFzdC0xL3MzL2F3czRfcmVxdWVzdCJ9LHsiWC1BbXotRGF0ZSI6IjIwMjYxMDE4VDEzNDg0MFoifSx7ImtleSI6InVwbG9hZHMvMjAyNi8xMC8xOC9jMWQyZTNmNC1hNWI2LTRjN2QtOGU5Zi0wYTFiMmMzZDRlNWYuanBnIn1dfQ==\" -F \"X-Amz-Signature=258d34266e58e100e38d602365a737b7e44d81c0eb8fba9a56c148f8f2eab56f\" -F file=@photo.jpg http://localhost:9000/catalog",
      "out": "HTTP/1.1 400 Bad Request\ncontent-type: application/xml\ncontent-length: 251\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>InvalidPolicyDocument</Code><Message>Policy condition &apos;starts-with&apos; for field &apos;content-type&apos; failed: expected prefix &apos;image/&apos;, got &apos;text/html&apos;</Message></Error>"
    }
  ],
  "shareCmd": [
    {
      "cmd": "node share.ts catalog invoices/2026/0042.pdf 600 invoice-0042.pdf",
      "out": "http://localhost:9000/catalog/invoices/2026/0042.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T134840Z&X-Amz-Expires=600&X-Amz-Signature=d007baf730a83dc9896e5cfb1e120747773106cd43ccfab397d48997fd85b98c&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22invoice-0042.pdf%22&x-amz-checksum-mode=ENABLED&x-id=GetObject"
    }
  ],
  "download": [
    {
      "cmd": "curl -s -i \"http://localhost:9000/catalog/invoices/2026/0042.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T134840Z&X-Amz-Expires=600&X-Amz-Signature=d007baf730a83dc9896e5cfb1e120747773106cd43ccfab397d48997fd85b98c&X-Amz-SignedHeaders=host&response-content-disposition=attachment%3B%20filename%3D%22invoice-0042.pdf%22&x-amz-checksum-mode=ENABLED&x-id=GetObject\"",
      "out": "HTTP/1.1 200 OK\ncontent-length: 27\ncontent-type: application/pdf\netag: \"3d991e70f541770c12f73442734746bf\"\ncontent-disposition: attachment; filename=\"invoice-0042.pdf\"\n\n%PDF-1.7\nInvoice 2026-0042"
    }
  ],
  "eventsAfter": [
    {
      "cmd": "aws s3 rm s3://catalog/uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg",
      "out": "delete: s3://catalog/uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg"
    }
  ],
  "events": [
    {
      "eventName": "s3:ObjectCreated:Put",
      "key": "uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg",
      "size": 2048,
      "eTag": "9eff775fee9d90a07ccf40d411bb16ac",
      "time": "2026-10-18T13:48:39.510Z"
    },
    {
      "eventName": "s3:ObjectCreated:Post",
      "key": "uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg",
      "size": 2048,
      "eTag": "9eff775fee9d90a07ccf40d411bb16ac",
      "time": "2026-10-18T13:48:40.253Z"
    },
    {
      "eventName": "s3:ObjectRemoved:Delete",
      "key": "uploads/2026/10/18/7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg",
      "time": "2026-10-18T13:48:41.203Z"
    }
  ],
  "firstEvent": {
    "eventVersion": "2.1",
    "eventSource": "rustfs:s3",
    "awsRegion": "",
    "eventTime": "2026-10-18T13:48:39.510Z",
    "eventName": "s3:ObjectCreated:Put",
    "userIdentity": {
      "principalId": "labadmin"
    },
    "requestParameters": {
      "host": "localhost:9000",
      "content-length": "2048",
      "x-request-id": "6d06c51b",
      "user-agent": "curl/8.23.0",
      "accept": "*/*",
      "content-type": "image/jpeg",
      "principalId": "labadmin"
    },
    "responseElements": {
      "x-amz-request-id": "6d06c51b",
      "x-amz-id-2": ""
    },
    "s3": {
      "s3SchemaVersion": "1.0",
      "configurationId": "Config",
      "bucket": {
        "name": "catalog",
        "ownerIdentity": {
          "principalId": "labadmin"
        },
        "arn": "arn:aws:s3:::catalog"
      },
      "object": {
        "key": "uploads%2F2026%2F10%2F18%2F7f3c9a2e-5b1d-4c6a-9e8f-2a4b6c8d0e1f.jpg",
        "size": 2048,
        "eTag": "9eff775fee9d90a07ccf40d411bb16ac",
        "contentType": "image/jpeg",
        "userMetadata": {
          "content-type": "image/jpeg"
        },
        "sequencer": "18DFA3D6C2D85832"
      }
    },
    "source": {
      "host": "localhost:9000",
      "port": "9000",
      "userAgent": "curl/8.23.0"
    }
  },
  "byDate": [
    {
      "cmd": "aws s3 ls s3://catalog/exports/2026/10/",
      "out": "                           PRE 16/\n                           PRE 17/\n                           PRE 18/"
    },
    {
      "cmd": "aws s3 ls s3://catalog/exports/2026/10/18/",
      "out": "2026-10-18 13:48:46          6 orders.csv"
    }
  ],
  "pages": [
    {
      "keys": 1000,
      "first": "logs/2026-10-18/00000.log",
      "last": "logs/2026-10-18/00999.log",
      "truncated": true,
      "token": "bG9ncy8yMDI2…"
    },
    {
      "keys": 1000,
      "first": "logs/2026-10-18/01000.log",
      "last": "logs/2026-10-18/01999.log",
      "truncated": true,
      "token": "bG9ncy8yMDI2…"
    },
    {
      "keys": 500,
      "first": "logs/2026-10-18/02000.log",
      "last": "logs/2026-10-18/02499.log",
      "truncated": false,
      "token": null
    }
  ],
  "listMs": 163,
  "objects": 2500,
  "paging": [
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --prefix logs/ --max-items 3 --query \"{keys: Contents[].Key, next: NextToken}\"",
      "out": "{\n    \"keys\": [\n        \"logs/2026-10-18/00000.log\",\n        \"logs/2026-10-18/00001.log\",\n        \"logs/2026-10-18/00002.log\"\n    ],\n    \"next\": \"eyJDb250aW51YXRpb25Ub2tlbiI6IG51bGwsICJib3RvX3RydW5jYXRlX2Ftb3VudCI6IDN9\"\n}"
    },
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --prefix logs/ --max-items 3 --starting-token eyJDb250aW51YXRpb25Ub2tlbiI6IG51bGwsICJib3RvX3RydW5jYXRlX2Ftb3VudCI6IDN9 --query \"Contents[].Key\"",
      "out": "[\n    \"logs/2026-10-18/00003.log\",\n    \"logs/2026-10-18/00004.log\",\n    \"logs/2026-10-18/00005.log\"\n]"
    },
    {
      "cmd": "aws s3 rm s3://catalog/logs/ --recursive --only-show-errors",
      "out": ""
    },
    {
      "cmd": "aws s3 ls s3://catalog/logs/",
      "out": "",
      "code": 1
    }
  ],
  "sse": [
    {
      "cmd": "aws s3api put-object --bucket catalog --key secret.txt --body note.txt --server-side-encryption AES256",
      "out": "aws: [ERROR]: An error occurred (InvalidRequest) when calling the PutObject operation: SSE-S3 requires RUSTFS_SSE_S3_MASTER_KEY to be set to a base64-encoded 32-byte key when KMS is not configured",
      "code": 254
    }
  ],
  "sseOn": [
    {
      "cmd": "aws s3 mb s3://vault",
      "out": "make_bucket: vault"
    },
    {
      "cmd": "aws s3api put-object --bucket vault --key secret.txt --body invoice.pdf --server-side-encryption AES256",
      "out": "{\n    \"ETag\": \"\\\"00e5a5f8f33d7a5e0fee0a93a15b6bc1\\\"\",\n    \"ChecksumCRC64NVME\": \"RNk1nthVij8=\",\n    \"ServerSideEncryption\": \"AES256\"\n}"
    },
    {
      "cmd": "aws s3api head-object --bucket vault --key secret.txt",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:49:06+00:00\",\n    \"ContentLength\": 27,\n    \"ETag\": \"\\\"00e5a5f8f33d7a5e0fee0a93a15b6bc1\\\"\",\n    \"ContentType\": \"text/plain\",\n    \"ServerSideEncryption\": \"AES256\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "aws s3 cp s3://vault/secret.txt -",
      "out": "%PDF-1.7\nInvoice 2026-0042"
    },
    {
      "cmd": "aws s3 cp invoice.pdf s3://vault/plain.txt",
      "out": "upload: ./invoice.pdf to s3://vault/plain.txt"
    },
    {
      "cmd": "podman exec s3-node-b sh -c \"strings /data/vault/plain.txt/xl.meta | tail -2; echo ---; strings /data/vault/secret.txt/xl.meta | tail -2\"",
      "out": "%PDF-1.7\nInvoice 2026-0042\n---\nAES256\nnull"
    }
  ],
  "metrics": [
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc admin metrics lab --scope disk",
      "out": "✗ Failed to query realtime metrics: Unsupported feature: A header you provided implies functionality that is not implemented.",
      "code": 7
    }
  ],
  "rcloneSteps": [
    {
      "cmd": "rclone lsd source:",
      "out": "          -1 2026-10-18 13:48:37        -1 catalog"
    },
    {
      "cmd": "rclone mkdir target:catalog",
      "out": ""
    },
    {
      "cmd": "rclone sync source:catalog target:catalog --stats-log-level NOTICE --stats 0 -v",
      "out": "INFO  : invoices/2026/0042.pdf: Copied (new)\nINFO  : exports/2026/10/18/orders.csv: Copied (new)\nINFO  : exports/2026/10/17/orders.csv: Copied (new)\nINFO  : uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg: Copied (new)\nINFO  : exports/2026/10/16/orders.csv: Copied (new)"
    },
    {
      "cmd": "rclone check source:catalog target:catalog",
      "out": "NOTICE: S3 bucket catalog: 0 differences found\nNOTICE: S3 bucket catalog: 5 matching files"
    },
    {
      "cmd": "aws s3 cp orders.csv s3://catalog/exports/2026/10/18/orders.csv",
      "out": "upload: ./orders.csv to s3://catalog/exports/2026/10/18/orders.csv"
    },
    {
      "cmd": "rclone sync source:catalog target:catalog -v",
      "out": "INFO  : exports/2026/10/18/orders.csv: Copied (replaced existing)\nINFO  :\nTransferred:   \t         24 B / 24 B, 100%, 0 B/s, ETA -\nChecks:                 5 / 5, 100%, Listed 34\nTransferred:            1 / 1, 100%\nElapsed time:         0.0s"
    },
    {
      "cmd": "rclone size target:catalog",
      "out": "Total objects: 5\nTotal size: 2.062 KiB (2111 Byte)"
    }
  ],
  "mirror": [
    {
      "cmd": "rc alias set backup http://s3-node-b:9000 labadmin labsecret123",
      "out": "✓ Alias 'backup' configured successfully."
    },
    {
      "cmd": "rc bucket create backup/catalog-mirror",
      "out": "✓ Bucket 'backup/catalog-mirror' created successfully."
    },
    {
      "cmd": "rc mirror lab/catalog backup/catalog-mirror",
      "out": "+ exports/2026/10/16/orders.csv\n+ exports/2026/10/17/orders.csv\n+ exports/2026/10/18/orders.csv\n+ invoices/2026/0042.pdf\n+ uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg"
    },
    {
      "cmd": "rc object list --recursive backup/catalog-mirror/",
      "out": "[2026-10-18 13:49:04]        6 B exports/2026/10/16/orders.csv\n[2026-10-18 13:49:04]        6 B exports/2026/10/17/orders.csv\n[2026-10-18 13:49:04]       24 B exports/2026/10/18/orders.csv\n[2026-10-18 13:49:04]       27 B invoices/2026/0042.pdf\n[2026-10-18 13:49:04]      2 KiB uploads/2026/10/18/c1d2e3f4-a5b6-4c7d-8e9f-0a1b2c3d4e5f.jpg"
    }
  ]
} as const
