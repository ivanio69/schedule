import { authConfigured, authHmac, safeEqualHex } from "@/lib/auth-session";

export const ARCHIVE_PREVIEW_TTL = 60 * 60;
export function signArchivePreview(id: string, now = Math.floor(Date.now() / 1000)) {
  const expires = String(now + ARCHIVE_PREVIEW_TTL);
  return { expires, token: authHmac(`archive-preview:${id}:${expires}`) };
}
export function validArchivePreview(id: string, expires: string | null, token: string | null, now = Math.floor(Date.now() / 1000)) {
  if (!authConfigured() || !/^[a-f0-9]{24}$/.test(id) || !expires || !/^\d{10}$/.test(expires) || !token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const expiration = Number(expires);
  if (expiration <= now || expiration > now + ARCHIVE_PREVIEW_TTL) return false;
  return safeEqualHex(token, authHmac(`archive-preview:${id}:${expires}`));
}
