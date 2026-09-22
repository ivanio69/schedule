import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, AUTH_COOKIE, PROFILE_COOKIE, adminCookieToken, authCookieOptions, verifyAuthSessionToken } from "@/lib/auth-session";
import { getPeople } from "@/lib/database";
import { normalizePersonRole } from "@/lib/people";

function clear(response: NextResponse) {
  for (const name of [AUTH_COOKIE, PROFILE_COOKIE, ADMIN_COOKIE]) response.cookies.set(name, "", authCookieOptions(0));
  return response;
}

export async function POST(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  const body = await request.json().catch(() => null) as { personId?: unknown } | null;
  const requestedId = typeof body?.personId === "string" ? body.personId : "";
  if (!session || !requestedId || requestedId !== session.personId) {
    return clear(NextResponse.json({ error:"Требуется вход через Telegram" }, { status:401 }));
  }
  const person = (await getPeople(false)).find(item=>item.id===session.personId&&item.active);
  if (!person) return clear(NextResponse.json({ error:"Профиль недоступен" }, { status:401 }));
  const role = normalizePersonRole(person.role, person.adminLink);
  const response = NextResponse.json({ ok:true,role,admin:role==="admin" }, { headers:{ "Cache-Control":"no-store" } });
  response.cookies.set(PROFILE_COOKIE, person.id, authCookieOptions());
  const adminToken=adminCookieToken();
  if(role==="admin"&&adminToken) response.cookies.set(ADMIN_COOKIE,adminToken,authCookieOptions(60*60*24));
  else response.cookies.set(ADMIN_COOKIE,"",authCookieOptions(0));
  return response;
}

export async function DELETE() {
  return clear(NextResponse.json({ ok:true }, { headers:{ "Cache-Control":"no-store" } }));
}
