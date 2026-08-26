/**
 * Turn a thrown upload error into something a clinician can act on.
 *
 * An interrupted upload is the common failure mode here: the request body is a
 * base64 `data:` URL (~33% larger than the file) sent in one shot, so a dropped
 * connection shows up server-side as body-parser's "request aborted" and
 * client-side as a bare TypeError from fetch. Neither string means anything to
 * the person looking at the screen.
 */
export function uploadErrorMessage(err: unknown): string {
  const raw =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";

  if (/abort|network|load failed|fetch failed|failed to fetch|connection/i.test(raw)) {
    return "Upload was interrupted before it finished — check your connection and try again.";
  }
  return raw.trim() || "Upload failed.";
}
