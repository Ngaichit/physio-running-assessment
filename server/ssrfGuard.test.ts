import { describe, expect, it } from "vitest";
import { isPublicHttpUrl } from "./_core/ssrfGuard";

describe("isPublicHttpUrl", () => {
  it("allows a normal https URL", () => {
    expect(isPublicHttpUrl("https://mybucket.s3.ap-east-1.amazonaws.com/x.pdf")).toBe(true);
  });
  it("rejects non-http(s) schemes", () => {
    expect(isPublicHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPublicHttpUrl("gopher://x")).toBe(false);
  });
  it("rejects localhost and loopback", () => {
    expect(isPublicHttpUrl("http://localhost/x")).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://[::1]/x")).toBe(false);
  });
  it("rejects private and link-local ranges", () => {
    expect(isPublicHttpUrl("http://10.0.0.5/x")).toBe(false);
    expect(isPublicHttpUrl("http://192.168.1.1/x")).toBe(false);
    expect(isPublicHttpUrl("http://172.16.4.4/x")).toBe(false);
    expect(isPublicHttpUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });
});
