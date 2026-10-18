// Recorded by tools/s3-capture/capture-versioning.mjs against a real RustFS server. Do not edit by hand.
export const VERSIONING = {
  "version": "1.0.3",
  "ids": [
    "4c08ba5d-0f4f-4080-bd78-c2f1a06587fd",
    "45094439-1aa2-4582-bae4-a1614d956b7c",
    "2e7f6a96-ad94-47fd-af00-facec7596491"
  ],
  "enable": [
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3api get-bucket-versioning --bucket catalog",
      "out": ""
    },
    {
      "cmd": "aws s3api put-bucket-versioning --bucket catalog --versioning-configuration Status=Enabled",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-versioning --bucket catalog",
      "out": "{\n    \"Status\": \"Enabled\"\n}"
    }
  ],
  "overwrite": [
    {
      "cmd": "aws s3api put-object --bucket catalog --key prices.csv --body prices.csv",
      "out": "{\n    \"ETag\": \"\\\"85b457c936d5e07f92738a4ca92ecc5e\\\"\",\n    \"ChecksumCRC64NVME\": \"scn5aUFq0cQ=\",\n    \"VersionId\": \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\"\n}"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key prices.csv --body prices.csv",
      "out": "{\n    \"ETag\": \"\\\"da3a99d769e682e270d0ad7878dc8070\\\"\",\n    \"ChecksumCRC64NVME\": \"7nXl/t+Svj8=\",\n    \"VersionId\": \"45094439-1aa2-4582-bae4-a1614d956b7c\"\n}"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key prices.csv --body prices.csv",
      "out": "{\n    \"ETag\": \"\\\"ab18c978e5d35fb9e96e0869672c223c\\\"\",\n    \"ChecksumCRC64NVME\": \"hvTsnsX6jNo=\",\n    \"VersionId\": \"2e7f6a96-ad94-47fd-af00-facec7596491\"\n}"
    },
    {
      "cmd": "aws s3api list-object-versions --bucket catalog --prefix prices.csv --query \"{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}\"",
      "out": "{\n    \"versions\": [\n        [\n            \"2e7f6a96-ad94-47fd-af00-facec7596491\",\n            true,\n            24\n        ],\n        [\n            \"45094439-1aa2-4582-bae4-a1614d956b7c\",\n            false,\n            24\n        ],\n        [\n            \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n            false,\n            24\n        ]\n    ],\n    \"deleteMarkers\": null\n}"
    },
    {
      "cmd": "aws s3 cp s3://catalog/prices.csv -",
      "out": "sku,price\nMUG-350,13.00"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key prices.csv --version-id 4c08ba5d-0f4f-4080-bd78-c2f1a06587fd first.csv",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:29:02+00:00\",\n    \"ContentLength\": 24,\n    \"ETag\": \"\\\"85b457c936d5e07f92738a4ca92ecc5e\\\"\",\n    \"ChecksumCRC64NVME\": \"scn5aUFq0cQ=\",\n    \"VersionId\": \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n    \"ContentType\": \"text/csv\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "cat first.csv",
      "out": "sku,price\nMUG-350,12.00"
    }
  ],
  "del": [
    {
      "cmd": "aws s3 rm s3://catalog/prices.csv",
      "out": "delete: s3://catalog/prices.csv"
    },
    {
      "cmd": "aws s3 ls s3://catalog/",
      "out": ""
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key prices.csv",
      "out": "aws: [ERROR]: An error occurred (404) when calling the HeadObject operation: Not Found",
      "code": 254
    },
    {
      "cmd": "aws s3api list-object-versions --bucket catalog --prefix prices.csv --query \"{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}\"",
      "out": "{\n    \"versions\": [\n        [\n            \"2e7f6a96-ad94-47fd-af00-facec7596491\",\n            false,\n            24\n        ],\n        [\n            \"45094439-1aa2-4582-bae4-a1614d956b7c\",\n            false,\n            24\n        ],\n        [\n            \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n            false,\n            24\n        ]\n    ],\n    \"deleteMarkers\": [\n        [\n            \"a0e14498-a887-4eae-8c13-33fb326a42af\",\n            true\n        ]\n    ]\n}"
    }
  ],
  "undelete": [
    {
      "cmd": "aws s3api delete-object --bucket catalog --key prices.csv --version-id a0e14498-a887-4eae-8c13-33fb326a42af",
      "out": "{\n    \"DeleteMarker\": true,\n    \"VersionId\": \"a0e14498-a887-4eae-8c13-33fb326a42af\"\n}"
    },
    {
      "cmd": "aws s3 cp s3://catalog/prices.csv -",
      "out": "sku,price\nMUG-350,13.00"
    }
  ],
  "restore": [
    {
      "cmd": "aws s3api copy-object --bucket catalog --key prices.csv --copy-source \"catalog/prices.csv?versionId=4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\"",
      "out": "{\n    \"CopySourceVersionId\": \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n    \"VersionId\": \"a32a1591-322b-4ef0-962f-dff21e016a28\",\n    \"CopyObjectResult\": {\n        \"ETag\": \"\\\"85b457c936d5e07f92738a4ca92ecc5e\\\"\",\n        \"LastModified\": \"2026-10-18T13:29:11.819000+00:00\",\n        \"ChecksumCRC64NVME\": \"scn5aUFq0cQ=\"\n    }\n}"
    },
    {
      "cmd": "aws s3 cp s3://catalog/prices.csv -",
      "out": "sku,price\nMUG-350,12.00"
    },
    {
      "cmd": "aws s3api list-object-versions --bucket catalog --prefix prices.csv --query \"{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}\"",
      "out": "{\n    \"versions\": [\n        [\n            \"a32a1591-322b-4ef0-962f-dff21e016a28\",\n            true,\n            24\n        ],\n        [\n            \"2e7f6a96-ad94-47fd-af00-facec7596491\",\n            false,\n            24\n        ],\n        [\n            \"45094439-1aa2-4582-bae4-a1614d956b7c\",\n            false,\n            24\n        ],\n        [\n            \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n            false,\n            24\n        ]\n    ],\n    \"deleteMarkers\": null\n}"
    }
  ],
  "purge": [
    {
      "cmd": "aws s3api delete-object --bucket catalog --key prices.csv --version-id 45094439-1aa2-4582-bae4-a1614d956b7c",
      "out": "{\n    \"DeleteMarker\": false,\n    \"VersionId\": \"45094439-1aa2-4582-bae4-a1614d956b7c\"\n}"
    },
    {
      "cmd": "aws s3api list-object-versions --bucket catalog --prefix prices.csv --query \"{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}\"",
      "out": "{\n    \"versions\": [\n        [\n            \"a32a1591-322b-4ef0-962f-dff21e016a28\",\n            true,\n            24\n        ],\n        [\n            \"2e7f6a96-ad94-47fd-af00-facec7596491\",\n            false,\n            24\n        ],\n        [\n            \"4c08ba5d-0f4f-4080-bd78-c2f1a06587fd\",\n            false,\n            24\n        ]\n    ],\n    \"deleteMarkers\": null\n}"
    },
    {
      "cmd": "aws s3api get-object --bucket catalog --key prices.csv --version-id 45094439-1aa2-4582-bae4-a1614d956b7c gone.csv",
      "out": "aws: [ERROR]: An error occurred (NoSuchVersion) when calling the GetObject operation: The specified version does not exist.",
      "code": 254
    }
  ],
  "undo": [
    {
      "cmd": "aws s3 cp prices.csv s3://catalog/prices.csv",
      "out": "upload: ./prices.csv to s3://catalog/prices.csv"
    },
    {
      "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
      "out": "✓ Alias 'lab' configured successfully."
    },
    {
      "cmd": "rc undo lab/catalog/prices.csv --dry-run",
      "out": "Would restore prices.csv from version 'a32a1591-322b-4ef0-962f-dff21e016a28' (expected current 'c5d721b8-232b-4799-9070-8af3484e2bb1')"
    },
    {
      "cmd": "rc undo lab/catalog/prices.csv",
      "out": "✓ Restored object version: prices.csv"
    },
    {
      "cmd": "aws s3 cp s3://catalog/prices.csv -",
      "out": "sku,price\nMUG-350,12.00"
    }
  ],
  "lockSetup": [
    {
      "cmd": "aws s3api create-bucket --bucket invoices --object-lock-enabled-for-bucket",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-versioning --bucket invoices",
      "out": "{\n    \"Status\": \"Enabled\"\n}"
    },
    {
      "cmd": "aws s3api put-object-lock-configuration --bucket invoices --object-lock-configuration \"{\\\"ObjectLockEnabled\\\": \\\"Enabled\\\", \\\"Rule\\\": {\\\"DefaultRetention\\\": {\\\"Mode\\\": \\\"GOVERNANCE\\\", \\\"Days\\\": 1}}}\"",
      "out": ""
    },
    {
      "cmd": "aws s3api get-object-lock-configuration --bucket invoices",
      "out": "{\n    \"ObjectLockConfiguration\": {\n        \"ObjectLockEnabled\": \"Enabled\",\n        \"Rule\": {\n            \"DefaultRetention\": {\n                \"Mode\": \"GOVERNANCE\",\n                \"Days\": 1\n            }\n        }\n    }\n}"
    }
  ],
  "governance": [
    {
      "cmd": "aws s3api put-object --bucket invoices --key 2026/0042.pdf --body invoice.pdf",
      "out": "{\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ChecksumCRC64NVME\": \"RNk1nthVij8=\",\n    \"VersionId\": \"94e592fe-46e8-457b-b470-51be433f6cc9\"\n}"
    },
    {
      "cmd": "aws s3api get-object-retention --bucket invoices --key 2026/0042.pdf",
      "out": "{\n    \"Retention\": {\n        \"Mode\": \"GOVERNANCE\",\n        \"RetainUntilDate\": \"2026-10-19T13:29:19.470000+00:00\"\n    }\n}"
    },
    {
      "cmd": "aws s3api delete-object --bucket invoices --key 2026/0042.pdf --version-id 94e592fe-46e8-457b-b470-51be433f6cc9",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the DeleteObject operation: Object is under GOVERNANCE retention and cannot be deleted until 2026-10-19 13:29:19.470250008 +00:00:00",
      "code": 254
    },
    {
      "cmd": "aws s3api delete-object --bucket invoices --key 2026/0042.pdf --version-id 94e592fe-46e8-457b-b470-51be433f6cc9 --bypass-governance-retention",
      "out": "{\n    \"DeleteMarker\": false,\n    \"VersionId\": \"94e592fe-46e8-457b-b470-51be433f6cc9\"\n}"
    }
  ],
  "compliance": [
    {
      "cmd": "aws s3api put-object --bucket invoices --key 2026/0043.pdf --body invoice.pdf --object-lock-mode COMPLIANCE --object-lock-retain-until-date 2026-10-19T13:29:21Z",
      "out": "{\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ChecksumCRC64NVME\": \"RNk1nthVij8=\",\n    \"VersionId\": \"178bee7f-8f1b-4cfa-95a2-c39c0b95977e\"\n}"
    },
    {
      "cmd": "aws s3api get-object-retention --bucket invoices --key 2026/0043.pdf",
      "out": "{\n    \"Retention\": {\n        \"Mode\": \"COMPLIANCE\",\n        \"RetainUntilDate\": \"2026-10-19T13:29:21+00:00\"\n    }\n}"
    },
    {
      "cmd": "aws s3api delete-object --bucket invoices --key 2026/0043.pdf --version-id 178bee7f-8f1b-4cfa-95a2-c39c0b95977e --bypass-governance-retention",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the DeleteObject operation: Object is under COMPLIANCE retention and cannot be deleted until 2026-10-19 13:29:21.0 +00:00:00",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object-retention --bucket invoices --key 2026/0043.pdf --version-id 178bee7f-8f1b-4cfa-95a2-c39c0b95977e --retention \"{\\\"Mode\\\": \\\"COMPLIANCE\\\", \\\"RetainUntilDate\\\": \\\"2026-01-01T00:00:00Z\\\"}\"",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the PutObjectRetention operation: Object is under COMPLIANCE retention and cannot be deleted until 2026-10-19 13:29:21.0 +00:00:00",
      "code": 254
    },
    {
      "cmd": "aws s3 rm s3://invoices/2026/0043.pdf",
      "out": "delete: s3://invoices/2026/0043.pdf"
    },
    {
      "cmd": "aws s3api list-object-versions --bucket invoices --prefix 2026/0043.pdf --query \"{versions: Versions[].[VersionId, IsLatest, Size], deleteMarkers: DeleteMarkers[].[VersionId, IsLatest]}\"",
      "out": "{\n    \"versions\": [\n        [\n            \"178bee7f-8f1b-4cfa-95a2-c39c0b95977e\",\n            false,\n            27\n        ]\n    ],\n    \"deleteMarkers\": [\n        [\n            \"da1843fb-81aa-44d7-aa79-f21acf946564\",\n            true\n        ]\n    ]\n}"
    }
  ],
  "legalHold": [
    {
      "cmd": "aws s3api put-object --bucket invoices --key 2026/0044.pdf --body invoice.pdf",
      "out": "{\n    \"ETag\": \"\\\"3d991e70f541770c12f73442734746bf\\\"\",\n    \"ChecksumCRC64NVME\": \"RNk1nthVij8=\",\n    \"VersionId\": \"f07eaa43-b3fb-4403-a340-8bff3df1cb2a\"\n}"
    },
    {
      "cmd": "aws s3api put-object-legal-hold --bucket invoices --key 2026/0044.pdf --version-id f07eaa43-b3fb-4403-a340-8bff3df1cb2a --legal-hold Status=ON",
      "out": "{\n    \"RequestCharged\": \"requester\"\n}"
    },
    {
      "cmd": "aws s3api delete-object --bucket invoices --key 2026/0044.pdf --version-id f07eaa43-b3fb-4403-a340-8bff3df1cb2a --bypass-governance-retention",
      "out": "aws: [ERROR]: An error occurred (AccessDenied) when calling the DeleteObject operation: Object has a legal hold and cannot be deleted. Remove the legal hold first.",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object-legal-hold --bucket invoices --key 2026/0044.pdf --version-id f07eaa43-b3fb-4403-a340-8bff3df1cb2a --legal-hold Status=OFF",
      "out": "{\n    \"RequestCharged\": \"requester\"\n}"
    },
    {
      "cmd": "aws s3api delete-object --bucket invoices --key 2026/0044.pdf --version-id f07eaa43-b3fb-4403-a340-8bff3df1cb2a --bypass-governance-retention",
      "out": "{\n    \"DeleteMarker\": false,\n    \"VersionId\": \"f07eaa43-b3fb-4403-a340-8bff3df1cb2a\"\n}"
    }
  ],
  "lockLater": [
    {
      "cmd": "aws s3api put-object-lock-configuration --bucket catalog --object-lock-configuration \"{\\\"ObjectLockEnabled\\\": \\\"Enabled\\\"}\"",
      "out": ""
    }
  ],
  "rules": [
    {
      "cmd": "aws s3api put-bucket-lifecycle-configuration --bucket catalog --lifecycle-configuration file://lifecycle.json",
      "out": ""
    },
    {
      "cmd": "aws s3api get-bucket-lifecycle-configuration --bucket catalog --query \"Rules[].ID\"",
      "out": "[\n    \"expire-temp-files\",\n    \"old-versions-after-30-days\",\n    \"abort-stale-uploads\",\n    \"remove-lonely-delete-markers\"\n]"
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key tmp/export.csv --body export.csv",
      "out": "{\n    \"Expiration\": \"expiry-date=\\\"Mon, 26 Oct 2026 00:00:00 GMT\\\", rule-id=\\\"expire-temp-files\\\"\",\n    \"ETag\": \"\\\"f0e4e65763dff492751e34ab24833e0f\\\"\",\n    \"ChecksumCRC64NVME\": \"V0kuiCLKPE0=\",\n    \"VersionId\": \"163dd30b-1b43-44ba-a82d-2e6d11f39a35\"\n}"
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key tmp/export.csv",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"Expiration\": \"expiry-date=\\\"Mon, 26 Oct 2026 00:00:00 GMT\\\", rule-id=\\\"expire-temp-files\\\"\",\n    \"LastModified\": \"2026-10-18T13:29:30+00:00\",\n    \"ContentLength\": 17,\n    \"ETag\": \"\\\"f0e4e65763dff492751e34ab24833e0f\\\"\",\n    \"VersionId\": \"163dd30b-1b43-44ba-a82d-2e6d11f39a35\",\n    \"ContentType\": \"text/csv\",\n    \"Metadata\": {}\n}"
    },
    {
      "cmd": "aws s3api put-bucket-lifecycle-configuration --bucket catalog --lifecycle-configuration file://tiering.json",
      "out": "aws: [ERROR]: An error occurred (InvalidArgument) when calling the PutBucketLifecycleConfiguration operation: invalid tier.",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key archive/x.csv --body export.csv --storage-class GLACIER",
      "out": "aws: [ERROR]: An error occurred (InvalidStorageClass) when calling the PutObject operation: The storage class you specified is not valid.",
      "code": 254
    }
  ],
  "lifecycle": {
    "Rules": [
      {
        "ID": "expire-temp-files",
        "Status": "Enabled",
        "Filter": {
          "Prefix": "tmp/"
        },
        "Expiration": {
          "Days": 7
        }
      },
      {
        "ID": "old-versions-after-30-days",
        "Status": "Enabled",
        "Filter": {
          "Prefix": ""
        },
        "NoncurrentVersionExpiration": {
          "NoncurrentDays": 30,
          "NewerNoncurrentVersions": 3
        }
      },
      {
        "ID": "abort-stale-uploads",
        "Status": "Enabled",
        "Filter": {
          "Prefix": ""
        },
        "AbortIncompleteMultipartUpload": {
          "DaysAfterInitiation": 3
        }
      },
      {
        "ID": "remove-lonely-delete-markers",
        "Status": "Enabled",
        "Filter": {
          "Prefix": ""
        },
        "Expiration": {
          "ExpiredObjectDeleteMarker": true
        }
      }
    ]
  },
  "fast": {
    "daySeconds": 5,
    "rules": {
      "Rules": [
        {
          "ID": "expire-temp-after-1-day",
          "Status": "Enabled",
          "Filter": {
            "Prefix": "tmp/"
          },
          "Expiration": {
            "Days": 1
          }
        },
        {
          "ID": "noncurrent-after-1-day",
          "Status": "Enabled",
          "Filter": {
            "Prefix": "docs/"
          },
          "NoncurrentVersionExpiration": {
            "NoncurrentDays": 1
          }
        }
      ]
    },
    "setup": [
      {
        "cmd": "aws s3 mb s3://scratch",
        "out": "make_bucket: scratch"
      },
      {
        "cmd": "aws s3api put-bucket-versioning --bucket scratch --versioning-configuration Status=Enabled",
        "out": ""
      },
      {
        "cmd": "aws s3api put-bucket-lifecycle-configuration --bucket scratch --lifecycle-configuration file://fast.json",
        "out": ""
      },
      {
        "cmd": "aws s3api put-object --bucket scratch --key docs/terms.txt --body v.txt",
        "out": "{\n    \"ETag\": \"\\\"eb260e9ae827821beceeed4104f0ad89\\\"\",\n    \"ChecksumCRC64NVME\": \"e5ThutavlkU=\",\n    \"VersionId\": \"e42f496d-b3c0-44f4-87b5-1d4e22b290b5\"\n}"
      },
      {
        "cmd": "aws s3api put-object --bucket scratch --key docs/terms.txt --body v.txt",
        "out": "{\n    \"ETag\": \"\\\"59d0d19fc45ca69230d858f60a5557f8\\\"\",\n    \"ChecksumCRC64NVME\": \"lZNNsQ+dl4M=\",\n    \"VersionId\": \"98d2675a-c836-4e27-beb6-e66a3016c0be\"\n}"
      },
      {
        "cmd": "aws s3api put-object --bucket scratch --key tmp/export.csv --body export.csv",
        "out": "{\n    \"Expiration\": \"expiry-date=\\\"Sun, 18 Oct 2026 13:29:42 GMT\\\", rule-id=\\\"expire-temp-after-1-day\\\"\",\n    \"ETag\": \"\\\"f0e4e65763dff492751e34ab24833e0f\\\"\",\n    \"ChecksumCRC64NVME\": \"V0kuiCLKPE0=\",\n    \"VersionId\": \"5531b77c-66f0-4752-9bde-274873df055e\"\n}"
      },
      {
        "cmd": "aws s3api list-object-versions --bucket scratch --query \"{versions: Versions[].[Key, IsLatest], deleteMarkers: DeleteMarkers[].[Key, IsLatest]}\"",
        "out": "{\n    \"versions\": [\n        [\n            \"docs/terms.txt\",\n            true\n        ],\n        [\n            \"docs/terms.txt\",\n            false\n        ],\n        [\n            \"tmp/export.csv\",\n            true\n        ]\n    ],\n    \"deleteMarkers\": null\n}"
      }
    ],
    "timeline": [
      {
        "at": 0,
        "state": "version of docs/terms.txt | version of docs/terms.txt (latest) | version of tmp/export.csv (latest)"
      },
      {
        "at": 8,
        "state": "delete marker of tmp/export.csv (latest) | version of docs/terms.txt | version of docs/terms.txt (latest) | version of tmp/export.csv"
      },
      {
        "at": 9,
        "state": "delete marker of tmp/export.csv (latest) | version of docs/terms.txt (latest) | version of tmp/export.csv"
      }
    ],
    "after": [
      {
        "cmd": "aws s3api list-object-versions --bucket scratch --query \"{versions: Versions[].[Key, IsLatest], deleteMarkers: DeleteMarkers[].[Key, IsLatest]}\"",
        "out": "{\n    \"versions\": [\n        [\n            \"docs/terms.txt\",\n            true\n        ],\n        [\n            \"tmp/export.csv\",\n            false\n        ]\n    ],\n    \"deleteMarkers\": [\n        [\n            \"tmp/export.csv\",\n            true\n        ]\n    ]\n}"
      },
      {
        "cmd": "aws s3 ls s3://scratch/ --recursive",
        "out": "2026-10-18 13:29:35          7 docs/terms.txt"
      }
    ]
  }
} as const
