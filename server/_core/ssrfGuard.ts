// Returns true only for http(s) URLs whose host is not localhost, a loopback,
// or a private / link-local IP literal. Blocks the common SSRF targets
// (cloud metadata at 169.254.169.254, internal services on 10/172.16/192.168).
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::1" || host === "0.0.0.0") return false;

  // IPv4 literal checks
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]), b = Number(m[2]);
    if (a === 127) return false;                 // loopback
    if (a === 10) return false;                  // private
    if (a === 192 && b === 168) return false;    // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
    if (a === 169 && b === 254) return false;    // link-local / metadata
    if (a === 0) return false;
  }
  return true;
}
