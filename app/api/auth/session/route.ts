import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, AUTH_COOKIE, PROFILE_COOKIE, authCookieOptions, verifyAuthSessionToken } from "@/lib/auth-session";
import { getPeople } from "@/lib/database";
import { normalizePersonRole } from "@/lib/people";

export const dynamic = "force-dynamic";

function clear(response: NextResponse) {
  for (const name of [AUTH_COOKIE, PROFILE_COOKIE, ADMIN_COOKIE]) response.cookies.set(name, "", authCookieOptions(0));
  return response;
}

export async function GET(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return clear(NextResponse.json({ authenticated:false }, { status:401, headers:{ "Cache-Control":"no-store" } }));
  const person = (await getPeople(false)).find(item=>item.id===session.personId&&item.active);
  if (!person) return clear(NextResponse.json({ authenticated:false }, { status:401, headers:{ "Cache-Control":"no-store" } }));
  const role = normalizePersonRole(person.role, person.adminLink);
  return NextResponse.json({ authenticated:true, person:{ id:person.id,name:person.name,role } }, { headers:{ "Cache-Control":"no-store" } });
}

export async function DELETE() {
  return clear(NextResponse.json({ ok:true }, { headers:{ "Cache-Control":"no-store" } }));
}
