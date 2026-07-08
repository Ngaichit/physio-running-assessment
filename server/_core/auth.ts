import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

async function createSession(
  user: Awaited<ReturnType<typeof db.getUserByEmail>>,
  req: Request,
  res: Response
) {
  if (!user) return;
  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name || "",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
}

// Returns true iff `password` authenticates `user`.
// - If the user has a bcrypt hash, compare against it.
// - Otherwise (legacy/no-hash account) accept the ENV admin password ONLY for
//   the configured admin email. Never for arbitrary password-less accounts.
export async function passwordMatches(
  user: { email?: string | null; passwordHash?: string | null },
  password: string
): Promise<boolean> {
  if (user.passwordHash) {
    return bcrypt.compare(password, user.passwordHash);
  }
  return (
    !!ENV.adminPassword &&
    user.email === ENV.adminEmail &&
    password === ENV.adminPassword
  );
}

// 10 attempts per 15 minutes per IP on auth endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many attempts. Please try again later." },
});

export function registerAuthRoutes(app: Express) {
  // ── Login ──────────────────────────────────────────────────────────────
  app.post("/api/auth/login", authLimiter, async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    try {
      let user = await db.getUserByEmail(email);

      // Admin fallback: if user doesn't exist and this is the admin email with ENV password
      if (!user && email === ENV.adminEmail && ENV.adminPassword && password === ENV.adminPassword) {
        await db.upsertUser({
          openId: email,
          email,
          name: email.split("@")[0],
          loginMethod: "password",
          lastSignedIn: new Date(),
        });
        user = await db.getUserByOpenId(email);
      }

      if (!user) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (!(await passwordMatches(user, password))) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      await createSession(user, req, res);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // ── Register ───────────────────────────────────────────────────────────
  app.post("/api/auth/register", authLimiter, async (req: Request, res: Response) => {
    const { name, email, password, inviteCode } = req.body ?? {};

    if (!name || !email || !password) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    // Check invite code if one is configured
    if (ENV.inviteCode && inviteCode !== ENV.inviteCode) {
      res.status(401).json({ error: "Invalid invite code" });
      return;
    }

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "An account with that email already exists" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      await db.upsertUser({
        openId: email,
        email,
        name,
        passwordHash,
        loginMethod: "password",
        lastSignedIn: new Date(),
      });

      const user = await db.getUserByOpenId(email);
      if (!user) {
        res.status(500).json({ error: "Failed to create account" });
        return;
      }

      await createSession(user, req, res);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Register failed", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });
}
