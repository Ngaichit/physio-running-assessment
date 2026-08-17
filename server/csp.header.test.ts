import { describe, it, expect } from "vitest";
import express from "express";
import helmet from "helmet";
import type { AddressInfo } from "net";
import { cspDirectives } from "./_core/csp";

// Boots the real helmet middleware with the app's config and reads the header it
// actually emits. The cspDirectives object alone can't catch this class of bug:
// helmet merges its own defaults in, so directives we never wrote still ship.
async function emittedCsp(): Promise<string> {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: { directives: cspDirectives },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }));
  app.get("/", (_req, res) => { res.send("ok"); });

  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      try {
        const { port } = server.address() as AddressInfo;
        const res = await fetch(`http://127.0.0.1:${port}/`);
        resolve(res.headers.get("content-security-policy") ?? "");
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

describe("emitted Content-Security-Policy", () => {
  // Helmet's default script-src-attr 'none' blocks inline event handlers
  // (onclick="..."). We keep that hardening — the exported report drives its
  // print button from an inline <script> + addEventListener instead. If this
  // ever flips, re-check that the report's print button still fires.
  it("blocks inline event handlers", async () => {
    const csp = await emittedCsp();
    expect(csp).toMatch(/script-src-attr\s+'none'/);
  });

  it("allows the inline <script> the report's print button depends on", async () => {
    const csp = await emittedCsp();
    expect(csp).toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("keeps the hardening we rely on", async () => {
    const csp = await emittedCsp();
    expect(csp).toMatch(/object-src\s+'none'/);
    expect(csp).toMatch(/frame-ancestors\s+'self'/);
  });
});
