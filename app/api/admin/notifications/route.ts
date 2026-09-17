import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getPeople } from "@/lib/database";
import { sendPush } from "@/lib/push";
const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD;const SESSION_SECRET=process.env.ADMIN_SESSION_SECRET??ADMIN_PASSWORD;const COOKIE_NAME="schedule_admin";function authorized(request:NextRequest){if(!SESSION_SECRET)return false;const token=createHmac("sha256",SESSION_SECRET).update("schedule-admin").digest("hex");return request.cookies.get(COOKIE_NAME)?.value===token}
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  const data = await request.json().catch(() => null) as { title?: unknown; body?: unknown; recipients?: unknown } | null;
  const title = typeof data?.title === "string" ? data.title.trim() : "";
  const body = typeof data?.body === "string" ? data.body.trim() : "";
  if (!title || !body) return NextResponse.json({ error: "Заполни заголовок и текст" }, { status: 400 });
  if (title.length > 80 || body.length > 240) return NextResponse.json({ error: "Уведомление слишком длинное" }, { status: 400 });
  const people = await getPeople(true);
  const requested = Array.isArray(data?.recipients) ? data.recipients.filter((id: unknown): id is string => typeof id === "string") : null;
  const validIds = new Set(people.map(p => p.id));
  const recipients = requested ? [...new Set(requested)].filter(id => validIds.has(id)) : people.map(p => p.id);
  if (!recipients.length) return NextResponse.json({ error: "Не выбраны получатели" }, { status: 400 });
  const result = await sendPush(recipients, null, { title, body, url: "/" });
  return NextResponse.json({ ok: true, recipients: recipients.length, ...result });
}
