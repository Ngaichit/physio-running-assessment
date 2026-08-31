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
  it("sizes the cover in absolute units, never vh", () => {
    const cover = source.match(/\n  \.cover \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(cover).toMatch(/height: 256mm;/);
    expect(cover).not.toMatch(/height:[^;]*vh/);
  });

  // Safari ignores the :first selector but still applies the declarations
  // inside it, so a margin here silently becomes the margin for EVERY page.
  // That is how the printed report lost all four of its page margins and
  // started printing text hard against the edge of the paper.
  it("never sets a margin inside @page :first", () => {
    const first = source.match(/@page :first \{[\s\S]*?\n  \}/)?.[0] ?? "";
    expect(first).toBeTruthy();
    expect(first).not.toMatch(/margin/);
  });

  it("keeps real margins on the @page rule", () => {
    expect(source).toMatch(/@page \{\s*size: A4;\s*margin: 16mm 15mm 18mm 15mm;/);
  });

  // The pill drawn on each photo must print the stored reading. Recomputing it
  // locally is what swapped inner and outer angles depending on the order the
  // three points happened to be clicked.
  it("labels angle annotations from the stored measuredValue", () => {
    expect(source).toMatch(/annotationDisplayAngle\(\s*ann\.measuredValue/);
    expect(source).not.toMatch(/if \(cross < 0\) inner = 360 - inner/);
  });
});
