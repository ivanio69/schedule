import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import type { DashboardAnnouncement } from "@/lib/announcements";

export const dynamic = "force-dynamic";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const text = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validDate = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value));

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const announcements = await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements")
    .find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ announcements }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const title = text(body.title, 120);
    const message = text(body.body, 1200);
    if (!title || !message) return NextResponse.json({ error: "Заполни заголовок и текст" }, { status: 400 });
    const audience = body.audience === "selected" ? "selected" : "all";
    const people = await getPeople(true);
    const validIds = new Set(people.map(person => person.id));
    const recipientIds = audience === "selected" && Array.isArray(body.recipientIds)
      ? [...new Set(body.recipientIds.filter((id: unknown): id is string => typeof id === "string" && validIds.has(id)))]
      : [];
    if (audience === "selected" && !recipientIds.length) return NextResponse.json({ error: "Выбери хотя бы одного человека" }, { status: 400 });
    const now = new Date().toISOString();
    const startsAt = validDate(body.startsAt) ? new Date(body.startsAt).toISOString() : now;
    const endsAt = body.endsAt && validDate(body.endsAt) ? new Date(body.endsAt).toISOString() : null;
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return NextResponse.json({ error: "Окончание должно быть позже начала" }, { status: 400 });
    const item: DashboardAnnouncement = {
      id: randomUUID(), title, body: message, audience, recipientIds, active: true,
      startsAt, endsAt, createdAt: now, updatedAt: now
    };
    await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements").insertOne(item);
    return NextResponse.json({ announcement: item });
  } catch (error) {
    console.error("Failed to create dashboard announcement", error);
    return NextResponse.json({ error: "Не удалось создать объявление" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body.id !== "string" || typeof body.active !== "boolean") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  const result = await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements").findOneAndUpdate(
    { id: body.id },
    { $set: { active: body.active, updatedAt: new Date().toISOString() } },
    { returnDocument: "after", projection: { _id: 0 } }
  );
  return result ? NextResponse.json({ announcement: result }) : NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан ID" }, { status: 400 });
  await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements").deleteOne({ id });
  return NextResponse.json({ ok: true });
}
