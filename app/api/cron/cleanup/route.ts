import { NextRequest, NextResponse } from "next/server";
import { runAutomaticCleanup } from "@/lib/maintenance";

export const dynamic = "force-dynamic";
const SCHEDULE = "17 3 * * *";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) return request.headers.get("authorization") === `Bearer ${secret}`;
  return process.env.VERCEL_ENV === "production" && request.headers.get("x-vercel-cron-schedule") === SCHEDULE;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  try {
    const cleanup = await runAutomaticCleanup();
    return NextResponse.json({ ok: true, cleanup }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Automatic cleanup failed", error);
    return NextResponse.json({ error: "Не удалось выполнить автоочистку" }, { status: 500 });
  }
}
