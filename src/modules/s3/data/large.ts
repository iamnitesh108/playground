// Recorded by tools/s3-capture/capture-large.mjs against a real RustFS server. Do not edit by hand.
export const LARGE = {
  "version": "1.0.3",
  "byHand": [
    {
      "cmd": "split -b 8M -d demo.mp4 part-",
      "out": ""
    },
    {
      "cmd": "ls -l part-* | awk '{print $5, $9}'",
      "out": "8388608 part-00\n8388608 part-01\n4194304 part-02"
    },
    {
      "cmd": "aws s3api create-multipart-upload --bucket catalog --key videos/demo.mp4 --content-type video/mp4",
      "out": "{\n    \"Bucket\": \"catalog\",\n    \"Key\": \"videos/demo.mp4\",\n    \"UploadId\": \"ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2\"\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key videos/demo.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2 --part-number 1 --body part-00",
      "out": "{\n    \"ETag\": \"\\\"f3e0f88a5675961a92e40b92222e82bb\\\"\",\n    \"ChecksumCRC64NVME\": \"G7Jl5Z3PJZQ=\"\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key videos/demo.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2 --part-number 2 --body part-01",
      "out": "{\n    \"ETag\": \"\\\"8405ab7f4a847185b0c08b5bed6aa05b\\\"\",\n    \"ChecksumCRC64NVME\": \"kFUmH55r7/4=\"\n}"
    }
  ],
  "resume": [
    {
      "cmd": "aws s3api list-multipart-uploads --bucket catalog",
      "out": "{\n    \"Uploads\": [\n        {\n            \"UploadId\": \"ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2\",\n            \"Key\": \"videos/demo.mp4\",\n            \"Initiated\": \"2026-10-18T13:15:27.083000+00:00\",\n            \"Owner\": {\n                \"DisplayName\": \"rustfs\",\n                \"ID\": \"c19050dbcee97fda828689dda99097a6321af2248fa760517237346e5d9c8a66\"\n            },\n            \"Initiator\": {\n                \"ID\": \"c19050dbcee97fda828689dda99097a6321af2248fa760517237346e5d9c8a66\",\n                \"DisplayName\": \"rustfs\"\n            }\n        }\n    ],\n    \"RequestCharged\": null,\n    \"Prefix\": \"\"\n}"
    },
    {
      "cmd": "aws s3api list-parts --bucket catalog --key videos/demo.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2",
      "out": "{\n    \"Parts\": [\n        {\n            \"PartNumber\": 1,\n            \"LastModified\": \"2026-10-18T13:15:27.678000+00:00\",\n            \"ETag\": \"\\\"f3e0f88a5675961a92e40b92222e82bb\\\"\",\n            \"Size\": 8388608\n        },\n        {\n            \"PartNumber\": 2,\n            \"LastModified\": \"2026-10-18T13:15:28.279000+00:00\",\n            \"ETag\": \"\\\"8405ab7f4a847185b0c08b5bed6aa05b\\\"\",\n            \"Size\": 8388608\n        }\n    ],\n    \"ChecksumAlgorithm\": null,\n    \"Initiator\": {\n        \"ID\": \"c19050dbcee97fda828689dda99097a6321af2248fa760517237346e5d9c8a66\",\n        \"DisplayName\": \"rustfs\"\n    },\n    \"Owner\": {\n        \"DisplayName\": \"rustfs\",\n        \"ID\": \"c19050dbcee97fda828689dda99097a6321af2248fa760517237346e5d9c8a66\"\n    },\n    \"StorageClass\": \"STANDARD\",\n    \"ChecksumType\": null\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key videos/demo.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2 --part-number 3 --body part-02",
      "out": "{\n    \"ETag\": \"\\\"86ba0542d4bc7233e9b8999a8f148646\\\"\",\n    \"ChecksumCRC64NVME\": \"kDKgh+l6grM=\"\n}"
    }
  ],
  "complete": [
    {
      "cmd": "cat parts.json",
      "out": "{\n  \"Parts\": [\n    {\n      \"ETag\": \"\\\"f3e0f88a5675961a92e40b92222e82bb\\\"\",\n      \"PartNumber\": 1\n    },\n    {\n      \"ETag\": \"\\\"8405ab7f4a847185b0c08b5bed6aa05b\\\"\",\n      \"PartNumber\": 2\n    },\n    {\n      \"ETag\": \"\\\"86ba0542d4bc7233e9b8999a8f148646\\\"\",\n      \"PartNumber\": 3\n    }\n  ]\n}"
    },
    {
      "cmd": "aws s3api complete-multipart-upload --bucket catalog --key videos/demo.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjY0MWIzZjkxLTYzYzUtNGQxZS05YmI4LTYzZjllMmFmNDY3ZXgxNzkyMzI5MzI3MDgzMTIyODc2 --multipart-upload file://parts.json",
      "out": "{\n    \"Location\": \"http://localhost:9000/catalog/videos/demo.mp4\",\n    \"Bucket\": \"catalog\",\n    \"Key\": \"videos/demo.mp4\",\n    \"ETag\": \"\\\"bb2191e9f0b5a3b33daca84e94efee23-3\\\"\"\n}"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key videos/demo.mp4",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:30+00:00\",\n    \"ContentLength\": 20971520,\n    \"ETag\": \"\\\"bb2191e9f0b5a3b33daca84e94efee23-3\\\"\",\n    \"ContentType\": \"video/mp4\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "aws s3api list-multipart-uploads --bucket catalog",
      "out": "{\n    \"RequestCharged\": null,\n    \"Prefix\": \"\"\n}"
    }
  ],
  "etag": [
    {
      "cmd": "md5sum part-*",
      "out": "f3e0f88a5675961a92e40b92222e82bb  part-00\n8405ab7f4a847185b0c08b5bed6aa05b  part-01\n86ba0542d4bc7233e9b8999a8f148646  part-02"
    },
    {
      "cmd": "cat part-00 part-01 part-02 | md5sum",
      "out": "d711d42a234fdd7ecd48a56ee140ddb1  -"
    },
    {
      "cmd": "for p in part-*; do openssl md5 -binary $p; done | md5sum",
      "out": "bb2191e9f0b5a3b33daca84e94efee23  -"
    }
  ],
  "abort": [
    {
      "cmd": "aws s3api create-multipart-upload --bucket catalog --key videos/abandoned.mp4",
      "out": "{\n    \"Bucket\": \"catalog\",\n    \"Key\": \"videos/abandoned.mp4\",\n    \"UploadId\": \"ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjMxYTAzNTA4LWJjMmItNDY0NC1hZTZmLTExNGM2ZTNkMDlmZXgxNzkyMzI5MzMyNDkyNDE5NzM4\"\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key videos/abandoned.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjMxYTAzNTA4LWJjMmItNDY0NC1hZTZmLTExNGM2ZTNkMDlmZXgxNzkyMzI5MzMyNDkyNDE5NzM4 --part-number 1 --body part-00",
      "out": "{\n    \"ETag\": \"\\\"f3e0f88a5675961a92e40b92222e82bb\\\"\",\n    \"ChecksumCRC64NVME\": \"G7Jl5Z3PJZQ=\"\n}"
    },
    {
      "cmd": "aws s3api list-multipart-uploads --bucket catalog --query \"Uploads[].[Key, Initiated]\" --output text",
      "out": "videos/abandoned.mp4\t2026-10-18T13:15:32.492000+00:00"
    },
    {
      "cmd": "aws s3api abort-multipart-upload --bucket catalog --key videos/abandoned.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjMxYTAzNTA4LWJjMmItNDY0NC1hZTZmLTExNGM2ZTNkMDlmZXgxNzkyMzI5MzMyNDkyNDE5NzM4",
      "out": ""
    },
    {
      "cmd": "aws s3api list-multipart-uploads --bucket catalog",
      "out": "{\n    \"RequestCharged\": null,\n    \"Prefix\": \"\"\n}"
    },
    {
      "cmd": "aws s3api list-parts --bucket catalog --key videos/abandoned.mp4 --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjMxYTAzNTA4LWJjMmItNDY0NC1hZTZmLTExNGM2ZTNkMDlmZXgxNzkyMzI5MzMyNDkyNDE5NzM4",
      "out": "aws: [ERROR]: An error occurred (NoSuchUpload) when calling the ListParts operation: The specified multipart upload does not exist. The upload ID may be invalid, or the upload may have been aborted or completed.",
      "code": 254
    }
  ],
  "rules": [
    {
      "cmd": "aws s3api create-multipart-upload --bucket catalog --key tiny-parts.bin",
      "out": "{\n    \"Bucket\": \"catalog\",\n    \"Key\": \"tiny-parts.bin\",\n    \"UploadId\": \"ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1\"\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1 --part-number 1 --body small.bin",
      "out": "{\n    \"ETag\": \"\\\"014d7a60c9e290ba3929d91dbca697cd\\\"\",\n    \"ChecksumCRC64NVME\": \"XGlRYzUuVBQ=\"\n}"
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1 --part-number 2 --body small.bin",
      "out": "{\n    \"ETag\": \"\\\"014d7a60c9e290ba3929d91dbca697cd\\\"\",\n    \"ChecksumCRC64NVME\": \"XGlRYzUuVBQ=\"\n}"
    },
    {
      "cmd": "aws s3api complete-multipart-upload --bucket catalog --key tiny-parts.bin --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1 --multipart-upload file://tiny.json",
      "out": "aws: [ERROR]: An error occurred (EntityTooSmall) when calling the CompleteMultipartUpload operation: Your proposed upload is smaller than the minimum allowed object size.",
      "code": 254
    },
    {
      "cmd": "aws s3api upload-part --bucket catalog --key tiny-parts.bin --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1 --part-number 10001 --body small.bin",
      "out": "aws: [ERROR]: An error occurred (InvalidArgument) when calling the UploadPart operation: partNumber must be between 1 and 10000",
      "code": 254
    },
    {
      "cmd": "aws s3api abort-multipart-upload --bucket catalog --key tiny-parts.bin --upload-id ZWU2M2ZmN2ItZTgzMy00NDk2LWExY2MtZDRmZTllN2FiNzA3LjE0Y2JhZGQ1LTIyZGYtNDRhMC04NDVmLTQzZTY5NWUxNDA1ZHgxNzkyMzI5MzM3NzI0OTEyNTk1",
      "out": ""
    }
  ],
  "cpTimeline": [
    {
      "op": "CreateMultipartUpload",
      "thread": "ThreadPoolExecutor-0_0",
      "status": 200,
      "start": 0,
      "end": 20
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_6",
      "part": 6,
      "status": 200,
      "start": 29,
      "end": 112
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_1",
      "part": 1,
      "status": 200,
      "start": 31,
      "end": 121
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_5",
      "part": 5,
      "status": 200,
      "start": 32,
      "end": 121
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_4",
      "part": 4,
      "status": 200,
      "start": 38,
      "end": 122
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_7",
      "part": 7,
      "status": 200,
      "start": 39,
      "end": 124
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_2",
      "part": 2,
      "status": 200,
      "start": 38,
      "end": 124
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_3",
      "part": 3,
      "status": 200,
      "start": 34,
      "end": 125
    },
    {
      "op": "UploadPart",
      "thread": "ThreadPoolExecutor-0_8",
      "part": 8,
      "status": 200,
      "start": 43,
      "end": 125
    },
    {
      "op": "CompleteMultipartUpload",
      "thread": "ThreadPoolExecutor-0_9",
      "status": 200,
      "start": 128,
      "end": 136
    }
  ],
  "cpSteps": [
    {
      "cmd": "aws --profile classic --debug s3 cp big.mp4 s3://catalog/videos/big.mp4",
      "out": "upload: ./big.mp4 to s3://catalog/videos/big.mp4"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key videos/big.mp4 --query \"{size: ContentLength, etag: ETag}\"",
      "out": "{\n    \"size\": 67108864,\n    \"etag\": \"\\\"401ae51254e2e844a03518b8f0893ed8-8\\\"\"\n}"
    }
  ],
  "cp": "upload: ./big.mp4 to s3://catalog/videos/big.mp4",
  "range": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H \"Range: bytes=0-15\" -o first16.bin http://localhost:9000/catalog/videos/demo.mp4",
      "out": "HTTP/1.1 206 Partial Content\ncontent-length: 16\ncontent-range: bytes 0-15/20971520\netag: \"bb2191e9f0b5a3b33daca84e94efee23-3\"\naccept-ranges: bytes"
    },
    {
      "cmd": "od -A d -t x1 first16.bin",
      "out": "0000000 96 1f 81 34 9e fe ea d1 cb 83 c0 c2 42 ab 48 ff\n0000016"
    },
    {
      "cmd": "od -A d -t x1 -N 16 demo.mp4",
      "out": "0000000 96 1f 81 34 9e fe ea d1 cb 83 c0 c2 42 ab 48 ff\n0000016"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H \"Range: bytes=-10\" -o /dev/null http://localhost:9000/catalog/videos/demo.mp4",
      "out": "HTTP/1.1 206 Partial Content\ncontent-length: 10\ncontent-range: bytes 20971510-20971519/20971520\netag: \"bb2191e9f0b5a3b33daca84e94efee23-3\"\naccept-ranges: bytes"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H \"Range: bytes=99999999-\" http://localhost:9000/catalog/videos/demo.mp4",
      "out": "HTTP/1.1 416 Range Not Satisfiable\ncontent-length: 135\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>InvalidRange</Code><Message>The requested range is not satisfiable</Message></Error>"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key videos/demo.mp4 --range bytes=8388608-8388623 middle.bin",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:30+00:00\",\n    \"ContentLength\": 16,\n    \"ETag\": \"\\\"bb2191e9f0b5a3b33daca84e94efee23-3\\\"\",\n    \"ContentRange\": \"bytes 8388608-8388623/20971520\",\n    \"ContentType\": \"video/mp4\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key videos/demo.mp4 --part-number 3 part3.bin",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:30+00:00\",\n    \"ContentLength\": 4194304,\n    \"ETag\": \"\\\"bb2191e9f0b5a3b33daca84e94efee23-3\\\"\",\n    \"ContentRange\": \"bytes 16777216-20971519/20971520\",\n    \"ContentType\": \"video/mp4\",\n    \"Metadata\": {},\n    \"PartsCount\": 3\n}"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key videos/demo.mp4 --part-number 3",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:30+00:00\",\n    \"ContentLength\": 20971520,\n    \"ETag\": \"\\\"bb2191e9f0b5a3b33daca84e94efee23-3\\\"\",\n    \"ContentType\": \"video/mp4\",\n    \"Metadata\": {}\n}"
    }
  ],
  "checksums": [
    {
      "cmd": "openssl md5 -binary invoice.pdf | base64",
      "out": "PZkecPVBdwwS9zRCc0dGvw=="
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --content-md5 PZkecPVBdwwS9zRCc0dGvw==",
      "out": "{\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ChecksumCRC64NVME\": \"RNk1nthVij8=\"\n}"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --content-md5 AAAAAAAAAAAAAAAAAAAAAA==",
      "out": "aws: [ERROR]: An error occurred (BadDigest) when calling the PutObject operation: The Content-Md5 you specified did not match what we received.",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --checksum-sha256 ancLCM2se+/L9UD+nEL0o46c3/bteeKkdBCepA7TmFM=",
      "out": "{\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ChecksumSHA256\": \"ancLCM2se+/L9UD+nEL0o46c3/bteeKkdBCepA7TmFM=\"\n}"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key invoices/2026-0042.pdf --checksum-mode ENABLED",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:48+00:00\",\n    \"ContentLength\": 27,\n    \"ChecksumSHA256\": \"ancLCM2se+/L9UD+nEL0o46c3/bteeKkdBCepA7TmFM=\",\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ContentType\": \"application/pdf\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key invoices/2026-0042.pdf --body invoice.pdf --checksum-sha256 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      "out": "aws: [ERROR]: An error occurred (BadDigest) when calling the PutObject operation: The Content-Md5 you specified did not match what we received.",
      "code": 254
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key videos/big.mp4 --checksum-mode ENABLED",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:15:43+00:00\",\n    \"ContentLength\": 67108864,\n    \"ChecksumCRC64NVME\": \"mA45IivOrgU=\",\n    \"ChecksumType\": \"FULL_OBJECT\",\n    \"ETag\": \"\\\"401ae51254e2e844a03518b8f0893ed8-8\\\"\",\n    \"ContentType\": \"video/mp4\",\n    \"Metadata\": {}\n}"
    }
  ]
} as const
