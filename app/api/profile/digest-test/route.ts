import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { forceDigestDelivery } from "@/lib/digest";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  try {
    const result = await forceDigestDelivery(session.personId);
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Force digest push failed", error);
    return NextResponse.json({ error: "Не удалось отправить тестовую сводку" }, { status: 500 });
  }
}
