// Recorded by tools/s3-capture/capture-requests.mjs against a real RustFS server. Do not edit by hand.
export const REQUESTS = {
  "version": "1.0.3",
  "verbs": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -X PUT http://localhost:9000/catalog",
      "out": "PUT /catalog HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=639151b581e591028baa9e557a682d1351cb36f753adbb683496d4a6f9060fab\nX-Amz-Date: 20261018T131133Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 200 OK\nx-request-id: 462c021c\nx-amz-request-id: 462c021c\ncontent-length: 0\ndate: Sun, 18 Oct 2026 13:11:33 GMT\n"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -T readme.txt -H \"Content-Type: text/plain\" http://localhost:9000/catalog/readme.txt",
      "out": "PUT /catalog/readme.txt HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=583e15dcdd23ec50126cb5232e1bc67a18874a88d8729fd5c55bde089c3ba0d1\nX-Amz-Date: 20261018T131133Z\nx-amz-content-sha256: UNSIGNED-PAYLOAD\nUser-Agent: curl/8.23.0\nAccept: */*\nContent-Type: text/plain\nContent-Length: 28\n\n\nHTTP/1.1 200 OK\netag: \"b4209f7376610ae2bec78b69e3b45d4d\"\nx-request-id: 1fce2640\nx-amz-request-id: 1fce2640\ncontent-length: 0\ndate: Sun, 18 Oct 2026 13:11:33 GMT\n"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 http://localhost:9000/catalog/readme.txt",
      "out": "GET /catalog/readme.txt HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=3c3d8e7030814aa0251f1005948483beab9a4e968746796b604d25f3e071d33e\nX-Amz-Date: 20261018T131133Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 200 OK\ncontent-length: 28\ncontent-type: text/plain\netag: \"b4209f7376610ae2bec78b69e3b45d4d\"\nlast-modified: Sun, 18 Oct 2026 13:11:33 GMT\naccept-ranges: bytes\nx-request-id: 29c90249\nx-amz-request-id: 29c90249\ndate: Sun, 18 Oct 2026 13:11:33 GMT\n\n\nProduct photos and manuals."
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -I http://localhost:9000/catalog/readme.txt",
      "out": "HEAD /catalog/readme.txt HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=4b2d2fa8e5a82c231076f73fbe09edc05ffe0f43ba2edb6936c4df26ed9d824d\nX-Amz-Date: 20261018T131134Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 200 OK\naccept-ranges: bytes\ncontent-length: 28\ncontent-type: text/plain\netag: \"b4209f7376610ae2bec78b69e3b45d4d\"\nlast-modified: Sun, 18 Oct 2026 13:11:33 GMT\nx-request-id: f5ca161b\nx-amz-request-id: f5ca161b\ndate: Sun, 18 Oct 2026 13:11:34 GMT\n"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 \"http://localhost:9000/catalog?list-type=2&delimiter=/\"",
      "out": "GET /catalog?list-type=2&delimiter=/ HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=f249f0867ef5940673c4c0c46be3982913ff52af835f88d0bb70423bc30aa3eb\nX-Amz-Date: 20261018T131134Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 200 OK\ncontent-type: application/xml\nx-request-id: 66760ba3\nx-amz-request-id: 66760ba3\ncontent-length: 455\ndate: Sun, 18 Oct 2026 13:11:34 GMT\n\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><ListBucketResult xmlns=\"http://s3.amazonaws.com/doc/2006-03-01/\"><Name>catalog</Name><Prefix></Prefix><MaxKeys>1000</MaxKeys><KeyCount>1</KeyCount><IsTruncated>false</IsTruncated><Contents><ETag>\"b4209f7376610ae2bec78b69e3b45d4d\"</ETag><Key>readme.txt</Key><LastModified>2026-10-18T13:11:33.853Z</LastModified><Size>28</Size><StorageClass>STANDARD</StorageClass></Contents><Delimiter>/</Delimiter></ListBucketResult>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -X DELETE http://localhost:9000/catalog/readme.txt",
      "out": "DELETE /catalog/readme.txt HTTP/1.1\nHost: localhost:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=4d2bf75015964bf588bd1d24e2b29df390a414aef49b6085d4b7c23fd23b4c95\nX-Amz-Date: 20261018T131134Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 204 No Content\nx-amz-delete-marker: false\nx-request-id: 78160a57\nx-amz-request-id: 78160a57\ndate: Sun, 18 Oct 2026 13:11:34 GMT\n"
    }
  ],
  "etag": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -T readme.txt http://localhost:9000/catalog/readme.txt",
      "out": "etag: \"b4209f7376610ae2bec78b69e3b45d4d\""
    },
    {
      "cmd": "md5sum readme.txt",
      "out": "b4209f7376610ae2bec78b69e3b45d4d  readme.txt"
    }
  ],
  "sigv4": {
    "method": "GET",
    "url": "http://localhost:9000/catalog/readme.txt",
    "accessKey": "labadmin",
    "secretKey": "labsecret123",
    "region": "us-east-1",
    "service": "s3",
    "canonicalRequest": "GET\n/catalog/readme.txt\n\nhost:localhost:9000\nx-amz-checksum-mode:ENABLED\nx-amz-content-sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nx-amz-date:20261018T131134Z\n\nhost;x-amz-checksum-mode;x-amz-content-sha256;x-amz-date\ne3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "stringToSign": "AWS4-HMAC-SHA256\n20261018T131134Z\n20261018/us-east-1/s3/aws4_request\n0d457e4dafd19083d84c49143d7a5c977251655cfe2f730f0558ee991f8b97a0",
    "signature": "d002ecf2dd3bd415c75c9c4d0a34c1fc21c7fea065abdbf7ef3aa772f58de2d7",
    "authorization": "AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-checksum-mode;x-amz-content-sha256;x-amz-date, Signature=d002ecf2dd3bd415c75c9c4d0a34c1fc21c7fea065abdbf7ef3aa772f58de2d7",
    "amzDate": "20261018T131134Z",
    "status": 200
  },
  "errors": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 http://localhost:9000/catalog/nope.txt",
      "out": "HTTP/1.1 404 Not Found\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 http://localhost:9000/no-such-bucket/readme.txt",
      "out": "HTTP/1.1 404 Not Found\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>NoSuchBucket</Code><Message>The specified bucket does not exist</Message></Error>"
    },
    {
      "cmd": "curl -s -v http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 403 Forbidden\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:wrong-secret http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 403 Forbidden\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match the signature you provided. Check your AWS secret access key and signing method. For more information, see REST Authentication and SOAP Authentication for details.</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user nobody:labsecret123 http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 403 Forbidden\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>InvalidAccessKeyId</Code><Message>The Access Key Id you provided does not exist in our records.</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:eu-west-1:s3 --user labadmin:labsecret123 http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 200 OK\nProduct photos and manuals."
    }
  ],
  "skew": [
    {
      "minutes": -20,
      "status": 403,
      "code": "RequestTimeTooSkewed",
      "message": "request time is too far from server time",
      "amzDate": "20261018T125135Z"
    },
    {
      "minutes": -16,
      "status": 403,
      "code": "RequestTimeTooSkewed",
      "message": "request time is too far from server time",
      "amzDate": "20261018T125535Z"
    },
    {
      "minutes": -14,
      "status": 200,
      "code": "OK",
      "message": "",
      "amzDate": "20261018T125735Z"
    },
    {
      "minutes": -5,
      "status": 200,
      "code": "OK",
      "message": "",
      "amzDate": "20261018T130635Z"
    },
    {
      "minutes": 0,
      "status": 200,
      "code": "OK",
      "message": "",
      "amzDate": "20261018T131135Z"
    },
    {
      "minutes": 5,
      "status": 200,
      "code": "OK",
      "message": "",
      "amzDate": "20261018T131635Z"
    },
    {
      "minutes": 14,
      "status": 200,
      "code": "OK",
      "message": "",
      "amzDate": "20261018T132535Z"
    },
    {
      "minutes": 16,
      "status": 403,
      "code": "RequestTimeTooSkewed",
      "message": "request time is too far from server time",
      "amzDate": "20261018T132735Z"
    },
    {
      "minutes": 20,
      "status": 403,
      "code": "RequestTimeTooSkewed",
      "message": "request time is too far from server time",
      "amzDate": "20261018T133135Z"
    }
  ],
  "skewed": {
    "minutes": -20,
    "status": 403,
    "code": "RequestTimeTooSkewed",
    "message": "request time is too far from server time",
    "amzDate": "20261018T125135Z"
  },
  "skewWire": {
    "headers": {
      "host": "localhost:9000",
      "x-amz-content-sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "x-amz-date": "20261018T125135Z",
      "authorization": "AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=3a51b5627a95aff949c265598dc1711310097c082f00729e7ace769b9d3c5847"
    },
    "status": 403,
    "body": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>RequestTimeTooSkewed</Code><Message>request time is too far from server time</Message></Error>"
  },
  "conditional": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -T readme.txt -H \"If-None-Match: *\" http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 412 Precondition Failed\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>PreconditionFailed</Code><Message>At least one of the pre-conditions you specified did not hold</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H 'If-None-Match: \"b4209f7376610ae2bec78b69e3b45d4d\"' http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 304 Not Modified"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -H 'If-Match: \"0123456789abcdef0123456789abcdef\"' http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 412 Precondition Failed\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>PreconditionFailed</Code><Message>At least one of the preconditions you specified did not hold.</Message></Error>"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -T readme.txt -H \"If-None-Match: *\" http://localhost:9000/catalog/new-file.txt",
      "out": "HTTP/1.1 200 OK"
    }
  ],
  "consistency": {
    "rounds": 300,
    "overwriteStale": 0,
    "listMissing": 0,
    "deleteVisible": 0,
    "ms": 8394
  },
  "race": {
    "trials": 50,
    "outcomes": {
      "200+412": 50
    }
  },
  "virtual": [
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -X PUT http://localhost:9000/catalog",
      "out": "HTTP/1.1 200 OK"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 -T readme.txt http://localhost:9000/catalog/readme.txt",
      "out": "HTTP/1.1 200 OK"
    },
    {
      "cmd": "curl -s -v --aws-sigv4 aws:amz:us-east-1:s3 --user labadmin:labsecret123 --resolve catalog.s3.lab.test:9000:127.0.0.1 http://catalog.s3.lab.test:9000/readme.txt",
      "out": "GET /readme.txt HTTP/1.1\nHost: catalog.s3.lab.test:9000\nAuthorization: AWS4-HMAC-SHA256 Credential=labadmin/20261018/us-east-1/s3/aws4_request, SignedHeaders=host;x-amz-content-sha256;x-amz-date, Signature=afb0a8e6c826bcfe4aa96ae6c21c426b418fa037699b783c25d37569db8f56d5\nX-Amz-Date: 20261018T131148Z\nx-amz-content-sha256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\nUser-Agent: curl/8.23.0\nAccept: */*\n\n\nHTTP/1.1 200 OK\ncontent-length: 28\ncontent-type: text/plain\netag: \"b4209f7376610ae2bec78b69e3b45d4d\"\nlast-modified: Sun, 18 Oct 2026 13:11:47 GMT\naccept-ranges: bytes\nx-request-id: 37b0e888\nx-amz-request-id: 37b0e888\ndate: Sun, 18 Oct 2026 13:11:48 GMT\n\n\nProduct photos and manuals."
    }
  ]
} as const
