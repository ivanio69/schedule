import { NextRequest, NextResponse } from "next/server";
import { consumeNativeHandoff } from "@/lib/native-auth";
import { getDatabase } from "@/lib/database";
import { normalizePersonRole, type Person } from "@/lib/people";
import { ADMIN_COOKIE, AUTH_COOKIE, PROFILE_COOKIE, adminCookieToken, authCookieOptions, createAuthSessionToken } from "@/lib/auth-session";
import { safeAuthNext } from "@/lib/auth-next";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const fail = () => NextResponse.redirect(new URL("/login?openid_error=flow_expired", request.url), { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  try {
    // Cross-site forms cannot add this header; browsers require a CORS preflight for it.
    if (request.headers.get("X-Schedule-Native-Auth") !== "1") return fail();
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) return fail();
    const form = await request.formData();
    const code = form.get("code"), verifier = form.get("verifier");
    if (typeof code !== "string" || typeof verifier !== "string") return fail();
    const handoff = await consumeNativeHandoff(code, verifier);
    if (!handoff) return fail();
    const person = await (await getDatabase()).collection<Person>("people").findOne({ id: handoff.personId, active: true });
    if (!person) return fail();
    const role = normalizePersonRole(person.role, person.adminLink);
    const success = new URL("/login", request.url);
    success.searchParams.set("openid", "success");
    success.searchParams.set("next", safeAuthNext(handoff.next));
    const response = NextResponse.redirect(success, { status: 303, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
    response.cookies.set(AUTH_COOKIE, createAuthSessionToken(person.id, role), authCookieOptions());
    response.cookies.set(PROFILE_COOKIE, person.id, authCookieOptions());
    const admin = adminCookieToken();
    response.cookies.set(ADMIN_COOKIE, role === "admin" && admin ? admin : "", authCookieOptions(role === "admin" && admin ? 86400 : 0));
    return response;
  } catch {
    return fail();
  }
}
