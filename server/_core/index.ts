import "dotenv/config";
import express from "express";
import helmet from "helmet";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { assertRequiredEnv } from "./env";
import { registerAuthRoutes } from "./auth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { isPublicHttpUrl } from "./ssrfGuard";
import { sdk } from "./sdk";
import { pingDatabase } from "../db";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertRequiredEnv();
  const app = express();
  app.set("trust proxy", 1); // Railway terminates TLS at a proxy; use X-Forwarded-For
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Vite serves inline styles; Google Fonts is used by the report.
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        // Screenshots/PDF pages render as data: URLs; blob: for canvas exports.
        imgSrc: ["'self'", "data:", "blob:"],
        // pdf.js worker + report print window need blob:; scripts are bundled.
        scriptSrc: ["'self'", "'unsafe-inline'", "blob:"],
        // fetch(data:) is used to re-encode inline screenshot images with annotations
        connectSrc: ["'self'", "data:"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'"],
      },
    },
    // The report opens a new tab via window.open + document.write; COEP/CORP
    // off avoids breaking that and the data: assets.
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
  }));
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerAuthRoutes(app);

  // Health check — registered before tRPC and the SPA fallback so neither can
  // swallow it. Railway polls this; a DB ping failure reports degraded (503).
  app.get("/healthz", async (_req, res) => {
    const dbOk = await pingDatabase();
    if (dbOk) { res.status(200).json({ status: "ok" }); }
    else { res.status(503).json({ status: "degraded", db: false }); }
  });

  // PDF proxy — fetches remote PDFs and serves them with proper headers
  // This avoids CORS issues when pdfjs-dist tries to load S3-hosted PDFs
  app.get("/api/pdf-proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) {
      res.status(400).json({ error: "Missing url parameter" });
      return;
    }
    // Require a valid session — this endpoint fetches on the server's behalf.
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!isPublicHttpUrl(url)) {
      res.status(400).json({ error: "URL not allowed" });
      return;
    }
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        res.status(400).json({ error: "Redirects are not allowed" });
        return;
      }
      if (!response.ok) {
        res.status(response.status).json({ error: `Failed to fetch PDF: ${response.statusText}` });
        return;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Length", buffer.length.toString());
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(buffer);
    } catch (err: any) {
      console.error("PDF proxy error:", err.message);
      res.status(500).json({ error: "Failed to proxy PDF" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path, type }) {
        // Log server-side failures with context. Hook Sentry.captureException(error) here later.
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[trpc] ${type} ${path ?? "<no-path>"} failed:`, error.message, error.stack);
        } else {
          console.warn(`[trpc] ${type} ${path ?? "<no-path>"} -> ${error.code}: ${error.message}`);
        }
      },
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const isProd = process.env.NODE_ENV === "production";
  const preferredPort = parseInt(process.env.PORT || "3000");
  // In production, bind the injected PORT directly — Railway only routes to it.
  // Scanning for a different port would make the app silently unreachable.
  const port = isProd ? preferredPort : await findAvailablePort(preferredPort);
  server.on("error", (err) => {
    console.error(`[server] failed to bind port ${port}:`, err);
    process.exit(1);
  });
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
