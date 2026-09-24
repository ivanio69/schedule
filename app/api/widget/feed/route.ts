import { NextResponse } from "next/server";
import { buildWidgetFeed } from "@/lib/widget-feed";
import { readBearerToken, resolveWidgetToken } from "@/lib/widget-auth";

export const dynamic = "force-dynamic";

function validDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diffDays = Math.abs(parsed.getTime() - todayUtc) / 86400000;
  return diffDays <= 8 ? value : null;
}

export async function GET(request: Request) {
  const token = await resolveWidgetToken(readBearerToken(request));
  if (!token) return NextResponse.json({ error: "Недействительный токен виджета" }, { status: 401 });

  const date = validDate(new URL(request.url).searchParams.get("date"));
  if (!date) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });

  const feed = await buildWidgetFeed(token.personId, date);
  if (!feed) return NextResponse.json({ error: "Профиль недоступен" }, { status: 404 });

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
