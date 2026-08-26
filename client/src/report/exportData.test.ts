import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// A report was exported titled "Unknown", with no screenshots and no strength
// tests, while the AI text in the same document named the patient correctly.
// Cause: the export read this component's useQuery results, and all three of
// them were undefined at click time, so each section was silently omitted.
//
// The export must pull its own data instead. Guard the source directly — the
// export builds its HTML inside a component and isn't importable.
const source = readFileSync(
  path.resolve(import.meta.dirname, "../components/ReportPreview.tsx"),
  "utf8",
);

describe("report export data", () => {
  it("fetches the patient, screenshots and strength tests at export time", () => {
    expect(source).toMatch(/utils\.patient\.get\.fetch\(/);
    expect(source).toMatch(/utils\.screenshot\.list\.fetch\(/);
    expect(source).toMatch(/utils\.dynamo\.list\.fetch\(/);
  });

  it("refuses to export a report it could not name", () => {
    expect(source).toMatch(/if \(formData\?\.patientId && !exportPatient\)/);
    expect(source).toMatch(/Could not load the patient record/);
  });

  it("builds the cover and sections from the fetched data, not the query state", () => {
    expect(source).toMatch(/const patientName = exportPatient \? exportPatient\.name/);
    expect(source).toMatch(/exportScreenshots && exportScreenshots\.length > 0/);
    expect(source).toMatch(/displayReport\?\.dynamoTests \|\| exportDynamo/);
  });

  // vh resolves against the screen viewport in Safari's print rendering, so a
  // 100vh cover overflowed onto a second, blank page.
  it("gives the cover a page-sized height in print", () => {
    expect(source).toMatch(/@media print \{[\s\S]*?\.cover \{ height: 296mm; \}/);
  });
});
