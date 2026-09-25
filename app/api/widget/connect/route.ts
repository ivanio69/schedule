import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getPeople } from "@/lib/database";
import { countWidgetTokens, createWidgetToken } from "@/lib/widget-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const person = (await getPeople(true)).find((item) => item.id === session.personId);
  if (!person) return NextResponse.json({ error: "Профиль недоступен" }, { status: 404 });

  let deviceId: unknown;
  try {
    const body = await request.json();
    deviceId = body?.deviceId;
  } catch {}

  const result = await createWidgetToken(person.id, deviceId);
  const connectedDevices = await countWidgetTokens(person.id);
  return NextResponse.json({
    token: result.token,
    expiresAt: result.expiresAt.toISOString(),
    connectedDevices,
    profile: { id: person.id, name: person.name },
  }, { headers: { "Cache-Control": "no-store" } });
}
