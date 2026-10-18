// Recorded by tools/s3-capture/capture-what.mjs against a real RustFS server. Do not edit by hand.
export const WHAT = {
  "version": "1.0.3",
  "laptop": [
    {
      "cmd": "find . -type f -printf \"%P  %s bytes\\n\" | sort",
      "out": "lamp-front.jpg  39552 bytes\nlamp-manual.pdf  120334 bytes\nmug-front.jpg  48213 bytes\nmug-side.jpg  51870 bytes\nreadme.txt  28 bytes"
    }
  ],
  "upload": [
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    },
    {
      "cmd": "aws s3 cp mug-front.jpg s3://catalog/images/mug/front.jpg --content-type image/jpeg --metadata color=blue,sku=MUG-350",
      "out": "upload: ./mug-front.jpg to s3://catalog/images/mug/front.jpg"
    },
    {
      "cmd": "aws s3 cp mug-side.jpg s3://catalog/images/mug/side.jpg --content-type image/jpeg",
      "out": "upload: ./mug-side.jpg to s3://catalog/images/mug/side.jpg"
    },
    {
      "cmd": "aws s3 cp lamp-front.jpg s3://catalog/images/lamp/front.jpg --content-type image/jpeg",
      "out": "upload: ./lamp-front.jpg to s3://catalog/images/lamp/front.jpg"
    },
    {
      "cmd": "aws s3 cp lamp-manual.pdf s3://catalog/manuals/lamp.pdf --content-type application/pdf",
      "out": "upload: ./lamp-manual.pdf to s3://catalog/manuals/lamp.pdf"
    },
    {
      "cmd": "aws s3 cp readme.txt s3://catalog/readme.txt --content-type text/plain",
      "out": "upload: ./readme.txt to s3://catalog/readme.txt"
    }
  ],
  "bucketNames": [
    {
      "cmd": "aws s3 mb s3://Product_Photos",
      "out": "make_bucket failed: s3://Product_Photos An error occurred (InvalidBucketName) when calling the CreateBucket operation: The specified bucket is not valid.",
      "code": 1
    },
    {
      "cmd": "aws s3 mb s3://catalog",
      "out": "make_bucket: catalog"
    }
  ],
  "anatomy": [
    {
      "cmd": "aws s3api head-object --bucket catalog --key images/mug/front.jpg",
      "out": "{\n    \"AcceptRanges\": \"bytes\",\n    \"LastModified\": \"2026-10-18T12:38:50+00:00\",\n    \"ContentLength\": 48213,\n    \"ETag\": \"\\\"c08dd209d96ab1ab01c4128d36358ed4\\\"\",\n    \"ContentType\": \"image/jpeg\",\n    \"Metadata\": {\n        \"color\": \"blue\",\n        \"sku\": \"MUG-350\"\n    }\n}"
    }
  ],
  "headObject": {
    "AcceptRanges": "bytes",
    "LastModified": "2026-10-18T12:38:50+00:00",
    "ContentLength": 48213,
    "ETag": "\"c08dd209d96ab1ab01c4128d36358ed4\"",
    "ContentType": "image/jpeg",
    "Metadata": {
      "color": "blue",
      "sku": "MUG-350"
    }
  },
  "flat": [
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --query \"Contents[].[Key, Size]\" --output text",
      "out": "images/lamp/front.jpg\t39552\nimages/mug/front.jpg\t48213\nimages/mug/side.jpg\t51870\nmanuals/lamp.pdf\t120334\nreadme.txt\t28"
    }
  ],
  "delimiter": [
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --delimiter / --query \"{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}\"",
      "out": "{\n    \"folders\": [\n        \"images/\",\n        \"manuals/\"\n    ],\n    \"objects\": [\n        \"readme.txt\"\n    ]\n}"
    },
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --prefix images/ --delimiter / --query \"{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}\"",
      "out": "{\n    \"folders\": [\n        \"images/lamp/\",\n        \"images/mug/\"\n    ],\n    \"objects\": null\n}"
    },
    {
      "cmd": "aws s3api list-objects-v2 --bucket catalog --prefix images/mug/ --delimiter / --query \"{folders: CommonPrefixes[].Prefix, objects: Contents[].Key}\"",
      "out": "{\n    \"folders\": null,\n    \"objects\": [\n        \"images/mug/front.jpg\",\n        \"images/mug/side.jpg\"\n    ]\n}"
    }
  ],
  "ls": [
    {
      "cmd": "aws s3 ls s3://catalog/",
      "out": "                           PRE images/\n                           PRE manuals/\n2026-10-18 12:38:52         28 readme.txt"
    },
    {
      "cmd": "aws s3 ls s3://catalog/images/",
      "out": "                           PRE lamp/\n                           PRE mug/"
    },
    {
      "cmd": "aws s3 ls s3://catalog/ --recursive",
      "out": "2026-10-18 12:38:51      39552 images/lamp/front.jpg\n2026-10-18 12:38:50      48213 images/mug/front.jpg\n2026-10-18 12:38:50      51870 images/mug/side.jpg\n2026-10-18 12:38:52     120334 manuals/lamp.pdf\n2026-10-18 12:38:52         28 readme.txt"
    }
  ],
  "vanish": [
    {
      "cmd": "aws s3 rm s3://catalog/manuals/lamp.pdf",
      "out": "delete: s3://catalog/manuals/lamp.pdf"
    },
    {
      "cmd": "aws s3 ls s3://catalog/",
      "out": "                           PRE images/\n2026-10-18 12:38:52         28 readme.txt"
    }
  ],
  "overwrite": [
    {
      "cmd": "aws s3 cp s3://catalog/readme.txt -",
      "out": "Product photos and manuals."
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key readme.txt --query \"{size: ContentLength, etag: ETag}\"",
      "out": "{\n    \"size\": 28,\n    \"etag\": \"\\\"b4209f7376610ae2bec78b69e3b45d4d\\\"\"\n}"
    },
    {
      "cmd": "aws s3 cp readme.txt s3://catalog/readme.txt --content-type text/plain",
      "out": "upload: ./readme.txt to s3://catalog/readme.txt"
    },
    {
      "cmd": "aws s3 cp s3://catalog/readme.txt -",
      "out": "Product photos and manuals.\nLamp manual moved to the support site."
    },
    {
      "cmd": "aws s3api head-object --bucket catalog --key readme.txt --query \"{size: ContentLength, etag: ETag}\"",
      "out": "{\n    \"size\": 67,\n    \"etag\": \"\\\"d94c815435327c0b2ee58e51ba82ea92\\\"\"\n}"
    }
  ],
  "rename": [
    {
      "cmd": "aws --debug s3 mv s3://catalog/readme.txt s3://catalog/docs/readme.txt",
      "out": "move: s3://catalog/readme.txt to s3://catalog/docs/readme.txt"
    },
    {
      "cmd": "aws s3 ls s3://catalog/ --recursive",
      "out": "2026-10-18 12:39:03         67 docs/readme.txt\n2026-10-18 12:38:51      39552 images/lamp/front.jpg\n2026-10-18 12:38:50      48213 images/mug/front.jpg\n2026-10-18 12:38:50      51870 images/mug/side.jpg"
    }
  ],
  "requests": [
    {
      "op": "HeadObject",
      "method": "HEAD",
      "path": "/catalog/readme.txt",
      "status": 200
    },
    {
      "op": "CopyObject",
      "method": "PUT",
      "path": "/catalog/docs/readme.txt",
      "status": 200
    },
    {
      "op": "DeleteObject",
      "method": "DELETE",
      "path": "/catalog/readme.txt",
      "status": 204
    }
  ],
  "keyRules": [
    {
      "cmd": "aws s3api put-object --bucket catalog --key images/../secret.txt --body readme.txt",
      "out": "aws: [ERROR]: An error occurred (InvalidArgument) when calling the PutObject operation: Invalid object key",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key images//double-slash.jpg --body readme.txt",
      "out": "aws: [ERROR]: An error occurred (InvalidArgument) when calling the PutObject operation: Invalid object key",
      "code": 254
    },
    {
      "cmd": "aws s3api put-object --bucket catalog --key \"images/mug/front (copy).jpg\" --body readme.txt --query ETag",
      "out": "\"\\\"d94c815435327c0b2ee58e51ba82ea92\\\"\""
    }
  ]
} as const
