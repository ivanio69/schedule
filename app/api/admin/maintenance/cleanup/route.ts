import { NextRequest, NextResponse } from "next/server";
import { getRoleSessionPerson } from "@/lib/role-session";
import { runAutomaticCleanup } from "@/lib/maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const actor = await getRoleSessionPerson(request, ["admin"]);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  try {
    const cleanup = await runAutomaticCleanup();
    return NextResponse.json({ ok: true, cleanup }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Manual cleanup failed", error);
    return NextResponse.json({ error: "Не удалось выполнить очистку" }, { status: 500 });
  }
}
