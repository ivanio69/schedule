import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createIndividualSlot, deleteIndividualSlot, getIndividualSlots, updateIndividualSlot } from "@/lib/database";

const SECRET = process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_PASSWORD;
const COOKIE = "schedule_admin";
function auth(request: NextRequest) { const token = SECRET ? createHmac("sha256", SECRET).update("schedule-admin").digest("hex") : null; return Boolean(token && request.cookies.get(COOKIE)?.value === token); }
function okTime(v: unknown): v is string { return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
function okDate(v: unknown): v is string { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)); }
function valid(body: Record<string, unknown> | null): body is Record<string, unknown> & { subject: string; professor: string; auditorium: string; date: string; timeStart: string; timeEnd: string; note: string } { return Boolean(body && typeof body.subject === "string" && body.subject.trim() && typeof body.professor === "string" && body.professor.trim() && typeof body.auditorium === "string" && okDate(body.date) && okTime(body.timeStart) && okTime(body.timeEnd) && body.timeStart < body.timeEnd && typeof body.note === "string"); }

export async function GET(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  return NextResponse.json({ slots: await getIndividualSlots(from ?? undefined, to ?? undefined) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!valid(body)) return NextResponse.json({ error: "Проверь дату, время и поля слота" }, { status: 400 });
  const slot = await createIndividualSlot({ subject: body.subject.trim(), professor: body.professor.trim(), auditorium: body.auditorium.trim(), date: body.date, timeStart: body.timeStart, timeEnd: body.timeEnd, note: body.note.trim() });
  return NextResponse.json({ slot }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!valid(body) || typeof body.id !== "string") return NextResponse.json({ error: "Проверь данные слота" }, { status: 400 });
  const slot = await updateIndividualSlot(body.id, { subject: body.subject.trim(), professor: body.professor.trim(), auditorium: body.auditorium.trim(), date: body.date, timeStart: body.timeStart, timeEnd: body.timeEnd, note: body.note.trim() });
  if (!slot) return NextResponse.json({ error: "Слот не найден" }, { status: 404 });
  return NextResponse.json({ slot });
}

export async function DELETE(request: NextRequest) {
  if (!auth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Не указан слот" }, { status: 400 });
  await deleteIndividualSlot(id);
  return NextResponse.json({ ok: true });
}
