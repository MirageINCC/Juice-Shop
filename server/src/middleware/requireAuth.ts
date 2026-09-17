import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySession } from "../auth/session.js";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = typeof token === "string" ? verifySession(token) : null;
  if (!user) {
    res.status(401).json({ error: "Nicht angemeldet" });
    return;
  }
  req.user = user;
  next();
}
