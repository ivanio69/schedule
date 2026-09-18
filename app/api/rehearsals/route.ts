import { NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal, filterRehearsalsForPerson, getDatabase, getPeople, getRehearsals, updateRehearsal } from "@/lib/database";
import { getChangedRehearsalAudienceNames, getRehearsalAudienceNames, getRehearsalBounds } from "@/lib/rehearsals";
import { sendPush } from "@/lib/push";
import type { Rehearsal, RehearsalBlock, RehearsalParticipantMode } from "@/lib/schedule";

function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function cleanText(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function cleanNotes(value: unknown) { return cleanText(value, 2000); }

async function normalizeParticipantNames(values: unknown, allowEmpty = true) {
  if (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== "string")) return null;
  const people = await getPeople(true);
  const allowed = new Set(people.map(person => person.name));
  const names = [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
  if (!allowEmpty && names.length === 0) return null;
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
    const notes = cleanNotes(raw.notes);
    if (!id || !title || !validTime(raw.timeStart) || !validTime(raw.timeEnd) || String(raw.timeStart) >= String(raw.timeEnd)) return null;
    const participants = await normalizeParticipantNames(raw.participants);
    if (!participants) return null;
    blocks.push({ id, title, timeStart: String(raw.timeStart), timeEnd: String(raw.timeEnd), notes, participants });
  }
  return blocks;
}

async function normalizeInput(body: unknown, creatorId: string) {
  if (!body || typeof body !== "object") return null;
  const raw = body as Partial<Rehearsal>;
  const subject = cleanText(raw.subject, 120);
  const responsible = cleanText(raw.responsible, 120);
  const notes = cleanNotes(raw.notes);
  if (!subject || !responsible || !validDate(raw.date)) return null;

  const creator = (await getPeople(true)).find(person => person.id === creatorId);
  if (!creator) return null;

  const participantMode: RehearsalParticipantMode = raw.participantMode === "blocks" ? "blocks" : "rehearsal";
  const hasSchedule = Array.isArray(raw.blocks) && raw.blocks.length > 0;
  const normalizedBlocks = hasSchedule ? await normalizeBlocks(raw.blocks) : [];
  if (hasSchedule && !normalizedBlocks) return null;
  if (participantMode === "blocks" && !normalizedBlocks?.length) return null;

  const normalizedParticipants = participantMode === "rehearsal" ? await normalizeParticipantNames(raw.participants) : [];
  if (participantMode === "rehearsal" && !normalizedParticipants) return null;

  const participants = participantMode === "rehearsal"
    ? [...new Set([creator.name, ...(normalizedParticipants ?? [])])]
    : [];
  const blocks = (normalizedBlocks ?? []).map(block => ({
    ...block,
    participants: participantMode === "blocks"
      ? [...new Set([creator.name, ...block.participants])]
      : [],
  }));

  let timeStart = String(raw.timeStart ?? "");
  let timeEnd = String(raw.timeEnd ?? "");
  if (blocks.length) {
    const bounds = getRehearsalBounds(blocks);
    timeStart = bounds.timeStart;
    timeEnd = bounds.timeEnd;
  } else if (!validTime(raw.timeStart) || !validTime(raw.timeEnd) || timeStart >= timeEnd) {
    return null;
  }

  return {
    creatorId,
    subject,
    date: String(raw.date),
    timeStart,
    timeEnd,
    responsible,
    participants,
    participantMode,
    blocks,
    notes,
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
    console.error("Failed to notify rehearsal participants", error);
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get("date");
    const id = url.searchParams.get("id");
    const personId = url.searchParams.get("personId");
    const db = await getDatabase();

    if (id) {
      const rehearsal = await db.collection<Rehearsal>("rehearsals").findOne({ id });
      if (!rehearsal) return NextResponse.json({ error: "Репетиция не найдена" }, { status: 404 });
      const visible = await filterRehearsalsForPerson([rehearsal], personId);
      if (!visible.length) return NextResponse.json({ error: "Репетиция не найдена" }, { status: 404 });
      const people = await getPeople();
      const creatorName = people.find(person => person.id === rehearsal.creatorId)?.name;
      return NextResponse.json({ rehearsal: { ...rehearsal, creatorName: rehearsal.creatorName ?? creatorName } }, { headers: { "Cache-Control": "no-store" } });
    }

    if (date) {
      if (!validDate(date)) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
      return NextResponse.json({ rehearsals: await filterRehearsalsForPerson(await getRehearsals(date), personId) }, { headers: { "Cache-Control": "no-store" } });
    }

    const rehearsals = await db.collection<Rehearsal>("rehearsals").find({}).sort({ date: 1, timeStart: 1 }).toArray();
    const people = await getPeople();
    const names = new Map(people.map(person => [person.id, person.name]));
    const hydrated = rehearsals.map(item => ({ ...item, creatorName: item.creatorName ?? names.get(item.creatorId) }));
    return NextResponse.json({ rehearsals: await filterRehearsalsForPerson(hydrated, personId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load rehearsals", error);
    return NextResponse.json({ error: "Не удалось загрузить репетиции" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";
    if (!creatorId || creatorId.length > 128) return NextResponse.json({ error: "Сначала выберите свой профиль" }, { status: 400 });
    const creator = (await getPeople(true)).find(person => person.id === creatorId);
    if (!creator) return NextResponse.json({ error: "Профиль не найден" }, { status: 400 });
    const input = await normalizeInput(body, creatorId);
    if (!input) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });
    const rehearsal = await createRehearsal(input);
    await notifyNames(getRehearsalAudienceNames(rehearsal), "Новая репетиция", rehearsal);
    return NextResponse.json({ rehearsal: { ...rehearsal, creatorName: creator.name } }, { status: 201 });
  } catch (error) {
    console.error("Failed to create rehearsal", error);
    return NextResponse.json({ error: "Не удалось создать репетицию" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    const creatorId = typeof body?.creatorId === "string" ? body.creatorId : "";
    if (!id || !creatorId) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });

    const db = await getDatabase();
    const before = await db.collection<Rehearsal>("rehearsals").findOne({ id, creatorId, isGlobal: { $ne: true } });
    if (!before) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });

    const input = await normalizeInput(body, creatorId);
    if (!input) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });
    const updated = await updateRehearsal(id, creatorId, input);
    if (!updated) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });

    const people = await getPeople();
    const creatorName = people.find(person => person.id === creatorId)?.name;
    const rehearsal = { ...updated, creatorName };
    await notifyNames(getChangedRehearsalAudienceNames(before, rehearsal), "Репетиция изменена", rehearsal);
    return NextResponse.json({ rehearsal });
  } catch (error) {
    console.error("Failed to update rehearsal", error);
    return NextResponse.json({ error: "Не удалось изменить репетицию" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const creatorId = url.searchParams.get("creatorId");
    if (!id || !creatorId) return NextResponse.json({ error: "Не хватает данных" }, { status: 400 });
    const db = await getDatabase();
    const rehearsal = await db.collection<Rehearsal>("rehearsals").findOne({ id, creatorId, isGlobal: { $ne: true } });
    if (!rehearsal) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });
    const deleted = await deleteRehearsal(id, creatorId);
    if (!deleted) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });
    await notifyNames(getRehearsalAudienceNames(rehearsal), "Репетиция отменена", rehearsal);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete rehearsal", error);
    return NextResponse.json({ error: "Не удалось удалить репетицию" }, { status: 500 });
  }
}
