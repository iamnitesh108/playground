//! Everyday S3 tasks, one after another, printing what the server answered.
use std::time::Duration;

use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::{Delete, ObjectIdentifier};
use aws_sdk_s3::Client;

fn section(name: &str) {
    println!("== {name}");
}

// region:client
fn client() -> Client {
    let endpoint = std::env::var("S3_ENDPOINT").unwrap_or_else(|_| "http://localhost:9000".into());
    let access = std::env::var("S3_ACCESS_KEY").unwrap_or_else(|_| "labadmin".into());
    let secret = std::env::var("S3_SECRET_KEY").unwrap_or_else(|_| "labsecret123".into());
    let config = aws_sdk_s3::Config::builder()
        .behavior_version_latest()
        .endpoint_url(endpoint) // not AWS: your server
        .region(Region::new("us-east-1")) // signed into every request
        .force_path_style(true) // http://host/bucket/key instead of http://bucket.host/key
        .credentials_provider(Credentials::new(access, secret, None, None, "static"))
        .build();
    Client::from_conf(config)
}
// endregion:client

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let s3 = client();
    let bucket = "catalog-rust";

    section("create a bucket");
    // region:create-bucket
    match s3.create_bucket().bucket(bucket).send().await {
        Ok(_) => println!("created bucket {bucket}"),
        Err(e) if e.as_service_error().is_some_and(|s| s.is_bucket_already_owned_by_you()) => {
            println!("bucket {bucket} already exists")
        }
        Err(e) => return Err(e.into()),
    }
    // endregion:create-bucket

    section("upload");
    // region:upload
    let readme = s3
        .put_object()
        .bucket(bucket)
        .key("readme.txt")
        .content_type("text/plain")
        .body(ByteStream::from_static(b"Product photos and manuals.\n"))
        .send()
        .await?;
    println!("uploaded readme.txt, ETag {}", readme.e_tag().unwrap_or_default());
    let photo = s3
        .put_object()
        .bucket(bucket)
        .key("images/mug/front.jpg")
        .content_type("image/jpeg")
        .metadata("color", "blue") // sent as x-amz-meta-color
        .metadata("sku", "MUG-350")
        .body(ByteStream::from(vec![0u8; 48_213]))
        .send()
        .await?;
    println!("uploaded images/mug/front.jpg, ETag {}", photo.e_tag().unwrap_or_default());
    s3.put_object()
        .bucket(bucket)
        .key("images/lamp/front.jpg")
        .content_type("image/jpeg")
        .body(ByteStream::from(vec![0u8; 39_552]))
        .send()
        .await?;
    // endregion:upload

    section("list");
    // region:list
    // one "folder" level: prefix + delimiter
    let level = s3.list_objects_v2().bucket(bucket).prefix("images/").delimiter("/").send().await?;
    for p in level.common_prefixes() {
        println!("folder {}", p.prefix().unwrap_or_default());
    }
    for o in level.contents() {
        println!("object {} {} bytes", o.key().unwrap_or_default(), o.size().unwrap_or_default());
    }

    // many keys: the paginator sends one request per page (1,000 keys by default; 2 here to show it)
    let mut pages = s3.list_objects_v2().bucket(bucket).max_keys(2).into_paginator().send();
    while let Some(page) = pages.next().await {
        let page = page?;
        let keys: Vec<&str> = page.contents().iter().filter_map(|o| o.key()).collect();
        println!("page: {keys:?} {}", if page.is_truncated().unwrap_or(false) { "(more)" } else { "(last)" });
    }
    // endregion:list

    section("download");
    // region:download
    let got = s3.get_object().bucket(bucket).key("readme.txt").send().await?;
    let text = got.body.collect().await?.into_bytes();
    print!("readme.txt says: {}", String::from_utf8_lossy(&text));
    let image = s3.get_object().bucket(bucket).key("images/mug/front.jpg").send().await?;
    let content_type = image.content_type().unwrap_or_default().to_string();
    let bytes = image.body.collect().await?.into_bytes();
    println!("downloaded images/mug/front.jpg: {} bytes, {content_type}", bytes.len());
    // endregion:download

    section("metadata");
    // region:metadata
    let head = s3.head_object().bucket(bucket).key("images/mug/front.jpg").send().await?;
    println!(
        "size {}, type {}, ETag {}",
        head.content_length().unwrap_or_default(),
        head.content_type().unwrap_or_default(),
        head.e_tag().unwrap_or_default()
    );
    let mut meta: Vec<_> = head.metadata().into_iter().flatten().collect();
    meta.sort();
    println!("last modified {}, user metadata {meta:?}", head.last_modified().map(|t| t.to_string()).unwrap_or_default());
    // endregion:metadata

    section("copy");
    // region:copy
    s3.copy_object()
        .bucket(bucket)
        .key("images/mug/front-copy.jpg")
        .copy_source(format!("{bucket}/images/mug/front.jpg"))
        .send()
        .await?;
    println!("copied to images/mug/front-copy.jpg");
    // endregion:copy

    section("move");
    // region:move
    // there is no rename: copy to the new key, then delete the old one
    s3.copy_object().bucket(bucket).key("docs/readme.txt").copy_source(format!("{bucket}/readme.txt")).send().await?;
    s3.delete_object().bucket(bucket).key("readme.txt").send().await?;
    println!("moved readme.txt to docs/readme.txt");
    // endregion:move

    section("delete");
    // region:delete
    s3.delete_object().bucket(bucket).key("images/mug/front-copy.jpg").send().await?;
    // up to 1,000 keys in one request
    let delete = Delete::builder()
        .objects(ObjectIdentifier::builder().key("images/lamp/front.jpg").build()?)
        .objects(ObjectIdentifier::builder().key("no/such/key.txt").build()?)
        .build()?;
    let many = s3.delete_objects().bucket(bucket).delete(delete).send().await?;
    for d in many.deleted() {
        println!("deleted {}", d.key().unwrap_or_default());
    }
    let left = s3.list_objects_v2().bucket(bucket).send().await?;
    let keys: Vec<&str> = left.contents().iter().filter_map(|o| o.key()).collect();
    println!("left: {keys:?}");
    // endregion:delete

    section("missing key");
    // region:missing
    match s3.get_object().bucket(bucket).key("nope.txt").send().await {
        Ok(_) => println!("found?"),
        Err(e) => {
            let status = e.raw_response().map(|r| r.status().as_u16()).unwrap_or_default();
            match e.into_service_error() {
                err if err.is_no_such_key() => println!("NoSuchKey: status {status}, message {}", err.meta().message().unwrap_or_default()),
                err => return Err(err.into()),
            }
        }
    }
    // endregion:missing

    section("presign");
    // region:presign
    // a link anyone can use for 10 minutes, without keys; signed locally, no request to the server
    let link = s3
        .get_object()
        .bucket(bucket)
        .key("docs/readme.txt")
        .presigned(PresigningConfig::expires_in(Duration::from_secs(600))?)
        .await?;
    println!("{}", link.uri());
    // endregion:presign

    section("clean up");
    for o in s3.list_objects_v2().bucket(bucket).send().await?.contents() {
        s3.delete_object().bucket(bucket).key(o.key().unwrap_or_default()).send().await?;
    }
    s3.delete_bucket().bucket(bucket).send().await?;
    println!("deleted bucket {bucket}");
    Ok(())
}
