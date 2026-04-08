import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
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

export function registerAuthRoutes(app: Express) {
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (!ENV.adminPassword || password !== ENV.adminPassword) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    try {
      let user = await db.getUserByEmail(email);

      if (!user) {
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
        res.status(500).json({ error: "Failed to create user" });
        return;
      }

      await createSession(user, req, res);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Login failed", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    const { name, email, accessCode } = req.body ?? {};

    if (!name || !email || !accessCode) {
      res.status(400).json({ error: "Name, email, and access code are required" });
      return;
    }

    if (!ENV.adminPassword || accessCode !== ENV.adminPassword) {
      res.status(401).json({ error: "Invalid access code" });
      return;
    }

    try {
      const existing = await db.getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "An account with that email already exists" });
        return;
      }

      await db.upsertUser({
        openId: email,
        email,
        name,
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
