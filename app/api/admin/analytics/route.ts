import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUsageAnalyticsReport } from "@/lib/usage-analytics";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  try {
    const analytics = await getUsageAnalyticsReport();
    return NextResponse.json({ analytics }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load usage analytics", error);
    return NextResponse.json({ error: "Не удалось загрузить аналитику" }, { status: 500 });
  }
}
