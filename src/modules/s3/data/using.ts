// Recorded by tools/s3-capture/capture-using.mjs against a real RustFS server. Do not edit by hand.
export const USING = {
  "version": "1.0.3",
  "cli": {
    "bucket": [
      {
        "cmd": "aws s3 mb s3://catalog",
        "out": "make_bucket: catalog"
      },
      {
        "cmd": "aws s3 ls",
        "out": "2026-10-18 13:02:41 catalog"
      }
    ],
    "upload": [
      {
        "cmd": "aws s3 cp mug-front.jpg s3://catalog/images/mug/front.jpg --content-type image/jpeg --metadata color=blue,sku=MUG-350",
        "out": "upload: ./mug-front.jpg to s3://catalog/images/mug/front.jpg"
      },
      {
        "cmd": "aws s3 cp readme.txt s3://catalog/docs/readme.txt",
        "out": "upload: ./readme.txt to s3://catalog/docs/readme.txt"
      },
      {
        "cmd": "aws s3 cp photos s3://catalog/images/ --recursive",
        "out": "upload: photos/lamp-front.jpg to s3://catalog/images/lamp-front.jpg\nupload: photos/lamp-side.jpg to s3://catalog/images/lamp-side.jpg\nupload: photos/vase.jpg to s3://catalog/images/vase.jpg"
      }
    ],
    "list": [
      {
        "cmd": "aws s3 ls s3://catalog/",
        "out": "                           PRE docs/\n                           PRE images/"
      },
      {
        "cmd": "aws s3 ls s3://catalog/images/",
        "out": "                           PRE mug/\n2026-10-18 13:02:44      39552 lamp-front.jpg\n2026-10-18 13:02:44      41210 lamp-side.jpg\n2026-10-18 13:02:44      36004 vase.jpg"
      },
      {
        "cmd": "aws s3 ls s3://catalog/ --recursive --human-readable --summarize",
        "out": "2026-10-18 13:02:43   28 Bytes docs/readme.txt\n2026-10-18 13:02:44   38.6 KiB images/lamp-front.jpg\n2026-10-18 13:02:44   40.2 KiB images/lamp-side.jpg\n2026-10-18 13:02:43   47.1 KiB images/mug/front.jpg\n2026-10-18 13:02:44   35.2 KiB images/vase.jpg\n\nTotal Objects: 5\n   Total Size: 161.1 KiB"
      },
      {
        "cmd": "aws s3api list-objects-v2 --bucket catalog --prefix images/ --delimiter / --query \"CommonPrefixes[].Prefix\"",
        "out": "[\n    \"images/mug/\"\n]"
      }
    ],
    "download": [
      {
        "cmd": "aws s3 cp s3://catalog/images/mug/front.jpg downloads/front.jpg",
        "out": "download: s3://catalog/images/mug/front.jpg to downloads/front.jpg"
      },
      {
        "cmd": "aws s3 cp s3://catalog/docs/readme.txt -",
        "out": "Product photos and manuals."
      },
      {
        "cmd": "wc -c downloads/front.jpg",
        "out": "48213 downloads/front.jpg"
      }
    ],
    "metadata": [
      {
        "cmd": "aws s3api head-object --bucket catalog --key images/mug/front.jpg",
        "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T13:02:43+00:00\",\n    \"ContentLength\": 48213,\n    \"ETag\": \"\\\"c08dd209d96ab1ab01c4128d36358ed4\\\"\",\n    \"ContentType\": \"image/jpeg\",\n    \"Metadata\": {\n        \"color\": \"blue\",\n        \"sku\": \"MUG-350\"\n    }\n}"
      },
      {
        "cmd": "aws s3api head-object --bucket catalog --key docs/readme.txt --query ContentType",
        "out": "\"text/plain\""
      }
    ],
    "copy": [
      {
        "cmd": "aws s3 cp s3://catalog/images/mug/front.jpg s3://catalog/images/mug/front-copy.jpg",
        "out": "copy: s3://catalog/images/mug/front.jpg to s3://catalog/images/mug/front-copy.jpg"
      }
    ],
    "move": [
      {
        "cmd": "aws s3 mv s3://catalog/images/vase.jpg s3://catalog/archive/vase.jpg",
        "out": "move: s3://catalog/images/vase.jpg to s3://catalog/archive/vase.jpg"
      },
      {
        "cmd": "aws s3 mv s3://catalog/images/lamp-front.jpg s3://catalog/images/lamp/front.jpg",
        "out": "move: s3://catalog/images/lamp-front.jpg to s3://catalog/images/lamp/front.jpg"
      },
      {
        "cmd": "aws s3 mv s3://catalog/images/lamp-side.jpg s3://catalog/images/lamp/side.jpg",
        "out": "move: s3://catalog/images/lamp-side.jpg to s3://catalog/images/lamp/side.jpg"
      }
    ],
    "delete": [
      {
        "cmd": "aws s3 rm s3://catalog/images/mug/front-copy.jpg",
        "out": "delete: s3://catalog/images/mug/front-copy.jpg"
      },
      {
        "cmd": "aws s3 rm s3://catalog/archive/ --recursive",
        "out": "delete: s3://catalog/archive/vase.jpg"
      },
      {
        "cmd": "aws s3 ls s3://catalog/ --recursive",
        "out": "2026-10-18 13:02:43         28 docs/readme.txt\n2026-10-18 13:02:51      39552 images/lamp/front.jpg\n2026-10-18 13:02:51      41210 images/lamp/side.jpg\n2026-10-18 13:02:43      48213 images/mug/front.jpg"
      }
    ],
    "sync": [
      {
        "cmd": "aws s3 sync site s3://catalog/site/",
        "out": "upload: site/style.css to s3://catalog/site/style.css\nupload: site/index.html to s3://catalog/site/index.html\nupload: site/about.html to s3://catalog/site/about.html"
      },
      {
        "cmd": "aws s3 sync site s3://catalog/site/",
        "out": ""
      },
      {
        "note": "style.css changed on the laptop; about.html is deleted"
      },
      {
        "cmd": "aws s3 sync site s3://catalog/site/ --dryrun",
        "out": "(dryrun) upload: site/style.css to s3://catalog/site/style.css"
      },
      {
        "cmd": "aws s3 sync site s3://catalog/site/ --delete",
        "out": "upload: site/style.css to s3://catalog/site/style.css\ndelete: s3://catalog/site/about.html"
      },
      {
        "cmd": "aws s3 ls s3://catalog/site/",
        "out": "2026-10-18 13:02:54         17 index.html\n2026-10-18 13:02:56         20 style.css"
      }
    ],
    "presign": [
      {
        "cmd": "aws s3 presign s3://catalog/docs/readme.txt --expires-in 600",
        "out": "http://localhost:9000/catalog/docs/readme.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T130257Z&X-Amz-Expires=600&X-Amz-SignedHeaders=host&X-Amz-Signature=cf4826865bb238bb601969fadab14d26bb6f34e6ef36fa5d03033ad8e2b39885"
      },
      {
        "cmd": "curl -s \"http://localhost:9000/catalog/docs/readme.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T130257Z&X-Amz-Expires=600&X-Amz-SignedHeaders=host&X-Amz-Signature=cf4826865bb238bb601969fadab14d26bb6f34e6ef36fa5d03033ad8e2b39885\"",
        "out": "Product photos and manuals."
      },
      {
        "cmd": "curl -s http://localhost:9000/catalog/docs/readme.txt",
        "out": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>"
      }
    ]
  },
  "rc": {
    "bucket": [
      {
        "cmd": "rc alias set lab http://localhost:9000 labadmin labsecret123",
        "out": "✓ Alias 'lab' configured successfully."
      },
      {
        "cmd": "rc bucket create lab/products",
        "out": "✓ Bucket 'lab/products' created successfully."
      },
      {
        "cmd": "rc bucket list lab",
        "out": "[2026-10-18 13:02:41]         0B catalog/\n[2026-10-18 13:02:58]         0B products/"
      }
    ],
    "upload": [
      {
        "cmd": "rc put mug-front.jpg lab/products/images/mug/front.jpg --content-type image/jpeg --metadata color=blue --metadata sku=MUG-350",
        "out": "mug-front.jpg -> lab/products/images/mug/front.jpg (47.08 KiB)"
      },
      {
        "cmd": "rc object copy --recursive ./photos/ lab/products/images/",
        "out": "./photos/lamp-front.jpg -> lab/products/images/lamp-front.jpg (38.62 KiB)\n./photos/lamp-side.jpg -> lab/products/images/lamp-side.jpg (40.24 KiB)\n./photos/vase.jpg -> lab/products/images/vase.jpg (35.16 KiB)\nSummary: 3 planned, 0 skipped, 3 succeeded, 0 failed, 0 cancelled, 114.03 KiB transferred"
      }
    ],
    "list": [
      {
        "cmd": "rc object list lab/products/",
        "out": "[                   ]         0B images/"
      },
      {
        "cmd": "rc object list --recursive lab/products/",
        "out": "[2026-10-18 13:02:58]  38.62 KiB images/lamp-front.jpg\n[2026-10-18 13:02:58]  40.24 KiB images/lamp-side.jpg\n[2026-10-18 13:02:58]  47.08 KiB images/mug/front.jpg\n[2026-10-18 13:02:58]  35.16 KiB images/vase.jpg"
      }
    ],
    "download": [
      {
        "cmd": "rc get lab/products/images/mug/front.jpg downloads/front-rc.jpg",
        "out": "lab/products/images/mug/front.jpg -> downloads/front-rc.jpg (47.08 KiB)"
      },
      {
        "cmd": "rc object stat lab/products/images/mug/front.jpg",
        "out": "Name      : images/mug/front.jpg\nDate      : 2026-10-18 13:02:58 UTC\nSize      : 48213 bytes\nSize      : 47.08 KiB\nETag      : c08dd209d96ab1ab01c4128d36358ed4\nType      : file\nMetadata  :\nContent-Type : image/jpeg\nX-Amz-Meta-Color : blue\nX-Amz-Meta-Sku : MUG-350"
      }
    ],
    "change": [
      {
        "cmd": "rc object copy lab/products/images/vase.jpg lab/products/archive/vase.jpg",
        "out": "lab/products/images/vase.jpg -> lab/products/archive/vase.jpg (35.16 KiB)"
      },
      {
        "cmd": "rc object move lab/products/images/lamp-front.jpg lab/products/images/lamp/front.jpg",
        "out": "lab/products/images/lamp-front.jpg -> lab/products/images/lamp/front.jpg (38.62 KiB)"
      },
      {
        "cmd": "rc object remove --recursive --force lab/products/archive/",
        "out": "Removed: lab/products/archive/vase.jpg\n✓ Removed 1 object(s)."
      },
      {
        "cmd": "rc object list --recursive lab/products/",
        "out": "[2026-10-18 13:02:58]  40.24 KiB images/lamp-side.jpg\n[2026-10-18 13:02:59]  38.62 KiB images/lamp/front.jpg\n[2026-10-18 13:02:58]  47.08 KiB images/mug/front.jpg\n[2026-10-18 13:02:58]  35.16 KiB images/vase.jpg"
      }
    ],
    "mirror": [
      {
        "cmd": "rc mirror ./site/ lab/products/site/",
        "out": "+ index.html\n+ style.css"
      },
      {
        "cmd": "rc object share lab/products/images/vase.jpg --expire 10m",
        "out": "Share URL (download):\nhttp://localhost:9000/products/images/vase.jpg?x-id=GetObject&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T130259Z&X-Amz-Expires=600&X-Amz-SignedHeaders=host&X-Amz-Signature=9aaffe9f96602624f028647b904e9f616f04e23fe564ddc22f135d3f3e60c401\n\nExpires in: 10 minute(s)"
      }
    ]
  },
  "apps": {
    "java": [
      "== create a bucket",
      "created bucket catalog-java",
      "== upload",
      "uploaded readme.txt, ETag \"b4209f7376610ae2bec78b69e3b45d4d\"",
      "uploaded images/mug/front.jpg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "== list",
      "all keys: [images/mug/front.jpg, images/lamp/front.jpg, readme.txt]",
      "folder images/lamp/",
      "folder images/mug/",
      "page: [images/lamp/front.jpg, images/mug/front.jpg] (more)",
      "page: [readme.txt] (last)",
      "== download",
      "readme.txt says: Product photos and manuals.",
      "downloaded images/mug/front.jpg: 48213 bytes, image/jpeg",
      "== metadata",
      "size 48213, type image/jpeg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "last modified 2026-10-18T13:03:00Z, user metadata {color=blue, sku=MUG-350}",
      "== copy",
      "copied to images/mug/front-copy.jpg",
      "== move",
      "moved readme.txt to docs/readme.txt; exists(readme.txt) = false",
      "== delete",
      "deleted images/lamp/front.jpg",
      "deleted no/such/key.txt",
      "left: [images/mug/front.jpg, docs/readme.txt]",
      "== missing key",
      "retrieve -> Optional.empty",
      "NoSuchKeyException: status 404, code NoSuchKey",
      "== presign",
      "http://localhost:9000/catalog-java/docs/readme.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20261018T130300Z&X-Amz-SignedHeaders=host&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Expires=600&X-Amz-Signature=200b617bdd45a907758754f33f328a6e2ce2ca2d62ec0d0c2b6a36aaf3b394de",
      "== clean up",
      "deleted bucket catalog-java"
    ],
    "ts": [
      "== create a bucket",
      "created bucket catalog-ts",
      "== upload",
      "uploaded readme.txt, ETag \"b4209f7376610ae2bec78b69e3b45d4d\"",
      "uploaded images/mug/front.jpg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "== list",
      "folder images/lamp/",
      "folder images/mug/",
      "page: [\"images/lamp/front.jpg\",\"images/mug/front.jpg\"] (more)",
      "page: [\"readme.txt\"] (last)",
      "== download",
      "readme.txt says: Product photos and manuals.",
      "downloaded images/mug/front.jpg: 48213 bytes, image/jpeg",
      "== metadata",
      "size 48213, type image/jpeg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "last modified 2026-10-18T13:03:01.000Z, user metadata {\"sku\":\"MUG-350\",\"color\":\"blue\"}",
      "== copy",
      "copied to images/mug/front-copy.jpg",
      "== move",
      "moved readme.txt to docs/readme.txt",
      "== delete",
      "deleted images/lamp/front.jpg",
      "deleted no/such/key.txt",
      "left: [\"docs/readme.txt\",\"images/mug/front.jpg\"]",
      "== missing key",
      "NoSuchKey: status 404, message The specified key does not exist.",
      "== presign",
      "http://localhost:9000/catalog-ts/docs/readme.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T130301Z&X-Amz-Expires=600&X-Amz-Signature=13dc9d485c5c7503f92484ffb081eb48121eacc4934fc75e8d3d62393f601b45&X-Amz-SignedHeaders=host&x-amz-checksum-mode=ENABLED&x-id=GetObject",
      "== clean up",
      "deleted bucket catalog-ts"
    ],
    "rust": [
      "== create a bucket",
      "created bucket catalog-rust",
      "== upload",
      "uploaded readme.txt, ETag \"b4209f7376610ae2bec78b69e3b45d4d\"",
      "uploaded images/mug/front.jpg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "== list",
      "folder images/lamp/",
      "folder images/mug/",
      "page: [\"images/lamp/front.jpg\", \"images/mug/front.jpg\"] (more)",
      "page: [\"readme.txt\"] (last)",
      "== download",
      "readme.txt says: Product photos and manuals.",
      "downloaded images/mug/front.jpg: 48213 bytes, image/jpeg",
      "== metadata",
      "size 48213, type image/jpeg, ETag \"fcd06742db6f354ffe8df8ae2d16fffb\"",
      "last modified 2026-10-18T13:03:01Z, user metadata [(\"color\", \"blue\"), (\"sku\", \"MUG-350\")]",
      "== copy",
      "copied to images/mug/front-copy.jpg",
      "== move",
      "moved readme.txt to docs/readme.txt",
      "== delete",
      "deleted images/lamp/front.jpg",
      "deleted no/such/key.txt",
      "left: [\"docs/readme.txt\", \"images/mug/front.jpg\"]",
      "== missing key",
      "NoSuchKey: status 404, message The specified key does not exist.",
      "== presign",
      "http://localhost:9000/catalog-rust/docs/readme.txt?x-id=GetObject&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=labadmin%2F20261018%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20261018T130301Z&X-Amz-Expires=600&X-Amz-SignedHeaders=host&X-Amz-Signature=09cef83da1d5923c6ec42ef6c87a150553151237442fa4e111e8dd58c6b4b94e",
      "== clean up",
      "deleted bucket catalog-rust"
    ]
  },
  "versions": {
    "micronaut": "4.5.0",
    "objectStorage": "2.5.0",
    "javaSdk": "2.25.64",
    "clientS3": "3.1145.0",
    "node": "24.21.0",
    "rustSdk": "1.152.0",
    "awsCli": "2.38.1",
    "rc": "0.1.36"
  }
} as const
