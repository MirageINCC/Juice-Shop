import jwt from "jsonwebtoken";
import { env } from "../env.js";

export const SESSION_COOKIE = "juice_shop_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24h

export interface SessionUser {
  id: string;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}

/**
 * Die Rollen werden beim Login in den Token eingefroren. Eine Rollenänderung in Discord
 * wirkt sich also erst beim nächsten Login bzw. nach Ablauf der 24h aus.
 */
export function signSession(user: SessionUser): string {
  return jwt.sign(user, env.SESSION_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

export function verifySession(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, env.SESSION_SECRET);
    if (typeof payload !== "object" || payload === null) return null;
    const { id, username, avatar, isAdmin } = payload as Record<string, unknown>;
    if (typeof id !== "string" || typeof username !== "string" || typeof isAdmin !== "boolean") {
      return null;
    }
    return { id, username, avatar: typeof avatar === "string" ? avatar : null, isAdmin };
  } catch {
    return null;
  }
}
