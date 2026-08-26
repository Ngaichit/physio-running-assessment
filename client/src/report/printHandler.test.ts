import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// The exported report is written into a new tab with document.write(). That tab
// inherits the app's CSP, which ships helmet's default script-src-attr 'none' —
// so inline event handler attributes never fire. The "Print / Save as PDF"
// button used onclick="window.print()" and was silently dead as a result.
//
// Guard the source directly: the report HTML is built inside a component and
// isn't exported, so there's nothing importable to assert against.
const source = readFileSync(
  path.resolve(import.meta.dirname, "../components/ReportPreview.tsx"),
  "utf8",
);

describe("exported report print button", () => {
  it("uses no inline event handler attributes", () => {
    const handlers = source.match(/\son(click|load|error|change|submit)\s*=\s*["']/g) ?? [];
    expect(handlers).toEqual([]);
  });

  it("still ships a print button", () => {
    expect(source).toMatch(/print-btn/);
    expect(source).toMatch(/Print \/ Save as PDF/);
  });

  it("wires the button up with addEventListener", () => {
    expect(source).toMatch(/addEventListener\(\s*["']click["']/);
    expect(source).toMatch(/window\.print\(\)/);
  });

  // Safari prints a script-generated about:blank document as a blank page, so
  // the finished report must arrive as a real document (blob: URL) rather than
  // being written into the placeholder tab.
  it("hands the finished report over with deliverReport, not document.write", () => {
    expect(source).toMatch(/deliverReport\(\s*printWindow/);
    expect(source).not.toMatch(/printWindow\.document\.write\(\s*html\s*\)/);
  });
});
