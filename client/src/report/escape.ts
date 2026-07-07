// Escape a value for safe interpolation into an HTML or SVG string.
// Used only on the string-building (print / dangerouslySetInnerHTML) paths —
// never on the React render path, which already escapes.
export function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
