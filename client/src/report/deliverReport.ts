/**
 * Hand a finished report to the tab that was opened for it.
 *
 * The tab has to be opened synchronously on click — popup blockers kill
 * window.open once the click's user activation expires — so it starts life as
 * about:blank and the HTML only arrives once screenshots and PDF pages have
 * rendered. Writing it with document.write leaves a script-generated
 * about:blank document, and Safari re-renders those as a blank page when it
 * prints: the report looks right on screen and the printout comes out white.
 *
 * Navigating the tab to a blob: URL instead gives it a real document with a
 * real URL, which prints normally. document.write remains the fallback for
 * environments without object URLs.
 */

export interface ReportWindowLike {
  location: { replace(url: string): void };
  document: { open(): void; write(html: string): void; close(): void };
}

export interface BlobUrls {
  /** Object URL for the HTML, or null when one can't be made. */
  create(html: string): string | null;
  revoke(url: string): void;
}

export type DeliveryMethod = "blob" | "document-write";

/** How long to keep the object URL alive so the tab can finish loading it. */
export const BLOB_REVOKE_DELAY_MS = 60_000;

export function deliverReport(
  win: ReportWindowLike,
  html: string,
  blobUrls: BlobUrls,
  schedule: (fn: () => void, ms: number) => void = setTimeout,
): DeliveryMethod {
  let url: string | null = null;
  try {
    url = blobUrls.create(html);
  } catch {
    url = null;
  }

  if (url) {
    try {
      win.location.replace(url);
      // Revoking immediately can cancel the navigation that just started.
      schedule(() => blobUrls.revoke(url as string), BLOB_REVOKE_DELAY_MS);
      return "blob";
    } catch {
      // Navigation refused — fall through and write the document instead.
      try {
        blobUrls.revoke(url);
      } catch {
        /* the URL is being discarded either way */
      }
    }
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  return "document-write";
}

/** The real browser implementation. */
export const browserBlobUrls: BlobUrls = {
  create(html) {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
    return URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  },
  revoke(url) {
    URL.revokeObjectURL(url);
  },
};
