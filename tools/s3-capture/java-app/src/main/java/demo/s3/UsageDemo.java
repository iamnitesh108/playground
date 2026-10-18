package demo.s3;

import io.micronaut.context.annotation.Value;
import io.micronaut.objectstorage.ObjectStorageOperations;
import io.micronaut.objectstorage.aws.AwsS3ObjectStorageEntry;
import io.micronaut.objectstorage.request.UploadRequest;
import jakarta.inject.Singleton;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The everyday S3 tasks, one after another, printing what the server answered. */
@Singleton
public class UsageDemo {

    private final S3Client s3;
    private final ObjectStorageOperations<PutObjectRequest.Builder, PutObjectResponse, DeleteObjectResponse> storage;
    private final String bucket;
    private final String endpoint;
    private final String accessKey;
    private final String secretKey;

    // region:inject
    // Micronaut builds the S3Client from application.yml (endpoint, region, keys, path-style)
    // and an ObjectStorageOperations bound to the bucket micronaut.object-storage.aws.default.bucket.
    public UsageDemo(S3Client s3,
                     ObjectStorageOperations<PutObjectRequest.Builder, PutObjectResponse, DeleteObjectResponse> storage,
                     @Value("${micronaut.object-storage.aws.default.bucket}") String bucket,
                     @Value("${aws.services.s3.endpoint-override}") String endpoint,
                     @Value("${aws.access-key-id}") String accessKey,
                     @Value("${aws.secret-key}") String secretKey) {
        this.s3 = s3;
        this.storage = storage;
        this.bucket = bucket;
        this.endpoint = endpoint;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
    }
    // endregion:inject

    public void run() throws Exception {
        section("create a bucket");
        // region:create-bucket
        try {
            s3.createBucket(b -> b.bucket(bucket));
            System.out.println("created bucket " + bucket);
        } catch (BucketAlreadyOwnedByYouException e) {
            System.out.println("bucket " + bucket + " already exists");
        }
        // endregion:create-bucket

        section("upload");
        // region:upload
        // the Micronaut way: ObjectStorageOperations, for the configured bucket
        UploadRequest readme = UploadRequest.fromBytes(
                "Product photos and manuals.\n".getBytes(StandardCharsets.UTF_8), "readme.txt", "text/plain");
        String etag = storage.upload(readme).getETag();
        System.out.println("uploaded readme.txt, ETag " + etag);

        // the SDK way: any bucket, any header, user metadata
        byte[] photo = new byte[48_213];
        PutObjectResponse put = s3.putObject(b -> b.bucket(bucket).key("images/mug/front.jpg")
                        .contentType("image/jpeg")
                        .metadata(Map.of("color", "blue", "sku", "MUG-350")),
                RequestBody.fromBytes(photo));
        System.out.println("uploaded images/mug/front.jpg, ETag " + put.eTag());
        s3.putObject(b -> b.bucket(bucket).key("images/lamp/front.jpg").contentType("image/jpeg"), RequestBody.fromBytes(new byte[39_552]));
        // endregion:upload

        section("list");
        // region:list
        // every key in the bucket (ObjectStorageOperations pages through the listing for you)
        System.out.println("all keys: " + storage.listObjects());

        // one "folder" level: prefix + delimiter, through the SDK
        ListObjectsV2Response level = s3.listObjectsV2(b -> b.bucket(bucket).prefix("images/").delimiter("/"));
        level.commonPrefixes().forEach(p -> System.out.println("folder " + p.prefix()));
        level.contents().forEach(o -> System.out.println("object " + o.key() + " " + o.size() + " bytes"));

        // many keys: the paginator sends one request per 1,000 keys (here 2 per page to show it)
        s3.listObjectsV2Paginator(b -> b.bucket(bucket).maxKeys(2)).stream()
                .forEach(page -> System.out.println("page: " + page.contents().stream().map(S3Object::key).toList()
                        + (page.isTruncated() ? " (more)" : " (last)")));
        // endregion:list

        section("download");
        // region:download
        Optional<AwsS3ObjectStorageEntry> entry = storage.retrieve("readme.txt");
        if (entry.isPresent()) {
            try (var in = entry.get().getInputStream()) {
                System.out.print("readme.txt says: " + new String(in.readAllBytes(), StandardCharsets.UTF_8));
            }
        }
        ResponseBytes<GetObjectResponse> bytes = s3.getObjectAsBytes(b -> b.bucket(bucket).key("images/mug/front.jpg"));
        System.out.println("downloaded images/mug/front.jpg: " + bytes.asByteArray().length + " bytes, " + bytes.response().contentType());
        // endregion:download

        section("metadata");
        // region:metadata
        HeadObjectResponse head = s3.headObject(b -> b.bucket(bucket).key("images/mug/front.jpg"));
        System.out.println("size " + head.contentLength() + ", type " + head.contentType() + ", ETag " + head.eTag());
        System.out.println("last modified " + head.lastModified() + ", user metadata " + head.metadata());
        // endregion:metadata

        section("copy");
        // region:copy
        s3.copyObject(b -> b.sourceBucket(bucket).sourceKey("images/mug/front.jpg")
                .destinationBucket(bucket).destinationKey("images/mug/front-copy.jpg"));
        System.out.println("copied to images/mug/front-copy.jpg");
        // endregion:copy

        section("move");
        // region:move
        // there is no rename: copy to the new key, then delete the old one
        s3.copyObject(b -> b.sourceBucket(bucket).sourceKey("readme.txt").destinationBucket(bucket).destinationKey("docs/readme.txt"));
        s3.deleteObject(b -> b.bucket(bucket).key("readme.txt"));
        System.out.println("moved readme.txt to docs/readme.txt; exists(readme.txt) = " + storage.exists("readme.txt"));
        // endregion:move

        section("delete");
        // region:delete
        storage.delete("images/mug/front-copy.jpg");
        // up to 1,000 keys in one request
        DeleteObjectsResponse many = s3.deleteObjects(b -> b.bucket(bucket).delete(d -> d.objects(
                ObjectIdentifier.builder().key("images/lamp/front.jpg").build(),
                ObjectIdentifier.builder().key("no/such/key.txt").build())));
        many.deleted().forEach(d -> System.out.println("deleted " + d.key()));
        System.out.println("left: " + storage.listObjects());
        // endregion:delete

        section("missing key");
        // region:missing
        System.out.println("retrieve -> " + storage.retrieve("nope.txt"));
        try {
            s3.getObjectAsBytes(b -> b.bucket(bucket).key("nope.txt"));
        } catch (NoSuchKeyException e) {
            System.out.println("NoSuchKeyException: status " + e.statusCode() + ", code " + e.awsErrorDetails().errorCode());
        }
        // endregion:missing

        section("presign");
        // region:presign
        // a link anyone can use for 10 minutes, without keys; signed locally, no request to the server
        try (S3Presigner presigner = S3Presigner.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.US_EAST_1)
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder().pathStyleAccessEnabled(true).build())
                .build()) {
            PresignedGetObjectRequest link = presigner.presignGetObject(p -> p
                    .signatureDuration(Duration.ofMinutes(10))
                    .getObjectRequest(g -> g.bucket(bucket).key("docs/readme.txt")));
            System.out.println(link.url());
        }
        // endregion:presign

        section("clean up");
        for (String key : List.copyOf(storage.listObjects())) storage.delete(key);
        s3.deleteBucket(b -> b.bucket(bucket));
        System.out.println("deleted bucket " + bucket);
    }

    private static void section(String name) {
        System.out.println("== " + name);
    }
}
