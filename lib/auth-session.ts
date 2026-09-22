import { createHmac, timingSafeEqual } from "node:crypto";
import type { PersonRole } from "@/lib/people";

export const AUTH_COOKIE = "schedule_auth";
export const PROFILE_COOKIE = "schedule_profile";
export const ADMIN_COOKIE = "schedule_admin";
export const AUTH_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AuthSessionPayload = {
  v: 1;
  personId: string;
  role: PersonRole;
  iat: number;
  exp: number;
};

export function authSecret() {
  return process.env.AUTH_SESSION_SECRET
    ?? process.env.ADMIN_SESSION_SECRET
    ?? process.env.ADMIN_PASSWORD
    ?? "";
}

export function authConfigured() {
  return Boolean(authSecret());
}

export function authHmac(value: string) {
  const secret = authSecret();
  if (!secret) throw new Error("AUTH_SESSION_SECRET is not configured");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqualHex(a: string, b: string) {
  if (!/^[a-f0-9]+$/i.test(a) || !/^[a-f0-9]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function createAuthSessionToken(personId: string, role: PersonRole, ttlSeconds = AUTH_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AuthSessionPayload = { v: 1, personId, role, iat: now, exp: now + ttlSeconds };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return encoded + "." + authHmac("session:" + encoded);
}

export function verifyAuthSessionToken(token: string | undefined | null): AuthSessionPayload | null {
  if (!token || !authConfigured()) return null;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return null;
  const expected = authHmac("session:" + encoded);
  if (!safeEqualHex(signature, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AuthSessionPayload;
    if (payload.v !== 1 || !payload.personId || !["user","headman","admin"].includes(payload.role)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function adminCookieToken() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? process.env.AUTH_SESSION_SECRET;
  return secret ? createHmac("sha256", secret).update("schedule-admin").digest("hex") : null;
}

export function authCookieOptions(maxAge = AUTH_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
