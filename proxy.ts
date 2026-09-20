import { NextRequest, NextResponse } from "next/server";
import versionInfo from "@/version.json";

const ENV_COOKIE = "schedule_environment";
const DEV_HOST_COOKIE = "schedule_dev_host";

function isAllowedPreviewHost(host: string | undefined) {
  return Boolean(
    host
    && host.startsWith("schedule-git-")
    && host.endsWith("-ivanio.vercel.app")
    && !host.includes("/")
    && !host.includes(":"),
  );
}

function clearDevCookies(response: NextResponse) {
  response.cookies.set(ENV_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  response.cookies.set(DEV_HOST_COOKIE, "", { path: "/", maxAge: 0, sameSite: "lax" });
  response.cookies.set("schedule_dev_pr", "", { path: "/", maxAge: 0, sameSite: "lax" });
  response.cookies.set("schedule_dev_version", "", { path: "/", maxAge: 0, sameSite: "lax" });
  return response;
}

export function proxy(request: NextRequest) {
  // Preview deployments must render themselves. Only production acts as the
  // same-origin gateway so an installed PWA never leaves its original scope.
  if (process.env.VERCEL_ENV !== "production") return NextResponse.next();

  const { pathname, search } = request.nextUrl;

  // Keep the environment control plane and PWA metadata on STABLE.
  if (
    pathname.startsWith("/api/environment")
    || pathname === "/sw.js"
    || pathname === "/manifest.webmanifest"
    || pathname === "/favicon.ico"
    || pathname.startsWith("/icon")
    || pathname.startsWith("/screenshots/")
  ) {
    return NextResponse.next();
  }

  if (request.cookies.get(ENV_COOKIE)?.value !== "dev") {
    return NextResponse.next();
  }

  const devPr = Number(request.cookies.get("schedule_dev_pr")?.value ?? "");
  const host = request.cookies.get(DEV_HOST_COOKIE)?.value;
  if (!isAllowedPreviewHost(host) || !Number.isFinite(devPr) || devPr <= versionInfo.pr) {
    return clearDevCookies(NextResponse.next());
  }

  const target = new URL(`${pathname}${search}`, `https://${host}`);
  const response = NextResponse.rewrite(target);
  response.headers.set("x-schedule-environment", "dev");
  return response;
}

export const config = {
  matcher: "/:path*",
};
