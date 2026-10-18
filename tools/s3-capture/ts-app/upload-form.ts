// Prints the fields of a presigned POST: an HTML form upload with conditions the server enforces.
//   node upload-form.ts <bucket> <key> <max-bytes>
import { S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'

const [Bucket, Key, maxBytes] = process.argv.slice(2)
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? 'labadmin', secretAccessKey: process.env.S3_SECRET_KEY ?? 'labsecret123' },
})
const post = await createPresignedPost(s3, {
  Bucket,
  Key,
  Conditions: [
    ['content-length-range', 1, Number(maxBytes)], // the server refuses anything bigger
    ['starts-with', '$Content-Type', 'image/'], // images only
  ],
  Fields: { 'Content-Type': 'image/jpeg' },
  Expires: 300,
})
console.log(JSON.stringify(post, null, 2))
