// Prints a presigned URL: node presign.ts <GET|PUT> <bucket> <key> <seconds> [content-type]
// The URL is computed here, from the keys; nothing is sent to the server.
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const [method, Bucket, Key, seconds, ContentType] = process.argv.slice(2)
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'labadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'labsecret123',
  },
  // the uploader's bytes are not known yet, so do not put a checksum of them into the link
  requestChecksumCalculation: 'WHEN_REQUIRED',
})
const command = method === 'PUT' ? new PutObjectCommand({ Bucket, Key, ContentType }) : new GetObjectCommand({ Bucket, Key })
const url = await getSignedUrl(s3, command, {
  expiresIn: Number(seconds),
  // sign the content type too, so the link only accepts that type
  signableHeaders: ContentType ? new Set(['content-type']) : undefined,
})
console.log(url)
