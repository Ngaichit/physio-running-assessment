// Returns true only for http(s) URLs with a public, DOMAIN-NAME host — one that
// is dotted, not an IP literal, and not an internal/loopback name. This app
// fetches PDFs only from named hosts (S3/CDN), never IP literals, so we reject
// every IP-literal form — closing SSRF encoding bypasses (decimal/hex/octal IPv4,
// partial-dotted like 127.1, and IPv6 literals incl. ::1, fc00::/7, fe80::/10)
// and the loopback/private/link-local(metadata) ranges in every encoding — plus
// single-label internal service names (redis, db, metadata) and .internal/.local
// TLDs. Requires a dotted, non-internal domain name.
// KNOWN LIMITATION: does not resolve DNS, so a public hostname that resolves to
// a private IP (DNS rebinding) is not blocked — a defense-in-depth follow-up.
// NOTE: the fetch call sites also use redirect: "manual" and reject 3xx, since a
// public URL can 302-redirect to an internal target and defeat a host check.
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return false;

  if (host.includes(":")) return false;        // any IPv6 literal
  if (/^0x/i.test(host)) return false;          // hex IPv4
  if (/^[0-9.]+$/.test(host)) return false;     // any all-numeric/dotted IPv4 form
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (!host.includes(".")) return false;        // single-label internal name (redis, db, metadata)
  if (host.endsWith(".internal") || host.endsWith(".local")) return false; // internal TLDs

  return true;
}
