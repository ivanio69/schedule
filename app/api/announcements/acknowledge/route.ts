import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import { announcementVisibleTo, type DashboardAnnouncement } from "@/lib/announcements";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const person = await getRoleSessionPerson(request, ["user","headman","admin"]);
  if (!person) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  const body = await request.json().catch(() => null) as { announcementId?: unknown } | null;
  const announcementId = typeof body?.announcementId === "string" ? body.announcementId : "";
  if (!announcementId) return NextResponse.json({ error: "Не указано объявление" }, { status: 400 });
  const db = await getDatabase();
  const announcement = await db.collection<DashboardAnnouncement>("dashboard_announcements").findOne({ id: announcementId }, { projection: { _id: 0 } });
  if (!announcement || !announcement.requiresAcknowledgement || !announcementVisibleTo(announcement, person.id)) return NextResponse.json({ error: "Объявление недоступно" }, { status: 404 });
  const existing = await db.collection("announcement_acknowledgements").findOne({ announcementId, personId: person.id }, { projection: { _id: 0, acknowledgedAt: 1 } });
  if (existing && typeof existing.acknowledgedAt === "string") return NextResponse.json({ ok: true, acknowledgedAt: existing.acknowledgedAt });
  const acknowledgedAt = new Date().toISOString();
  await db.collection("announcement_acknowledgements").updateOne({ announcementId, personId: person.id }, { $setOnInsert: { announcementId, personId: person.id, acknowledgedAt } }, { upsert: true });
  return NextResponse.json({ ok: true, acknowledgedAt }, { headers: { "Cache-Control": "no-store" } });
}
