import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import { getRoleSessionPerson } from "@/lib/role-session";
import { DEFAULT_ANNOUNCEMENT_ACCENT, DEFAULT_ANNOUNCEMENT_BACKGROUND, type DashboardAnnouncement } from "@/lib/announcements";
import { sendPush } from "@/lib/push";

export async function POST(request: NextRequest) {
  const actor = await getRoleSessionPerson(request, ["headman", "admin"]);
  if (!actor) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
  const message = typeof body?.body === "string" ? body.body.trim().slice(0, 1200) : "";
  if (!title || !message) return NextResponse.json({ error: "Заполни заголовок и текст" }, { status: 400 });

  const people = await getPeople(true);
  const validIds = new Set(people.map(item => item.id));
  const audience = body?.audience === "selected" ? "selected" : "all";
  const requested = Array.isArray(body?.recipientIds) ? body.recipientIds.filter((id): id is string => typeof id === "string") : [];
  const recipientIds = audience === "selected" ? [...new Set(requested)].filter(id => validIds.has(id)) : [];
  if (audience === "selected" && !recipientIds.length) return NextResponse.json({ error: "Выбери получателей" }, { status: 400 });

  const now = new Date().toISOString();
  const announcement: DashboardAnnouncement = {
    id: randomUUID(), title, body: message, audience, recipientIds, active: true,
    startsAt: now, endsAt: null, accentColor: DEFAULT_ANNOUNCEMENT_ACCENT,
    backgroundColor: DEFAULT_ANNOUNCEMENT_BACKGROUND, createdAt: now, updatedAt: now,
  };
  await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements").insertOne(announcement);
  const recipientsForPush = audience === "all" ? people.map(item => item.id) : recipientIds;
  const delivery = body?.sendPush === true
    ? await sendPush(recipientsForPush, null, { title: title.slice(0, 80), body: message.slice(0, 240), url: "/" })
    : null;
  return NextResponse.json({ announcement, delivery });
}
