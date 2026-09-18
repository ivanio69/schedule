import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal, getDatabase, getPeople, getRehearsals, updateRehearsal } from "@/lib/database";
import { getChangedRehearsalAudienceNames, getRehearsalAudienceNames, getRehearsalBounds } from "@/lib/rehearsals";
import { sendPush } from "@/lib/push";
import type { Rehearsal, RehearsalBlock, RehearsalParticipantMode } from "@/lib/schedule";

function authenticated(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update("schedule-admin").digest("hex");
  const actual = request.cookies.get("schedule_admin")?.value ?? "";
  return /^[a-f0-9]{64}$/.test(actual) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
const unauthorized = () => NextResponse.json({ error: "Войди в панель администратора" }, { status: 401 });
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const validTime = (value: unknown) => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const cleanText = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function normalizeNames(values: unknown, fallbackAll = false) {
  const people = await getPeople(true);
  if (values === undefined && fallbackAll) return people.map(person => person.name);
  if (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== "string")) return null;
  const allowed = new Set(people.map(person => person.name));
  const names = [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
  if (names.some(name => !allowed.has(name))) return null;
  return names;
}

async function normalizeBlocks(values: unknown): Promise<RehearsalBlock[] | null> {
  if (!Array.isArray(values) || values.length < 1 || values.length > 40) return null;
  const blocks: RehearsalBlock[] = [];
  for (const value of values) {
    if (!value || typeof value !== "object") return null;
    const raw = value as Partial<RehearsalBlock>;
    const id = cleanText(raw.id, 128);
    const title = cleanText(raw.title, 120);
    if (!id || !title || !validTime(raw.timeStart) || !validTime(raw.timeEnd) || String(raw.timeStart) >= String(raw.timeEnd)) return null;
    const participants = await normalizeNames(raw.participants);
    if (!participants) return null;
    blocks.push({
      id,
      title,
      timeStart: String(raw.timeStart),
      timeEnd: String(raw.timeEnd),
      notes: cleanText(raw.notes, 2000),
      participants,
    });
  }
  return blocks;
}

async function normalizeInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const raw = body as Partial<Rehearsal>;
  const subject = cleanText(raw.subject, 120);
  const responsible = cleanText(raw.responsible, 120);
  const notes = cleanText(raw.notes, 2000);
  if (!subject || !responsible || !validDate(raw.date)) return null;
  const participantMode: RehearsalParticipantMode = raw.participantMode === "blocks" ? "blocks" : "rehearsal";

  if (participantMode === "blocks") {
    const blocks = await normalizeBlocks(raw.blocks);
    if (!blocks) return null;
    const bounds = getRehearsalBounds(blocks);
    return {
      creatorId: "admin",
      subject,
      date: String(raw.date),
      timeStart: bounds.timeStart,
      timeEnd: bounds.timeEnd,
      responsible,
      participants: [] as string[],
      participantMode,
      blocks,
      notes,
      isGlobal: true,
    };
  }

  if (!validTime(raw.timeStart) || !validTime(raw.timeEnd) || String(raw.timeStart) >= String(raw.timeEnd)) return null;
  const participants = await normalizeNames(raw.participants, true);
  if (!participants) return null;
  return {
    creatorId: "admin",
    subject,
    date: String(raw.date),
    timeStart: String(raw.timeStart),
    timeEnd: String(raw.timeEnd),
    responsible,
    participants,
    participantMode,
    blocks: [] as RehearsalBlock[],
    notes,
    isGlobal: true,
  };
}

async function notifyNames(names: string[], title: string, rehearsal: Rehearsal) {
  if (!names.length) return;
  try {
    const people = await getPeople();
    const ids = new Map(people.map(person => [person.name, person.id]));
    const participantIds = [...new Set(names.map(name => ids.get(name)).filter((value): value is string => Boolean(value)))];
    if (!participantIds.length) return;
    const blockText = rehearsal.blocks?.length ? ` · ${rehearsal.blocks.length} блоков` : "";
    await sendPush(participantIds, null, {
      title,
      body: `${rehearsal.subject} · ${rehearsal.date} · ${rehearsal.timeStart}–${rehearsal.timeEnd}${blockText}`,
      url: "/schedule",
    });
  } catch (error) {
    console.error("Failed to notify global rehearsal participants", error);
  }
}

export async function GET(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  const date = request.nextUrl.searchParams.get("date");
  if (id) {
    const rehearsal = await (await getDatabase()).collection<Rehearsal>("rehearsals").findOne({ id, isGlobal: true });
    return rehearsal
      ? NextResponse.json({ rehearsal: { ...rehearsal, creatorName: "Администратор" } }, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
  }
  if (!date || !validDate(date)) return NextResponse.json({ error: "Укажи дату" }, { status: 400 });
  return NextResponse.json({ rehearsals: (await getRehearsals(date)).filter(item => item.isGlobal) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  const input = await normalizeInput(body);
  if (!input) return NextResponse.json({ error: "Проверь данные репетиции" }, { status: 400 });
  const rehearsal = await createRehearsal(input);
  await notifyNames(getRehearsalAudienceNames(rehearsal), "Новая общая репетиция", rehearsal);
  return NextResponse.json({ rehearsal: { ...rehearsal, creatorName: "Администратор" } }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Не указана репетиция" }, { status: 400 });
  const db = await getDatabase();
  const before = await db.collection<Rehearsal>("rehearsals").findOne({ id, creatorId: "admin", isGlobal: true });
  if (!before) return NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
  const input = await normalizeInput(body);
  if (!input) return NextResponse.json({ error: "Проверь данные репетиции" }, { status: 400 });
  const updated = await updateRehearsal(id, "admin", input);
  if (!updated) return NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
  const rehearsal = { ...updated, creatorName: "Администратор" };
  await notifyNames(getChangedRehearsalAudienceNames(before, rehearsal), "Общая репетиция изменена", rehearsal);
  return NextResponse.json({ rehearsal });
}

export async function DELETE(request: NextRequest) {
  if (!authenticated(request)) return unauthorized();
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указана репетиция" }, { status: 400 });
  const db = await getDatabase();
  const rehearsal = await db.collection<Rehearsal>("rehearsals").findOne({ id, creatorId: "admin", isGlobal: true });
  if (!rehearsal) return NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
  const deleted = await deleteRehearsal(id, "admin");
  if (!deleted) return NextResponse.json({ error: "Общая репетиция не найдена" }, { status: 404 });
  await notifyNames(getRehearsalAudienceNames(rehearsal), "Репетиция отменена", rehearsal);
  return NextResponse.json({ ok: true });
}
