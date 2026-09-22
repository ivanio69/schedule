import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase, getPeople } from "@/lib/database";
import {
  DEFAULT_ANNOUNCEMENT_ACCENT,
  DEFAULT_ANNOUNCEMENT_BACKGROUND,
  normalizeAnnouncementColor,
  type DashboardAnnouncement,
} from "@/lib/announcements";
import { decorateAnnouncementsWithAcknowledgements } from "@/lib/announcement-acknowledgements";
import { sendPush } from "@/lib/push";

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

async function audienceFrom(body: Record<string, unknown>, fallback?: DashboardAnnouncement) {
  const people = await getPeople(true);
  const validIds = new Set(people.map(person => person.id));
  const audienceTouched = body.audience !== undefined || body.recipientIds !== undefined;

  if (fallback && !audienceTouched) {
    const recipientsForPush = fallback.audience === "all"
      ? people.map(person => person.id)
      : fallback.recipientIds.filter(id => validIds.has(id));
    return { audience: fallback.audience, recipientIds: fallback.recipientIds, recipientsForPush };
  }

  const audience = body.audience === "selected" ? "selected" : body.audience === "all" ? "all" : fallback?.audience ?? "all";
  const source = Array.isArray(body.recipientIds) ? body.recipientIds : fallback?.recipientIds ?? [];
  const recipientIds = audience === "selected"
    ? [...new Set(source.filter((id: unknown): id is string => typeof id === "string" && validIds.has(id)))]
    : [];
  if (audience === "selected" && !recipientIds.length) throw new Error("Выбери хотя бы одного человека");
  return { audience, recipientIds, recipientsForPush: audience === "all" ? people.map(person => person.id) : recipientIds };
}

async function maybeSendPush(
  requested: boolean,
  recipients: string[],
  title: string,
  body: string,
) {
  if (!requested) return null;
  try {
    return await sendPush(recipients, null, {
      title: title.slice(0, 80),
      body: body.slice(0, 240),
      url: "/",
    });
  } catch (error) {
    console.error("Failed to send announcement push", error);
    return { subscriptions: 0, sent: 0, failed: 0, error: true };
  }
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const announcements = await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements")
    .find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
  return NextResponse.json({ announcements: await decorateAnnouncementsWithAcknowledgements(announcements) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const title = text(body.title, 120);
    const message = text(body.body, 1200);
    if (!title || !message) return NextResponse.json({ error: "Заполни заголовок и текст" }, { status: 400 });
    const { audience, recipientIds, recipientsForPush } = await audienceFrom(body);
    const now = new Date().toISOString();
    const startsAt = validDate(body.startsAt) ? new Date(body.startsAt as string).toISOString() : now;
    const endsAt = body.endsAt && validDate(body.endsAt) ? new Date(body.endsAt as string).toISOString() : null;
    if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return NextResponse.json({ error: "Окончание должно быть позже начала" }, { status: 400 });
    const accentColor = normalizeAnnouncementColor(body.accentColor, DEFAULT_ANNOUNCEMENT_ACCENT);
    const backgroundColor = normalizeAnnouncementColor(body.backgroundColor, DEFAULT_ANNOUNCEMENT_BACKGROUND);
    const item: DashboardAnnouncement = {
      id: randomUUID(), title, body: message, audience, recipientIds, active: true,
      startsAt, endsAt, accentColor, backgroundColor, requiresAcknowledgement: body.requiresAcknowledgement === true, createdAt: now, updatedAt: now
    };
    await (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements").insertOne(item);
    const push = await maybeSendPush(body.sendPush === true, recipientsForPush, title, message);
    return NextResponse.json({ announcement: (await decorateAnnouncementsWithAcknowledgements([item]))[0], push });
  } catch (error) {
    if (error instanceof Error && error.message === "Выбери хотя бы одного человека") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to create dashboard announcement", error);
    return NextResponse.json({ error: "Не удалось создать объявление" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
    const collection = (await getDatabase()).collection<DashboardAnnouncement>("dashboard_announcements");
    const current = await collection.findOne({ id: body.id }, { projection: { _id: 0 } });
    if (!current) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });

    const title = body.title === undefined ? current.title : text(body.title, 120);
    const message = body.body === undefined ? current.body : text(body.body, 1200);
    if (!title || !message) return NextResponse.json({ error: "Заполни заголовок и текст" }, { status: 400 });

    const { audience, recipientIds, recipientsForPush } = await audienceFrom(body, current);
    let endsAt = current.endsAt;
    if (body.endsAt === null || body.endsAt === "") endsAt = null;
    else if (body.endsAt !== undefined) {
      if (!validDate(body.endsAt)) return NextResponse.json({ error: "Некорректная дата окончания" }, { status: 400 });
      endsAt = new Date(body.endsAt as string).toISOString();
    }
    if (endsAt && Date.parse(endsAt) <= Date.parse(current.startsAt)) {
      return NextResponse.json({ error: "Окончание должно быть позже начала" }, { status: 400 });
    }

    const accentColor = body.accentColor === undefined
      ? current.accentColor ?? DEFAULT_ANNOUNCEMENT_ACCENT
      : normalizeAnnouncementColor(body.accentColor, DEFAULT_ANNOUNCEMENT_ACCENT);
    const backgroundColor = body.backgroundColor === undefined
      ? current.backgroundColor ?? DEFAULT_ANNOUNCEMENT_BACKGROUND
      : normalizeAnnouncementColor(body.backgroundColor, DEFAULT_ANNOUNCEMENT_BACKGROUND);
    const active = typeof body.active === "boolean" ? body.active : current.active;
    const requiresAcknowledgement = typeof body.requiresAcknowledgement === "boolean" ? body.requiresAcknowledgement : current.requiresAcknowledgement === true;
    const updatedAt = new Date().toISOString();

    const result = await collection.findOneAndUpdate(
      { id: body.id },
      { $set: { title, body: message, audience, recipientIds, active, endsAt, accentColor, backgroundColor, requiresAcknowledgement, updatedAt } },
      { returnDocument: "after", projection: { _id: 0 } }
    );
    if (!result) return NextResponse.json({ error: "Объявление не найдено" }, { status: 404 });

    const push = await maybeSendPush(body.sendPush === true, recipientsForPush, title, message);
    return NextResponse.json({ announcement: (await decorateAnnouncementsWithAcknowledgements([result]))[0], push });
  } catch (error) {
    if (error instanceof Error && error.message === "Выбери хотя бы одного человека") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to update dashboard announcement", error);
    return NextResponse.json({ error: "Не удалось сохранить объявление" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан ID" }, { status: 400 });
  const db = await getDatabase();
  await Promise.all([
    db.collection<DashboardAnnouncement>("dashboard_announcements").deleteOne({ id }),
    db.collection("announcement_acknowledgements").deleteMany({ announcementId: id }),
  ]);
  return NextResponse.json({ ok: true });
}
