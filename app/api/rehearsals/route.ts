import { NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal, filterRehearsalsForPerson, getDatabase, getPeople, getRehearsals, updateRehearsal } from "@/lib/database";
import type { Rehearsal } from "@/lib/schedule";
import { sendPush } from "@/lib/push";

function validTime(value: unknown) { return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function validDate(value: unknown) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }
function validPayload(value: unknown): value is Omit<Rehearsal, "id" | "createdAt" | "creatorName"> {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<Rehearsal>;
  return typeof input.creatorId === "string" && input.creatorId.length >= 8 && input.creatorId.length <= 128 && typeof input.subject === "string" && input.subject.trim().length >= 1 && input.subject.trim().length <= 120 && validDate(input.date) && validTime(input.timeStart) && validTime(input.timeEnd) && typeof input.responsible === "string" && input.responsible.trim().length >= 1 && input.responsible.trim().length <= 120 && Array.isArray(input.participants) && input.participants.length <= 100 && input.participants.every((p) => typeof p === "string" && p.trim().length > 0 && p.trim().length <= 120);
}
function validEditPayload(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<Rehearsal>;
  return typeof input.subject === "string" && input.subject.trim().length >= 1 && input.subject.trim().length <= 120 && validDate(input.date) && validTime(input.timeStart) && validTime(input.timeEnd) && typeof input.responsible === "string" && input.responsible.trim().length >= 1 && input.responsible.trim().length <= 120 && Array.isArray(input.participants) && input.participants.length <= 100 && input.participants.every((p) => typeof p === "string" && p.trim().length > 0 && p.trim().length <= 120);
}
async function resolveParticipants(participants: string[]) {
  const people = await getPeople(true);
  const byName = new Map(people.map((person) => [person.name, person]));
  const normalized = [...new Set(participants.map((participant) => participant.trim()).filter(Boolean))];
  if (normalized.some((participant) => !byName.has(participant))) return null;
  return { participants: normalized, participantIds: normalized.map((participant) => byName.get(participant)!.id) };
}

async function notifyParticipants(participantIds: string[], title: string, rehearsal: Rehearsal) {
  if (!participantIds.length) return;
  try {
    await sendPush(participantIds, null, {
      title,
      body: `${rehearsal.subject} · ${rehearsal.date} · ${rehearsal.timeStart}–${rehearsal.timeEnd}`,
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
    const personId = url.searchParams.get("personId");
    if (date) {
      if (!validDate(date)) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
      return NextResponse.json({ rehearsals: await filterRehearsalsForPerson(await getRehearsals(date), personId) }, { headers: { "Cache-Control": "no-store" } });
    }
    const db = await getDatabase();
    const rehearsals = await db.collection<Rehearsal>("rehearsals").find({}).sort({ date: 1, timeStart: 1 }).toArray();
    const people = await getPeople();
    const names = new Map(people.map((person) => [person.id, person.name]));
    const hydrated = rehearsals.map((item) => ({ ...item, creatorName: item.creatorName ?? names.get(item.creatorId) }));
    return NextResponse.json({ rehearsals: await filterRehearsalsForPerson(hydrated, personId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to load rehearsals", error);
    return NextResponse.json({ error: "Не удалось загрузить репетиции" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!validPayload(body)) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });
    if (body.timeStart >= body.timeEnd) return NextResponse.json({ error: "Время окончания должно быть позже начала" }, { status: 400 });
    const resolved = await resolveParticipants(body.participants);
    if (!resolved) return NextResponse.json({ error: "Участники должны выбираться из списка группы" }, { status: 400 });
    const rehearsal = await createRehearsal({ ...body, subject: body.subject.trim(), responsible: body.responsible.trim(), participants: resolved.participants });
    await notifyParticipants(resolved.participantIds, "Новая репетиция", rehearsal);
    return NextResponse.json({ rehearsal }, { status: 201 });
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
    if (!id || !creatorId || !validEditPayload(body)) return NextResponse.json({ error: "Проверьте данные репетиции" }, { status: 400 });
    if (body.timeStart >= body.timeEnd) return NextResponse.json({ error: "Время окончания должно быть позже начала" }, { status: 400 });
    const resolved = await resolveParticipants(body.participants);
    if (!resolved) return NextResponse.json({ error: "Участники должны выбираться из списка группы" }, { status: 400 });
    const updated = await updateRehearsal(id, creatorId, { subject: body.subject.trim(), date: body.date, timeStart: body.timeStart, timeEnd: body.timeEnd, responsible: body.responsible.trim(), participants: resolved.participants });
    if (!updated) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });
    const people = await getPeople();
    const creatorName = people.find((person) => person.id === creatorId)?.name;
    const rehearsal = { ...updated, creatorName };
    await notifyParticipants(resolved.participantIds, "Репетиция изменена", rehearsal);
    return NextResponse.json({ rehearsal });
  } catch (error) {
    console.error("Failed to update rehearsal", error);
    return NextResponse.json({ error: "Не удалось изменить репетицию" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url), id = url.searchParams.get("id"), creatorId = url.searchParams.get("creatorId");
    if (!id || !creatorId) return NextResponse.json({ error: "Не хватает данных" }, { status: 400 });
    const deleted = await deleteRehearsal(id, creatorId);
    return deleted ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });
  } catch (error) {
    console.error("Failed to delete rehearsal", error);
    return NextResponse.json({ error: "Не удалось удалить репетицию" }, { status: 500 });
  }
}