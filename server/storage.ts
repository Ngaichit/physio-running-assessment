import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";

function getS3Client() {
  if (!ENV.awsAccessKeyId || !ENV.awsSecretAccessKey || !ENV.awsBucket) {
    throw new Error(
      "AWS S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, and AWS_BUCKET in your .env file."
    );
  }
  return new S3Client({
    region: ENV.awsRegion || "us-east-1",
    credentials: {
      accessKeyId: ENV.awsAccessKeyId,
      secretAccessKey: ENV.awsSecretAccessKey,
    },
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const key = normalizeKey(relKey);

  await client.send(
    new PutObjectCommand({
      Bucket: ENV.awsBucket,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );

  const url = `https://${ENV.awsBucket}.s3.${ENV.awsRegion}.amazonaws.com/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  const key = normalizeKey(relKey);

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: ENV.awsBucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}
