import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_BYTES, formatBytes, uploadSizeError } from "./uploadLimits";

describe("formatBytes", () => {
  it("formats bytes, KB and MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("does not pretend to know a nonsense size", () => {
    expect(formatBytes(NaN)).toBe("unknown size");
    expect(formatBytes(-1)).toBe("unknown size");
  });
});

describe("uploadSizeError", () => {
  it("passes a file at or under the limit", () => {
    expect(uploadSizeError(0)).toBeNull();
    expect(uploadSizeError(1024)).toBeNull();
    expect(uploadSizeError(MAX_UPLOAD_BYTES)).toBeNull();
  });

  it("rejects a file over the limit and names both sizes", () => {
    const msg = uploadSizeError(MAX_UPLOAD_BYTES + 1);
    expect(msg).toMatch(/12\.0 MB/);
    expect(msg).toMatch(/limit/i);
  });

  it("rejects an unreadable size rather than letting it through", () => {
    expect(uploadSizeError(NaN)).toMatch(/could not read/i);
  });

  it("honours an explicit limit", () => {
    expect(uploadSizeError(2048, 1024)).toMatch(/limit is 1 KB/);
    expect(uploadSizeError(512, 1024)).toBeNull();
  });

  // The bug this module exists to prevent: the browser used to allow 20 MB
  // while inline storage capped out at 12 MB, so 12-20 MB uploads were
  // accepted by the picker and could only fail after a long transfer.
  it("rejects the sizes that used to slip past the file picker", () => {
    for (const mb of [13, 15, 18, 20]) {
      expect(uploadSizeError(mb * 1024 * 1024)).not.toBeNull();
    }
  });
});
