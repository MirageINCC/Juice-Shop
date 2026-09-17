import { apiFetch } from "./client";
import type { SessionUser } from "./types";

export const fetchMe = () => apiFetch<{ user: SessionUser | null }>("/auth/me");

export const logout = () => apiFetch<void>("/auth/logout", { method: "POST" });
