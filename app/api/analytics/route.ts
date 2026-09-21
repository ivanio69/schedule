import { NextRequest, NextResponse } from "next/server";
import { recordUsageEvent, type UsageEvent } from "@/lib/usage-analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<UsageEvent>;
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false }, { status: 400 });
    if (!["start","pageview","heartbeat"].includes(String(body.type))) return NextResponse.json({ ok: false }, { status: 400 });
    const ok = await recordUsageEvent(body as UsageEvent);
    return NextResponse.json({ ok }, { status: ok ? 200 : 400, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
