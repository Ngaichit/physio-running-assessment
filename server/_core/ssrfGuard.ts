// Returns true only for http(s) URLs with a DOMAIN-NAME host. This app fetches
// PDFs only from named hosts (S3/CDN), never IP literals, so we reject every
// IP-literal form — which closes SSRF encoding bypasses (decimal/hex/octal IPv4,
// partial-dotted like 127.1, and IPv6 literals incl. ::1, fc00::/7, fe80::/10)
// as well as the loopback/private/link-local(metadata) ranges in every encoding.
// KNOWN LIMITATION: does not resolve DNS, so a public hostname that resolves to
// a private IP (DNS rebinding) is not blocked — a defense-in-depth follow-up.
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;

  if (host.includes(":")) return false;        // any IPv6 literal
  if (/^0x/i.test(host)) return false;          // hex IPv4 (0x7f000001)
  if (/^[0-9.]+$/.test(host)) return false;     // any all-numeric/dotted IPv4 form (incl. decimal 2130706433, 127.1, private ranges)
  if (host === "localhost" || host.endsWith(".localhost")) return false;

  return true;
}
