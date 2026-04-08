import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function isS3Configured() {
  return !!(ENV.awsAccessKeyId && ENV.awsSecretAccessKey && ENV.awsBucket);
}

function getS3Client() {
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

function toBase64DataUrl(data: Buffer | Uint8Array | string, contentType: string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  return `data:${contentType};base64,${buf.toString("base64")}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);

  // Fallback: store as base64 data URL when S3 is not configured
  if (!isS3Configured()) {
    const url = toBase64DataUrl(data, contentType);
    return { key, url };
  }

  const client = getS3Client();
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
  const key = normalizeKey(relKey);

  // If it looks like a data URL already (stored without S3), return as-is
  if (key.startsWith("data:")) {
    return { key, url: key };
  }

  if (!isS3Configured()) {
    return { key, url: key };
  }

  const client = getS3Client();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: ENV.awsBucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}
