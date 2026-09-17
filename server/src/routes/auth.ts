import crypto from "node:crypto";
import { Router } from "express";
import { getMemberRoles } from "../auth/discordBot.js";
import { buildAuthorizeUrl, exchangeCodeForToken, fetchDiscordUser } from "../auth/discordOAuth.js";
import { SESSION_COOKIE, signSession, verifySession } from "../auth/session.js";
import { env } from "../env.js";

const STATE_COOKIE = "juice_shop_oauth_state";
const isProd = env.NODE_ENV === "production";

export const authRouter = Router();

authRouter.get("/discord/login", (_req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 5 * 60 * 1000,
  });
  res.redirect(buildAuthorizeUrl(state));
});

authRouter.get("/discord/callback", async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const expected = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);

    if (typeof code !== "string" || typeof state !== "string" || state !== expected) {
      res.status(400).send("Ungültige OAuth-Antwort.");
      return;
    }

    const accessToken = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(accessToken);
    const roles = await getMemberRoles(discordUser.id);
    const isAdmin = roles !== null && roles.some((role) => env.ADMIN_ROLE_IDS.includes(role));

    const token = signSession({
      id: discordUser.id,
      username: discordUser.username,
      avatar: discordUser.avatar,
      isAdmin,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = typeof token === "string" ? verifySession(token) : null;
  res.json({ user });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});
