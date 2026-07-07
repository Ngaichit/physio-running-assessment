import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<script>alert("x")&'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&amp;&#39;&lt;/script&gt;"
    );
  });
  it("coerces non-strings and nullish to a safe string", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
    expect(escapeHtml(42)).toBe("42");
  });
  it("neutralizes an SVG-breaking payload", () => {
    expect(escapeHtml("</text><image href=x onerror=alert(1)>")).toBe(
      "&lt;/text&gt;&lt;image href=x onerror=alert(1)&gt;"
    );
  });
});
