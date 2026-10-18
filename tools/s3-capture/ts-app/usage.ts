// Everyday S3 tasks, one after another, printing what the server answered. Node 24 runs this file as is.
import {
  BucketAlreadyOwnedByYou,
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  paginateListObjectsV2,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const section = (name: string) => console.log(`== ${name}`)

// region:client
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000', // not AWS: your server
  region: 'us-east-1', // signed into every request
  forcePathStyle: true, // http://host/bucket/key instead of http://bucket.host/key
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'labadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'labsecret123',
  },
})
const Bucket = 'catalog-ts'
// endregion:client

section('create a bucket')
// region:create-bucket
try {
  await s3.send(new CreateBucketCommand({ Bucket }))
  console.log(`created bucket ${Bucket}`)
} catch (e) {
  if (!(e instanceof BucketAlreadyOwnedByYou)) throw e
  console.log(`bucket ${Bucket} already exists`)
}
// endregion:create-bucket

section('upload')
// region:upload
const readme = await s3.send(
  new PutObjectCommand({ Bucket, Key: 'readme.txt', Body: 'Product photos and manuals.\n', ContentType: 'text/plain' }),
)
console.log(`uploaded readme.txt, ETag ${readme.ETag}`)
const photo = await s3.send(
  new PutObjectCommand({
    Bucket,
    Key: 'images/mug/front.jpg',
    Body: new Uint8Array(48_213),
    ContentType: 'image/jpeg',
    Metadata: { color: 'blue', sku: 'MUG-350' }, // sent as x-amz-meta-color, x-amz-meta-sku
  }),
)
console.log(`uploaded images/mug/front.jpg, ETag ${photo.ETag}`)
await s3.send(new PutObjectCommand({ Bucket, Key: 'images/lamp/front.jpg', Body: new Uint8Array(39_552), ContentType: 'image/jpeg' }))
// endregion:upload

section('list')
// region:list
// one "folder" level: prefix + delimiter
const level = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: 'images/', Delimiter: '/' }))
for (const p of level.CommonPrefixes ?? []) console.log(`folder ${p.Prefix}`)
for (const o of level.Contents ?? []) console.log(`object ${o.Key} ${o.Size} bytes`)

// many keys: the paginator sends one request per page (1,000 keys by default; 2 here to show it)
for await (const page of paginateListObjectsV2({ client: s3, pageSize: 2 }, { Bucket })) {
  console.log(`page: ${JSON.stringify((page.Contents ?? []).map((o) => o.Key))} ${page.IsTruncated ? '(more)' : '(last)'}`)
}
// endregion:list

section('download')
// region:download
const got = await s3.send(new GetObjectCommand({ Bucket, Key: 'readme.txt' }))
process.stdout.write(`readme.txt says: ${await got.Body!.transformToString()}`)
const image = await s3.send(new GetObjectCommand({ Bucket, Key: 'images/mug/front.jpg' }))
const bytes = await image.Body!.transformToByteArray()
console.log(`downloaded images/mug/front.jpg: ${bytes.length} bytes, ${image.ContentType}`)
// endregion:download

section('metadata')
// region:metadata
const head = await s3.send(new HeadObjectCommand({ Bucket, Key: 'images/mug/front.jpg' }))
console.log(`size ${head.ContentLength}, type ${head.ContentType}, ETag ${head.ETag}`)
console.log(`last modified ${head.LastModified?.toISOString()}, user metadata ${JSON.stringify(head.Metadata)}`)
// endregion:metadata

section('copy')
// region:copy
await s3.send(new CopyObjectCommand({ Bucket, Key: 'images/mug/front-copy.jpg', CopySource: `${Bucket}/images/mug/front.jpg` }))
console.log('copied to images/mug/front-copy.jpg')
// endregion:copy

section('move')
// region:move
// there is no rename: copy to the new key, then delete the old one
await s3.send(new CopyObjectCommand({ Bucket, Key: 'docs/readme.txt', CopySource: `${Bucket}/readme.txt` }))
await s3.send(new DeleteObjectCommand({ Bucket, Key: 'readme.txt' }))
console.log('moved readme.txt to docs/readme.txt')
// endregion:move

section('delete')
// region:delete
await s3.send(new DeleteObjectCommand({ Bucket, Key: 'images/mug/front-copy.jpg' }))
// up to 1,000 keys in one request
const many = await s3.send(
  new DeleteObjectsCommand({ Bucket, Delete: { Objects: [{ Key: 'images/lamp/front.jpg' }, { Key: 'no/such/key.txt' }] } }),
)
for (const d of many.Deleted ?? []) console.log(`deleted ${d.Key}`)
const left = await s3.send(new ListObjectsV2Command({ Bucket }))
console.log(`left: ${JSON.stringify(left.Contents?.map((o) => o.Key))}`)
// endregion:delete

section('missing key')
// region:missing
try {
  await s3.send(new GetObjectCommand({ Bucket, Key: 'nope.txt' }))
} catch (e) {
  if (!(e instanceof NoSuchKey)) throw e
  console.log(`${e.name}: status ${e.$metadata.httpStatusCode}, message ${e.message}`)
}
// endregion:missing

section('presign')
// region:presign
// a link anyone can use for 10 minutes, without keys; signed locally, no request to the server
const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: 'docs/readme.txt' }), { expiresIn: 600 })
console.log(url)
// endregion:presign

section('clean up')
for (const o of (await s3.send(new ListObjectsV2Command({ Bucket }))).Contents ?? []) {
  await s3.send(new DeleteObjectCommand({ Bucket, Key: o.Key }))
}
await s3.send(new DeleteBucketCommand({ Bucket }))
console.log(`deleted bucket ${Bucket}`)
