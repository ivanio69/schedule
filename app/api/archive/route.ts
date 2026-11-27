import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import type { ArchiveItem } from "@/lib/archive";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.json({ error: "Войди в приложение" }, { status: 401 });
  try {
    const items = await (await getDatabase()).collection<ArchiveItem>("archive").find({}, { projection: { _id: 0 } }).sort({ createdAt: -1, id: 1 }).toArray();
    return NextResponse.json({ items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Failed to load archive", error);
    return NextResponse.json({ error: "Не удалось загрузить архив. Попробуй ещё раз" }, { status: 500 });
  }
}
