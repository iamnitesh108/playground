/** Everyday jobs across the console, the two CLIs and the three SDKs used in this module (as in the recorded programs). */
export interface Cheat {
  job: string
  console: string
  aws: string
  rc: string
  java: string
  ts: string
  rust: string
}

export const CHEATS: Cheat[] = [
  { job: 'create a bucket', console: 'Create Bucket', aws: 'aws s3 mb s3://b', rc: 'rc bucket create lab/b', java: 's3.createBucket(b -> b.bucket(…))', ts: 'CreateBucketCommand', rust: 'create_bucket()' },
  { job: 'upload', console: 'Upload File/Folder', aws: 'aws s3 cp file s3://b/key', rc: 'rc put file lab/b/key', java: 'storage.upload(UploadRequest…) · s3.putObject', ts: 'PutObjectCommand', rust: 'put_object()' },
  { job: 'list a level', console: 'click into folders', aws: 'aws s3 ls s3://b/prefix/', rc: 'rc object list lab/b/prefix/', java: 's3.listObjectsV2(…prefix, delimiter)', ts: 'ListObjectsV2Command', rust: 'list_objects_v2()' },
  { job: 'list everything', console: '—', aws: 'aws s3 ls s3://b --recursive', rc: 'rc object list --recursive', java: 'listObjectsV2Paginator', ts: 'paginateListObjectsV2', rust: 'into_paginator()' },
  { job: 'download', console: 'Download', aws: 'aws s3 cp s3://b/key file', rc: 'rc get lab/b/key file', java: 'storage.retrieve(key) · getObjectAsBytes', ts: 'GetObjectCommand', rust: 'get_object()' },
  { job: 'metadata', console: 'Info, Metadata', aws: 'aws s3api head-object', rc: 'rc object stat', java: 's3.headObject', ts: 'HeadObjectCommand', rust: 'head_object()' },
  { job: 'copy', console: '—', aws: 'aws s3 cp s3://b/a s3://b/b', rc: 'rc object copy', java: 's3.copyObject', ts: 'CopyObjectCommand', rust: 'copy_object()' },
  { job: 'move', console: '—', aws: 'aws s3 mv', rc: 'rc object move', java: 'copyObject + deleteObject', ts: 'Copy + DeleteObjectCommand', rust: 'copy_object() + delete_object()' },
  { job: 'delete', console: 'Delete', aws: 'aws s3 rm (--recursive)', rc: 'rc object remove (--recursive)', java: 'storage.delete · s3.deleteObjects', ts: 'DeleteObject(s)Command', rust: 'delete_object(s)()' },
  { job: 'sync a folder', console: '—', aws: 'aws s3 sync dir s3://b/p/', rc: 'rc mirror ./dir/ lab/b/p/', java: '—', ts: '—', rust: '—' },
  { job: 'share a link', console: 'Generate URL', aws: 'aws s3 presign s3://b/key', rc: 'rc object share lab/b/key', java: 'S3Presigner.presignGetObject', ts: 'getSignedUrl', rust: 'presigned()' },
]

/** Operations beyond the everyday ones, with the commands recorded in later lessons. */
export const MORE: { job: string; command: string; lesson: string }[] = [
  { job: 'start RustFS', command: 'podman run -d -p 9000:9000 -p 9001:9001 -e RUSTFS_ACCESS_KEY=… -e RUSTFS_SECRET_KEY=… -v data:/data docker.io/rustfs/rustfs:latest', lesson: 'run' },
  { job: 'is it up?', command: 'curl http://localhost:9000/health · /health/ready', lesson: 'run' },
  { job: 'save a server for rc', command: 'rc alias set lab http://localhost:9000 ACCESS SECRET', lesson: 'run' },
  { job: 'multipart by hand', command: 'aws s3api create-multipart-upload · upload-part · complete-multipart-upload', lesson: 'large-files' },
  { job: 'unfinished uploads', command: 'aws s3api list-multipart-uploads · abort-multipart-upload', lesson: 'large-files' },
  { job: 'read a byte range', command: 'aws s3api get-object --range bytes=0-1023 · curl -H "Range: bytes=0-1023"', lesson: 'large-files' },
  { job: 'user and policy', command: 'rc admin user add · rc admin policy create · rc admin policy attach', lesson: 'access' },
  { job: 'access key for an app', command: 'rc admin service-account create lab KEY SECRET --user U --policy p.json', lesson: 'access' },
  { job: 'bucket policy', command: 'aws s3api put-bucket-policy --policy file://p.json', lesson: 'access' },
  { job: 'CORS', command: 'aws s3api put-bucket-cors --cors-configuration file://cors.json', lesson: 'access' },
  { job: 'versioning on', command: 'aws s3api put-bucket-versioning --versioning-configuration Status=Enabled', lesson: 'versioning' },
  { job: 'versions of a key', command: 'aws s3api list-object-versions --prefix key', lesson: 'versioning' },
  { job: 'undo a delete', command: 'aws s3api delete-object --version-id <delete marker> · rc undo lab/b/key', lesson: 'versioning' },
  { job: 'lifecycle rules', command: 'aws s3api put-bucket-lifecycle-configuration --lifecycle-configuration file://l.json', lesson: 'versioning' },
  { job: 'cluster and drives', command: 'rc admin info cluster lab · rc admin heal start lab --bucket b', lesson: 'durability' },
  { job: 'bucket events', command: 'aws s3api put-bucket-notification-configuration --notification-configuration file://n.json', lesson: 'patterns' },
  { job: 'copy to another server', command: 'rclone sync source:b target:b · rc mirror lab/b other/b', lesson: 'patterns' },
]
