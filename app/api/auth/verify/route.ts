import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import { ADMIN_COOKIE, AUTH_COOKIE, PROFILE_COOKIE, adminCookieToken, authCookieOptions, authHmac, createAuthSessionToken, safeEqualHex } from "@/lib/auth-session";
import { normalizePersonRole } from "@/lib/people";

export const dynamic = "force-dynamic";

type AuthCodeDoc = {
  id:string;
  personId:string;
  codeHash:string;
  attempts:number;
  createdAt:string;
  expiresAt:string;
  usedAt?:string;
};

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", authCookieOptions(0));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { requestId?:unknown; code?:unknown } | null;
  const requestId = typeof body?.requestId === "string" ? body.requestId : "";
  const code = typeof body?.code === "string" ? body.code.replace(/\D/g,"") : "";
  if (!requestId || !/^\d{6}$/.test(code)) return NextResponse.json({ error: "Введи 6-значный код" }, { status: 400 });

  const db = await getDatabase();
  const collection = db.collection<AuthCodeDoc>("auth_codes");
  const entry = await collection.findOne({ id: requestId });
  if (!entry || entry.usedAt || entry.expiresAt <= new Date().toISOString()) {
    return NextResponse.json({ error: "Код истёк. Запроси новый." }, { status: 410 });
  }
  if (entry.attempts >= 5) return NextResponse.json({ error: "Слишком много попыток. Запроси новый код." }, { status: 429 });

  const expected = authHmac("login-code:" + entry.id + ":" + entry.personId + ":" + code);
  if (!safeEqualHex(entry.codeHash, expected)) {
    await collection.updateOne({ id: entry.id }, { $inc: { attempts: 1 } });
    return NextResponse.json({ error: "Неверный код" }, { status: 401 });
  }

  const person = (await getPeople(false)).find(item => item.id === entry.personId && item.active);
  if (!person) return NextResponse.json({ error: "Профиль больше недоступен" }, { status: 403 });
  const role = normalizePersonRole(person.role, person.adminLink);
  await collection.updateOne({ id: entry.id }, { $set: { usedAt: new Date().toISOString() } });

  const response = NextResponse.json({ ok:true, person:{ id:person.id, name:person.name, role } }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(AUTH_COOKIE, createAuthSessionToken(person.id, role), authCookieOptions());
  response.cookies.set(PROFILE_COOKIE, person.id, authCookieOptions());
  const adminToken = adminCookieToken();
  if (role === "admin" && adminToken) response.cookies.set(ADMIN_COOKIE, adminToken, authCookieOptions(60 * 60 * 24));
  else clearCookie(response, ADMIN_COOKIE);
  return response;
}
