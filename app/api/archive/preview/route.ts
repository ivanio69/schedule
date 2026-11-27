import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifyAuthSessionToken } from "@/lib/auth-session";
import { getDatabase } from "@/lib/database";
import { archiveFileUrl, type ArchiveItem } from "@/lib/archive";
import { signArchivePreview } from "@/lib/archive-preview-token";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!verifyAuthSessionToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.json({ error: "Войди в приложение" }, { status: 401 });
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || id.length > 100) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const item = await (await getDatabase()).collection<ArchiveItem>("archive").findOne({ id, kind: "file" });
    if (!item) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    const url = new URL(archiveFileUrl(item), request.url);
    if (item.file) {
      const signed = signArchivePreview(item.file.id);
      url.searchParams.set("expires", signed.expires);
      url.searchParams.set("token", signed.token);
    }
    return NextResponse.json({ url: url.href }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Failed to prepare archive preview", error);
    return NextResponse.json({ error: "Не удалось открыть предпросмотр" }, { status: 500 });
  }
}
