# s3-capture

Records real behaviour of an S3-compatible server (RustFS) for the `s3` module, so the lessons
show what the server actually did. Each script writes one data file in `src/modules/s3/data/`.

Everything runs in throwaway containers (podman): the RustFS server `s3-lab` (host ports 19910 for the
S3 API and 19911 for the console), extra servers `s3-node-*` and the network `s3-net`. Client tools
(`amazon/aws-cli`, `rustfs/rc`, `curlimages/curl`, `rclone/rclone`) run with `--rm` and
`--network container:<server>`, so they reach the server at `http://localhost:9000` exactly as a reader
would. Scripts remove their containers, volumes and networks when they finish, also on failure.

- `lib/lab.mjs` — starts and removes servers, runs the client tools in containers.
- `lib/record.mjs` — `Session` runs a command line *as written* (split into arguments and handed to the
  tool), so a recording shows the command that ran; `writeData` writes `src/modules/s3/data/<file>.ts`,
  rewrites the lab ports to 9000/9001, shortens request ids, and refuses to write anything containing the
  current user's name or home directory.
- `lib/sigv4.mjs` — AWS Signature Version 4 written out step by step, for requests a normal client would not
  send (a wrong clock, a race of conditional writes, polling a version list).
- `lib/browser.mjs` — a tiny WebDriver BiDi driver for a headless Firefox (time zone UTC), to read the console.
- `aws/` — the aws CLI configuration the recordings use (`default`, plus `virtual` and `classic` profiles).
- `aws-access/` — profiles for the users created in the access lesson.
- `policies/` — policy, CORS, lifecycle and notification documents (shown in the lessons).

Images used: `docker.io/rustfs/rustfs:latest` (recorded with 1.0.3), `docker.io/amazon/aws-cli`,
`docker.io/rustfs/rc`, `docker.io/curlimages/curl`, `docker.io/rclone/rclone`, `docker.io/library/node:24-alpine`.
MinIO's `mc` is not used: its images and downloads were not available when this was recorded.

## What object storage is (`capture-what.mjs` → `what.ts`)

Uploads a few files with content type and user metadata, lists the bucket flat and with a delimiter, shows
a "folder" vanishing with its last object, a whole-object overwrite, `aws s3 mv` as HEAD + copy + delete
(parsed from `--debug`), bucket-name rules, and the keys RustFS refuses (`..`, `//`).

## Running RustFS (`capture-run.mjs` → `run.ts`, `capture-console.mjs` → `console.ts`)

`capture-run.mjs`: the `podman run` command, health endpoints, an unsigned request, the aws CLI with the
files in `aws/` (and the `virtual` profile failing), rc aliases, the data directory after small, medium and
multipart uploads (`tree`, `du -b`, `strings`, `xxd`), the data surviving a replaced container,
`compose/compose.yaml` with `podman compose`, and one server with four drives (refused without
`RUSTFS_UNSAFE_BYPASS_DISK_CHECK`, then started with it).

`capture-console.mjs` (needs `firefox`): logs in to the web console and records the text of the login page,
sidebar, bucket list, create-bucket and upload dialogs, object details, access keys, policies and users, so
the lessons can describe the console with its own labels.

## Using S3 day to day (`capture-using.mjs` → `using.ts`)

Everyday tasks with the aws CLI and with rc, then the three programs, each against its own bucket:

- `java-app/` — Micronaut 4.5 with micronaut-object-storage-aws (`ObjectStorageOperations`) and the AWS SDK
  for Java v2 `S3Client` configured in `application.yml` (endpoint override, path-style). Build once:
  `gradle installDist` (Gradle 8.8, Java 17).
- `ts-app/` — `usage.ts` with @aws-sdk/client-s3 v3, run by Node 24 directly. `npm install` once.
  `presign.ts`, `upload-form.ts` and `share.ts` are used by later lessons.
- `rust-app/` — aws-sdk-s3 with tokio. `cargo build --release` once.

The lessons import the sources with Vite `?raw` and show the `// region:<name>` parts.

## The S3 API on the wire (`capture-requests.mjs` → `requests.ts`)

curl `-v --aws-sigv4` for PUT/GET/HEAD/LIST/DELETE (request and response headers), ETag vs MD5, the aws
CLI's canonical request, string to sign and signature (from `--debug`, used by the in-browser signer),
error responses, requests signed with a clock up to ±20 minutes off, conditional requests (and 50 races of
two `If-None-Match: *` uploads), 300 rounds of read-after-write checks, and virtual-hosted addressing with
`RUSTFS_SERVER_DOMAINS`.

## Large files (`capture-large.mjs` → `large.ts`)

A multipart upload by hand (split, create, parts, list, resume, complete), the `-N` ETag recomputed with
`openssl md5 -binary`, abort, `EntityTooSmall` and part-number limits, `aws --profile classic --debug s3 cp`
of 64 MiB parsed into a per-thread timeline, range GETs, `--part-number`, and Content-MD5 /
x-amz-checksum-sha256 right and wrong.

## Access, policies and sharing (`capture-access.mjs` → `access.ts`)

Users and policies created with `rc admin`, allowed and denied requests per profile (`aws-access/`), an
explicit deny, a service account with a narrower policy, a public-read bucket policy and the public access
block, `rc bucket anonymous`, presigned GET expiring, presigned PUT with a signed content type (and one
signed by a user who may not write), and CORS preflights.

## Versioning, object lock and lifecycle (`capture-versioning.mjs` → `versioning.ts`)

Versions, delete markers, undo and restore, deleting a version id, `rc undo`, object lock in governance and
compliance mode and legal holds, lifecycle rules with the `x-amz-expiration` header, a transition and a
storage class RustFS refuses. Expiry itself is recorded on a second server started with
`RUSTFS_ILM_DEBUG_DAY_SECS=5`, `RUSTFS_SCANNER_CYCLE=1` and `RUSTFS_ILM_PROCESS_TIME=1` (RustFS test
settings that make one lifecycle day last five seconds), polling the version list every second.

## Surviving disk failures (`capture-durability.mjs` → `durability.ts`)

One server with four drives (named volumes): shard sizes per drive, drives made unreadable one by one
(`chmod 000`) with a read and a write after each, healing after they return, a wiped drive healed with
`rc admin heal start`, and bytes overwritten inside one shard (bit rot) repaired on read. Then four servers
`s3-node-1…4` on `s3-net`: two stopped one after the other, reads and writes after each, both started
again, and the time until the object written meanwhile was healed onto them.

## Patterns and operations (`capture-patterns.mjs` → `patterns.ts`)

`s3-lab` on `s3-net` with webhook notifications to `webhook/receiver.mjs` (container `s3-hook`), presigned
PUT and POST uploads (with size and type conditions), a download link with a file name, date prefixes,
2,500 keys listed page by page, `rc admin metrics`, SSE refused without a key and working on a second server
(`s3-node-b`, started with `RUSTFS_SSE_S3_MASTER_KEY`), and the bucket copied to `s3-node-b` with rclone
(`rclone/rclone.conf`) and `rc mirror`.

## Run everything

```sh
cd tools/s3-capture
(cd java-app && gradle installDist) && (cd ts-app && npm install) && (cd rust-app && cargo build --release)
for s in what run console using requests large access versioning durability patterns; do node capture-$s.mjs; done
```

Ids, times and ETags of random data differ on every run; the behaviour does not.
