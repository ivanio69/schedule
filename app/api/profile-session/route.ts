import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPeople } from "@/lib/database";
import { normalizePersonRole } from "@/lib/people";

const ADMIN_COOKIE = "schedule_admin";
const PROFILE_COOKIE = "schedule_profile";

function adminToken() {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  return secret ? createHmac("sha256", secret).update("schedule-admin").digest("hex") : null;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { personId?: unknown } | null;
  const personId = typeof body?.personId === "string" ? body.personId : "";
  const people = await getPeople(false);
  const person = people.find(item => item.id === personId && item.active);
  const role = person ? normalizePersonRole(person.role, person.adminLink) : "user";
  const token = adminToken();
  const admin = Boolean(person && role === "admin" && token);
  const response = NextResponse.json({
    ok: Boolean(person),
    role,
    admin,
  }, { status: person ? (role === "admin" && !token ? 503 : 200) : 404, headers: { "Cache-Control": "no-store" } });

  if (!person) {
    response.cookies.set(PROFILE_COOKIE, "", cookieOptions(0));
    response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
    return response;
  }

  response.cookies.set(PROFILE_COOKIE, person.id, cookieOptions(60 * 60 * 24 * 30));
  if (admin && token) response.cookies.set(ADMIN_COOKIE, token, cookieOptions(60 * 60 * 24));
  else response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(PROFILE_COOKIE, "", cookieOptions(0));
  response.cookies.set(ADMIN_COOKIE, "", cookieOptions(0));
  return response;
}
