// A download link for a private object that also tells the browser the file name to save it as.
//   node share.ts <bucket> <key> <seconds> <file name>
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const [Bucket, Key, seconds, fileName] = process.argv.slice(2)
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000',
  region: 'us-east-1',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? 'labadmin', secretAccessKey: process.env.S3_SECRET_KEY ?? 'labsecret123' },
})
const command = new GetObjectCommand({ Bucket, Key, ResponseContentDisposition: `attachment; filename="${fileName}"` })
console.log(await getSignedUrl(s3, command, { expiresIn: Number(seconds) }))
