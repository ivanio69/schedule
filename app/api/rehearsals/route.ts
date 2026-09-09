import { NextResponse } from "next/server";
import { createRehearsal, deleteRehearsal, getDatabase, getPeople, getRehearsals, updateRehearsal } from "@/lib/database";
import type { Rehearsal } from "@/lib/schedule";

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
async function validateParticipants(participants: string[]) {
  const people = await getPeople(true);
  const allowed = new Set(people.map((p) => p.name));
  if (participants.some((p) => !allowed.has(p.trim()))) return null;
  return participants.map((p) => p.trim());
}

export async function GET(request: Request) {
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date) {
      if (!validDate(date)) return NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
      return NextResponse.json({ rehearsals: await getRehearsals(date) }, { headers: { "Cache-Control": "no-store" } });
    }
    const db = await getDatabase();
    const rehearsals = await db.collection<Rehearsal>("rehearsals").find({}).sort({ date: 1, timeStart: 1 }).toArray();
    const people = await getPeople();
    const names = new Map(people.map((person) => [person.id, person.name]));
    return NextResponse.json({ rehearsals: rehearsals.map((item) => ({ ...item, creatorName: item.creatorName ?? names.get(item.creatorId) })) }, { headers: { "Cache-Control": "no-store" } });
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
    const participants = await validateParticipants(body.participants);
    if (!participants) return NextResponse.json({ error: "Участники должны выбираться из списка группы" }, { status: 400 });
    const rehearsal = await createRehearsal({ ...body, subject: body.subject.trim(), responsible: body.responsible.trim(), participants });
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
    const participants = await validateParticipants(body.participants);
    if (!participants) return NextResponse.json({ error: "Участники должны выбираться из списка группы" }, { status: 400 });
    const updated = await updateRehearsal(id, creatorId, { subject: body.subject.trim(), date: body.date, timeStart: body.timeStart, timeEnd: body.timeEnd, responsible: body.responsible.trim(), participants });
    if (!updated) return NextResponse.json({ error: "Репетиция не найдена или вы не её автор" }, { status: 404 });
    const people = await getPeople();
    const creatorName = people.find((person) => person.id === creatorId)?.name;
    return NextResponse.json({ rehearsal: { ...updated, creatorName } });
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