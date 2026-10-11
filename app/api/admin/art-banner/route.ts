import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getArtBannerEnabled, setArtBannerEnabled } from "@/lib/art-banner";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };

function authorize(request: NextRequest) {
  const session = verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Требуется вход" }, { status: 401, headers });
  if (session.role !== "admin") return NextResponse.json({ error: "Нет доступа" }, { status: 403, headers });
  return null;
}

export async function GET(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  try {
    return NextResponse.json({ enabled: await getArtBannerEnabled() }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось загрузить настройку баннера" }, { status: 500, headers });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = authorize(request);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Укажи enabled: true или false" }, { status: 400, headers });
  }
  try {
    await setArtBannerEnabled(body.enabled);
    return NextResponse.json({ enabled: body.enabled }, { headers });
  } catch {
    return NextResponse.json({ error: "Не удалось сохранить настройку баннера" }, { status: 500, headers });
  }
}
