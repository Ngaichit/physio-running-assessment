import { describe, expect, it, vi } from "vitest";
import { BLOB_REVOKE_DELAY_MS, deliverReport, type BlobUrls, type ReportWindowLike } from "./deliverReport";

const HTML = "<!DOCTYPE html><html><body>report</body></html>";

function fakeWindow() {
  const calls: string[] = [];
  const win: ReportWindowLike = {
    location: { replace: (url: string) => calls.push(`replace:${url}`) },
    document: {
      open: () => calls.push("open"),
      write: (h: string) => calls.push(`write:${h.length}`),
      close: () => calls.push("close"),
    },
  };
  return { win, calls };
}

function fakeBlobUrls(url: string | null): BlobUrls & { revoked: string[] } {
  const revoked: string[] = [];
  return {
    create: () => url,
    revoke: (u: string) => void revoked.push(u),
    revoked,
  };
}

describe("deliverReport", () => {
  it("navigates the tab to a blob: URL rather than writing the document", () => {
    const { win, calls } = fakeWindow();
    const method = deliverReport(win, HTML, fakeBlobUrls("blob:abc"), () => {});

    expect(method).toBe("blob");
    expect(calls).toEqual(["replace:blob:abc"]);
    // The document.write path is what Safari prints as a blank page.
    expect(calls.some(c => c.startsWith("write:"))).toBe(false);
  });

  it("keeps the object URL alive long enough for the tab to load it", () => {
    const { win } = fakeWindow();
    const urls = fakeBlobUrls("blob:abc");
    const schedule = vi.fn();

    deliverReport(win, HTML, urls, schedule);

    expect(urls.revoked).toEqual([]); // not revoked synchronously
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), BLOB_REVOKE_DELAY_MS);
    schedule.mock.calls[0][0]();
    expect(urls.revoked).toEqual(["blob:abc"]);
  });

  it("falls back to document.write when no object URL can be made", () => {
    const { win, calls } = fakeWindow();
    const method = deliverReport(win, HTML, fakeBlobUrls(null), () => {});

    expect(method).toBe("document-write");
    expect(calls).toEqual(["open", `write:${HTML.length}`, "close"]);
  });

  it("falls back when creating the object URL throws", () => {
    const { win, calls } = fakeWindow();
    const urls: BlobUrls = { create: () => { throw new Error("nope"); }, revoke: () => {} };

    expect(deliverReport(win, HTML, urls, () => {})).toBe("document-write");
    expect(calls).toEqual(["open", `write:${HTML.length}`, "close"]);
  });

  it("falls back when navigation is refused, and does not leak the URL", () => {
    const calls: string[] = [];
    const win: ReportWindowLike = {
      location: { replace: () => { throw new Error("blocked"); } },
      document: {
        open: () => calls.push("open"),
        write: (h: string) => calls.push(`write:${h.length}`),
        close: () => calls.push("close"),
      },
    };
    const urls = fakeBlobUrls("blob:abc");

    expect(deliverReport(win, HTML, urls, () => {})).toBe("document-write");
    expect(calls).toEqual(["open", `write:${HTML.length}`, "close"]);
    expect(urls.revoked).toEqual(["blob:abc"]);
  });

  it("delivers the html unchanged on the fallback path", () => {
    const written: string[] = [];
    const win: ReportWindowLike = {
      location: { replace: () => { throw new Error("blocked"); } },
      document: { open: () => {}, write: (h: string) => void written.push(h), close: () => {} },
    };
    deliverReport(win, HTML, fakeBlobUrls(null), () => {});
    expect(written).toEqual([HTML]);
  });
});
