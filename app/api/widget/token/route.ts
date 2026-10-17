import { NextResponse } from "next/server";
import { readBearerToken, revokeWidgetToken } from "@/lib/widget-auth";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const rawToken = readBearerToken(request);
  if (!rawToken) return NextResponse.json({ error: "Нет токена" }, { status: 401 });
  await revokeWidgetToken(rawToken);
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
