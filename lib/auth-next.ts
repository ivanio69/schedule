// Redirects after authentication must stay on this site, including backslash URL normalization.
export function safeAuthNext(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)) return "/";
  const url = new URL(value, "https://schedule.invalid");
  if (url.origin !== "https://schedule.invalid" || url.pathname.startsWith("/login") || url.pathname.startsWith("/api/auth/")) return "/";
  return url.pathname + url.search + url.hash;
}
