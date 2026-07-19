import { describe, it, expect } from "vitest";
import { cspDirectives } from "./_core/csp";

describe("CSP directives", () => {
  // Regression: the video editor plays uploaded videos via URL.createObjectURL()
  // (blob: object URLs). media-src was missing, so it fell back to
  // default-src 'self' and the browser refused to load the video — the user
  // could not see the uploaded video in the editor.
  it("allows blob: for media so uploaded videos can play", () => {
    expect(cspDirectives.mediaSrc).toContain("blob:");
    expect(cspDirectives.mediaSrc).toContain("'self'");
  });

  it("keeps blob: allowances for the other features that rely on it", () => {
    expect(cspDirectives.imgSrc).toContain("blob:"); // canvas exports / data: screenshots
    expect(cspDirectives.scriptSrc).toContain("blob:"); // pdf.js worker + print window
    expect(cspDirectives.workerSrc).toContain("blob:"); // pdf.js worker
  });

  it("locks down the baseline (default-src 'self', object-src 'none')", () => {
    expect(cspDirectives.defaultSrc).toEqual(["'self'"]);
    expect(cspDirectives.objectSrc).toEqual(["'none'"]);
  });
});
