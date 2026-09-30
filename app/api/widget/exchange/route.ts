import { NextResponse } from "next/server";
import { getPeople } from "@/lib/database";
import { exchangeWidgetPairing, revokeWidgetToken } from "@/lib/widget-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await exchangeWidgetPairing(body?.code, body?.deviceId);
    if (!result) return NextResponse.json({ error: "Код подключения недействителен или устарел" }, { status: 401 });

    const person = (await getPeople(true)).find((item) => item.id === result.personId);
    if (!person) {
      await revokeWidgetToken(result.token);
      return NextResponse.json({ error: "Профиль недоступен" }, { status: 404 });
    }

    return NextResponse.json({
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      profile: { id: person.id, name: person.name },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Widget pairing exchange failed", error);
    return NextResponse.json({ error: "Не удалось подключить виджет" }, { status: 500 });
  }
}
