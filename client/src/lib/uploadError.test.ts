import { describe, expect, it } from "vitest";
import { uploadErrorMessage } from "./uploadError";

describe("uploadErrorMessage", () => {
  // What the server actually logged when the InBody/VO2 uploads failed.
  it("explains an aborted request instead of echoing body-parser", () => {
    const msg = uploadErrorMessage(new Error("BadRequestError: request aborted"));
    expect(msg).toMatch(/interrupted/i);
    expect(msg).toMatch(/try again/i);
    expect(msg).not.toMatch(/BadRequestError/);
  });

  it("treats the browser's own network failures the same way", () => {
    for (const raw of ["Failed to fetch", "Load failed", "NetworkError when attempting to fetch resource"]) {
      expect(uploadErrorMessage(new TypeError(raw))).toMatch(/interrupted/i);
    }
  });

  it("passes a real server message straight through", () => {
    expect(uploadErrorMessage(new Error('Unsupported file type "text/html". Please upload a PDF or JPEG/PNG/WebP image.')))
      .toMatch(/unsupported file type/i);
    expect(uploadErrorMessage(new Error("File is 14.0 MB — the limit is 12.0 MB."))).toMatch(/14\.0 MB/);
  });

  it("falls back rather than showing an empty toast", () => {
    expect(uploadErrorMessage(new Error(""))).toBe("Upload failed.");
    expect(uploadErrorMessage(undefined)).toBe("Upload failed.");
    expect(uploadErrorMessage({})).toBe("Upload failed.");
  });

  it("accepts a bare string", () => {
    expect(uploadErrorMessage("request aborted")).toMatch(/interrupted/i);
  });
});
