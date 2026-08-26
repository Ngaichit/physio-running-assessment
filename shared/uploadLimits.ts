/**
 * Single source of truth for upload size limits.
 *
 * The three layers used to disagree: the browser accepted 20 MB, the tRPC route
 * rejected over 15 MB, and inline (no-S3) storage rejected over 12 MB. Anything
 * in between was accepted by the file picker and could only ever fail, so the
 * limit lives here and every layer imports it.
 *
 * 12 MB is the binding constraint. Without S3 the file is stored inline as a
 * base64 `data:` URL in a MEDIUMTEXT column (16,777,215 bytes), and base64 adds
 * ~33% on top of the raw bytes plus the `data:<type>;base64,` prefix.
 */
export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Why `bytes` is too large to upload, or null when it fits. Checked in the
 * browser before reading the file so an oversized upload fails instantly
 * instead of after a long transfer that can only be rejected at the end.
 */
export function uploadSizeError(bytes: number, limit: number = MAX_UPLOAD_BYTES): string | null {
  if (!Number.isFinite(bytes) || bytes < 0) return "Could not read the file size.";
  if (bytes <= limit) return null;
  return `File is ${formatBytes(bytes)} — the limit is ${formatBytes(limit)}.`;
}
