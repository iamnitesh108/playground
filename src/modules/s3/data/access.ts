// Recorded by tools/s3-capture/capture-access.mjs against a real RustFS server. Do not edit by hand.
export const ACCESS = {
  "version": "1.0.3",
  "setup": [
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3 cp logo.svg s3://catalog/public/logo.svg",
      "out": "upload: ./logo.svg to s3://catalog/public/logo.svg"
    },
    {
      "cmd": "aws s3 cp invoice.pdf s3://catalog/invoices/2026-0042.pdf",
      "out": "upload: ./invoice.pdf to s3://catalog/invoices/2026-0042.pdf"
    }
  ],
  "builtIn": [
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc admin policy ls lab",
      "out": "  readonly\n  readwrite\n  KMSKeyUser\n  writeonly\n  diagnostics\n  consoleAdmin\n  KMSAuditor\n  KMSKeyAdministrator"
    },
    {
      "cmd": "rc admin policy info lab readonly",
      "out": "Policy: readonly\n\n{\n  \"policy\": {\n    \"Statement\": [\n      {\n        \"Action\": [\n          \"s3:GetBucketLocation\",\n          \"s3:GetObject\",\n          \"s3:GetBucketQuota\"\n        ],\n        \"Effect\": \"Allow\",\n        \"Resource\": [\n          \"arn:aws:s3:::*\"\n        ]\n      },\n      {\n        \"Action\": [\n          \"sts:AssumeRole\"\n        ],\n        \"Effect\": \"Allow\"\n      }\n    ],\n    \"Version\": \"2012-10-17\"\n  },\n  \"policy_name\": \"readonly\"\n}"
    }
  ],
  "users": [
    {
      "cmd": "rc admin user add lab catalog-reader readersecret123",
      "out": "✓ User 'catalog-reader' created successfully."
    },
    {
      "cmd": "rc admin policy create lab catalog-read catalog-read.json",
      "out": "✓ Policy 'catalog-read' created successfully."
    },
    {
      "cmd": "rc admin policy attach lab catalog-read --user catalog-reader",
      "out": "✓ Policy 'catalog-read' attached to user 'catalog-reader' successfully."
    },
    {
      "cmd": "rc admin user add lab catalog-uploader uploadersecret123",
      "out": "✓ User 'catalog-uploader' created successfully."
    },
    {
      "cmd": "rc admin policy create lab uploads-write uploads-write.json",
      "out": "✓ Policy 'uploads-write' created successfully."
    },
    {
      "cmd": "rc admin policy attach lab uploads-write --user catalog-uploader",
      "out": "✓ Policy 'uploads-write' attached to user 'catalog-uploader' successfully."
    },
    {
      "cmd": "rc admin user add lab catalog-app appsecret12345",
      "out": "✓ User 'catalog-app' created successfully."
    },
    {
      "cmd": "rc admin policy create lab catalog-app catalog-app.json",
      "out": "✓ Policy 'catalog-app' created successfully."
    },
    {
      "cmd": "rc admin policy attach lab catalog-app --user catalog-app",
      "out": "✓ Policy 'catalog-app' attached to user 'catalog-app' successfully."
    },
    {
      "cmd": "rc admin user ls lab",
      "out": "● catalog-app (policies: catalog-app)\n● catalog-uploader (policies: uploads-write)\n● catalog-reader (policies: catalog-read)"
    }
  ],
  "reader": [
    {
      "cmd": "aws --profile reader s3 ls s3://catalog/ --recursive",
      "out": "2026-10-18 13:23:05         27 invoices/2026-0042.pdf\n2026-10-18 13:23:04         42 public/logo.svg"
    },
    {
      "cmd": "aws --profile reader s3 cp s3://catalog/invoices/2026-0042.pdf -",
      "out": "%PDF-1.7\nInvoice 2026-0042"
    },
    {
      "cmd": "aws --profile reader s3 cp note.txt s3://catalog/note.txt",
      "out": "upload failed: ./note.txt to s3://catalog/note.txt An error occurred (AccessDenied) when calling the PutObject operation: Access Denied",
      "code": 1
    },
    {
      "cmd": "aws --profile reader s3 ls",
      "out": "2026-10-18 13:23:03 catalog"
    }
  ],
  "uploader": [
    {
      "cmd": "aws --profile uploader s3 cp photo.jpg s3://catalog/uploads/photo.jpg",
      "out": "upload: ./photo.jpg to s3://catalog/uploads/photo.jpg"
    },
    {
      "cmd": "aws --profile uploader s3 cp photo.jpg s3://catalog/images/photo.jpg",
      "out": "upload failed: ./photo.jpg to s3://catalog/images/photo.jpg An error occurred (AccessDenied) when calling the PutObject operation: Access Denied",
      "code": 1
    },
    {
      "cmd": "aws --profile uploader s3 ls s3://catalog/uploads/",
      "out": "2026-10-18 13:23:09       2048 photo.jpg"
    },
    {
      "cmd": "aws --profile uploader s3 ls s3://catalog/",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the ListObjectsV2 operation: Access Denied",
      "code": 254
    },
    {
      "cmd": "aws --profile uploader s3 cp s3://catalog/uploads/photo.jpg -",
      "out": "download failed: s3://catalog/uploads/photo.jpg to - An error occurred (403) when calling the HeadObject operation: Forbidden",
      "code": 1
    }
  ],
  "app": [
    {
      "cmd": "aws --profile app s3 cp invoice.pdf s3://catalog/invoices/2026-0043.pdf",
      "out": "upload: ./invoice.pdf to s3://catalog/invoices/2026-0043.pdf"
    },
    {
      "cmd": "aws --profile app s3 rm s3://catalog/uploads/photo.jpg",
      "out": "delete: s3://catalog/uploads/photo.jpg"
    },
    {
      "cmd": "aws --profile app s3 rm s3://catalog/invoices/2026-0043.pdf",
      "out": "delete failed: s3://catalog/invoices/2026-0043.pdf An error occurred (AccessDenied) when calling the DeleteObject operation: Access Denied",
      "code": 1
    }
  ],
  "accessKey": [
    {
      "cmd": "rc admin service-account create lab catalog-app-invoices appkeysecret12345 --user catalog-app --name invoice-reader --policy invoices-read.json",
      "out": "✓ Service account created successfully.\nAccess Key: catalog-app-invoices\nSecret Key: appkeysecret12345\n\n⚠ Make sure to save the secret key, it cannot be retrieved later!"
    },
    {
      "cmd": "aws --profile app-key s3 cp s3://catalog/invoices/2026-0042.pdf -",
      "out": "%PDF-1.7\nInvoice 2026-0042"
    },
    {
      "cmd": "aws --profile app-key s3 cp note.txt s3://catalog/invoices/note.txt",
      "out": "upload failed: ./note.txt to s3://catalog/invoices/note.txt An error occurred (AccessDenied) when calling the PutObject operation: Access Denied",
      "code": 1
    },
    {
      "cmd": "rc admin service-account ls lab --user catalog-app",
      "out": "  catalog-app-invoices (parent: catalog-app) [on]"
    }
  ],
  "bucketPolicy": [
    {
      "cmd": "curl -s http://localhost:9000/catalog/public/logo.svg",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    },
    {
      "cmd": "aws s3api put-bucket-policy --bucket catalog --policy file://public-read.json",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-policy --bucket catalog --query Policy --output text",
      "out": "{\n  \"Version\": \"2012-10-17\",\n  \"Statement\": [\n    {\n      \"Sid\": \"AnyoneMayReadPublic\",\n      \"Effect\": \"Allow\",\n      \"Principal\": \"*\",\n      \"Action\": [\"s3:GetObject\"],\n      \"Resource\": [\"arn:aws:s3:::catalog/public/*\"]\n    }\n  ]\n}"
    },
    {
      "cmd": "curl -s http://localhost:9000/catalog/public/logo.svg",
      "out": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>"
    },
    {
      "cmd": "curl -s http://localhost:9000/catalog/invoices/2026-0042.pdf",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    },
    {
      "cmd": "curl -s \"http://localhost:9000/catalog?list-type=2\"",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    }
  ],
  "publicBlock": [
    {
      "cmd": "aws s3api put-public-access-block --bucket catalog --public-access-block-configuration BlockPublicPolicy=true,RestrictPublicBuckets=true",
      "out": ""
    },
    {
      "cmd": "curl -s http://localhost:9000/catalog/public/logo.svg",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    },
    {
      "cmd": "aws s3api put-bucket-policy --bucket catalog --policy file://public-read.json",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the PutBucketPolicy operation: Access Denied",
      "code": 254
    },
    {
      "cmd": "aws s3api delete-public-access-block --bucket catalog",
      "out": ""
    },
    {
      "cmd": "aws s3api delete-bucket-policy --bucket catalog",
      "out": ""
    },
    {
      "cmd": "curl -s http://localhost:9000/catalog/public/logo.svg",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    }
  ],
  "anonymous": [
    {
      "cmd": "rc bucket anonymous set download lab/catalog/public",
      "out": "Warning: setting 'lab/catalog/public' will replace the entire bucket policy for 'catalog', which may remove unrelated statements\nSet anonymous permission for 'lab/catalog/public' to 'download'"
    },
    {
      "cmd": "rc bucket anonymous list lab/catalog",
      "out": "Anonymous policies:\n  public/ => download"
    },
    {
      "cmd": "curl -s http://localhost:9000/catalog/public/logo.svg",
      "out": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>"
    },
    {
      "cmd": "rc bucket anonymous set private lab/catalog/public",
      "out": "✗ Cannot set a prefix target to private because that would delete the entire bucket policy",
      "code": 2
    }
  ],
  "presignGet": [
    {
      "cmd": "aws s3 presign s3://catalog/invoices/2026-0042.pdf --expires-in 10",
      "out": "http://localhost:9000/catalog/invoices/2026-0042.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132325Z&X-Amz-Expires=10&X-Amz-SignedHeaders=host&X-Amz-Signature=e5364257b06675946221a9128af9cadd29232f458f9bcf74106b99bbd5b2b0fd"
    },
    {
      "cmd": "curl -s \"http://localhost:9000/catalog/invoices/2026-0042.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132325Z&X-Amz-Expires=10&X-Amz-SignedHeaders=host&X-Amz-Signature=e5364257b06675946221a9128af9cadd29232f458f9bcf74106b99bbd5b2b0fd\"",
      "out": "%PDF-1.7\nInvoice 2026-0042"
    },
    {
      "note": "12 seconds later"
    },
    {
      "cmd": "curl -s \"http://localhost:9000/catalog/invoices/2026-0042.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132325Z&X-Amz-Expires=10&X-Amz-SignedHeaders=host&X-Amz-Signature=e5364257b06675946221a9128af9cadd29232f458f9bcf74106b99bbd5b2b0fd\"",
      "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Request has expired</Message></Error>"
    }
  ],
  "presignPutUrl": [
    {
      "cmd": "node presign.ts PUT catalog uploads/from-browser.jpg 300 image/jpeg",
      "out": "http://localhost:9000/catalog/uploads/from-browser.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132337Z&X-Amz-Expires=300&X-Amz-Signature=d07e1b7418caa3c7b1c97d965b4a8cfc8aece6152c5f4786ff7aa2cd2ca606d3&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject"
    }
  ],
  "presignPut": [
    {
      "cmd": "curl -s -i -X PUT -H \"Content-Type: image/jpeg\" --data-binary @photo.jpg \"http://localhost:9000/catalog/uploads/from-browser.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132337Z&X-Amz-Expires=300&X-Amz-Signature=d07e1b7418caa3c7b1c97d965b4a8cfc8aece6152c5f4786ff7aa2cd2ca606d3&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject\"",
      "out": "HTTP/1.1 200 OK\netag: \"9eff775fee9d90a07ccf40d411bb16ac\"\ncontent-length: 0"
    },
    {
      "cmd": "curl -s -i -X PUT -H \"Content-Type: text/html\" --data-binary @photo.jpg \"http://localhost:9000/catalog/uploads/from-browser.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132337Z&X-Amz-Expires=300&X-Amz-Signature=d07e1b7418caa3c7b1c97d965b4a8cfc8aece6152c5f4786ff7aa2cd2ca606d3&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject\"",
      "out": "HTTP/1.1 403 Forbidden\ncontent-length: 320\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>SignatureDoesNotMatch</Code><Message>The request signature we calculated does not match the signature you provided. Check your AWS secret access key and signing method. For more information, see REST Authentication and SOAP Authentication for details.</Message></Error>"
    },
    {
      "cmd": "aws s3 ls s3://catalog/uploads/",
      "out": "2026-10-18 13:23:37       2048 from-browser.jpg"
    }
  ],
  "presignBadUrl": [
    {
      "cmd": "S3_ACCESS_KEY=catalog-reader S3_SECRET_KEY=readersecret123 node presign.ts PUT catalog uploads/by-reader.jpg 300 image/jpeg",
      "out": "http://localhost:9000/catalog/uploads/by-reader.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=catalog-reader%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132338Z&X-Amz-Expires=300&X-Amz-Signature=be3044cc3ba3387488c5b32a4c3cdacfe8d9d79a3862d97e3691f54ffbba4393&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject"
    }
  ],
  "presignBad": [
    {
      "cmd": "curl -s -i -X PUT -H \"Content-Type: image/jpeg\" --data-binary @photo.jpg \"http://localhost:9000/catalog/uploads/by-reader.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=catalog-reader%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132338Z&X-Amz-Expires=300&X-Amz-Signature=be3044cc3ba3387488c5b32a4c3cdacfe8d9d79a3862d97e3691f54ffbba4393&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject\"",
      "out": "HTTP/1.1 403 Forbidden\ncontent-length: 110\n\n<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
    }
  ],
  "cors": [
    {
      "cmd": "curl -s -i -X OPTIONS -H \"Origin: http://localhost:5173\" -H \"Access-Control-Request-Method: PUT\" -H \"Access-Control-Request-Headers: content-type\" http://localhost:9000/catalog/uploads/photo.jpg",
      "out": "HTTP/1.1 200 OK\ncontent-length: 0"
    },
    {
      "cmd": "aws s3api put-bucket-cors --bucket catalog --cors-configuration file://cors.json",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-cors --bucket catalog",
      "out": "{\n    \"CORSRules\": [\n        {\n            \"AllowedHeaders\": [\n                \"content-type\"\n            ],\n            \"AllowedMethods\": [\n                \"GET\",\n                \"PUT\"\n            ],\n            \"AllowedOrigins\": [\n                \"http://localhost:5173\"\n            ],\n            \"ExposeHeaders\": [\n                \"ETag\"\n            ],\n            \"MaxAgeSeconds\": 600\n        }\n    ]\n}"
    },
    {
      "cmd": "curl -s -i -X OPTIONS -H \"Origin: http://localhost:5173\" -H \"Access-Control-Request-Method: PUT\" -H \"Access-Control-Request-Headers: content-type\" http://localhost:9000/catalog/uploads/photo.jpg",
      "out": "HTTP/1.1 200 OK\naccess-control-allow-origin: http://localhost:5173\nvary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers\naccess-control-allow-methods: GET, PUT\naccess-control-allow-headers: content-type\naccess-control-max-age: 600\ncontent-length: 0"
    },
    {
      "cmd": "curl -s -i -X OPTIONS -H \"Origin: https://other-site.example\" -H \"Access-Control-Request-Method: PUT\" -H \"Access-Control-Request-Headers: content-type\" http://localhost:9000/catalog/uploads/photo.jpg",
      "out": "HTTP/1.1 403 Forbidden\ncontent-length: 0"
    },
    {
      "cmd": "curl -s -i -X PUT -H \"Origin: http://localhost:5173\" -H \"Content-Type: image/jpeg\" --data-binary @photo.jpg \"http://localhost:9000/catalog/uploads/from-browser.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T132337Z&X-Amz-Expires=300&X-Amz-Signature=d07e1b7418caa3c7b1c97d965b4a8cfc8aece6152c5f4786ff7aa2cd2ca606d3&X-Amz-SignedHeaders=content-type%3Bhost&x-id=PutObject\"",
      "out": "HTTP/1.1 200 OK\netag: \"9eff775fee9d90a07ccf40d411bb16ac\"\naccess-control-allow-origin: http://localhost:5173\nvary: Origin\naccess-control-allow-methods: GET, PUT\naccess-control-expose-headers: ETag\ncontent-length: 0"
    }
  ]
} as const
