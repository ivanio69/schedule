import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getPeople } from "@/lib/database";
import { countWidgetTokens, createWidgetPairing, revokeWidgetTokens } from "@/lib/widget-auth";

export const dynamic = "force-dynamic";

async function activeSessionPerson(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return null;
  const person = (await getPeople(true)).find((item) => item.id === session.personId);
  return person ?? null;
}

export async function GET(request: NextRequest) {
  const person = await activeSessionPerson(request);
  if (!person) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const connectedDevices = await countWidgetTokens(person.id);
  return NextResponse.json({ connectedDevices }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const person = await activeSessionPerson(request);
  if (!person) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const pairing = await createWidgetPairing(person.id);
  const deepLink = `schedule214://widget/pair?code=${encodeURIComponent(pairing.code)}`;
  return NextResponse.json({
    deepLink,
    expiresAt: pairing.expiresAt.toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest) {
  const person = await activeSessionPerson(request);
  if (!person) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const revoked = await revokeWidgetTokens(person.id);
  return NextResponse.json({ ok: true, revoked }, { headers: { "Cache-Control": "no-store" } });
}
