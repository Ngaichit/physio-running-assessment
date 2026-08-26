import { PutObjectCommand, S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";
import { MAX_UPLOAD_BYTES, formatBytes } from "@shared/uploadLimits";

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

// MySQL MEDIUMTEXT cap is 16,777,215 bytes. The base64 form of the file is what we store,
// so the raw file is capped at ~12 MB once you account for base64's 33% overhead and the
// "data:<contentType>;base64," prefix. That cap is the app-wide upload limit, shared with
// the tRPC route and the browser so all three agree — see @shared/uploadLimits.
const INLINE_FILE_MAX_BYTES = MAX_UPLOAD_BYTES;

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

  // Fallback when S3 isn't configured: embed the file inline as a data: URL.
  // The DB column is MEDIUMTEXT (16 MB) so files up to ~12 MB raw fit cleanly.
  if (!isS3Configured()) {
    const buf = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
    if (buf.length > INLINE_FILE_MAX_BYTES) {
      throw new Error(
        `File is too large to store inline (${formatBytes(buf.length)}; limit ${formatBytes(INLINE_FILE_MAX_BYTES)}). ` +
        `Configure S3 (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_BUCKET) for larger files.`
      );
    }
    return { key, url: toBase64DataUrl(buf, contentType) };
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
